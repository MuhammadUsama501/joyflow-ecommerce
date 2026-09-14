import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
export type CartLine = { slug: string; name: string; priceCents: number; qty: number };
type CartContextValue = {
  lines: CartLine[];
  count: number;
  totalCents: number;
  ready: boolean;
  add: (line: Omit<CartLine, "qty">, qty?: number) => void;
  remove: (slug: string) => void;
  setQty: (slug: string, qty: number) => void;
  clear: () => void;
};
const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "ledgerline.cart.v1";
export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const data: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(data))
        setLines(
          data
            .filter(
              (line): line is CartLine =>
                line &&
                typeof line.slug === "string" &&
                typeof line.name === "string" &&
                Number.isSafeInteger(line.priceCents) &&
                line.priceCents >= 0 &&
                Number.isInteger(line.qty) &&
                line.qty >= 1 &&
                line.qty <= 50,
            )
            .slice(0, 50),
        );
    } catch {
      /* Ignore malformed saved carts. */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* Cart still works in memory. */
    }
  }, [lines, ready]);
  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      ready,
      count: lines.reduce((n, l) => n + l.qty, 0),
      totalCents: lines.reduce((n, l) => n + l.qty * l.priceCents, 0),
      add: (line, qty = 1) => {
        if (!Number.isInteger(qty) || qty < 1) return;
        setLines((previous) =>
          previous.some((l) => l.slug === line.slug)
            ? previous.map((l) =>
                l.slug === line.slug ? { ...l, ...line, qty: Math.min(50, l.qty + qty) } : l,
              )
            : previous.length < 50
              ? [...previous, { ...line, qty: Math.min(50, qty) }]
              : previous,
        );
      },
      remove: (slug) => setLines((previous) => previous.filter((l) => l.slug !== slug)),
      setQty: (slug, qty) => {
        if (!Number.isInteger(qty) || qty < 0 || qty > 50) return;
        setLines((previous) =>
          qty === 0
            ? previous.filter((l) => l.slug !== slug)
            : previous.map((l) => (l.slug === slug ? { ...l, qty } : l)),
        );
      },
      clear: () => setLines([]),
    }),
    [lines, ready],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
