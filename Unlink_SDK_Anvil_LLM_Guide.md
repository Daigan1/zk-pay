# Unlink React SDK -- LLM Implementation Guide

## With Local Anvil + Scaffold-ETH Integration

------------------------------------------------------------------------

# Overview

This document explains:

1.  How the `@unlink-xyz/react` SDK works
2.  Core hooks and architecture
3.  How to integrate with Scaffold-ETH
4.  How to test locally using Anvil
5.  Deployment strategy for Monad testnet
6.  Adapter-based private contract execution

This guide is structured so another LLM can implement the integration
correctly.

------------------------------------------------------------------------

# What Unlink Provides

Unlink is a privacy layer that enables:

-   Private balances
-   Private transfers
-   Private deposits/withdrawals
-   Private DeFi execution via an Adapter
-   Multi-account support
-   Burner accounts

Unlink works via:

-   A privacy pool contract
-   A relay/gateway service
-   ZK proof generation
-   Atomic unshield → execute → reshield transactions

------------------------------------------------------------------------

# Installation

``` bash
npm install @unlink-xyz/react@canary
```

------------------------------------------------------------------------

# Provider Setup

Wrap your app with:

``` tsx
import { UnlinkProvider } from "@unlink-xyz/react";

<UnlinkProvider chain="monad-testnet" autoSync>
  <App />
</UnlinkProvider>
```

Important:

-   `chain` auto-resolves pool + gateway
-   `chain` and `gatewayUrl` are mutually exclusive
-   `autoSync` defaults to true

------------------------------------------------------------------------

# Core Hook: useUnlink()

Provides:

Wallet state: - ready - walletExists - busy - error

Account state: - accounts - activeAccount - createAccount() -
switchAccount()

Wallet actions: - createWallet() - importWallet() - exportMnemonic() -
clearWallet()

Transfers: - send() - planSend() - executeSend()

Deposits: - deposit()

Withdrawals: - withdraw() - planWithdraw() - executeWithdraw()

Sync: - refresh() - forceResync()

Transaction tracking: - getTxStatus() - waitForConfirmation()

------------------------------------------------------------------------

# Wallet Initialization Flow

Pseudo-logic:

if ready and no walletExists: createWallet()

if walletExists and no activeAccount: createAccount()

------------------------------------------------------------------------

# Deposits (Public → Private)

Deposit requires:

-   token address
-   amount (bigint)
-   depositor (EOA address)

------------------------------------------------------------------------

# Private Send

Send private tokens:

execute(\[{ token, recipient, amount }\])

------------------------------------------------------------------------

# Withdraw (Private → Public)

execute(\[{ token, amount, recipient }\])

------------------------------------------------------------------------

# Private DeFi (Adapter Execution)

The Adapter performs:

1.  Unshield private funds
2.  Execute arbitrary contract calls
3.  Reshield output tokens

Important:

When your contract is called via Adapter:

msg.sender == ADAPTER_ADDRESS

Design contracts accordingly.

------------------------------------------------------------------------

# Using with Scaffold-ETH + Anvil

## Development Strategy

### Phase 1 -- Public MVP on Anvil

Run:

anvil

Deploy contracts locally via Foundry.

Use Scaffold hooks for public interactions.

------------------------------------------------------------------------

### Phase 2 -- Abstract Funds Layer

Create frontend abstraction:

deposit(token, amount) withdraw(token, amount, recipient)
executeStrategy(inputs, calls)

Initially use public ERC20 transfers.

------------------------------------------------------------------------

### Phase 3 -- Add Unlink

Replace funds layer with:

-   requestDeposit()
-   useSend()
-   useWithdraw()
-   useInteract() (adapter)

Core protocol logic remains unchanged.

------------------------------------------------------------------------

# Local Testing Options

## Option A (Recommended)

Contracts on Anvil. Unlink using chain="monad-testnet".

## Option B (Full Local)

Requires:

-   Deploy UnlinkPool to Anvil
-   Run Unlink gateway locally
-   Use explicit provider config with gatewayUrl + chainId + poolAddress

------------------------------------------------------------------------

# Architecture Principle

Core protocol = standard EVM contracts Unlink = private execution +
accounting layer

Without privacy, payroll and strategy allocations become public
surveillance.

------------------------------------------------------------------------

# Security Considerations

-   Do not rely on msg.sender for user identity in adapter calls
-   Cap liquidity
-   Restrict strategy risk
-   Use explicit recipient parameters if needed

------------------------------------------------------------------------

# End of Guide
