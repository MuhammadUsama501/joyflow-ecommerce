# Ledgerline ecommerce + PayRam

Existing React/TypeScript, Vite and TanStack Start storefront, with a separate Node/Express PayRam API. TanStack Router is retained to preserve the project. No React Router migration is needed.

## What is implemented

- Existing catalog, product pages, persistent cart and plan builder connect to server-authoritative products.
- Checkout collects name and email, then sends only product IDs and quantities.
- Express creates an order/payment, calls the documented PayRam REST API and returns its hosted checkout URL.
- The browser opens PayRam in a separate tab, retaining a private order access token in sessionStorage. If popups are blocked, the processing page provides an Open secure payment link.
- Status polling runs every four seconds, stops after ten minutes and can be resumed. A timeout does not mean payment failed.
- HMAC-authenticated webhooks are also checked against PayRam's server API before payment changes.
- JSON transactions serialize writes and roll forward interrupted multi-file changes.
- No merchant private keys, seed phrases, card numbers or CVVs are requested or stored.
- Orders become paid only after verified payment. Actual ERP license activation/email delivery is a separate fulfillment integration; this code does not fabricate activation keys.

## Important PayRam boundaries

This repository's store API uses **JSON only**, with no database driver or database service. The separately deployed **PayRam gateway itself uses its own database/infrastructure**. If your no-database requirement includes third-party gateway software, self-hosting PayRam is incompatible with that requirement. Nothing here installs that infrastructure.

PayRam card payments are a **fiat-to-crypto onramp**, not a conventional anonymous card form. The documented PayRam Wallet flow creates a customer wallet and requires first-purchase verification. Provider fees and regional eligibility apply.

USDT is the configured preference, not a promise that every card provider can settle in USDT on every network. The onramp guide says Base-only, whereas newer release notes describe additional Ethereum onramps. Confirm the exact asset/network/card route in your installed PayRam version before enabling it. This implementation does not silently convert USDC to USDT.

## Requirements and installation

Use Node.js 22+ (Node 24 was used for verification) and npm. Download Node from https://nodejs.org/ if needed.

From the repository root:

```powershell
npm.cmd install
npm.cmd install --prefix server
Copy-Item .env.example .env.local
Copy-Item server/.env.example server/.env
```

Do not overwrite an existing environment file; merge the settings instead. Existing root .env contents were not changed by this integration. On macOS/Linux, use npm instead of npm.cmd and cp instead of Copy-Item.

Run the frontend in terminal 1, from the repository root:

```powershell
npm.cmd run dev -- --port 5173
```

Run the backend in terminal 2, also from the repository root:

```powershell
npm.cmd run dev --prefix server
```

Equivalent backend commands: cd server, npm.cmd install, npm.cmd run dev. The API defaults to http://localhost:5000 and frontend to http://localhost:5173. Express starts without PayRam credentials so you can browse products; checkout is disabled until configuration is complete.

## Environment variables

Root .env.local:

| Variable | Value |
| --- | --- |
| VITE_API_URL | http://localhost:5000 locally; your HTTPS Express API origin in production |

server/.env:

| Variable | Meaning |
| --- | --- |
| PORT | Express port, default 5000 |
| CLIENT_URL | Exact allowed frontend origin; default http://localhost:5173 |
| PAYRAM_API_URL | PayRam gateway origin from Settings / Site URL, without an API path |
| PAYRAM_API_KEY | Project API key from your PayRam dashboard |
| PAYRAM_WEBHOOK_SECRET | Leave blank to use the project API key; if set, must equal it |
| MERCHANT_WALLET_ADDRESS | Public EVM receiving/cold wallet address only |
| CRYPTO_ASSET | USDT by default; USDC also supported as an explicit choice |
| CRYPTO_NETWORK | Required: ETH, BASE or POL; verify asset support in your gateway |
| PAYRAM_WALLET_CONFIGURED | Set true only after configuring that wallet/asset/network in PayRam |
| PAYRAM_CARD_ENABLED | Set true only after activating and testing card payments for that route |
| NODE_ENV | development locally; production when deployed |

Only VITE_API_URL belongs in Vite configuration. PayRam API keys must never use a VITE_ prefix. The backend rejects invalid/checksum-invalid or zero EVM addresses. Tron addresses are not compatible with the requested MetaMask wallet configuration.

## PayRam setup

