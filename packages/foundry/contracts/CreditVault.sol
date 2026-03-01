// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CreditVault
 * @notice Lender-facing vault for ZK-Pay's wage-backed leverage facility.
 *
 *         Lenders deposit USDC and receive vault shares. The WageVault draws
 *         USDC from this vault when issuing credit. On settlement, the WageVault
 *         returns principal + fixed fee. Fees grow the vault's total assets,
 *         increasing the share price for lenders.
 *
 *         Share price: totalAssets / totalSupply
 *         totalAssets = USDC balance + totalLentOut
 *
 *         Lender returns are deterministic (fixed fee per borrowing period).
 *         Lenders are NOT exposed to borrower strategy risk.
 *         Lenders ARE exposed to smart contract risk and payroll oracle risk.
 */
contract CreditVault is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;

    /// @notice The WageVault contract authorized to draw and repay funds.
    address public vault;

    /// @notice USDC principal currently lent out to borrowers via WageVault.
    uint256 public totalLentOut;

    /// @notice Cumulative fees collected since deployment.
    uint256 public totalFeesCollected;

    // Errors
    error NotVault(address caller);
    error VaultAlreadySet();
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientLiquidity(uint256 requested, uint256 available);
    error InsufficientShares(uint256 requested, uint256 available);

    // Events
    event Deposited(address indexed lender, uint256 assets, uint256 shares);
    event Withdrawn(address indexed lender, uint256 assets, uint256 shares);
    event FundsDrawn(uint256 amount);
    event RepaymentReceived(uint256 principal, uint256 fee);
    event DefaultRecorded(uint256 principal);

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault(msg.sender);
        _;
    }

    constructor(address usdc_, address admin) ERC20("ZK-Pay Credit Share", "zkCRED") Ownable(admin) {
        if (usdc_ == address(0)) revert ZeroAddress();
        usdc = IERC20(usdc_);
    }

    /// @notice One-time vault initialization (called by deploy script).
    function setVault(address vault_) external onlyOwner {
        if (vault != address(0)) revert VaultAlreadySet();
        if (vault_ == address(0)) revert ZeroAddress();
        vault = vault_;
    }

    // -------------------------------------------------------------------------
    // Lender functions
    // -------------------------------------------------------------------------

    /// @notice Deposit USDC and receive vault shares (shares go to caller).
    function deposit(uint256 assets) external nonReentrant returns (uint256 shares) {
        return _deposit(assets, msg.sender);
    }

    /// @notice Deposit USDC on behalf of `recipient` (for privacy-mode support).
    ///         USDC is pulled from msg.sender; shares are minted to `recipient`.
    function depositTo(uint256 assets, address recipient) external nonReentrant returns (uint256 shares) {
        if (recipient == address(0)) revert ZeroAddress();
        return _deposit(assets, recipient);
    }

    /// @notice Burn caller's vault shares and receive USDC.
    function withdraw(uint256 shares) external nonReentrant returns (uint256 assets) {
        return _withdraw(shares, msg.sender);
    }

    /// @notice Burn `owner`'s vault shares and send USDC to caller (for privacy-mode support).
    ///         Caller must have ERC-20 allowance on `owner`'s shares.
    function withdrawFrom(uint256 shares, address owner) external nonReentrant returns (uint256 assets) {
        if (owner == address(0)) revert ZeroAddress();
        return _withdraw(shares, owner);
    }

    function _deposit(uint256 assets, address recipient) internal returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        shares = _convertToShares(assets);
        usdc.safeTransferFrom(msg.sender, address(this), assets);
        _mint(recipient, shares);
        emit Deposited(recipient, assets, shares);
    }

    function _withdraw(uint256 shares, address owner) internal returns (uint256 assets) {
        if (shares == 0) revert ZeroAmount();
        if (shares > balanceOf(owner)) revert InsufficientShares(shares, balanceOf(owner));

        // If caller is not the owner, spend ERC-20 allowance
        if (owner != msg.sender) {
            _spendAllowance(owner, msg.sender, shares);
        }

        assets = _convertToAssets(shares);
        uint256 available = usdc.balanceOf(address(this));
        if (assets > available) revert InsufficientLiquidity(assets, available);

        _burn(owner, shares);
        usdc.safeTransfer(msg.sender, assets);
        emit Withdrawn(owner, assets, shares);
    }

    // -------------------------------------------------------------------------
    // WageVault integration
    // -------------------------------------------------------------------------

    /// @notice Called by WageVault when issuing credit. Transfers USDC to the caller.
    function drawFunds(uint256 amount) external onlyVault {
        uint256 available = usdc.balanceOf(address(this));
        if (amount > available) revert InsufficientLiquidity(amount, available);

        totalLentOut += amount;
        usdc.safeTransfer(msg.sender, amount);

        emit FundsDrawn(amount);
    }

    /// @notice Called by WageVault on settlement. Receives principal + fee.
    ///         Caller must have approved this contract for `principal + fee`.
    function onRepayment(uint256 principal, uint256 fee) external onlyVault {
        totalLentOut -= principal;
        totalFeesCollected += fee;

        usdc.safeTransferFrom(msg.sender, address(this), principal + fee);

        emit RepaymentReceived(principal, fee);
    }

    /// @notice Called by WageVault on clawback/default. The principal is lost.
    ///         Share price drops proportionally.
    function onDefault(uint256 principal) external onlyVault {
        totalLentOut -= principal;
        emit DefaultRecorded(principal);
    }

    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------

    /// @notice Total assets under management (USDC in vault + lent out).
    function totalAssets() public view returns (uint256) {
        return usdc.balanceOf(address(this)) + totalLentOut;
    }

    /// @notice USDC available for new loans or withdrawals.
    function availableLiquidity() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /// @notice Convert assets to shares at current exchange rate.
    function convertToShares(uint256 assets) external view returns (uint256) {
        return _convertToShares(assets);
    }

    /// @notice Convert shares to assets at current exchange rate.
    function convertToAssets(uint256 shares) external view returns (uint256) {
        return _convertToAssets(shares);
    }

    /// @notice Share price in USDC base units (scaled by 1e6 for precision).
    function sharePrice() external view returns (uint256) {
        uint256 supply = totalSupply() + 1;
        uint256 totalAss = totalAssets() + 1;
        return (totalAss * 1e6) / supply;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    /// @dev Virtual offset of 1 prevents the classic first-depositor share inflation attack.
    ///      An attacker cannot donate USDC to skew the share price because the +1 offset
    ///      ensures new depositors always receive a non-zero share amount.
    function _convertToShares(uint256 assets) private view returns (uint256) {
        uint256 supply = totalSupply() + 1;
        uint256 totalAss = totalAssets() + 1;
        return (assets * supply) / totalAss;
    }

    function _convertToAssets(uint256 shares) private view returns (uint256) {
        uint256 supply = totalSupply() + 1;
        uint256 totalAss = totalAssets() + 1;
        return (shares * totalAss) / supply;
    }
}
