// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IFundsRouter
 * @notice Abstraction layer for all token custody and movement operations.
 *
 *         Phase 2 (public): implemented by PublicFundsRouter using standard
 *         ERC20 transfers and mock token mint/burn.
 *
 *         Phase 3 (private): will be implemented by an Unlink adapter that
 *         routes deposits into shielded pools and uses reshielding for
 *         private balance management.
 *
 *         The WageVault delegates all token operations through this interface
 *         so swapping the router swaps the entire funds layer without touching
 *         business logic.
 */
interface IFundsRouter {
    /// @notice Pull `amount` of `token` from `from` into the router.
    ///         The `from` address must have approved the router for `amount`.
    function deposit(address token, uint256 amount, address from) external;

    /// @notice Send `amount` of `token` from the router to `to`.
    function withdraw(address token, uint256 amount, address to) external;

    /// @notice Execute a strategy rebalance: dispose of input tokens and acquire output tokens.
    ///
    ///         In the public router, inputs are burned (mock tokens) and outputs are minted.
    ///         USDC inputs/outputs are no-ops (USDC stays in router balance).
    ///
    /// @param tokensIn  Tokens to dispose of (burn or sell)
    /// @param amountsIn Amounts of each input token
    /// @param tokensOut Tokens to acquire (mint or buy)
    /// @param amountsOut Amounts of each output token
    function executeStrategy(
        address[] calldata tokensIn,
        uint256[] calldata amountsIn,
        address[] calldata tokensOut,
        uint256[] calldata amountsOut
    ) external;

    /// @notice Returns how much of `token` the router holds.
    function balanceOf(address token) external view returns (uint256);
}
