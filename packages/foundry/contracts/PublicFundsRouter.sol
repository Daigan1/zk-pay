// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IFundsRouter.sol";
import "./IYieldVault.sol";
import "./MockMON.sol";
import "./MockWETH.sol";

/**
 * @title PublicFundsRouter
 * @notice Phase 2 implementation of IFundsRouter using standard ERC20 transfers.
 *
 *         This router holds all protocol tokens (USDC, MON, WETH) on behalf of
 *         the WageVault. Only the vault can call mutating functions.
 *
 *         In Phase 3, this contract is replaced by an Unlink privacy router
 *         that routes deposits into shielded pools. The WageVault code stays
 *         unchanged because it only calls the IFundsRouter interface.
 *
 *         executeStrategy handles mock rebalancing: burns input tokens and
 *         mints output tokens to simulate DEX swaps. USDC entries in
 *         executeStrategy are no-ops since USDC stays in the router balance.
 */
contract PublicFundsRouter is IFundsRouter {
    using SafeERC20 for IERC20;

    address public vault;
    address public immutable deployer;
    address public immutable usdc;
    MockMON public immutable mockMon;
    MockWETH public immutable mockWeth;
    IYieldVault public yieldVault;

    error NotVault(address caller);
    error NotDeployer(address caller);
    error VaultAlreadySet();
    error ZeroAddress();
    error ArrayLengthMismatch();
    error UnknownToken(address token);
    error YieldVaultAlreadySet();

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault(msg.sender);
        _;
    }

    constructor(address usdc_, address mockMon_, address mockWeth_) {
        if (usdc_ == address(0)) revert ZeroAddress();
        if (mockMon_ == address(0)) revert ZeroAddress();
        if (mockWeth_ == address(0)) revert ZeroAddress();

        deployer = msg.sender;
        usdc = usdc_;
        mockMon = MockMON(mockMon_);
        mockWeth = MockWETH(mockWeth_);
    }

    /// @notice One-time vault initialization. Only callable by deployer.
    function setVault(address vault_) external {
        if (msg.sender != deployer) revert NotDeployer(msg.sender);
        if (vault != address(0)) revert VaultAlreadySet();
        if (vault_ == address(0)) revert ZeroAddress();
        vault = vault_;
    }

    /// @notice One-time yield vault setup. Only callable by deployer.
    function setYieldVault(address yieldVault_) external {
        if (msg.sender != deployer) revert NotDeployer(msg.sender);
        if (address(yieldVault) != address(0)) revert YieldVaultAlreadySet();
        if (yieldVault_ == address(0)) revert ZeroAddress();
        yieldVault = IYieldVault(yieldVault_);
        // Pre-approve yield vault to pull USDC from router
        IERC20(usdc).approve(yieldVault_, type(uint256).max);
    }

    function deposit(address token, uint256 amount, address from) external onlyVault {
        IERC20(token).safeTransferFrom(from, address(this), amount);
        // Auto-stake USDC into yield vault
        if (token == usdc && address(yieldVault) != address(0)) {
            yieldVault.deposit(amount);
        }
    }

    function withdraw(address token, uint256 amount, address to) external onlyVault {
        // Unstake USDC from yield vault before sending
        if (token == usdc && address(yieldVault) != address(0)) {
            uint256 shares = _usdcToShares(amount);
            yieldVault.withdraw(shares);
        }
        IERC20(token).safeTransfer(to, amount);
    }

    function executeStrategy(
        address[] calldata tokensIn,
        uint256[] calldata amountsIn,
        address[] calldata tokensOut,
        uint256[] calldata amountsOut
    ) external onlyVault {
        if (tokensIn.length != amountsIn.length) revert ArrayLengthMismatch();
        if (tokensOut.length != amountsOut.length) revert ArrayLengthMismatch();

        // Burn input tokens (dispose of old positions).
        for (uint256 i = 0; i < tokensIn.length; i++) {
            if (amountsIn[i] == 0) continue;
            // USDC is not burned — it stays in router balance.
            if (tokensIn[i] == usdc) continue;
            _burnMock(tokensIn[i], amountsIn[i]);
        }

        // Mint output tokens (acquire new positions).
        for (uint256 i = 0; i < tokensOut.length; i++) {
            if (amountsOut[i] == 0) continue;
            // USDC is not minted — it's already in router balance.
            if (tokensOut[i] == usdc) continue;
            _mintMock(tokensOut[i], amountsOut[i]);
        }
    }

    function balanceOf(address token) external view returns (uint256) {
        if (token == usdc && address(yieldVault) != address(0)) {
            // Report the underlying USDC value of our yield vault shares
            uint256 shares = yieldVault.balanceOf(address(this));
            return yieldVault.convertToAssets(shares) + IERC20(usdc).balanceOf(address(this));
        }
        return IERC20(token).balanceOf(address(this));
    }

    /// @notice Returns accrued yield on staked USDC (above the deposited principal).
    function usdcYieldAccrued() external view returns (uint256) {
        if (address(yieldVault) == address(0)) return 0;
        uint256 shares = yieldVault.balanceOf(address(this));
        uint256 currentValue = yieldVault.convertToAssets(shares);
        // The yield is the difference between current value and shares (shares were 1:1 at deposit)
        return currentValue > shares ? currentValue - shares : 0;
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /// @dev Convert a USDC amount to the equivalent yield vault shares (rounds up).
    function _usdcToShares(uint256 amount) internal view returns (uint256) {
        uint256 totalShares = yieldVault.balanceOf(address(this));
        uint256 totalAssets = yieldVault.convertToAssets(totalShares);
        if (totalAssets == 0) return amount;
        uint256 shares = (amount * totalShares + totalAssets - 1) / totalAssets;
        return shares > totalShares ? totalShares : shares;
    }

    function _burnMock(address token, uint256 amount) internal {
        if (token == address(mockMon)) {
            mockMon.burn(address(this), amount);
        } else if (token == address(mockWeth)) {
            mockWeth.burn(address(this), amount);
        } else {
            revert UnknownToken(token);
        }
    }

    function _mintMock(address token, uint256 amount) internal {
        if (token == address(mockMon)) {
            mockMon.mint(address(this), amount);
        } else if (token == address(mockWeth)) {
            mockWeth.mint(address(this), amount);
        } else {
            revert UnknownToken(token);
        }
    }
}
