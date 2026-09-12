import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartLine = {
  slug: string;
  name: string;
  priceCents: number;
  qty: number;
};

type CartContextValue = {
  lines: CartLine[];
  count: number;
  totalCents: number;
  add: (line: Omit<CartLine, "qty">, qty?: number) => void;
  remove: (slug: string) => void;
  setQty: (slug: string, qty: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "ledgerline.cart.v1";
const MAX_QTY = 50;

function normalizeLines(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((line): line is CartLine => {
      return (
        typeof line === "object" &&
        line !== null &&
        typeof line.slug === "string" &&
        typeof line.name === "string" &&
        typeof line.priceCents === "number" &&
        Number.isFinite(line.priceCents) &&
        typeof line.qty === "number" &&
        Number.isFinite(line.qty) &&
        line.qty >= 1
      );
    })
    .map((line) => ({ ...line, qty: Math.min(MAX_QTY, Math.floor(line.qty)) }));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setLines(normalizeLines(JSON.parse(raw)));
    } catch {
      /* ignore malformed cart */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* storage unavailable */
    }
  }, [lines]);

  const value = useMemo<CartContextValue>(() => {
    return {
      lines,
      count: lines.reduce((n, l) => n + l.qty, 0),
      totalCents: lines.reduce((n, l) => n + l.qty * l.priceCents, 0),
      add: (line, qty = 1) =>
        setLines((prev) => {
          const existing = prev.find((l) => l.slug === line.slug);
          if (existing) {
            return prev.map((l) =>
              l.slug === line.slug ? { ...l, qty: Math.min(MAX_QTY, l.qty + Math.max(1, qty)) } : l,
            );
          }
          return [...prev, { ...line, qty: Math.min(MAX_QTY, Math.max(1, qty)) }];
        }),
      remove: (slug) => setLines((prev) => prev.filter((l) => l.slug !== slug)),
      setQty: (slug, qty) =>
        setLines((prev) =>
          qty <= 0
            ? prev.filter((l) => l.slug !== slug)
            : prev.map((l) => (l.slug === slug ? { ...l, qty: Math.min(MAX_QTY, Math.floor(qty)) } : l)),
        ),
      clear: () => setLines([]),
    };
  }, [lines]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
