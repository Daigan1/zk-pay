// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./IFundsRouter.sol";
import "./CreditVault.sol";
import "./MockUSDC.sol";
import "./PayrollRegistry.sol";
import "./WageToken.sol";

/**
 * @title WageVault
 * @notice Core protocol contract for ZK-Pay v3 — wage-backed leverage facility.
 *
 *         v3 economic model:
 *          - Lenders deposit USDC into CreditVault and earn fixed fees.
 *          - Borrowers (employees) draw credit up to MAX_CREDIT_BPS of salary.
 *          - A fixed leverage fee is charged: fee = amount * feeBps / 10_000.
 *          - Borrowers keep all strategy upside, absorb all downside.
 *          - On settlement, repayment (principal + fee) goes to CreditVault.
 *          - Lenders are protected from borrower trading losses.
 *
 *         Architecture:
 *          - CreditVault provides USDC liquidity (replaces admin treasury).
 *          - IFundsRouter holds multi-asset positions (USDC, MON, WETH).
 *          - WageToken (wUSDC) is minted 1:1 with credit as a claim token.
 *
 *         Adapter-compatible (Phase 3): employee-facing functions accept an
 *         explicit `employee` parameter for Unlink privacy integration.
 */
contract WageVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Credit policy
    // -------------------------------------------------------------------------

    uint256 public constant MAX_CREDIT_BPS = 3000; // 30%
    uint256 private constant BPS_DENOMINATOR = 10_000;

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress(string param);
    error ZeroAmount();
    error NotRegistered(address employee);
    error ActiveLoanExists(address employee);
    error ExceedsCreditLimit(uint256 requested, uint256 max);
    error NoActiveLoan(address employee);
    error InvalidAllocation(uint256 sum);
    error NotEmployeeOrAdapter(address caller);
    error InvalidFeeBps(uint256 feeBps);

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    IFundsRouter public immutable router;
    MockUSDC public immutable usdc;
    address public immutable monToken;
    address public immutable wethToken;
    WageToken public immutable wageToken;
    PayrollRegistry public immutable registry;
    CreditVault public immutable creditVault;

    /// @notice Unlink adapter address (primary). address(0) = public mode only.
    address public adapter;

    /// @notice Additional authorized callers (e.g. Unlink pool for adapter-execution flows).
    mapping(address => bool) public authorizedCaller;

    /// @notice Fixed leverage fee in basis points (e.g. 100 = 1%).
    uint256 public feeBps;

    struct LoanRecord {
        uint128 loanedAmount; // principal
        uint128 fixedFee; // fee = loanedAmount * feeBps / 10_000
        uint64 payDate;
        bool active;
        address tokenHolder; // who holds wUSDC: employee (public) or adapter (privacy)
    }

    /// @notice Per-employee allocation preference in basis points (must sum to 10,000).
    struct Allocation {
        uint16 usdcBps;
        uint16 monBps;
        uint16 wethBps;
    }

    /// @notice Per-employee position: actual token amounts held by the router.
    struct Position {
        uint128 usdcAmount;
        uint128 monAmount;
        uint128 wethAmount;
    }

    uint256 public totalOutstanding;

    mapping(address => LoanRecord) private _loans;
    mapping(address => Allocation) private _allocations;
    mapping(address => Position) private _positions;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event CreditRequested(address indexed employee, uint256 principal, uint256 fee);
    event AllocationSet(address indexed employee, uint16 usdcBps, uint16 monBps, uint16 wethBps);
    event PaymentSettled(address indexed employee, uint256 principal, uint256 fee);
    event LoanClawedBack(address indexed employee, uint256 principal);
    event LoanForfeited(address indexed employee, uint256 principal);
    event AdapterSet(address indexed adapter);
    event CallerAuthorized(address indexed caller, bool authorized);
    event FeeBpsSet(uint256 feeBps);

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier employeeOrAdapter(address employee) {
        if (msg.sender != employee && msg.sender != adapter && !authorizedCaller[msg.sender]) {
            revert NotEmployeeOrAdapter(msg.sender);
        }
        _;
    }

    modifier onlyOwnerOrAuthorized() {
        if (msg.sender != owner() && msg.sender != adapter && !authorizedCaller[msg.sender]) {
            revert NotEmployeeOrAdapter(msg.sender);
        }
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(
        address router_,
        address usdc_,
        address wageToken_,
        address registry_,
        address monToken_,
        address wethToken_,
        address creditVault_,
        uint256 feeBps_,
        address admin
    ) Ownable(admin) {
        if (router_ == address(0)) revert ZeroAddress("router");
        if (usdc_ == address(0)) revert ZeroAddress("usdc");
        if (wageToken_ == address(0)) revert ZeroAddress("wageToken");
        if (registry_ == address(0)) revert ZeroAddress("registry");
        if (monToken_ == address(0)) revert ZeroAddress("monToken");
        if (wethToken_ == address(0)) revert ZeroAddress("wethToken");
        if (creditVault_ == address(0)) revert ZeroAddress("creditVault");
        if (feeBps_ > BPS_DENOMINATOR) revert InvalidFeeBps(feeBps_);

        router = IFundsRouter(router_);
        usdc = MockUSDC(usdc_);
        wageToken = WageToken(wageToken_);
        registry = PayrollRegistry(registry_);
        monToken = monToken_;
        wethToken = wethToken_;
        creditVault = CreditVault(creditVault_);
        feeBps = feeBps_;
    }

    // -------------------------------------------------------------------------
    // Admin configuration
    // -------------------------------------------------------------------------

    /// @notice Set the Unlink adapter address. address(0) disables adapter mode.
    function setAdapter(address adapter_) external onlyOwner {
        if (adapter_ == address(0) && totalOutstanding > 0) {
            revert ZeroAddress("adapter (loans outstanding)");
        }
        adapter = adapter_;
        emit AdapterSet(adapter_);
    }

    /// @notice Authorize or deauthorize an additional caller (e.g. Unlink pool).
    function setAuthorizedCaller(address caller_, bool authorized_) external onlyOwner {
        authorizedCaller[caller_] = authorized_;
        emit CallerAuthorized(caller_, authorized_);
    }

    /// @notice Update the leverage fee (basis points). Only applies to new loans.
    function setFeeBps(uint256 feeBps_) external onlyOwner {
        if (feeBps_ > BPS_DENOMINATOR) revert InvalidFeeBps(feeBps_);
        feeBps = feeBps_;
        emit FeeBpsSet(feeBps_);
    }

    // -------------------------------------------------------------------------
    // Employee: request credit
    // -------------------------------------------------------------------------

    /**
     * @notice Request wage-backed credit up to MAX_CREDIT_BPS of salary.
     *
     * USDC is drawn from CreditVault and deposited into the router.
     * A fixed fee is recorded: fee = amount * feeBps / 10_000.
     * On settlement, the borrower owes principal + fee.
     *
     * @param amount   Credit amount in USDC base units (principal)
     * @param employee The employee address (must equal msg.sender or adapter)
     */
    function requestCredit(uint256 amount, address employee) external nonReentrant employeeOrAdapter(employee) {
        if (!registry.isRegistered(employee)) revert NotRegistered(employee);
        if (_loans[employee].active) revert ActiveLoanExists(employee);
        if (amount == 0) revert ZeroAmount();

        uint256 salary = registry.salaryOf(employee);
        uint256 maxCredit = (salary * MAX_CREDIT_BPS) / BPS_DENOMINATOR;
        if (amount > maxCredit) revert ExceedsCreditLimit(amount, maxCredit);

        _issueCredit(employee, msg.sender, amount);
    }

    /**
     * @notice Register with mock payroll data and request max credit in one tx.
     * @param employee The employee address (must equal msg.sender or adapter)
     */
    function registerAndRequestCredit(address employee) external nonReentrant employeeOrAdapter(employee) {
        if (_loans[employee].active) revert ActiveLoanExists(employee);

        registry.mockRegisterFor(employee);

        uint256 salary = registry.salaryOf(employee);
        uint256 maxCredit = (salary * MAX_CREDIT_BPS) / BPS_DENOMINATOR;

        _issueCredit(employee, msg.sender, maxCredit);
    }

    // -------------------------------------------------------------------------
    // Employee: set allocation
    // -------------------------------------------------------------------------

    /**
     * @notice Rebalance the employee's position across USDC, MON, and WETH.
     * @param usdcBps  Percentage in USDC (basis points, e.g. 5000 = 50%)
     * @param monBps   Percentage in MON
     * @param wethBps  Percentage in WETH
     * @param employee The employee address (must equal msg.sender or adapter)
     */
    function setAllocation(uint16 usdcBps, uint16 monBps, uint16 wethBps, address employee)
        external
        nonReentrant
        employeeOrAdapter(employee)
    {
        LoanRecord storage loan = _loans[employee];
        if (!loan.active) revert NoActiveLoan(employee);

        uint256 sum = uint256(usdcBps) + uint256(monBps) + uint256(wethBps);
        if (sum != BPS_DENOMINATOR) revert InvalidAllocation(sum);

        uint256 loanedAmount = loan.loanedAmount;

        Position memory oldPos = _positions[employee];

        uint128 newMon = uint128((loanedAmount * monBps) / BPS_DENOMINATOR);
        uint128 newWeth = uint128((loanedAmount * wethBps) / BPS_DENOMINATOR);
        uint128 newUsdc = uint128(loanedAmount - newMon - newWeth);

        _positions[employee] = Position({ usdcAmount: newUsdc, monAmount: newMon, wethAmount: newWeth });
        _allocations[employee] = Allocation({ usdcBps: usdcBps, monBps: monBps, wethBps: wethBps });

        // Build executeStrategy arrays: burn old positions, mint new ones.
        uint256 inCount;
        if (oldPos.monAmount > 0) inCount++;
        if (oldPos.wethAmount > 0) inCount++;

        uint256 outCount;
        if (newMon > 0) outCount++;
        if (newWeth > 0) outCount++;

        if (inCount > 0 || outCount > 0) {
            address[] memory tokensIn = new address[](inCount);
            uint256[] memory amountsIn = new uint256[](inCount);
            address[] memory tokensOut = new address[](outCount);
            uint256[] memory amountsOut = new uint256[](outCount);

            uint256 idx;
            if (oldPos.monAmount > 0) {
                tokensIn[idx] = monToken;
                amountsIn[idx] = oldPos.monAmount;
                idx++;
            }
            if (oldPos.wethAmount > 0) {
                tokensIn[idx] = wethToken;
                amountsIn[idx] = oldPos.wethAmount;
            }

            idx = 0;
            if (newMon > 0) {
                tokensOut[idx] = monToken;
                amountsOut[idx] = newMon;
                idx++;
            }
            if (newWeth > 0) {
                tokensOut[idx] = wethToken;
                amountsOut[idx] = newWeth;
            }

            router.executeStrategy(tokensIn, amountsIn, tokensOut, amountsOut);
        }

        emit AllocationSet(employee, usdcBps, monBps, wethBps);
    }

    // -------------------------------------------------------------------------
    // Admin: settlement and clawback
    // -------------------------------------------------------------------------

    /**
     * @notice Settle an employee's loan after payday confirmation.
     *
     *         Settlement flow:
     *         1. Liquidate MON/WETH positions back to USDC (via router).
     *         2. Return principal to CreditVault from the router.
     *         3. Mint fee USDC to cover the lending charge.
     *         4. Burn wUSDC and deregister employee.
     */
    function settlePayment(address employee) external onlyOwnerOrAuthorized nonReentrant {
        LoanRecord storage loan = _loans[employee];
        if (!loan.active) revert NoActiveLoan(employee);

        uint256 principal = loan.loanedAmount;
        uint256 fee = loan.fixedFee;
        address holder = loan.tokenHolder;
        Position memory pos = _positions[employee];

        // CEI: clear state before external calls.
        totalOutstanding -= principal;
        delete _loans[employee];
        delete _positions[employee];
        delete _allocations[employee];

        // Burn wUSDC from holder (employee or adapter).
        wageToken.burn(holder, principal);
        registry.removeEmployee(employee);

        // Liquidate MON/WETH positions back to USDC via router.
        _liquidatePositions(pos);

        // Return principal from router to this contract, then to CreditVault.
        router.withdraw(address(usdc), principal, address(this));
        usdc.approve(address(creditVault), principal + fee);

        // Mint fee USDC (mock: simulates employer payroll deduction).
        if (fee > 0) {
            usdc.mint(address(this), fee);
        }

        // Send repayment (principal + fee) to CreditVault.
        creditVault.onRepayment(principal, fee);

        emit PaymentSettled(employee, principal, fee);
    }

    /// @notice Claw back a loan when payroll settlement fails (admin only).
    ///         Returns the principal to CreditVault (no fee charged).
    ///         Positions are liquidated and the USDC is recovered for lenders.
    function clawbackLoan(address employee) external onlyOwnerOrAuthorized nonReentrant {
        address holder = _loans[employee].tokenHolder;
        uint256 principal = _returnLoan(employee, holder);

        // Return principal from router to CreditVault (no fee on clawback).
        router.withdraw(address(usdc), principal, address(this));
        usdc.approve(address(creditVault), principal);
        creditVault.onRepayment(principal, 0);

        emit LoanClawedBack(employee, principal);
    }

    /// @notice Employee voluntarily forfeits their loan (early exit).
    ///         Principal is returned to CreditVault (no fee charged).
    /// @param employee The employee address (must equal msg.sender or adapter)
    function forfeitLoan(address employee) external nonReentrant employeeOrAdapter(employee) {
        address holder = _loans[employee].tokenHolder;
        uint256 principal = _returnLoan(employee, holder);

        // Return principal from router to CreditVault.
        router.withdraw(address(usdc), principal, address(this));
        usdc.approve(address(creditVault), principal);
        creditVault.onRepayment(principal, 0);

        emit LoanForfeited(employee, principal);
    }

    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------

    function getLoan(address employee) external view returns (LoanRecord memory) {
        return _loans[employee];
    }

    function getAllocation(address employee) external view returns (Allocation memory) {
        return _allocations[employee];
    }

    function getPosition(address employee) external view returns (Position memory) {
        return _positions[employee];
    }

    function maxCreditFor(address employee) external view returns (uint256) {
        uint256 salary = registry.salaryOf(employee);
        return (salary * MAX_CREDIT_BPS) / BPS_DENOMINATOR;
    }

    /// @notice Compute the fee for a given credit amount at current feeBps.
    function computeFee(uint256 amount) external view returns (uint256) {
        return (amount * feeBps) / BPS_DENOMINATOR;
    }

    /// @notice Compute the total repayment (principal + fee) for a given credit amount.
    function computeRepayment(uint256 amount) external view returns (uint256) {
        return amount + (amount * feeBps) / BPS_DENOMINATOR;
    }

    /// @notice Available USDC in the CreditVault for new loans.
    function availableLiquidity() external view returns (uint256) {
        return creditVault.availableLiquidity();
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /// @dev Issue credit: draw USDC from CreditVault → router, create loan, mint wUSDC.
    function _issueCredit(address employee, address tokenRecipient, uint256 amount) private {
        uint64 payDate = uint64(registry.nextPayDateOf(employee));
        uint128 fee = uint128((amount * feeBps) / BPS_DENOMINATOR);

        // Draw USDC from CreditVault to this contract.
        creditVault.drawFunds(amount);

        // Deposit USDC into the router for position management.
        usdc.approve(address(router), amount);
        router.deposit(address(usdc), amount, address(this));

        _loans[employee] = LoanRecord({
            loanedAmount: uint128(amount), fixedFee: fee, payDate: payDate, active: true, tokenHolder: tokenRecipient
        });
        totalOutstanding += amount;

        _positions[employee] = Position({ usdcAmount: uint128(amount), monAmount: 0, wethAmount: 0 });
        _allocations[employee] = Allocation({ usdcBps: 10_000, monBps: 0, wethBps: 0 });

        wageToken.mint(tokenRecipient, amount);
        emit CreditRequested(employee, amount, fee);
    }

    /// @dev Liquidate MON/WETH positions back to USDC via router.
    ///      Burns mock MON/WETH. The USDC principal stays in the router.
    function _liquidatePositions(Position memory pos) private {
        uint256 inCount;
        if (pos.monAmount > 0) inCount++;
        if (pos.wethAmount > 0) inCount++;

        if (inCount > 0) {
            address[] memory tokensIn = new address[](inCount);
            uint256[] memory amountsIn = new uint256[](inCount);
            address[] memory tokensOut = new address[](0);
            uint256[] memory amountsOut = new uint256[](0);

            uint256 idx;
            if (pos.monAmount > 0) {
                tokensIn[idx] = monToken;
                amountsIn[idx] = pos.monAmount;
                idx++;
            }
            if (pos.wethAmount > 0) {
                tokensIn[idx] = wethToken;
                amountsIn[idx] = pos.wethAmount;
            }

            router.executeStrategy(tokensIn, amountsIn, tokensOut, amountsOut);
        }
    }

    /// @dev Return a loan: clear state, burn MON/WETH, burn wUSDC, deregister.
    ///      Does NOT return USDC to CreditVault — caller must handle that.
    function _returnLoan(address employee, address tokenSource) private returns (uint256 loanedAmount) {
        LoanRecord storage loan = _loans[employee];
        if (!loan.active) revert NoActiveLoan(employee);

        loanedAmount = loan.loanedAmount;
        Position memory pos = _positions[employee];

        totalOutstanding -= loanedAmount;
        delete _loans[employee];
        delete _positions[employee];
        delete _allocations[employee];

        _liquidatePositions(pos);

        wageToken.burn(tokenSource, loanedAmount);
        registry.removeEmployee(employee);
    }
}