1. Deploy PayRam separately using its official guide: https://payram.com/setup .
2. In the gateway dashboard configure the chosen network's deposit infrastructure, gas funding and your merchant cold-wallet **public address**. Follow the provider's own operational setup; this store never accepts private keys.
3. Match MERCHANT_WALLET_ADDRESS to the cold wallet in PayRam. An environment variable does not configure PayRam's fund sweeping.
4. Generate a project API key and enter its origin/key in server/.env.
5. Confirm your desired token is supported on that network, then set CRYPTO_NETWORK and PAYRAM_WALLET_CONFIGURED=true.
6. For card payments, use Settings → Payment Channels → Cards and verify it is enabled for this project. Test your US customer flow, token/network, fees and verification requirements. Only then set PAYRAM_CARD_ENABLED=true.
7. Register the webhook described below.
8. Start with PayRam's test environment. Never use mainnet funds for automated local tests.

No automatic payout or asset conversion API is called. PayRam manages deposit addresses and sweeping. The configured receiving wallet is the **final cold wallet**, whereas webhook destination_address identifies a **customer deposit address**. These addresses should not be compared as if they were the same wallet.

## Official API contract

Checked against official documentation on 2026-09-15:

- Create: https://docs.payram.com/api-integration/payments-api/create-payment
- Status: https://docs.payram.com/api-integration/payments-api/payment-status
- Deposit options: https://docs.payram.com/api-integration/payments-api/get-blockchain-currencies
- Webhooks: https://docs.payram.com/api-integration/payments-api/webhook
- Card flow: https://docs.payram.com/features/card-to-crypto-fiat-onramp
- Version changes: https://www.payram.com/releases

The adapter is server/src/services/payram.service.js:

- POST /api/v1/payment with API-Key header and customerEmail, customerID, invoiceID, amountInUSD, currency and network. The local order UUID is used as the unique customer/invoice reference for this guest purchase.
- Reads reference_id and url from the create response. Checkout redirects must match the configured PayRam origin.
- GET /api/v1/payment/reference/{reference_id}; checks referenceID, customerID, invoiceID, amountInUSD and paymentState.
- Maps OPEN → pending, PARTIALLY_FILLED → processing, FILLED/OVER_FILLED → paid, CANCELLED → cancelled.
- No unverified refund or transaction-ID fields are invented. providerTransactionId remains null; transaction hashes come from payment_info.
- Creation POSTs are not automatically retried. If a response is lost, the original checkout key returns the same local order with a reconciliation message instead of making another invoice.

Older SDK guidance refers to an API-KEY webhook header. The implementation follows the current REST documentation's stronger HMAC format and deliberately rejects the legacy unsigned header. Update your gateway if it does not send signatures.

## Webhook configuration and verification

Register this public HTTPS endpoint in PayRam Settings → Webhook, then mark it active:

```text
https://YOUR_API_DOMAIN/api/webhooks/payram
```

A local localhost URL is not reachable by PayRam. For gateway testing, use an HTTPS tunnel to port 5000, or deploy this API on a reachable host. Keep the gateway key server-side.

The raw request bytes are verified against X-Payram-Signature:

```text
sha256=<HMAC-SHA256(raw request body, project API key)>
```

There is no separate invented webhook signing key. PAYRAM_WEBHOOK_SECRET exists for configuration compatibility but must match PAYRAM_API_KEY.

After signature validation, the service:
1. Parses only documented payment fields; discards unknown fields.
2. Finds the local payment by provider reference.
3. Fetches the invoice directly from PayRam with the server API key.
4. Matches invoice, customer reference and USD amount; checks crypto currency/amounts if supplied by the webhook.
5. Fetches deposit options from PayRam, validates the asset/network, and matches webhook destinations to its customerAddress. The final merchant wallet is stored separately.
6. Records a deduplication key of reference_id + status.
7. Atomically records the event, payment and order updates.
8. Preserves paid orders if older pending/cancelled deliveries arrive.

A webhook with unknown local reference returns 409 so PayRam can retry if creation is still in progress. Invalid signatures return 401, invalid JSON returns 400. Validation failures never mark an unpaid order paid.

The documented status response does not expose a final merchant cold wallet, settlement network, or transaction ID in its example. These cannot be independently proven from that response. This integration pins currency/network when creating the invoice and requires you to confirm the gateway's cold-wallet configuration. It does not pretend that local configuration proves a blockchain sweep happened.

## JSON data and product management

