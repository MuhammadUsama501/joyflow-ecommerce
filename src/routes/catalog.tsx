import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { productsQuery } from "@/lib/queries";
import { ProductCard } from "@/components/ProductCard";

export const Route = createFileRoute("/catalog")({
  head: () => ({
    meta: [
      { title: "Catalog — Ledgerline ERP, POS & Restaurant Licenses" },
      {
        name: "description",
        content: "Every Ledgerline edition: ERP, POS and restaurant management licenses with prices.",
      },
      { property: "og:title", content: "Catalog — Ledgerline" },
      { property: "og:description", content: "ERP, POS and restaurant management licenses." },
    ],
  }),
  component: Catalog,
});

function Catalog() {
  const { data: products = [], isLoading } = useQuery(productsQuery);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand">(02) — Catalog</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">All editions</h1>
      <p className="mt-2 max-w-[52ch] text-subtle">
        Every edition is a digital license. Keys are issued by email right after checkout.
      </p>

      {isLoading ? (
        <p className="mt-8 text-sm text-subtle">Loading catalog…</p>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </main>
  );
}
