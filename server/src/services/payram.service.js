import { createHmac, timingSafeEqual } from "node:crypto";
import { assert, HttpError } from "../utils/errors.js";
import { validatePaymentConfig } from "../config.js";
// Official REST contract checked 2026-09-15; documentation links are in README.
export class PayRamService {
  constructor(config, fetchImpl = fetch) {
    this.config = config;
    this.fetch = fetchImpl;
  }
  assertConfigured() {
    validatePaymentConfig(this.config);
  }
  async request(endpoint, body) {
    this.assertConfigured();
    let response;
    try {
      response = await this.fetch(new URL(endpoint, this.config.apiUrl), {
        method: body ? "POST" : "GET",
        headers: { "API-Key": this.config.apiKey, "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(12000),
      });
    } catch {
      throw new HttpError(502, "PayRam could not be reached. Payment confirmation may be delayed.");
    }
    if (!response.ok)
      throw new HttpError(502, "PayRam rejected the request. Check the gateway configuration.");
    try {
      return await response.json();
    } catch {
      throw new HttpError(502, "PayRam returned an invalid response.");
    }
  }
  async createCheckout({ order, payment }) {
    const result = await this.request("/api/v1/payment", {
      customerEmail: order.customer.email,
      customerID: order.id,
      invoiceID: order.id,
      amountInUSD: order.totalAmount,
      currency: payment.cryptoCurrency,
      network: payment.cryptoNetwork,
    });
    assert(
      typeof result.reference_id === "string" && result.reference_id.length > 0,
      502,
      "PayRam did not return a payment reference.",
    );
    let url;
    try {
      url = new URL(result.url);
    } catch {
      throw new HttpError(502, "PayRam did not return a checkout URL.");
    }
    assert(
      url.origin === new URL(this.config.apiUrl).origin && !url.username && !url.password,
      502,
      "PayRam checkout URL does not match the gateway.",
    );
    return {
      providerPaymentId: result.reference_id,
      checkout: { type: "payram", url: url.href, sessionId: result.reference_id },
    };
  }
  getPaymentStatus(reference) {
    return this.request("/api/v1/payment/reference/" + encodeURIComponent(reference));
  }
  getDepositOptions(reference) {
    return this.request("/api/v1/blockchain-currency/reference/" + encodeURIComponent(reference));
  }
  verifyWebhook({ rawBody, headers }) {
    this.assertConfigured();
    const signature = headers["x-payram-signature"];
    if (typeof signature !== "string" || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
    const expected =
      "sha256=" + createHmac("sha256", this.config.apiKey).update(rawBody).digest("hex");
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }
  parseWebhook(payload) {
    assert(
      payload && typeof payload === "object" && !Array.isArray(payload),
      400,
      "Invalid webhook payload.",
    );
    assert(
      typeof payload.reference_id === "string" && payload.reference_id.length <= 200,
      400,
      "Missing PayRam reference.",
    );
    assert(
      ["OPEN", "PARTIALLY_FILLED", "FILLED", "OVER_FILLED", "CANCELLED"].includes(payload.status),
      400,
      "Unknown PayRam payment state.",
    );
    const safe = {};
    for (const name of [
      "reference_id",
      "invoice_id",
      "customer_id",
      "status",
      "amount",
      "currency",
      "filled_amount",
      "filled_amount_in_usd",
      "timestamp",
      "confirmation_current",
      "confirmation_required",
    ]) {
      if (
        ["string", "number"].includes(typeof payload[name]) &&
        String(payload[name]).length <= 200
      )
        safe[name] = payload[name];
    }
    safe.payment_info = (Array.isArray(payload.payment_info) ? payload.payment_info : [])
      .slice(0, 100)
      .map((entry) => {
        const clean = {};
        for (const key of ["transaction_hash", "destination_address", "block_number"]) {
          if (
            entry &&
            ["string", "number"].includes(typeof entry[key]) &&
            String(entry[key]).length <= 200
          )
            clean[key] = entry[key];
        }
        return clean;
      });
    return safe;
  }
}