All PayRam store data is in server/data/:

- products.json — initial real catalog copied from src/data/products.json, with authoritative price in USD and isActive flag.
- carts.json — checkout cart snapshots.
- orders.json — customer details, immutable priced items, totals and payment state.
- payments.json — provider reference, checkout URL, status and access-token hash.
- payment-events.json — sanitized, authenticated events.
- .transaction.json — temporary recovery journal; normally removed after commit.
- .server.lock — prevents multiple live API processes sharing this store.

Runtime customer/order files are gitignored and created automatically if missing. No real order data should be committed. Missing files initialize as arrays; malformed JSON fails with a clear storage error instead of silently deleting records.

To add/edit a product, **stop the backend first**, edit server/data/products.json, then restart. Keep IDs and slugs unique. Example:

```json
{
  "id": "erp-license",
  "slug": "erp-license",
  "name": "ERP License",
  "sku": "ERP-001",
  "category": "ERP",
  "description": "Perpetual ERP license",
  "features": ["Inventory", "Accounting"],
  "price": 25,
  "currency": "USD",
  "isActive": true,
  "is_featured": false,
  "sort_order": 100
}
```

Changing src/data/products.json alone does not change the running API catalog. The existing browser-only admin editor is retained as a legacy editor; it does not edit the secure PayRam catalog or orders. No public admin mutation endpoint was added.

Custom plans use POST /api/plan-quotes. The server recalculates selected products and add-ons using src/data/pricing-config.json, saves a deterministic plan product in server/data/products.json and returns its ID/price. Custom plans are hidden from the public catalog but available to their cart by ID. Edit the pricing configuration on disk, not browser overrides, for authoritative plan pricing. Historical quoted plans retain their saved price; disabling an included product blocks purchase.

The store currently applies no extra checkout tax or coupon discount (both fields are zero); plan bundle discounts are included in the quoted plan price. Configure any required tax rules before commercial launch.

## API routes

Successful responses are { success: true, data: ... }. Errors are { success: false, message: ... }.

| Method | Path | Notes |
| --- | --- | --- |
| GET | /api/health | API liveness |
| GET | /api/payment-config | Public readiness and payment-method labels only |
| GET | /api/products | Active public products |
| GET | /api/products/:id | Active product by ID or slug |
| POST | /api/plan-quotes | Server-priced custom plan |
| POST | /api/checkout | Customer + product IDs/quantities; Idempotency-Key required |
| GET | /api/orders/:orderId | Bearer access token required |
| GET | /api/orders/:orderId/payment-status | Bearer token; checks PayRam |
| GET | /api/payments/:paymentId | Bearer token; checks PayRam |
| POST | /api/webhooks/payram | Raw-body HMAC required |

The checkout UUID key doubles as the private bearer access token, stored hashed at rest. Same key + same request returns the same checkout; changing the request under that key returns 409. The browser keeps the token in sessionStorage, never a URL or PayRam request. Keep the original store tab open. Closing the session loses browser access; recovery requires merchant support, not a public email lookup.

## Testing

Automated tests never contact a real payment provider. They run against an isolated temporary JSON directory and a test-only implementation of the documented PayRam responses.

From the repository root:

```powershell
npm.cmd test --prefix server
npx.cmd tsc --noEmit
npm.cmd run build
npm.cmd run test:browser --prefix server
```

Browser tests require Google Chrome installed, and free ports 5000/5173. Stop your development servers first. They launch the storefront, run an isolated Express fixture and test catalog/cart persistence, checkout, verified success, private order access, mobile layout and plan quotes. No gateway simulator endpoint exists in the production API.

Manual local checks:
1. Start Express and Vite; open /catalog (also available through /products).
2. Add a product, open /cart, change quantity and reload to confirm persistence.
3. Open /checkout. With blank gateway configuration, payment remains disabled.
4. Configure your test PayRam gateway and restart Express.
5. Enter customer information and continue. A secure PayRam tab opens; the store displays /payment-processing/:paymentId.
6. Complete a test payment. The signed webhook or verified API poll confirms the order.
7. Check the order/payment JSON files and /orders/:orderId/success in the original tab.
8. Replay a signed event from the gateway: it must not create a second payment or change paidAt.
9. Tamper with signature, amount, currency or invoice: the automated suite demonstrates rejection.
10. Cancel a test invoice; check the failure page. A partial payment must remain processing.

