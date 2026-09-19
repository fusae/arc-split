# Arc Microgrants — application draft

**Status: ready for application; not submitted. Mainnet contract runtime and a real 0.1 USDC payment have been verified.**

## Project name
Arc Split

## Short description
Arc Split lets independent teams collect one USDC payment and automatically distribute it to 2–5 collaborators in a single atomic transaction. Fixed amounts and split percentages are recorded in an immutable, ownerless contract. Every recipient receives a verifiable payment receipt. The app uses an English-only interface and never holds private keys.

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
- English-only interface with onchain-verified payment receipts.

## Deployment evidence
- Public source: https://github.com/fusae/arc-split
- Application: https://arc-split.netlify.app
- Mainnet contract: https://explorer.arc.io/address/0x04BCD2f7Ad98071A2E668a047B94Efa46cc7AC08
- Mainnet payment: https://explorer.arc.io/tx/0x0cf2b7434afb1949c07cbd56ffe4ac1c8ef9da8f799ca4b98aac41be85ab7b4e
- Verified receipt: https://arc-split.netlify.app/#chain=5042&contract=0x04BCD2f7Ad98071A2E668a047B94Efa46cc7AC08&order=1
- Mainnet verification: order 1 paid 0.1 USDC; successful transaction and OrderPaid event at block 21665082 match the immutable order, with 0.07 and 0.03 USDC payouts. Both addresses are controlled by the builder; this is a functional test, not customer traction.
- Public builder profile: https://github.com/fusae
- Testnet contract: https://explorer.testnet.arc.io/address/0x6C16c004550d46c8699B0c870bF1fA34c2fE9f7d
- Testnet payment (not mainnet evidence): https://explorer.testnet.arc.io/tx/0x83858f5f1f32029f2c22c5e5c0249396aa2c9e988174708cbefeb32d17a30ddf

## Submission checks
- Application is public and does not require visitor login; source repository is public.
- Mainnet create/pay flow and independently verifiable receipt are complete.
- Confirm required applicant contact details, declarations and program terms in the actual application form.
- Payout eligibility is subject to the program's verification after selection.

Program: https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq
