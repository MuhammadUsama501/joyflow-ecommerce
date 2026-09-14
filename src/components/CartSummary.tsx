import { formatPrice } from "@/lib/money";
export function CartSummary({
  items,
}: {
  items: { name: string; quantity: number; priceCents: number }[];
}) {
  const total = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  return (
    <section className="rounded-[24px] border border-line bg-surface p-6 shadow-panel">
      <h2 className="text-lg font-bold">Order summary</h2>
      <ul className="mt-4 space-y-3">
        {items.map((item, index) => (
          <li key={index} className="flex justify-between gap-4 text-sm">
            <span>
              {item.name} × {item.quantity}
            </span>
            <span className="shrink-0 tabular-nums">
              {formatPrice(item.priceCents * item.quantity)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex justify-between border-t border-line pt-4">
        <span>Subtotal</span>
        <span>{formatPrice(total)}</span>
      </div>
      <div className="mt-2 flex justify-between text-xl font-bold">
        <span>Total</span>
        <span>{formatPrice(total)}</span>
      </div>
    </section>
  );
}