Never mark orders paid by editing JSON as a payment test. The application has no browser-controlled success endpoint.

## Operations and limits

This JSON implementation is for local development, demos, prototypes and low traffic on **one persistent Node process**. Do not use cluster mode, multiple replicas, shared writers or ephemeral/serverless disks. The frontend can be hosted separately, including Lovable; the Express API needs a persistent Node host and writable persistent storage.

Writes use temporary file + rename, a single-process queue and a roll-forward journal for order/payment/event consistency. This reduces corruption but is not a high-traffic database or a guarantee against disk/power failure. Back up the entire data directory while the API is stopped, restrict filesystem access and protect customer PII.

After an unclean shutdown, check that no API process is still running before removing only server/data/.server.lock. Restart to recover any pending journal. Never delete the journal to bypass an error.

If payment creation reports an unknown outcome, do not repeat a provider create call blindly. Match the stored order ID to invoiceID in the PayRam dashboard. Have the operator reconcile its reference and verify the gateway invoice before making a fresh purchase. No automatic refund, payout or manual paid-status endpoint is exposed.

Use HTTPS for both applications, an exact CLIENT_URL origin, firewalling and a reverse proxy. Proxy deployments should configure Express trust proxy only for the actual trusted proxy topology; do not indiscriminately trust forwarded client headers. Rate limits are in-process and intended for a single instance.

The legacy PayPal/MetaMask server stubs previously returned secrets or unverified paid orders. Those stubs now fail closed. The PayPal UI remains unavailable until a genuine server-side create/capture integration is supplied. Existing local admin credentials/orders are not authentication or trusted records for this API.

## What you still need

- A reachable PayRam gateway and its project API key.
- Public merchant cold-wallet address, supported token and explicit network.
- Matching wallet/deposit/sweep setup in PayRam.
- Confirmation that Cards works for that project's network/asset and US customer locations.
- A public HTTPS webhook endpoint.
- Production API hosting with persistent storage, plus ERP fulfillment/tax configuration appropriate to your store.

Verified: payment creation/status endpoints, request/response names, HMAC signature algorithm/header, status values and hosted-checkout URL.

Not verified against your live instance: credentials, network/token/card eligibility, provider fees, KYC flow, final cold-wallet settlement, version compatibility and actual payment delivery. These require your configured gateway. Recurring billing and automated refunds are not implemented because they were not part of the verified checkout contract.

## Delivery file map

Created for this integration:

- server/package.json, server/package-lock.json, server/.env.example
- server/src/app.js, server/src/server.js, server/src/config.js
- server/src/utils/errors.js
- server/src/storage/jsonStorage.js
- server/src/services/payram.service.js, checkout.service.js, plan.service.js
- server/data/products.json plus auto-created carts.json, orders.json, payments.json and payment-events.json
- server/test/checkout.test.js, server/test/browser/checkout.spec.js, server/playwright.config.js
- src/services/api.ts, src/services/paymentService.ts
- src/pages/CheckoutPage.tsx, PaymentProcessingPage.tsx, OrderSuccessPage.tsx, PaymentFailedPage.tsx
- src/components/AddToCartButton.tsx, CartItem.tsx, CartSummary.tsx
- src/routes/checkout.tsx, payment-processing.$paymentId.tsx, payment-failed.$paymentId.tsx, orders.$orderId.success.tsx, products.index.tsx
- Root .env.example

Updated existing files:

- src/lib/cart.tsx and src/lib/queries.ts: persisted cart and authoritative API product reads.
- src/components/ProductCard.tsx: add-to-cart action.
- src/routes/cart.tsx, catalog.tsx, pricing.tsx: checkout entry, errors, server-priced custom plans.
- src/routes/index.tsx, products.$slug.tsx, __root.tsx: payment wording.
- src/routes/_authenticated/admin.tsx: pre-existing compile fixes and legacy-settings clarification.
- src/start.ts: corrected TanStack startup export and CSRF middleware.
- src/routeTree.gen.ts: generated routes.
- src/lib/paypal.functions.ts, metamask.functions.ts and orders.ts: unsafe legacy payment stubs fail closed.
- .gitignore and README.md.

Some legacy files already had uncommitted edits when work began; existing database-file deletions and root .env edits were not performed by this integration.

Installed runtime packages: express, cors, dotenv, helmet, express-rate-limit, ethers.
Installed development package: @playwright/test (uses your installed Chrome).
