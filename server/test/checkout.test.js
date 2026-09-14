import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID, createHmac } from "node:crypto";
import { JsonStorage } from "../src/storage/jsonStorage.js";
import { loadConfig } from "../src/config.js";
import { PayRamService } from "../src/services/payram.service.js";
import { createApp } from "../src/app.js";
import { CheckoutService } from "../src/services/checkout.service.js";

const key = "test-project-key-only";
const wallet = "0x0000000000000000000000000000000000000001";
const config = loadConfig({
  PAYRAM_API_URL: "https://gateway.example",
  PAYRAM_API_KEY: key,
  MERCHANT_WALLET_ADDRESS: wallet,
  CRYPTO_NETWORK: "ETH",
  PAYRAM_WALLET_CONFIGURED: "true",
});
const customer = { name: "Test Customer", email: "test@example.com" };
const input = { customer, items: [{ productId: "erp", quantity: 2 }] };
const silent = { info() {}, error() {} };
async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "payram-test-"));
  const storage = new JsonStorage(directory);
  await storage.init();
  await storage.writeJson("products.json", [
    { id: "erp", slug: "erp-license", name: "ERP", price: 25.15, currency: "USD", isActive: true },
    { id: "inactive", name: "Inactive", price: 10, currency: "USD", isActive: false },
  ]);
  const requests = new Map();
  let creates = 0;
  const provider = new PayRamService(config, async (url, options) => {
    assert.equal(options.headers["API-Key"], key);
    if (options.method === "POST") {
      creates++;
      assert.equal(url.pathname, "/api/v1/payment");
      const body = JSON.parse(options.body);
      assert.equal(body.currency, "USDT");
      assert.equal(body.network, "ETH");
      const reference = randomUUID();
      requests.set(reference, {
        referenceID: reference,
        invoiceID: body.invoiceID,
        customerID: body.customerID,
        amountInUSD: String(body.amountInUSD),
        paymentState: "OPEN",
      });
      return Response.json({
        reference_id: reference,
        url: "https://gateway.example/payments?reference_id=" + reference,
      });
    }
    if (url.pathname.includes("/blockchain-currency/"))
      return Response.json([
        { blockchainCode: "ETH", currencyCode: "USDT", customerAddress: wallet },
      ]);
    const reference = decodeURIComponent(url.pathname.split("/").at(-1));
    return Response.json(requests.get(reference));
  });
  const app = createApp({ storage, provider, config, logger: silent });
  const server = await new Promise((resolve) => {
    const running = app.listen(0, "127.0.0.1", () => resolve(running));
  });
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  const base = "http://127.0.0.1:" + server.address().port;
  async function call(endpoint, options = {}) {
    const response = await fetch(base + endpoint, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    return { status: response.status, body: await response.json(), headers: response.headers };
  }
  const token = randomUUID();
  async function checkout(data = input, access = token) {
    return call("/api/checkout", {
      method: "POST",
      headers: { "Idempotency-Key": access },
      body: JSON.stringify(data),
    });
  }
  async function webhook(event, signature) {
    const raw = JSON.stringify(event);
    const signed = signature ?? "sha256=" + createHmac("sha256", key).update(raw).digest("hex");
    return call("/api/webhooks/payram", {
      method: "POST",
      headers: { "X-Payram-Signature": signed },
      body: raw,
    });
  }
  async function payment(result) {
    return storage.findById("payments.json", result.body.data.paymentId);
  }
  const eventFor = (remote, changes = {}) => ({
    reference_id: remote.referenceID,
    invoice_id: remote.invoiceID,
    customer_id: remote.customerID,
    status: "FILLED",
    amount: "50.30",
    currency: "USDT",
    filled_amount: "50.30",
    filled_amount_in_usd: "50.30",
    confirmation_current: 12,
    confirmation_required: 12,
    payment_info: [{ transaction_hash: "0x" + "a".repeat(64), destination_address: wallet }],
    ...changes,
  });
  return {
    storage,
    provider,
    requests,
    checkout,
    webhook,
    payment,
    eventFor,
    call,
    token,
    creates: () => creates,
    directory,
  };
}
test("server prices, authenticated reads and checkout idempotency", async (t) => {
  const f = await fixture(t);
  const forged = {
    ...input,
    totalAmount: 0.01,
    items: [{ productId: "erp", quantity: 2, price: 0.01 }],
  };
  const results = await Promise.all([f.checkout(forged), f.checkout(forged)]);
  assert.equal(results[0].status, 201);
  assert.equal(results[0].body.data.amount, 50.3);
  assert.equal(results[0].body.data.paymentId, results[1].body.data.paymentId);
  assert.equal(f.creates(), 1);
  const payment = await f.payment(results[0]);
  assert.equal(payment.status, "pending");
  assert.equal((await f.call("/api/payments/" + payment.id)).status, 403);
  const authorized = await f.call("/api/payments/" + payment.id, {
    headers: { Authorization: "Bearer " + f.token },
  });
  assert.equal(authorized.status, 200);
  assert.equal(authorized.body.data.accessHash, undefined);
  assert.equal(
    (await f.checkout({ ...input, items: [{ productId: "erp", quantity: 1 }] })).status,
    409,
  );
  assert.equal((await f.storage.readJson("orders.json")).length, 1);
});
test("reject inactive, missing and fractional quantities without creating orders", async (t) => {
  const f = await fixture(t);
  for (const items of [
    [{ productId: "inactive", quantity: 1 }],
    [{ productId: "missing", quantity: 1 }],
    [{ productId: "erp", quantity: 1.5 }],
    [{ productId: "erp", quantity: -1 }],
    [
      { productId: "erp", quantity: 40 },
      { productId: "erp", quantity: 40 },
    ],
    [],
  ]) {
    assert.equal((await f.checkout({ customer, items }, randomUUID())).status, 400);
  }
  assert.equal(f.creates(), 0);
  assert.equal((await f.storage.readJson("orders.json")).length, 0);
});
test("invalid signatures and malformed JSON never confirm payment", async (t) => {
  const f = await fixture(t);
  const result = await f.checkout();
  const record = await f.payment(result);
  const remote = f.requests.get(record.providerPaymentId);
  assert.equal((await f.webhook(f.eventFor(remote), "sha256=bad")).status, 401);
  assert.equal((await f.webhook(f.eventFor(remote), "sha256=" + "0".repeat(64))).status, 401);
  const malformed = await f.call("/api/checkout", { method: "POST", body: "{" });
  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.success, false);
  assert.equal((await f.payment(result)).status, "pending");
});
test("confirmed webhook pays once, logs only allowed fields and ignores late OPEN", async (t) => {
  const f = await fixture(t);
  const result = await f.checkout();
  const record = await f.payment(result);
  const remote = f.requests.get(record.providerPaymentId);
  remote.paymentState = "FILLED";
  const event = f.eventFor(remote, {
    secret: "must-not-be-stored",
    card_number: "must-not-be-stored",
  });
  const responses = await Promise.all([f.webhook(event), f.webhook(event)]);
  assert.ok(responses.every((r) => r.status === 200));
  const paid = await f.payment(result);
  assert.equal(paid.status, "paid");
  assert.ok(paid.paidAt);
  assert.equal((await f.storage.findById("orders.json", paid.orderId)).status, "paid");
  assert.equal((await f.storage.readJson("payment-events.json")).length, 1);
  assert.equal(
    (await readFile(path.join(f.directory, "payment-events.json"), "utf8")).includes(
      "must-not-be-stored",
    ),
    false,
  );
  remote.paymentState = "OPEN";
  assert.equal((await f.webhook(f.eventFor(remote, { status: "OPEN" }))).status, 200);
  assert.equal((await f.payment(result)).paidAt, paid.paidAt);
});
test("signed event alone cannot override a pending API invoice", async (t) => {
  const f = await fixture(t);
  const result = await f.checkout();
  const record = await f.payment(result);
  const remote = f.requests.get(record.providerPaymentId);
  assert.equal((await f.webhook(f.eventFor(remote))).status, 409);
  assert.equal((await f.payment(result)).status, "pending");
});
test("amount, asset, reference and invoice mismatches fail closed", async (t) => {
  const f = await fixture(t);
  const result = await f.checkout();
  const record = await f.payment(result);
  const remote = f.requests.get(record.providerPaymentId);
  remote.paymentState = "FILLED";
  for (const changes of [
    { currency: "USDC" },
    { invoice_id: "other" },
    { filled_amount: "1.00" },
    { filled_amount_in_usd: "1.00" },
    { payment_info: [{ destination_address: "bad" }] },
    { payment_info: [{ destination_address: "0x0000000000000000000000000000000000000002" }] },
  ]) {
    assert.equal((await f.webhook(f.eventFor(remote, changes))).status, 409);
  }
  remote.amountInUSD = "0.01";
  assert.equal((await f.webhook(f.eventFor(remote))).status, 409);
  remote.amountInUSD = "50.3";
  remote.referenceID = "different";
  assert.equal(
    (await f.webhook(f.eventFor(remote, { reference_id: record.providerPaymentId }))).status,
    409,
  );
  assert.equal((await f.payment(result)).status, "pending");
  assert.equal((await f.storage.readJson("payment-events.json")).length, 0);
});
test("partial payment stays processing; verified server polling confirms full payment", async (t) => {
  const f = await fixture(t);
  const result = await f.checkout();
  const record = await f.payment(result);
  const remote = f.requests.get(record.providerPaymentId);
  remote.paymentState = "PARTIALLY_FILLED";
  assert.equal(
    (await f.webhook(f.eventFor(remote, { status: "PARTIALLY_FILLED", filled_amount: "20.0" })))
      .status,
    200,
  );
  assert.equal((await f.payment(result)).status, "processing");
  remote.paymentState = "FILLED";
  await f.storage.update("payments.json", record.id, { lastCheckedAt: null });
  const response = await f.call("/api/payments/" + record.id, {
    headers: { Authorization: "Bearer " + f.token },
  });
  assert.equal(response.body.data.status, "paid");
});
test("cancelled payment does not fulfill an order", async (t) => {
  const f = await fixture(t);
  const result = await f.checkout();
  const record = await f.payment(result);
  const remote = f.requests.get(record.providerPaymentId);
  remote.paymentState = "CANCELLED";
  assert.equal((await f.webhook(f.eventFor(remote, { status: "CANCELLED" }))).status, 200);
  assert.equal((await f.payment(result)).status, "cancelled");
  assert.equal((await f.storage.findById("orders.json", record.orderId)).status, "cancelled");
});
test("no gateway credentials returns 503 without creating an order", async (t) => {
  const f = await fixture(t);
  const disabled = loadConfig({});
  const service = new CheckoutService(f.storage, new PayRamService(disabled), disabled, silent);
  await assert.rejects(
    () => service.checkout(input, randomUUID()),
    (error) => error.status === 503,
  );
  assert.equal((await f.storage.readJson("orders.json")).length, 0);
});
test("unknown create outcome never automatically repeats a provider charge request", async (t) => {
  const f = await fixture(t);
  let calls = 0;
  const provider = new PayRamService(config, async () => {
    calls++;
    throw new Error("timeout");
  });
  const service = new CheckoutService(f.storage, provider, config, silent);
  const token = randomUUID();
  const first = await service.checkout(input, token);
  const retry = await service.checkout(input, token);
  assert.equal(first.paymentId, retry.paymentId);
  assert.equal(calls, 1);
  assert.equal(first.status, "processing");
  assert.equal(first.checkout.url, null);
});
test("JSON queue prevents lost updates and journal recovers an interrupted transaction", async (t) => {
  const f = await fixture(t);
  await Promise.all(
    Array.from({ length: 20 }, (_, i) => f.storage.insert("carts.json", { id: "cart_" + i })),
  );
  assert.equal((await f.storage.readJson("carts.json")).length, 20);
  await writeFile(
    path.join(f.directory, ".transaction.json"),
    JSON.stringify({
      "orders.json": [{ id: "recovered" }],
      "payments.json": [{ id: "recovered-payment" }],
    }),
  );
  const restarted = new JsonStorage(f.directory);
  await restarted.init();
  assert.equal((await restarted.findById("orders.json", "recovered")).id, "recovered");
  assert.equal(
    (await restarted.findById("payments.json", "recovered-payment")).id,
    "recovered-payment",
  );
  await writeFile(path.join(f.directory, "carts.json"), "broken");
  await assert.rejects(() => restarted.readJson("carts.json"), /Invalid JSON/);
});
test("checkout redirects are restricted to the configured gateway", () => {
  const provider = new PayRamService(config, async () =>
    Response.json({ reference_id: "ref", url: "https://untrusted.example/pay" }),
  );
  return assert.rejects(
    () =>
      provider.createCheckout({
        order: { id: "order", customer, totalAmount: 10 },
        payment: { cryptoCurrency: "USDT", cryptoNetwork: "ETH" },
      }),
    /does not match/,
  );
});
