// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PayrollRegistry
 * @notice Employer-controlled registry of employee payroll commitments.
 *
 *         In the MVP this acts as a mocked oracle: the owner (employer/admin)
 *         attests that an employee receives a given salary on a given schedule.
 *         In a future ZK phase this contract would verify a ZK proof of a
 *         paystub rather than trusting the owner's attestation.
 *
 *         Design note: kept separate from WageVault so the verification layer
 *         can be swapped for a ZK verifier (Phase 3) without touching vault logic.
 */
contract PayrollRegistry is Ownable {
    struct EmployeeRecord {
        uint256 salaryPerPeriod; // gross pay per period, in USDC base units (6 decimals)
        uint256 payPeriodDays; // e.g. 14 for bi-weekly, 30 for monthly
        uint256 nextPayDate; // unix timestamp of the next payday
        bool registered;
    }

    mapping(address => EmployeeRecord) private _records;
    mapping(address => bool) public authorized;

    error ZeroAddress();
    error ZeroSalary();
    error ZeroPeriod();
    error PayDateInPast();
    error AlreadyRegistered(address employee);
    error NotRegistered(address employee);
    error NotAuthorized(address caller);

    event EmployeeRegistered(
        address indexed employee, uint256 salaryPerPeriod, uint256 payPeriodDays, uint256 nextPayDate
    );
    event PayDateAdvanced(address indexed employee, uint256 newPayDate);
    event EmployeeRemoved(address indexed employee);
    event Authorized(address indexed account);
    event Deauthorized(address indexed account);

    modifier onlyAuthorized() {
        if (msg.sender != owner() && !authorized[msg.sender]) revert NotAuthorized(msg.sender);
        _;
    }

    constructor(address employer) Ownable(employer) { }

    // -------------------------------------------------------------------------
    // Owner (employer) functions
    // -------------------------------------------------------------------------

    function authorize(address account) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        authorized[account] = true;
        emit Authorized(account);
    }

    function deauthorize(address account) external onlyOwner {
        authorized[account] = false;
        emit Deauthorized(account);
    }

    function registerEmployee(address employee, uint256 salaryPerPeriod, uint256 payPeriodDays, uint256 nextPayDate)
        external
        onlyOwner
    {
        if (employee == address(0)) revert ZeroAddress();
        if (salaryPerPeriod == 0) revert ZeroSalary();
        if (payPeriodDays == 0) revert ZeroPeriod();
        if (nextPayDate <= block.timestamp) revert PayDateInPast();
        if (_records[employee].registered) revert AlreadyRegistered(employee);

        _records[employee] = EmployeeRecord({
            salaryPerPeriod: salaryPerPeriod, payPeriodDays: payPeriodDays, nextPayDate: nextPayDate, registered: true
        });

        emit EmployeeRegistered(employee, salaryPerPeriod, payPeriodDays, nextPayDate);
    }

    /// @notice Advance the next pay date after a successful settlement cycle.
    function advancePayDate(address employee) external onlyAuthorized {
        if (!_records[employee].registered) revert NotRegistered(employee);
        _records[employee].nextPayDate += _records[employee].payPeriodDays * 1 days;
        emit PayDateAdvanced(employee, _records[employee].nextPayDate);
    }

    function removeEmployee(address employee) external onlyAuthorized {
        if (!_records[employee].registered) revert NotRegistered(employee);
        delete _records[employee];
        emit EmployeeRemoved(employee);
    }

    // -------------------------------------------------------------------------
    // Mock self-registration (simulates ZK paystub upload)
    // -------------------------------------------------------------------------

    /// @notice Employee self-registers with mock payroll data.
    ///         Simulates the future flow: upload paystub → ZK proof verifies →
    ///         payroll commitment created. Anyone can call this for themselves.
    ///         Mock values: $5,000/period, biweekly (14 days), next pay in 14 days.
    function mockSelfRegister() external {
        if (_records[msg.sender].registered) revert AlreadyRegistered(msg.sender);

        uint256 mockSalary = 5_000 * 1e6; // $5,000 USDC (6 decimals)
        uint256 mockPeriod = 14; // biweekly
        uint256 mockPayDate = block.timestamp + 14 days;

        _records[msg.sender] = EmployeeRecord({
            salaryPerPeriod: mockSalary, payPeriodDays: mockPeriod, nextPayDate: mockPayDate, registered: true
        });

        emit EmployeeRegistered(msg.sender, mockSalary, mockPeriod, mockPayDate);
    }

    /// @notice Register an employee with mock payroll data on their behalf.
    ///         Only callable by authorized contracts (e.g. WageVault) to enable
    ///         single-transaction register + credit flows.
    function mockRegisterFor(address employee) external onlyAuthorized {
        if (employee == address(0)) revert ZeroAddress();
        if (_records[employee].registered) revert AlreadyRegistered(employee);

        uint256 mockSalary = 5_000 * 1e6;
        uint256 mockPeriod = 14;
        uint256 mockPayDate = block.timestamp + 14 days;

        _records[employee] = EmployeeRecord({
            salaryPerPeriod: mockSalary, payPeriodDays: mockPeriod, nextPayDate: mockPayDate, registered: true
        });

        emit EmployeeRegistered(employee, mockSalary, mockPeriod, mockPayDate);
    }

    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------

    function getRecord(address employee) external view returns (EmployeeRecord memory) {
        return _records[employee];
    }

    function isRegistered(address employee) external view returns (bool) {
        return _records[employee].registered;
    }

    function salaryOf(address employee) external view returns (uint256) {
        return _records[employee].salaryPerPeriod;
    }

    function nextPayDateOf(address employee) external view returns (uint256) {
        return _records[employee].nextPayDate;
    }
}
