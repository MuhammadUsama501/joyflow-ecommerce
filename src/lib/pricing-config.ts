import defaultConfig from "@/data/pricing-config.json";

export type ConfigOption = {
  id: string;
  label: string;
  price_cents: number;
};

export type PricingConfig = {
  terminals: ConfigOption[];
  locations: ConfigOption[];
  support: ConfigOption[];
  bundleDiscountPercent: number;
};

export type PlanSelection = {
  productSlugs: string[];
  terminalId: string;
  locationId: string;
  supportId: string;
};

const STORAGE_KEY = "ledgerline.plan-config.v1";

export function getPlanConfig(): PricingConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PricingConfig;
  } catch {
    /* ignore malformed */
  }
  return defaultConfig as PricingConfig;
}

export function savePlanConfig(config: PricingConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function resetPlanConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getConfigOption(options: ConfigOption[], id: string): ConfigOption | undefined {
  return options.find((o) => o.id === id);
}
