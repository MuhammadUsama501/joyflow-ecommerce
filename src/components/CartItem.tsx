import { formatPrice } from "@/lib/money";
import type { CartLine } from "@/lib/cart";
export function CartItem({
  line,
  setQty,
  remove,
}: {
  line: CartLine;
  setQty: (slug: string, qty: number) => void;
  remove: (slug: string) => void;
}) {
  return (
    <li className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="break-words font-semibold">{line.name}</p>
        <p className="font-mono text-[11px] uppercase tracking-wider text-subtle">
          {formatPrice(line.priceCents)} each
        </p>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3">
        <input
          aria-label={"Quantity for " + line.name}
          type="number"
          min={1}
          max={50}
          value={line.qty}
          onChange={(event) => setQty(line.slug, Number(event.target.value))}
          className="w-16 rounded-xl border border-line bg-paper px-3 py-2 text-sm tabular-nums outline-none focus:border-brand/50"
        />
        <span className="text-right font-bold tabular-nums">
          {formatPrice(line.priceCents * line.qty)}
        </span>
        <button
          type="button"
          onClick={() => remove(line.slug)}
          className="font-mono text-[11px] uppercase tracking-wider text-subtle hover:text-ink"
        >
          Remove
        </button>
      </div>
    </li>
  );
}
