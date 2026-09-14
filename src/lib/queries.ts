import { queryOptions } from "@tanstack/react-query";

import { api } from "@/services/api";

import catalog from "@/data/products.json";

export type Product = (typeof catalog)[number];

export { catalog };

const OVERRIDES_KEY = "ledgerline.product-overrides.v1";

type OverridesState = { overrides: Product[] };

function readOverrides(): Map<string, Product> {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as OverridesState;
    if (!Array.isArray(parsed.overrides)) return new Map();
    return new Map(parsed.overrides.map((p) => [p.id, p]));
  } catch {
    return new Map();
  }
}

function writeOverrides(overrides: Product[]): void {
  try {
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify({ overrides }));
  } catch {
    /* storage unavailable */
  }
}

export function mergedCatalog(): Product[] {
  const overrides = readOverrides();
  const merged = new Map<string, Product>();
  for (const p of catalog) merged.set(p.id, p);
  for (const [id, p] of overrides) merged.set(id, p);
  return [...merged.values()].sort((a, b) => a.sort_order - b.sort_order);
}

export const productsQuery = queryOptions({
  queryKey: ["products"],
  queryFn: async (): Promise<Product[]> => loadStoreProducts(),
});

export const allProductsQuery = queryOptions({
  queryKey: ["products", "all"],
  queryFn: async (): Promise<Product[]> => mergedCatalog(),
});

export const productQuery = (slug: string) =>
  queryOptions({
    queryKey: ["products", slug],
    queryFn: async (): Promise<Product | undefined> =>
      (await loadStoreProducts()).find((p) => p.slug.toLowerCase() === slug.toLowerCase()),
  });

export function upsertProduct(product: Product): void {
  const overrides = readOverrides();
  overrides.set(product.id, product);
  writeOverrides([...overrides.values()]);
}

export function removeProduct(id: string): void {
  const overrides = readOverrides();
  overrides.delete(id);
  writeOverrides([...overrides.values()]);
}

export function resetProductOverrides(): void {
  try {
    localStorage.removeItem(OVERRIDES_KEY);
  } catch {
    /* storage unavailable */
  }
}

export type PriceLine = {
  slug: string;
  name: string;
  qty: number;
  price_cents: number;
};

export function priceCart(items: { slug: string; qty: number }[]): {
  lines: PriceLine[];
  total_cents: number;
  currency: "USD";
} {
  const lines = items.map((i) => {
    const product = mergedCatalog().find(
      (p) => p.slug.toLowerCase() === i.slug.toLowerCase() && p.is_active,
    );
    if (!product) throw new Error(`Product unavailable: ${i.slug}`);
    return {
      slug: product.slug,
      name: product.name,
      qty: i.qty,
      price_cents: product.price_cents,
    };
  });
  const total_cents = lines.reduce((n, l) => n + l.qty * l.price_cents, 0);
  return { lines, total_cents, currency: "USD" };
}

async function loadStoreProducts(): Promise<Product[]> {
  const products =
    await api<
      (Omit<Product, "price_cents" | "is_active"> & { price: number; isActive: boolean })[]
    >("/api/products");
  return products.map(({ price, isActive, ...product }) => ({
    ...product,
    price_cents: Math.round(price * 100),
    is_active: isActive,
  }));
}

export async function loadCartProduct(slug: string): Promise<Product> {
  const product = await api<
    Omit<Product, "price_cents" | "is_active"> & { price: number; isActive: boolean }
  >("/api/products/" + encodeURIComponent(slug));
  return { ...product, price_cents: Math.round(product.price * 100), is_active: product.isActive };
}
