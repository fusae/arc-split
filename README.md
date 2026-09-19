# Arc Split

One USDC payment, automatically split between 2–5 collaborators on Arc.

Arc Split is a small, English-language, non-custodial prototype: create an immutable payment order, share a link, pay once, and independently verify every recipient's payout. The application charges no fee.

## Status

- Application and Solidity contract implemented.
- No simulated payment mode; receipts are verified against onchain transactions.
- Mainnet contract deployed and runtime-verified: [0x04BCD2f7Ad98071A2E668a047B94Efa46cc7AC08](https://explorer.arc.io/address/0x04BCD2f7Ad98071A2E668a047B94Efa46cc7AC08), chain ID 5042.
- Arc Testnet end-to-end validation passed: exact 70/30 payouts, receipt verification, duplicate-payment rejection, atomic rollback, reentrancy protection, five recipients and micro-USDC rounding. [Payment evidence](https://explorer.testnet.arc.io/tx/0x83858f5f1f32029f2c22c5e5c0249396aa2c9e988174708cbefeb32d17a30ddf).
- **A mainnet create/pay demonstration is still outstanding; the grant application has not been submitted.**
- The application defaults to the deployed contracts; visitors do not need to deploy another instance. Transaction signing remains in each user's wallet.
- Prototype, not independently audited. Test results are not a guarantee of safety.

Live application: https://arc-split.netlify.app

Hosting: Netlify static hosting; no visitor account is required. Build with `npm run build` and publish `dist/` using `netlify.toml`. Hosting does not hold wallet keys or funds.

Public source: https://github.com/fusae/arc-split

## Run

```sh
npm ci
npm run build
npm test
npm run dev
```

Open `http://localhost:4182`. The deployed application is static: no backend, private keys, API keys or server-held funds. The runtime dependency is ethers; solc, Ganache, esbuild and Playwright are development-only tools. Ganache is used only with isolated disposable test accounts and is not bundled or hosted.

For browser verification on macOS with Chrome installed, run `node scripts/verify-browser.mjs` with the local site running. All payment RPC traffic in that test is intercepted and routed to a disposable local EVM; no real money is used. Test artifacts are ignored by Git.

For the separate Arc Testnet validation script, `node scripts/verify-testnet.mjs` creates or reuses a disposable test-only wallet and prints only its public address and test balance. Request free test USDC from the Circle faucet, then run `node scripts/verify-testnet.mjs --run`. It is hard-locked to chain 5042002, with a 2 test-USDC run budget and a gas-price ceiling. Private keys stay in ignored `.sites-runtime/` with file mode 0600, and never belong in a commit or deployment. Never fund those test-only wallets with real assets. A new run deploys a fresh test contract; it does not replace the app's default contracts.

## Payment design

1. The creator supplies a title, a fixed USDC amount, 2–5 distinct recipients, and positive basis-point shares totaling 10,000.
2. `createOrder` permanently stores these terms. The resulting link includes the chain, contract and order ID; it never dictates the order's payment terms.
3. `pay(orderId)` must receive exactly the order amount as **native USDC**. No ERC-20 approval or allowance is required.
4. The order is marked paid before external calls. A contract-wide reentrancy guard blocks recursive payments. If any payout fails, the whole transaction reverts, including earlier payouts and the paid flag.
5. `OrderPaid` records the payer, amount, recipients and exact payouts. The UI verifies contract runtime, chain ID, stored order, receipt status and event details before displaying a verified receipt.

There are no administrators, upgrades, withdrawal methods or editable orders. Unsolicited ordinary transfers are rejected. Forced native transfers can leave funds in the contract that cannot be recovered; do not send funds directly to it.

### Arc-specific accounting

Arc uses USDC as its native gas asset, with **18 native decimals**. Its ERC-20 interface uses 6 decimals but represents the same balance. This application uses the native interface throughout and expresses each payout at 6-decimal USDC precision (`1 micro-USDC = 10^12 native units`). Each non-final share is rounded down to whole micro-USDC; the last recipient receives the remainder. Orders that would allocate less than one micro-USDC to any recipient are rejected.

Network fees are additional to the order amount. The app fetches current gas prices and sets the documented 20 Gwei max-fee floor. The wallet presents the final transaction for user review. Arc blocklisting, recipient contract behavior, or network conditions can cause a payout to revert. Failed transactions can still consume gas.

Sources: [RPC and chain IDs](https://docs.arc.io/arc/references/rpc-endpoints), [EVM differences](https://docs.arc.io/arc/references/evm-differences), [fees](https://docs.arc.io/arc/references/gas-and-fees).

## Deployment

1. Open **Contract setup**, select the intended network, and connect a wallet.
2. Estimate deployment fees, then explicitly confirm the deployment in the wallet.
3. The app compares deployed runtime bytecode to its reproducibly compiled artifact. A different implementation is refused.
4. The address is saved in the current browser. For a public default, put the verified address into `src/config.json` under the exact chain ID and rebuild.
5. Create a small order, review all recipient addresses, and pay through the wallet. Save the resulting explorer transaction and receipt link as evidence.

Deployments, creation and payment are distinct wallet transactions. No automated signing, background payment, bridging or funding is performed by this application.

The compiler is pinned to Solidity 0.8.30 with the Shanghai target, optimizer enabled (200 runs), and metadata bytecode hash disabled for stable runtime comparisons. Arc supports newer opcodes, but this contract deliberately needs none of them.

## Limitations

- Fixed-amount, one-time orders only; no refunds, partial payments, cancellation, recurring payments, recipient edits or escrow.
- Payouts to contracts that reject native transfers will fail the entire payment.
- The creator and recipient identities are not verified. A code match does not establish the identity of a merchant.
- Titles and addresses are public onchain. Never enter private personal information.
- No contract address or transaction is fabricated; blank deployment configuration means setup is still required.
- No grant selection or payment is guaranteed.

## Agent interface

Where the browser supports WebMCP, `prepare_split_request` validates and fills the visible form, and `get_split_state` reads the visible flow state. Neither tool creates orders, connects wallets, signs transactions or sends funds. Browser tests exercise these tools through a local compatibility harness; native browser support is optional.

## License

MIT. See LICENSE.
