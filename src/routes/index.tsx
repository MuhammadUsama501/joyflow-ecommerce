import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { productsQuery } from "@/lib/queries";
import { ProductCard } from "@/components/ProductCard";
import { formatPrice } from "@/lib/money";
import { useCart } from "@/lib/cart";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ledgerline — ERP, POS & Restaurant Software Licenses" },
      {
        name: "description",
        content:
          "Perpetual ERP, POS and restaurant management licenses. Instant activation keys, PayPal checkout, no shipping.",
      },
      { property: "og:title", content: "Ledgerline — ERP, POS & Restaurant Software Licenses" },
      {
        property: "og:description",
        content: "Perpetual software licenses for restaurants and back office teams.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: products = [] } = useQuery(productsQuery);
  const { add, lines, totalCents } = useCart();
  const featured = products.find((p) => p.is_featured) ?? products[0];
  const rest = products.filter((p) => p.id !== featured?.id).slice(0, 4);

  return (
    <main className="mx-auto max-w-7xl px-6">
      <section className="grid gap-8 py-14 lg:grid-cols-12 lg:gap-10">
        <div className="animate-rise lg:col-span-5">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-brand">
            (01) — License storefront
          </p>
          <h1 className="max-w-[16ch] text-balance text-4xl font-bold leading-[1.08] tracking-tight">
            Perpetual software licenses, priced like a line item.
          </h1>
          <p className="mt-5 max-w-[40ch] text-pretty leading-relaxed text-subtle">
            ERP, POS and restaurant management sold as digital licenses. No shipping, no seat games —
            one order, one activation key.
          </p>
          <div className="mt-7 flex items-center gap-3">
            <Link
              to="/catalog"
              className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground shadow-brand transition-transform hover:-translate-y-0.5"
            >
              Browse catalog
            </Link>
            <Link
              to="/policy"
              className="rounded-xl border border-line bg-surface px-5 py-3 text-sm font-semibold transition-colors hover:border-brand/40"
            >
              View license policy
            </Link>
          </div>
          <dl className="mt-9 flex flex-wrap gap-x-8 gap-y-4">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-subtle">
                Install base
              </dt>
              <dd className="text-lg font-bold tabular-nums">12,480</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-subtle">
                Avg. activation
              </dt>
              <dd className="text-lg font-bold tabular-nums">4 min</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-subtle">
                Uptime SLA
              </dt>
              <dd className="text-lg font-bold tabular-nums">99.98%</dd>
            </div>
          </dl>
        </div>

        {featured ? (
          <div className="animate-rise lg:col-span-7">
            <div className="relative h-full rounded-[24px] border border-line bg-surface p-7 shadow-panel">
              <span className="absolute right-5 top-5 rounded-full bg-sage/10 px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-sage">
                In stock · instant key
              </span>
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brand">
                    Featured edition
                  </p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight">{featured.name}</h2>
                </div>
                <span className="font-mono text-xs text-subtle">SKU {featured.sku}</span>
              </div>
              <div className="mt-5 space-y-2.5 border-t border-line pt-5 text-sm">
                {featured.features.map((f) => (
                  <div key={f} className="flex justify-between">
                    <span className="text-subtle">{f}</span>
                    <span className="font-medium">Included</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-end justify-between border-t border-line pt-5">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-subtle">
                    Perpetual license
                  </span>
                  <div className="text-3xl font-bold tabular-nums">
                    {formatPrice(featured.price_cents, featured.currency)}
                  </div>
                </div>
                <button
                  onClick={() => {
                    add({
                      slug: featured.slug,
                      name: featured.name,
                      priceCents: featured.price_cents,
                    });
                    toast.success("Added to cart");
                  }}
                  className="rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand"
                >
                  Add to cart
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-8 py-8 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-8">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="text-xl font-bold tracking-tight">Catalog</h2>
            <span className="font-mono text-[11px] uppercase tracking-wider text-subtle">
              (02) — {rest.length} editions
            </span>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {rest.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>

        <aside className="lg:col-span-4">
          <div className="rounded-[20px] border border-line bg-surface p-5 shadow-card">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-bold tracking-tight">Your cart</h2>
              <span className="font-mono text-[11px] text-subtle">(03) — {lines.length} items</span>
            </div>
            <ul className="mt-4 space-y-3 text-sm">
              {lines.length === 0 ? (
                <li className="text-subtle">No licenses selected yet.</li>
              ) : (
                lines.map((l) => (
                  <li key={l.slug} className="flex items-center justify-between gap-3">
                    <span className="text-subtle">
                      {l.name}
                      {l.qty > 1 ? ` ×${l.qty}` : ""}
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatPrice(l.priceCents * l.qty)}
                    </span>
                  </li>
                ))
              )}
            </ul>
            <div className="mt-4 flex items-end justify-between border-t border-line pt-4">
              <span className="font-medium text-subtle">Total</span>
              <span className="text-2xl font-bold tabular-nums">{formatPrice(totalCents)}</span>
            </div>
            <Link
              to="/cart"
              className="mt-4 block w-full rounded-xl bg-paypal px-4 py-3 text-center text-sm font-semibold text-paypal-foreground transition-transform hover:-translate-y-0.5"
            >
              PayPal Checkout
            </Link>
            <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-wider text-subtle">
              Digital delivery · no shipping
            </p>
          </div>
        </aside>
      </section>

      <section className="grid gap-8 py-8 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7">
          <h2 className="text-xl font-bold tracking-tight">Pricing tiers</h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-subtle">
            (04) — Plate &amp; Ledger POS · perpetual
          </p>
          <div className="mt-5 overflow-hidden rounded-[20px] border border-line bg-surface shadow-panel">
            <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-3">
              <div className="bg-surface p-5">
                <p className="font-mono text-[10px] uppercase tracking-wider text-subtle">Single</p>
                <div className="mt-2 text-2xl font-bold tabular-nums">$490</div>
                <ul className="mt-4 space-y-2 text-sm text-subtle">
                  <li>1 terminal</li>
                  <li>Basic reporting</li>
                  <li>Email support</li>
                </ul>
              </div>
              <div className="relative bg-brand/5 p-5">
                <span className="absolute right-4 top-4 rounded-full bg-brand px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider text-brand-foreground">
                  Popular
                </span>
                <p className="font-mono text-[10px] uppercase tracking-wider text-subtle">Multi</p>
                <div className="mt-2 text-2xl font-bold tabular-nums">$990</div>
                <ul className="mt-4 space-y-2 text-sm text-subtle">
                  <li>Up to 5 terminals</li>
                  <li>Kitchen display + table map</li>
                  <li>Priority support</li>
                </ul>
              </div>
              <div className="bg-surface p-5">
                <p className="font-mono text-[10px] uppercase tracking-wider text-subtle">
                  Enterprise
                </p>
                <div className="mt-2 text-2xl font-bold tabular-nums">$1,290</div>
                <ul className="mt-4 space-y-2 text-sm text-subtle">
                  <li>Unlimited terminals</li>
                  <li>Multi-location sync</li>
                  <li>API + webhook access</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div className="lg:col-span-5">
          <div className="rounded-[20px] border border-line bg-surface p-6 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight">License policy</h2>
              <span className="font-mono text-[11px] uppercase tracking-wider text-subtle">(05)</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-subtle">
              All licenses are digital and delivered by email as an activation key. Because software is
              delivered instantly, all sales are{" "}
              <span className="font-semibold text-ink">final and non-refundable</span>.
            </p>
            <Link
              to="/policy"
              className="mt-4 inline-block text-sm font-semibold text-brand transition-colors hover:text-ink"
            >
              Read the full no-refund policy →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
