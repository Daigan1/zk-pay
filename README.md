# ZK-Pay: Borrow against future earnings and deploy capital into earning strategies

## What Is ZK-Pay?

**ZK-Pay** is an on-chain lending and neo-banking platform that enables
users to:

-   Borrow credit against their future earnings
-   Invest those funds into yield-generating strategies
-   Manage payroll and assets entirely on-chain privately using the Unlink Privacy SDK
-   Preserve financial privacy using zero-knowledge proofs

It combines **stablecoin payroll, private lending, and DeFi yield** into a single easy-to-use experience for the user.

## The Problem
-   Users are unable to spend their future paychecks
-   Users *could* be earning 5%+ APY on this income or investing in other opportunities
-   Some companies have long gaps in payments with bi-monthly wages
-   web2 solutions are not private and full of hurdles
-   Users struggle to understand web3 and how to onboard into it
-   Privacy is difficult as employees don't want their income published to a public ledger

## Core Concept

All these problems are addressed by ZK-Pay which allows users to:

1.  Submit proof of employment income (via ZK proofs)
2.  Receive a stablecoin credit line based on verified future earnings
3.  Deploy capital into yield strategies
4.  Automatically settle repayment on payday
5.  Users can also lend the protocol money with little risk and earn a fixed %
6.  New users to cryptocurrencies can gain exposure in safer strategies (USDC Farming) without the hassle

It functions as a **crypto-native bank account with higher yield
potential**, built entirely on-chain.

## Stablecoin + Payroll System

### How It Works

-   A user submits a paystub
-   A zero-knowledge proof verifies:
    -   Pay date
    -   Income amount
-   The protocol issues a stablecoin credit line shieled with Unlink
-   The user can:
    -   Invest in crypto assets
    -   Earn yield on stablecoins earning 5%+ APY
    -   Allocate to automated strategies

No sensitive income data is made public or any investment strategies.

------------------------------------------------------------------------

## Treasury & Settlement Mechanism

On the verified payment date:

-   If payroll extraction succeeds:
    -   The loan is repaid
    -   The user's invested assets and yield are unlocked from the platform
-   If extraction fails:
    -   The protocol treasury absorbs repayment
    -   Risk management mechanisms activate

This creates a structured credit system with automated settlement logic without needing to involve the employer.

## Why Privacy Is Essential

ZK-Pay is designed around financial privacy:

-   Employees don't want their income statements public
-   Users don't want their investment strategies exposed
-   Users don't want their full balances visible on-chain

ZK-Pay acts as a full payroll + bank replacement, so confidentiality is
critical.

Zero-knowledge proofs + Unlink Privacy SDK to ensure:

-   Income verification without exposure
-   Private investment allocations
-   Hidden balances

## The Vision

ZK-Pay is building:

-   A privacy-first on-chain neobank
-   A lending system based on future earnings
-   A full payroll-to-investment financial stack
-   A ability for users to earn on their future income instead of letting it sit

All without sacrificing financial privacy.

# Tech Stach

-   Monad for a high-performance EVM-L1
-   Unlink to shield tranasctions involving proof-of-wage and investing line of credit
-   Plaid for linking to bank accounts and repaying loan amount on payday
-   Next.JS for user-friendly front-end and components

Built for the Ship private. Ship fast. hackathon.

# To Run Locally

-   yarn chain
-   yarn deploy
-   yarn start