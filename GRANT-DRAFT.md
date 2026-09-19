# Arc Microgrants — application draft

**Status: draft; not submitted. Mainnet contract deployed and runtime verified; mainnet payment evidence is still outstanding.**

## Project name
Arc Split

## Short description
Arc Split lets independent teams collect one USDC payment and automatically distribute it to 2–5 collaborators in a single atomic transaction. Fixed amounts and split percentages are recorded in an immutable, ownerless contract. Every recipient receives a verifiable payment receipt. The app supports Chinese and English and never holds private keys.

## What problem does it solve?
Small collaborative projects often require one person to collect the entire client payment and manually distribute it. That adds custody, follow-up and accounting work. Arc Split makes the agreed split visible before payment and enforces it in the payment transaction.

## How Arc is used
Payment and gas both use Arc's native USDC. The contract handles the 18-decimal native / 6-decimal display boundary explicitly and guarantees that split payouts sum exactly to the order amount. Single-transaction execution gives the payer all-or-nothing settlement; the application independently verifies the payout event and transaction receipt.

## Implemented scope
- Immutable fixed-amount split orders, 2–5 recipients.
- Single-payment enforcement and reentrancy protection.
- Whole-payment rollback when a recipient rejects payment.
- Shareable order and receipt links, JSON receipt download and print view.
- Browser-wallet deployment with an explicit fee estimate and runtime verification.
- Bilingual interface and clearly separated simulated demo.

## Deployment evidence
- Public source: https://github.com/fusae/arc-split
- Application: https://arc-split.netlify.app
- Mainnet contract: https://explorer.arc.io/address/0x04BCD2f7Ad98071A2E668a047B94Efa46cc7AC08
- Testnet contract: https://explorer.testnet.arc.io/address/0x6C16c004550d46c8699B0c870bF1fA34c2fE9f7d
- Testnet payment (not mainnet evidence): https://explorer.testnet.arc.io/tx/0x83858f5f1f32029f2c22c5e5c0249396aa2c9e988174708cbefeb32d17a30ddf

## Evidence to add before submission
- Public source repository URL and confirm unauthenticated application access.
- Mainnet deployment transaction.
- One successful mainnet create/pay flow and the resulting receipt link.
- Public builder profile and payout eligibility verification as requested by the program.

Do not submit until the mainnet evidence is real and all public links are independently accessible.

Program: https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq
