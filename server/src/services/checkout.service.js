import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { isAddress } from "ethers";
import { assert } from "../utils/errors.js";

const id = (prefix) => prefix + "_" + randomUUID();
const hash = (value) => createHash("sha256").update(value).digest("hex");
const now = () => new Date().toISOString();
const states = {
  OPEN: "pending",
  PARTIALLY_FILLED: "processing",
  FILLED: "paid",
  OVER_FILLED: "paid",
  CANCELLED: "cancelled",
};
export function usdCents(value) {
  assert(
    (typeof value === "string" || typeof value === "number") &&
      /^\d+(\.\d{1,2})?$/.test(String(value)),
    400,
    "Invalid USD amount.",
  );
  const cents = Math.round(Number(value) * 100);
  assert(
    Number.isSafeInteger(cents) && cents > 0 && cents <= 100000000,
    400,
    "Amount is outside the supported range.",
  );
  return cents;
}
function decimal(value) {
  assert(
    typeof value === "string" && /^\d+(\.\d{1,18})?$/.test(value) && value.length <= 60,
    400,
    "Invalid payment amount.",
  );
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, "0"));
}
function publicRecord(record) {
  const { accessHash, requestHash, ...safe } = record;
  return safe;
}
export class CheckoutService {
  constructor(storage, provider, config, logger = console) {
    this.storage = storage;
    this.provider = provider;
    this.config = config;
    this.logger = logger;
    this.checkoutQueue = Promise.resolve();
    this.refreshes = new Map();
  }
  log(message, payment) {
    this.logger.info(message, { paymentId: payment?.id, orderId: payment?.orderId });
  }
  products() {
    return this.storage.readJson("products.json").then((rows) => rows.filter((p) => p.isActive));
  }
  authorize(record, token) {
    assert(record, 404, "Order or payment not found.");
    const actual = hash(typeof token === "string" ? token : "");
    assert(
      typeof record.accessHash === "string" &&
        timingSafeEqual(Buffer.from(actual), Buffer.from(record.accessHash)),
      403,
      "This order requires its private access token.",
    );
  }
  checkoutResponse(order, payment) {
    return {
      orderId: order.id,
      paymentId: payment.id,
      amount: order.totalAmount,
      currency: order.currency,
      cryptoAsset: payment.cryptoCurrency,
      cryptoNetwork: payment.cryptoNetwork,
      walletAddress: payment.receivingWalletAddress,
      checkout: payment.checkout,
      status: payment.status,
      failureReason: payment.failureReason,
    };
  }
  checkout(input, key) {
    const work = this.checkoutQueue.then(() => this.create(input, key));
    this.checkoutQueue = work.catch(() => {});
    return work;
  }
  async create(input, key) {
    this.provider.assertConfigured();
    assert(
      typeof key === "string" && /^[a-f0-9-]{36,100}$/i.test(key),
      400,
      "A unique checkout Idempotency-Key is required.",
    );
    assert(
      input && typeof input === "object" && !Array.isArray(input),
      400,
      "Invalid checkout request.",
    );
    const customer = {
      name: typeof input.customer?.name === "string" ? input.customer.name.trim() : "",
      email:
        typeof input.customer?.email === "string" ? input.customer.email.trim().toLowerCase() : "",
    };
    assert(
      typeof customer.name === "string" && customer.name.length >= 2 && customer.name.length <= 100,
      400,
      "Enter your name (2–100 characters).",
    );
    assert(
      typeof customer.email === "string" &&
        customer.email.length <= 254 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email),
      400,
      "Enter a valid email address.",
    );
    assert(
      Array.isArray(input.items) && input.items.length > 0 && input.items.length <= 50,
      400,
      "Choose between 1 and 50 products.",
    );
    const quantities = new Map();
    for (const item of input.items) {
      assert(
        item &&
          typeof item.productId === "string" &&
          item.productId.length <= 150 &&
          Number.isInteger(item.quantity) &&
          item.quantity >= 1 &&
          item.quantity <= 50,
        400,
        "Product quantities must be whole numbers from 1 to 50.",
      );
      const quantity = (quantities.get(item.productId) || 0) + item.quantity;
      assert(quantity <= 50, 400, "Maximum quantity per product is 50.");
      quantities.set(item.productId, quantity);
    }
    const normalized = [...quantities]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([productId, quantity]) => ({ productId, quantity }));
    const accessHash = hash(key);
    const requestHash = hash(JSON.stringify({ customer, items: normalized }));
    const draft = await this.storage.transaction((data) => {
      const previous = data["payments.json"].find((p) => p.accessHash === accessHash);
      if (previous) {
        assert(
          previous.requestHash === requestHash,
          409,
          "This checkout key belongs to a different cart.",
        );
        return {
          existing: true,
          payment: previous,
          order: data["orders.json"].find((o) => o.id === previous.orderId),
        };
      }
      const items = normalized.map(({ productId, quantity }) => {
        const product = data["products.json"].find((p) => p.id === productId && p.isActive);
        assert(product, 400, "A selected product is no longer available.");
        if (product.isCustom)
          assert(
            product.includedProductIds.every((id) =>
              data["products.json"].some((p) => p.id === id && p.isActive),
            ),
            400,
            "A plan product is no longer available.",
          );
        assert(product.currency === "USD", 400, "Only USD products can use this checkout.");
        const unitCents = usdCents(product.price);
        return {
          productId,
          productSlug: product.slug || product.id,
          productName: product.name,
          unitPrice: unitCents / 100,
          quantity,
          lineTotal: (unitCents * quantity) / 100,
        };
      });
      const totalCents = items.reduce((sum, item) => sum + Math.round(item.lineTotal * 100), 0);
      usdCents(totalCents / 100);
      const timestamp = now();
      const order = {
        id: id("order"),
        customer,
        items,
        subtotal: totalCents / 100,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: totalCents / 100,
        currency: "USD",
        status: "pending_payment",
        createdAt: timestamp,
        updatedAt: timestamp,
        paidAt: null,
        accessHash,
      };
      const payment = {
        id: id("pay"),
        orderId: order.id,
        provider: "payram",
        providerPaymentId: null,
        providerTransactionId: null,
        fiatAmount: order.totalAmount,
        fiatCurrency: "USD",
        cryptoAmount: null,
        cryptoCurrency: this.config.asset,
        cryptoNetwork: this.config.network,
        receivingWalletAddress: this.config.wallet,
        transactionHash: null,
        transactionHashes: [],
        depositAddresses: [],
        status: "pending",
        failureReason: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        paidAt: null,
        lastCheckedAt: null,
        checkout: { type: "payram", url: null, sessionId: null },
        accessHash,
        requestHash,
      };
      data["carts.json"].push({
        id: id("cart"),
        orderId: order.id,
        items: normalized,
        createdAt: timestamp,
      });
      data["orders.json"].push(order);
      data["payments.json"].push(payment);
      return { order, payment, existing: false };
    });
    if (draft.existing) return this.checkoutResponse(draft.order, draft.payment);
    this.log("order created", draft.payment);
    this.log("payment created", draft.payment);
    try {
      const session = await this.provider.createCheckout(draft);
      const payment = await this.storage.transaction((data) => {
        const record = data["payments.json"].find((p) => p.id === draft.payment.id);
        assert(
          !data["payments.json"].some(
            (p) => p.id !== record.id && p.providerPaymentId === session.providerPaymentId,
          ),
          502,
          "PayRam returned a reused payment reference.",
        );
        Object.assign(record, session, { updatedAt: now() });
        return record;
      });
      this.log("PayRam session created", payment);
      this.log("checkout created", payment);
      return this.checkoutResponse(draft.order, payment);
    } catch {
      // A lost response may still have created an invoice. Never blindly repeat the POST.
      const payment = await this.storage.update("payments.json", draft.payment.id, {
        status: "processing",
        failureReason:
          "Checkout could not be opened. Contact the store with your order reference before retrying.",
        updatedAt: now(),
      });
      this.log("payment creation needs reconciliation", payment);
      return this.checkoutResponse(draft.order, payment);
    }
  }
  async refresh(paymentId, event = null) {
    if (!event && this.refreshes.has(paymentId)) return this.refreshes.get(paymentId);
    const work = this.refreshPayment(paymentId, event);
    if (!event) {
      this.refreshes.set(paymentId, work);
      try {
        return await work;
      } finally {
        this.refreshes.delete(paymentId);
      }
    }
    return work;
  }
  async refreshPayment(paymentId, event) {
    const payment = await this.storage.findById("payments.json", paymentId);
    assert(payment, 404, "Payment not found.");
    if (!payment.providerPaymentId) return payment;
    if (
      !event &&
      (["paid", "cancelled", "failed", "refunded", "returned"].includes(payment.status) ||
        (payment.lastCheckedAt && Date.now() - Date.parse(payment.lastCheckedAt) < 4000))
    )
      return payment;
    const remote = await this.provider.getPaymentStatus(payment.providerPaymentId);
    assert(
      remote.referenceID === payment.providerPaymentId,
      409,
      "PayRam reference does not match this payment.",
    );
    assert(
      remote.customerID === payment.orderId && remote.invoiceID === payment.orderId,
      409,
      "PayRam invoice does not match this order.",
    );
    assert(
      usdCents(remote.amountInUSD) === usdCents(payment.fiatAmount),
      409,
      "PayRam invoice amount does not match this order.",
    );
    assert(Object.hasOwn(states, remote.paymentState), 409, "Unknown PayRam payment state.");
    const options = await this.provider.getDepositOptions(payment.providerPaymentId);
    assert(Array.isArray(options), 502, "PayRam returned invalid deposit options.");
    const option = options.find(
      (option) =>
        option.blockchainCode === payment.cryptoNetwork &&
        option.currencyCode === payment.cryptoCurrency,
    );
    assert(option, 409, "PayRam does not offer the configured asset on this network.");
    if (event) {
      assert(event.reference_id === payment.providerPaymentId, 409, "Webhook payment mismatch.");
      if (event.invoice_id !== undefined)
        assert(event.invoice_id === payment.orderId, 409, "Webhook invoice mismatch.");
      if (event.customer_id !== undefined)
        assert(event.customer_id === payment.orderId, 409, "Webhook customer mismatch.");
      if (event.currency !== undefined)
        assert(event.currency === payment.cryptoCurrency, 409, "Webhook crypto currency mismatch.");
      // amount is denominated in crypto, NOT USD. Do not assume USDT has a fixed USD rate.
      if (event.amount !== undefined)
        assert(decimal(event.amount) > 0n, 400, "Invalid requested crypto amount.");
      if (["FILLED", "OVER_FILLED"].includes(event.status)) {
        assert(
          ["FILLED", "OVER_FILLED"].includes(remote.paymentState),
          409,
          "PayRam confirmation is not final yet. Retry this webhook.",
        );
        if (event.amount !== undefined && event.filled_amount !== undefined)
          assert(
            decimal(event.filled_amount) >= decimal(event.amount),
            409,
            "Webhook reports an underpayment.",
          );
        if (event.filled_amount_in_usd !== undefined)
          assert(
            decimal(event.filled_amount_in_usd) >= decimal(payment.fiatAmount.toFixed(2)),
            409,
            "Webhook USD amount is insufficient.",
          );
      }
      for (const info of event.payment_info) {
        if (info.destination_address !== undefined)
          assert(isAddress(info.destination_address), 409, "Invalid PayRam deposit address.");
        if (info.destination_address !== undefined)
          assert(
            typeof option.customerAddress === "string" &&
              option.customerAddress.toLowerCase() === info.destination_address.toLowerCase(),
            409,
            "Webhook destination does not match the PayRam deposit address.",
          );
      }
    }
    const state = states[remote.paymentState];
    return this.storage.transaction((data) => {
      const record = data["payments.json"].find((p) => p.id === paymentId);
      const order = data["orders.json"].find((o) => o.id === record.orderId);
      assert(order, 409, "Payment order is missing.");
      const eventKey = event ? event.reference_id + ":" + event.status : null;
      if (eventKey && data["payment-events.json"].some((e) => e.providerEventId === eventKey)) {
        this.log("duplicate webhook ignored", record);
        return record;
      }
      if (event) {
        const hashes = event.payment_info
          .map((i) => i.transaction_hash)
          .filter((v) => typeof v === "string");
        for (const tx of hashes)
          assert(
            !data["payments.json"].some(
              (p) => p.id !== record.id && p.transactionHashes?.includes(tx),
            ),
            409,
            "Transaction is already assigned to another payment.",
          );
        record.transactionHashes = [...new Set([...record.transactionHashes, ...hashes])];
        record.transactionHash = record.transactionHashes[0] || null;
        record.depositAddresses = [
          ...new Set([
            ...record.depositAddresses,
            ...event.payment_info.map((i) => i.destination_address).filter(Boolean),
          ]),
        ];
        if (
          event.filled_amount &&
          (!record.cryptoAmount || decimal(event.filled_amount) >= decimal(record.cryptoAmount))
        )
          record.cryptoAmount = event.filled_amount;
      }
      const timestamp = now();
      record.lastCheckedAt = timestamp;
      record.updatedAt = timestamp;
      // A late OPEN or cancelled delivery must never undo a completed order.
      if (!["paid", "refunded", "returned"].includes(record.status)) {
        // PARTIALLY_FILLED cannot be downgraded by an older OPEN response.
        if (!(record.status === "processing" && state === "pending")) record.status = state;
        if (state === "paid") {
          record.paidAt = timestamp;
          record.failureReason = null;
          order.status = "paid";
          order.paidAt = timestamp;
          order.updatedAt = timestamp;
          // Paid is not fulfillment: an ERP activation system must issue real licenses.
          this.log("payment paid", record);
        } else if (state === "cancelled") {
          order.status = "cancelled";
          order.updatedAt = timestamp;
          record.failureReason = "The PayRam payment expired or was cancelled.";
          this.log("payment failed", record);
        } else {
          this.log("payment processing", record);
        }
      }
      if (event)
        data["payment-events.json"].push({
          id: id("evt"),
          paymentId: record.id,
          providerEventId: eventKey,
          eventType: event.status,
          payload: event,
          receivedAt: timestamp,
        });
      return record;
    });
  }
  async payment(id, token) {
    const record = await this.storage.findById("payments.json", id);
    this.authorize(record, token);
    const latest = await this.refresh(id);
    return publicRecord(latest);
  }
  async order(id, token) {
    const order = await this.storage.findById("orders.json", id);
    this.authorize(order, token);
    return publicRecord(order);
  }
  async orderPayment(id, token) {
    await this.order(id, token);
    const payment = (await this.storage.readJson("payments.json")).find((p) => p.orderId === id);
    assert(payment, 404, "Payment not found.");
    return this.payment(payment.id, token);
  }
  async webhook(rawBody, headers) {
    this.log("webhook received");
    assert(this.provider.verifyWebhook({ rawBody, headers }), 401, "Invalid PayRam signature.");
    this.log("webhook verified");
    let payload;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      assert(false, 400, "Invalid webhook JSON.");
    }
    const event = this.provider.parseWebhook(payload);
    const payment = (await this.storage.readJson("payments.json")).find(
      (p) => p.providerPaymentId === event.reference_id,
    );
    // Retry later if the webhook raced the create-payment response.
    assert(payment, 409, "PayRam payment is not linked to a local order yet.");
    const key = event.reference_id + ":" + event.status;
    if (
      (await this.storage.readJson("payment-events.json")).some((e) => e.providerEventId === key)
    ) {
      this.log("duplicate webhook ignored", payment);
      return { received: true, duplicate: true };
    }
    await this.refresh(payment.id, event);
    return { received: true };
  }
}
