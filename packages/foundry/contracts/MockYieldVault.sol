// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./IYieldVault.sol";

/**
 * @title MockYieldVault
 * @notice ERC-4626-style yield vault for Anvil testing.
 *         Simulates ~5% APY on USDC deposits. Shares are minted 1:1 on first
 *         deposit; subsequent deposits/withdrawals account for accrued yield.
 *
 *         Yield accrues linearly based on elapsed time since last update.
 *         On Monad mainnet this would be replaced by Curvance or another real vault.
 */
contract MockYieldVault is ERC20, IYieldVault {
    using SafeERC20 for IERC20;

    IERC20 public immutable underlying;
    uint256 public totalDeposited;
    uint256 public lastUpdate;

    /// @dev 5% APY expressed as rate per second (5e16 / 365.25 days in seconds)
    uint256 private constant RATE_PER_SECOND = 1_585_489_599; // ~5% / 31_557_600

    /// @dev Precision for rate calculations (1e18)
    uint256 private constant PRECISION = 1e18;

    constructor(address usdc_) ERC20("Yield USDC", "yUSDC") {
        underlying = IERC20(usdc_);
        lastUpdate = block.timestamp;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function asset() external view override returns (address) {
        return address(underlying);
    }

    function balanceOf(address account) public view override(ERC20, IYieldVault) returns (uint256) {
        return super.balanceOf(account);
    }

    function deposit(uint256 assets) external override returns (uint256 shares) {
        _accrueYield();

        if (totalSupply() == 0) {
            shares = assets;
        } else {
            shares = (assets * totalSupply()) / totalDeposited;
        }

        underlying.safeTransferFrom(msg.sender, address(this), assets);
        totalDeposited += assets;
        _mint(msg.sender, shares);
    }

    function withdraw(uint256 shares) external override returns (uint256 assets) {
        _accrueYield();

        assets = convertToAssets(shares);
        _burn(msg.sender, shares);
        totalDeposited -= assets;
        underlying.safeTransfer(msg.sender, assets);
    }

    function convertToAssets(uint256 shares) public view override returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return shares;
        uint256 projected = totalDeposited + _pendingYield();
        return (shares * projected) / supply;
    }

    function _pendingYield() internal view returns (uint256) {
        if (totalDeposited == 0) return 0;
        uint256 elapsed = block.timestamp - lastUpdate;
        return (totalDeposited * RATE_PER_SECOND * elapsed) / PRECISION;
    }

    function _accrueYield() internal {
        uint256 yield_ = _pendingYield();
        if (yield_ > 0) {
            // Mint USDC yield out of thin air (mock only).
            // Real vaults earn yield from lending/LP fees.
            totalDeposited += yield_;
        }
        lastUpdate = block.timestamp;
    }
}
