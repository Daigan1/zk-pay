# ZK-Pay: Wage-Backed Crypto Neobank (Monad + Scaffold-ETH) with Unlink Privacy Layer

## High-Level Summary

ZK-Pay is a crypto-native payroll neobank that lets employees access
wage-backed liquidity and allocate it into stablecoin strategies
(including AI/agent-managed allocations).

The core protocol is implemented first as a **standard public EVM
application** using **Scaffold-ETH 2 + Foundry** and tested end-to-end
on a local **Anvil** chain. Once the public flows work reliably
(contracts + UI), a privacy layer is added using **Unlink** to make
payroll balances, wage credit usage, and strategy allocations
confidential.

This "public-first then privacy" approach ensures the core product logic
is correct and demoable early, while allowing Unlink integration to
replace only the **funds movement** and **balance accounting** paths
(deposit/withdraw/strategy execution) without rewriting the business
logic.

------------------------------------------------------------------------

## Core Problem

Traditional payroll is slow (biweekly), inflexible, and not
programmable. Employees often need liquidity before payday, but typical
solutions introduce predatory lending dynamics and expose sensitive
financial data.

In crypto, putting payroll on-chain without privacy makes salary and
behavior permanently visible.

ZK-Pay solves this by:

1.  Verifying wage eligibility (initially mocked, later ZK-based)\
2.  Granting wage-backed access to funds (stablecoins)\
3.  Allowing users to allocate earned funds into strategies\
4.  Adding Unlink privacy so wage data and strategy choices are not
    public financial surveillance

------------------------------------------------------------------------

## Key Product Features

### 1. Wage Eligibility and Payroll Commitments (Public MVP)

-   Employee uploads their payroll which the tool can establish the frequency of payments.           
-   MVP uses mocked payroll commitments (mapping or Merkle root). This should use ZK proofs in the future to prove the frequency of paystubs.
-   Employee proves eligibility based on commitment.

### 2. Wage-Backed Liquidity Access

-   User can request capped liquidity (e.g., 20--30% of paycheck).
-   Treasury/LP-funded pool provides funds for the user
-   Repayment simulated via payday settlement. This could integrate into PLAID to automatically pull the users payment on their date of repayment, and unlock their total balance (remaining 70-8-%)
- If the PLAID payment fails, the funds loaned to the user are taken back.

### 3. Strategy Allocation

-   User can allocate:
    -   100% stablecoin
    -   Custom ratio (e.g., 80% USDC / 20% ETH)
    -   AI-managed strategy
-   Uses a basic vault contract in MVP.
-   These funds are "locked into" the contract and not widthdrawlable UNTIL the payment succeeds on the pay stub date.
- User gets a "w" version of the assets to show what they own.

### 4. Treasury & Agent Automation

-   Treasury manages liquidity buffer.
-   Off-chain AI agent can rebalance allocations.
-   Maintain reserves for payday liquidity.

------------------------------------------------------------------------

## Development Plan

### Phase 0 -- Stack Setup

-   Scaffold-ETH 2 (Frontend)
-   Foundry (Contracts)
-   Anvil (Local chain)

### Phase 1 -- Public EVM MVP on Anvil

Contracts: Choose to change this design if needed, but here is a basic example you could use.

-   PayrollCommitment.sol: user gets issued a loan (20-30%) after ZK proof of their paystub + frequency is submitted. The "w" version of tokens can be minted.
-   CreditPolicy.sol: defines the max loan amount and terms
-   WageVault.sol: contains the treasury funds
-   Settlement.sol: called after PLAID money is pulled on pay-day, and the users full funds (remaining 70-80% unlocked, and w tokens could be burned)

Frontend Screens:

-   Employee: Unlock Wage Credit via Payroll Stubs
-   Strategy: Allocate Funds
-   Settlement: Finalize & Withdraw (automatic if possible)

MVP Completion Criteria:

-   Full loop works publicly on Anvil.

### Phase 2 -- Abstract Funds Movement

Create interface:

-   deposit(token, amount)
-   withdraw(token, amount, recipient)
-   executeStrategy(inputs, calls, outputs)

Initially implemented using public ERC20 transfers.

### Phase 3 -- Add Unlink Privacy Layer

After MVP works publicly:

1.  Add UnlinkProvider
2.  Replace deposits with private pool deposits
3.  Replace strategy execution with Unlink Adapter calls
4.  Use reshielding to maintain private balances
5.  Enable private-to-public withdrawals

Key Behavior:

-   When called via Unlink Adapter, `msg.sender` equals adapter address.
-   Shares minted to adapter are reshielded privately to user.

### Phase 4 -- Deploy to Monad Testnet

-   Update wagmi chain config
-   Use UnlinkProvider with monad-testnet
-   Deploy contracts via Foundry
-   Demo private + public flows on Monad

------------------------------------------------------------------------

## Security & Risk Controls

-   Cap wage-backed liquidity.
-   Restrict strategy risk.
-   Avoid reliance on msg.sender when using Unlink Adapter.
-   Explicitly pass recipient if public minting required.

------------------------------------------------------------------------

## Demo Flow

1.  Employer commits payroll.
2.  Employee unlocks wage-backed credit.
3.  Employee allocates privately into strategy.
4.  Show private balances.
5.  Simulate payday settlement.
6.  Withdraw to public wallet.

------------------------------------------------------------------------

## Why Unlink Is Essential

-   Salary data must remain confidential.
-   Public strategy allocations leak financial behavior.
-   Employers require privacy for adoption.
-   Unlink enables confidential accounting without rewriting vault
    contracts.

------------------------------------------------------------------------

## Architecture Principle

Core protocol logic remains standard EVM contracts.

Unlink acts as the private execution and accounting layer for value
movement.

Without privacy, payroll becomes public financial surveillance.
