# ZK-Pay v3 -- Wage-Backed Leverage Model (Fixed Fee, Lender Protected)

## Overview

This document defines the updated economic architecture for ZK-Pay.

The system is no longer a shared-yield vault. It is now a **wage-backed
leverage facility** with the following properties:

-   Lenders earn a fixed, short-duration fee (not variable APY).
-   Borrowers use credit to take risk (e.g., ETH exposure, yield
    farming).
-   Borrowers absorb strategy gains and losses.
-   Repayment is enforced at payday via payroll settlement.
-   Lenders are protected from borrower trading losses.
-   Yield farming is optional and entirely borrower-risk.

This README explains how the existing application should be modified to
implement this structure.

------------------------------------------------------------------------

# Core Economic Model

## Key Principle

Lender return comes from a **fixed leverage fee**, not shared farming
yield.

Borrowers are effectively leveraging their future paycheck.

------------------------------------------------------------------------

# Roles

## 1. Lender (Liquidity Provider)

-   Deposits stablecoin into CreditVault.
-   Receives vault shares.
-   Earns a fixed fee per borrowing period.
-   Is protected from borrower trading losses.
-   Has no exposure to borrower strategy outcomes.

Lender does NOT earn variable yield from strategy performance.

------------------------------------------------------------------------

## 2. Borrower (Employee)

-   Has committed payroll amount for a pay period.
-   Can draw a capped % of expected wages.
-   Uses internal platform credits to:
    -   Buy approved assets (e.g., ETH)
    -   Enter approved yield strategies
-   Keeps all upside.
-   Absorbs all downside.
-   Owes principal + fixed fee at payday.

------------------------------------------------------------------------

## 3. Employer / Payroll Commitment

-   Commits paystub amount (P).
-   Defines payday timestamp.
-   Enables enforced settlement.

------------------------------------------------------------------------

# Financial Definitions

P = Paystub amount\
L = Line of credit drawn\
F = Fixed leverage fee\
repayment = L + F

There is no yield sharing between lender and borrower.

Strategy profits or losses belong entirely to borrower.

------------------------------------------------------------------------

# Example Scenario

Paystub: \$10,000\
Borrowed: \$1,500\
Fixed fee: 1% flat = \$15

Repayment owed: \$1,515

------------------------------------------------------------------------

### Case A -- Borrower Profits

Borrower deploys \$1,500 into ETH. Position grows to \$1,600. Profit =
\$100.

On payday:

Borrower owes \$1,515. Borrower keeps \$85 profit.

Lender receives: - \$1,500 principal - \$15 fixed fee

------------------------------------------------------------------------

### Case B -- Borrower Loses

Borrower deploys \$1,500 into ETH. Position drops to \$1,300. Loss =
-\$200.

On payday:

Borrower still owes \$1,515. Shortfall is deducted from paycheck.

Borrower receives: \$10,000 - \$1,515 = \$8,485.

Lender still receives: - \$1,500 principal - \$15 fixed fee

Borrower absorbs full strategy loss.

------------------------------------------------------------------------

# Why This Model Makes Economic Sense

Lenders receive:

-   Predictable short-duration return.
-   No exposure to ETH volatility.
-   No exposure to yield strategy failure.
-   Employer-linked repayment structure.

Borrowers receive:

-   Early access to liquidity.
-   Leverage on future income.
-   Full upside if strategy wins.

This mirrors traditional margin financing or receivables financing.

------------------------------------------------------------------------

# Contract Changes Required

The existing shared-yield vault must be modified.

## 1. Remove Yield Sharing Logic

Delete or disable: - Yield split percentages. - Lender yield share
accounting. - Employee yield share logic.

Yield should no longer affect lender payout.

------------------------------------------------------------------------

## 2. Add Fixed Fee Model

Add to BorrowPosition:

-   principalBorrowed
-   fixedFee
-   repaymentAmount
-   periodId
-   settled

When draw(amount):

-   Ensure within credit limit.
-   Compute fee: fee = amount \* feeBps / 10_000
-   repaymentAmount = amount + fee
-   Transfer funds to borrower (or mint credits).

------------------------------------------------------------------------

## 3. Enforce Settlement

On settlePeriod():

-   Compute repaymentAmount.
-   Deduct repayment from payroll.
-   Transfer principal + fee to CreditVault.
-   Mark position settled.

Settlement must be atomic.

------------------------------------------------------------------------

## 4. CreditVault Logic

Vault responsibilities:

-   Track totalAssets.
-   Track totalShares.
-   Accept lender deposits.
-   Receive repaymentAmount at settlement.
-   Increase vault value by collected fees.

Vault APY is derived solely from fixed fees.

------------------------------------------------------------------------

# Risk Boundaries

Lender protection covers:

-   Borrower trading losses.
-   Strategy underperformance.

Lender is NOT protected from:

-   Smart contract exploits.
-   Payroll oracle failure.
-   Employer insolvency.

These risks must be documented clearly.

------------------------------------------------------------------------

# Privacy Layer Integration (Unlink)

When integrating Unlink:

Keep private: - Paystub amount (P) - Credit draw amount (L) - Fee (F) -
Strategy positions - Strategy PnL

Public: - Aggregate vault liquidity. - Total outstanding credit. -
Protocol fee totals.

Unlink should handle: - Private balance accounting. - Private leverage
execution. - Adapter-based asset deployment.

------------------------------------------------------------------------

# Recommended Parameters

Max credit: 20--30% of paycheck\
Flat fee: 0.5--2% per pay period\
Duration: 1--2 weeks typical

Short duration is critical to risk control.

------------------------------------------------------------------------

# Implementation Summary

To update the system:

1.  Remove yield-sharing economics.
2.  Introduce fixed leverage fee.
3.  Ensure borrower bears all strategy risk.
4.  Enforce repayment at payday.
5.  Make lender returns deterministic.

This transforms the product from a yield vault into:

A private, wage-backed leverage facility.

------------------------------------------------------------------------

# End of Document
