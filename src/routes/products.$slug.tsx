import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { productQuery } from "@/lib/queries";
import { formatPrice } from "@/lib/money";
import { useCart } from "@/lib/cart";

export const Route = createFileRoute("/products/$slug")({
  head: () => ({
    meta: [
      { title: "License details — Ledgerline" },
      { name: "description", content: "Edition details, features and pricing for this license." },
      { property: "og:title", content: "License details — Ledgerline" },
      { property: "og:description", content: "Edition details, features and pricing." },
    ],
  }),
  component: ProductDetail,
});

function ProductDetail() {
  const { slug } = Route.useParams();
  const { data: product, isLoading } = useQuery(productQuery(slug));
  const { add } = useCart();
  const navigate = useNavigate();

  if (isLoading) {
    return <main className="mx-auto max-w-7xl px-6 py-16 text-sm text-subtle">Loading…</main>;
  }

  if (!product) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight">Edition not found</h1>
        <Link to="/catalog" className="mt-4 inline-block font-semibold text-brand">
          Back to catalog →
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <Link to="/catalog" className="font-mono text-[11px] uppercase tracking-wider text-subtle">
        ← Catalog
      </Link>
      <div className="mt-6 grid gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7">
          <span className="rounded-md bg-brand/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-brand">
            {product.category}
          </span>
          <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight">{product.name}</h1>
          <p className="mt-4 max-w-[52ch] leading-relaxed text-subtle">{product.description}</p>
          <div className="mt-8 space-y-2.5 border-t border-line pt-6 text-sm">
            {product.features.map((f) => (
              <div key={f} className="flex justify-between">
                <span className="text-subtle">{f}</span>
                <span className="font-medium">Included</span>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-5">
          <div className="rounded-[24px] border border-line bg-surface p-6 shadow-panel">
            <span className="font-mono text-[10px] uppercase tracking-wider text-subtle">
              SKU {product.sku} · perpetual license
            </span>
            <div className="mt-2 text-4xl font-bold tabular-nums">
              {formatPrice(product.price_cents, product.currency)}
            </div>
            <button
              onClick={() => {
                add({ slug: product.slug, name: product.name, priceCents: product.price_cents });
                toast.success("Added to cart");
              }}
              className="mt-6 w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-brand-foreground shadow-brand transition-transform hover:-translate-y-0.5"
            >
              Add to cart
            </button>
            <button
              onClick={() => {
                add({ slug: product.slug, name: product.name, priceCents: product.price_cents });
                void navigate({ to: "/cart" });
              }}
              className="mt-3 w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm font-semibold transition-colors hover:border-brand/40"
            >
              Buy now with PayPal
            </button>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-subtle">
              Digital delivery · all sales final
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
