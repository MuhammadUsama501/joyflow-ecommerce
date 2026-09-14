import express from "express";
import { quotePlan } from "./services/plan.service.js";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { CheckoutService } from "./services/checkout.service.js";
import { assert } from "./utils/errors.js";
export function createApp({ storage, provider, config, logger = console }) {
  const app = express();
  const service = new CheckoutService(storage, provider, config, logger);
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: config.clientUrl,
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
    }),
  );
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  const limiter = (limit) =>
    rateLimit({
      windowMs: 60_000,
      limit,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { success: false, message: "Too many requests. Please try again shortly." },
    });
  const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
  const token = (req) => req.get("Authorization")?.replace(/^Bearer /, "") || "";
  app.post(
    "/api/webhooks/payram",
    limiter(300),
    express.raw({ type: "application/json", limit: "64kb" }),
    async (req, res) => {
      assert(Buffer.isBuffer(req.body), 400, "Expected an application/json webhook body.");
      ok(res, await service.webhook(req.body, req.headers));
    },
  );
  app.use(express.json({ limit: "32kb" }));
  app.get("/api/health", (_req, res) => ok(res, { status: "ok" }));
  app.get("/api/payment-config", (_req, res) => {
    let configured = true;
    try {
      provider.assertConfigured();
    } catch {
      configured = false;
    }
    ok(res, {
      configured,
      cardEnabled: configured && config.cardEnabled,
      cryptoAsset: config.asset,
      cryptoNetwork: config.network,
    });
  });
  app.get("/api/products", async (_req, res) =>
    ok(
      res,
      (await service.products()).filter((p) => !p.isCustom),
    ),
  );
  app.get("/api/products/:id", async (req, res) => {
    const product = (await service.products()).find(
      (p) => p.id === req.params.id || p.slug === req.params.id,
    );
    assert(product, 404, "Product not found.");
    ok(res, product);
  });
  app.post("/api/plan-quotes", limiter(10), async (req, res) =>
    ok(res, await quotePlan(storage, req.body)),
  );
  app.post("/api/checkout", limiter(10), async (req, res) =>
    ok(res, await service.checkout(req.body, req.get("Idempotency-Key")), 201),
  );
  app.use(["/api/orders", "/api/payments"], limiter(90));
  app.get("/api/orders/:orderId", async (req, res) =>
    ok(res, await service.order(req.params.orderId, token(req))),
  );
  app.get("/api/orders/:orderId/payment-status", async (req, res) =>
    ok(res, await service.orderPayment(req.params.orderId, token(req))),
  );
  app.get("/api/payments/:paymentId", async (req, res) =>
    ok(res, await service.payment(req.params.paymentId, token(req))),
  );
  app.use((_req, res) => res.status(404).json({ success: false, message: "API route not found." }));
  app.use((error, _req, res, _next) => {
    const status = Number.isInteger(error.status) ? error.status : 500;
    if (status >= 500) logger.error("API request failed", { status }); // never dump provider errors or secrets
    res
      .status(status)
      .json({
        success: false,
        message:
          status === 500
            ? "Something went wrong. Please try again."
            : error.type === "entity.parse.failed"
              ? "Invalid JSON request."
              : error.message,
      });
  });
  return app;
}
