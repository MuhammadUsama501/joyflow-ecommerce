import { test, expect } from "@playwright/test";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { JsonStorage } from "../../src/storage/jsonStorage.js";
import { createApp } from "../../src/app.js";
import { PayRamService } from "../../src/services/payram.service.js";
import { loadConfig } from "../../src/config.js";
let server;
const records = new Map();
test.beforeAll(async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "payram-browser-"));
  const storage = new JsonStorage(directory);
  await storage.init();
  await storage.writeJson(
    "products.json",
    JSON.parse(await readFile(new URL("../../data/products.json", import.meta.url), "utf8")),
  );
  const config = loadConfig({
    CLIENT_URL: "http://localhost:5173",
    PAYRAM_API_URL: "http://127.0.0.1:5000",
    PAYRAM_API_KEY: "browser-test-only",
    MERCHANT_WALLET_ADDRESS: "0x0000000000000000000000000000000000000001",
    CRYPTO_NETWORK: "ETH",
    PAYRAM_WALLET_CONFIGURED: "true",
  });
  const provider = new PayRamService(config, async (url, options) => {
    if (options.method === "POST") {
      const body = JSON.parse(options.body);
      const reference = randomUUID();
      records.set(reference, {
        referenceID: reference,
        customerID: body.customerID,
        invoiceID: body.invoiceID,
        amountInUSD: String(body.amountInUSD),
        paymentState: "OPEN",
      });
      return Response.json({
        reference_id: reference,
        url: "http://127.0.0.1:5000/payments?reference_id=" + reference,
      });
    }
    if (url.pathname.includes("/blockchain-currency/"))
      return Response.json([
        {
          blockchainCode: "ETH",
          currencyCode: "USDT",
          customerAddress: "0x0000000000000000000000000000000000000001",
        },
      ]);
    return Response.json(records.get(url.pathname.split("/").at(-1)));
  });
  const app = createApp({ storage, provider, config, logger: { info() {}, error() {} } });
  server = await new Promise((resolve) => {
    const running = app.listen(5000, "127.0.0.1", () => resolve(running));
  });
});
test.afterAll(async () => {
  if (server)
    await new Promise((resolve) => {
      server.closeAllConnections();
      server.close(resolve);
    });
});
test("catalog, persisted cart, hosted checkout, verified success and private order access", async ({
  page,
  context,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/catalog");
  await page.getByRole("button", { name: "Add to cart" }).first().click();
  await page.goto("/cart");
  await expect(page.getByRole("spinbutton").first()).toHaveValue("1");
  await page.reload();
  await expect(page.getByRole("spinbutton").first()).toHaveValue("1");
  await page.getByRole("link", { name: "Continue with PayRam" }).click();
  await page.getByLabel("Full name").fill("Browser Customer");
  await page.getByLabel("Email address", { exact: true }).fill("browser@example.com");
  await page.getByRole("button", { name: "Continue to Secure Payment" }).click();
  await expect(page).toHaveURL(/payment-processing/);
  await expect(page.getByRole("heading", { name: "Payment processing" })).toBeVisible();
  const remote = [...records.values()].at(-1);
  remote.paymentState = "FILLED";
  await expect(page.getByRole("heading", { name: "Payment confirmed" })).toBeVisible({
    timeout: 20000,
  });
  const successUrl = page.url();
  const privatePage = await context.newPage();
  await privatePage.goto(successUrl);
  await expect(
    privatePage.getByRole("heading", { name: "Payment is not confirmed" }),
  ).toBeVisible();
  await privatePage.close();
  await page.goto("/cart");
  await expect(page.getByText("Your cart is empty.")).toBeVisible();
  expect(errors).toEqual([]);
});
test("mobile checkout fits viewport and unavailable configuration prevents payment", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/payment-config", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { configured: false, cardEnabled: false, cryptoAsset: "USDT", cryptoNetwork: "" },
      },
    }),
  );
  await page.goto("/catalog");
  await page.getByRole("button", { name: "Add to cart" }).first().click();
  await page.goto("/checkout");
  await expect(
    page.getByText("PayRam checkout is not available yet. Please contact the store."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue to Secure Payment" })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test("custom plan receives a server-priced product that can reach checkout", async ({ page }) => {
  await page.goto("/pricing");
  await page.getByText("Ledgerline ERP", { exact: true }).first().click();
  await page.getByRole("button", { name: /add.*cart/i }).click();
  await expect(page.getByText("Custom plan added to cart!", { exact: true })).toBeVisible();
  await page.goto("/checkout");
  await expect(page.getByRole("heading", { name: "Secure checkout" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue to Secure Payment" })).toBeEnabled();
});
