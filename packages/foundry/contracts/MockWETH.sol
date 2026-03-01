// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockWETH
 * @notice Freely mintable ERC20 mock for Wrapped Ether (Anvil testing).
 *         Uses 6 decimals to match USDC-denominated position tracking in the vault.
 */
contract MockWETH is ERC20 {
    uint8 private constant DECIMALS = 6;

    error BurnNotAuthorized();

    constructor() ERC20("Wrapped Ether", "WETH") { }

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Only the token holder can burn their own tokens.
    function burn(address from, uint256 amount) external {
        if (msg.sender != from) revert BurnNotAuthorized();
        _burn(from, amount);
    }
}
