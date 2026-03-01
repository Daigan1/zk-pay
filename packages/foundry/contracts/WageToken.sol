// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title WageToken
 * @notice Non-transferable ERC20 receipt token (wUSDC) representing an active
 *         wage credit position. Only the WageVault (owner) can mint and burn.
 *         Decimals match MockUSDC (6).
 *
 *         Soulbound design: transfers between non-zero addresses are blocked.
 *         This prevents employees from moving their wUSDC to another wallet,
 *         which would brick `settlePayment` / `clawbackLoan` since those burn
 *         from the employee address recorded in the LoanRecord.
 *
 *         Phase 3 note: when Unlink is integrated, the vault will mint wUSDC
 *         to the Unlink adapter address. The adapter will reshield privately
 *         to the user. Minting to adapter is allowed because `from == address(0)`.
 */
contract WageToken is ERC20, Ownable {
    uint8 private constant DECIMALS = 6;

    error TransferRestricted();

    constructor(address initialOwner) ERC20("Wage USDC", "wUSDC") Ownable(initialOwner) { }

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }

    /// @notice Block all transfers between non-zero addresses.
    ///         Minting (from == address(0)) and burning (to == address(0)) are allowed.
    function _update(address from, address to, uint256 amount) internal override {
        if (from != address(0) && to != address(0)) revert TransferRestricted();
        super._update(from, to, amount);
    }
}
