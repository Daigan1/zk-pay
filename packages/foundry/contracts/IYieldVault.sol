// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title IYieldVault
/// @notice ERC-4626-style interface for yield-bearing vaults.
///         On Anvil: implemented by MockYieldVault (simulated APY).
///         On Monad: implemented by Curvance or other DeFi vaults.
interface IYieldVault {
    function deposit(uint256 assets) external returns (uint256 shares);
    function withdraw(uint256 shares) external returns (uint256 assets);
    function balanceOf(address account) external view returns (uint256);
    function convertToAssets(uint256 shares) external view returns (uint256);
    function asset() external view returns (address);
}
