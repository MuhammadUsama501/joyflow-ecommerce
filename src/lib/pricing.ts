import type { Product } from "@/lib/queries";
import { getPlanConfig, getConfigOption, type PlanSelection } from "@/lib/pricing-config";

export type PriceBreakdown = {
  label: string;
  amount_cents: number;
};

export type PlanPriceResult = {
  basePrice: number;
  addonPrice: number;
  discount: number;
  total: number;
  breakdown: PriceBreakdown[];
};

export function calculatePlanPrice(selection: PlanSelection, products: Product[]): PlanPriceResult {
  const config = getPlanConfig();
  const breakdown: PriceBreakdown[] = [];
  let basePrice = 0;
  let addonPrice = 0;

  // Base prices from selected products
  for (const slug of selection.productSlugs) {
    const product = products.find((p) => p.slug === slug);
    if (product) {
      basePrice += product.price_cents;
      breakdown.push({ label: product.name, amount_cents: product.price_cents });
    }
  }

  // Terminal add-on
  const terminal = getConfigOption(config.terminals, selection.terminalId);
  if (terminal && terminal.price_cents > 0) {
    addonPrice += terminal.price_cents;
    breakdown.push({ label: terminal.label, amount_cents: terminal.price_cents });
  }

  // Location add-on
  const location = getConfigOption(config.locations, selection.locationId);
  if (location && location.price_cents > 0) {
    addonPrice += location.price_cents;
    breakdown.push({ label: location.label, amount_cents: location.price_cents });
  }

  // Support add-on
  const support = getConfigOption(config.support, selection.supportId);
  if (support && support.price_cents > 0) {
    addonPrice += support.price_cents;
    breakdown.push({ label: support.label, amount_cents: support.price_cents });
  }

  // Bundle discount
  const subtotal = basePrice + addonPrice;
  let discount = 0;
  if (selection.productSlugs.length >= 3 && subtotal > 0) {
    discount = Math.round(subtotal * (config.bundleDiscountPercent / 100));
    breakdown.push({
      label: `Bundle discount (${config.bundleDiscountPercent}%)`,
      amount_cents: -discount,
    });
  }

  const total = subtotal - discount;

  return { basePrice, addonPrice, discount, total, breakdown };
}
