import { createHash } from "node:crypto";
import pricing from "../../../src/data/pricing-config.json" with { type: "json" };
import { assert } from "../utils/errors.js";
import { usdCents } from "./checkout.service.js";

export async function quotePlan(storage, selection) {
  assert(
    selection &&
      Array.isArray(selection.productSlugs) &&
      selection.productSlugs.length > 0 &&
      selection.productSlugs.length <= 20,
    400,
    "Select products for your plan.",
  );
  assert(
    selection.productSlugs.every((slug) => typeof slug === "string" && slug.length <= 150),
    400,
    "Invalid plan product.",
  );
  const slugs = [...new Set(selection.productSlugs)].sort();
  const options = ["terminals", "locations", "support"].map((group, index) => {
    const key = ["terminalId", "locationId", "supportId"][index];
    const option = pricing[group].find((entry) => entry.id === selection[key]);
    assert(
      option && Number.isSafeInteger(option.price_cents) && option.price_cents >= 0,
      400,
      "Invalid plan option.",
    );
    return option;
  });
  return storage.transaction((data) => {
    const products = slugs.map((slug) => {
      const product = data["products.json"].find(
        (p) => p.slug === slug && p.isActive && !p.isCustom,
      );
      assert(product && product.currency === "USD", 400, "A plan product is unavailable.");
      return product;
    });
    const subtotal =
      products.reduce((sum, p) => sum + usdCents(p.price), 0) +
      options.reduce((sum, o) => sum + o.price_cents, 0);
    const discount =
      products.length >= 3 ? Math.round((subtotal * pricing.bundleDiscountPercent) / 100) : 0;
    const price = (subtotal - discount) / 100;
    usdCents(price);
    const selectionSnapshot = {
      productSlugs: slugs,
      options,
      prices: products.map((p) => [p.id, p.price]),
      discount,
    };
    const reference =
      "plan-" +
      createHash("sha256").update(JSON.stringify(selectionSnapshot)).digest("hex").slice(0, 32);
    const existing = data["products.json"].find((p) => p.id === reference);
    if (existing) return existing;
    const product = {
      id: reference,
      slug: reference,
      name: "Custom Plan: " + products.map((p) => p.name).join(" + "),
      sku: reference,
      category: "Plan",
      description: options.map((o) => o.label).join(" · "),
      features: options.map((o) => o.label),
      price,
      currency: "USD",
      isActive: true,
      is_featured: false,
      sort_order: 999,
      isCustom: true,
      includedProductIds: products.map((p) => p.id),
      selection: selectionSnapshot,
    };
    data["products.json"].push(product);
    return product;
  });
}
