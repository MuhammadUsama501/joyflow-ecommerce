import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { productsQuery, type Product } from "@/lib/queries";
import { formatPrice } from "@/lib/money";
import { useCart } from "@/lib/cart";
import { getPlanConfig, type PlanSelection } from "@/lib/pricing-config";
import { api } from "@/services/api";
import { calculatePlanPrice } from "@/lib/pricing";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Build Your Plan — Ledgerline" },
      {
        name: "description",
        content:
          "Configure your custom software license plan. Select products, terminals, locations and support level.",
      },
      { property: "og:title", content: "Build Your Plan — Ledgerline" },
      {
        property: "og:description",
        content: "Build a custom plan with ERP, POS and RMS licenses.",
      },
    ],
  }),
  component: PricingPage,
});

const card = "rounded-[20px] border border-line bg-surface p-5 shadow-card";
const cardActive = "rounded-[20px] border-2 border-brand bg-surface p-5 shadow-brand";
const radioOption =
  "flex items-center gap-3 rounded-xl border border-line bg-paper px-4 py-3 text-sm transition-colors hover:border-brand/40 cursor-pointer";
const radioOptionActive =
  "flex items-center gap-3 rounded-xl border-2 border-brand bg-brand/5 px-4 py-3 text-sm font-semibold";

function PricingPage() {
  const { data: products = [] } = useQuery(productsQuery);
  const { add } = useCart();
  const config = getPlanConfig();

  const [selection, setSelection] = useState<PlanSelection>({
    productSlugs: [],
    terminalId: "t1",
    locationId: "l1",
    supportId: "s_email",
  });

  const result = calculatePlanPrice(selection, products);

  function toggleProduct(slug: string) {
    setSelection((prev) => {
      const has = prev.productSlugs.includes(slug);
      return {
        ...prev,
        productSlugs: has
          ? prev.productSlugs.filter((s) => s !== slug)
          : [...prev.productSlugs, slug],
      };
    });
  }

  async function addToCart() {
    if (selection.productSlugs.length === 0) {
      toast.error("Select at least one product.");
      return;
    }
    try {
      const quote = await api<{ slug: string; name: string; price: number }>("/api/plan-quotes", {
        method: "POST",
        body: JSON.stringify(selection),
      });
      const names = selection.productSlugs
        .map((slug) => products.find((p) => p.slug === slug)?.name)
        .filter(Boolean);
      const label = names.length === 1 ? names[0] : `Custom Plan — ${names.join(" + ")}`;
      add({
        slug: quote.slug,
        name: quote.name,
        priceCents: Math.round(quote.price * 100),
      });
      toast.success("Custom plan added to cart!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not quote your plan.");
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand">
          (08) — Build your plan
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Configure your custom license</h1>
        <p className="mt-2 max-w-[55ch] text-pretty text-subtle">
          Select the products you need, then choose terminals, locations and support level. Bundle
          3+ products and save {config.bundleDiscountPercent}%.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
        {/* Left: configurator */}
        <div className="space-y-8 lg:col-span-8">
          {/* Product selection */}
          <section>
            <h2 className="text-lg font-bold tracking-tight">Products</h2>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-subtle">
              Select one or more
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {products.map((p) => {
                const selected = selection.productSlugs.includes(p.slug);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProduct(p.slug)}
                    className={selected ? cardActive : card}
                  >
                    <div className="flex items-start justify-between">
                      <div className="text-left">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-brand">
                          {p.category}
                        </span>
                        <h3 className="mt-1 font-bold">{p.name}</h3>
                      </div>
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 font-mono text-[10px] font-medium text-brand">
                        {selected ? "Selected" : "Select"}
                      </span>
                    </div>
                    <p className="mt-3 text-left text-sm leading-relaxed text-subtle">
                      {p.description}
                    </p>
                    <div className="mt-3 border-t border-line pt-3 text-left">
                      <span className="text-2xl font-bold tabular-nums">
                        {formatPrice(p.price_cents, p.currency)}
                      </span>
                      <span className="ml-1 font-mono text-[10px] uppercase text-subtle">
                        / perpetual
                      </span>
                    </div>
                    {p.features.length > 0 && (
                      <ul className="mt-3 space-y-1 text-left text-sm text-subtle">
                        {p.features.map((f) => (
                          <li key={f}>• {f}</li>
                        ))}
                      </ul>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Terminals */}
          <section>
            <h2 className="text-lg font-bold tracking-tight">Terminals</h2>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-subtle">
              How many POS terminals?
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {config.terminals.map((opt) => {
                const active = selection.terminalId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelection((prev) => ({ ...prev, terminalId: opt.id }))}
                    className={active ? radioOptionActive : radioOption}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                        active ? "border-brand" : "border-line"
                      }`}
                    >
                      {active && <span className="h-2 w-2 rounded-full bg-brand" />}
                    </span>
                    <span className="flex-1 text-left">{opt.label}</span>
                    <span className="font-mono text-xs">
                      {opt.price_cents === 0 ? "Free" : `+${formatPrice(opt.price_cents)}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Locations */}
          <section>
            <h2 className="text-lg font-bold tracking-tight">Locations</h2>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-subtle">
              How many business locations?
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {config.locations.map((opt) => {
                const active = selection.locationId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelection((prev) => ({ ...prev, locationId: opt.id }))}
                    className={active ? radioOptionActive : radioOption}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                        active ? "border-brand" : "border-line"
                      }`}
                    >
                      {active && <span className="h-2 w-2 rounded-full bg-brand" />}
                    </span>
                    <span className="flex-1 text-left">{opt.label}</span>
                    <span className="font-mono text-xs">
                      {opt.price_cents === 0 ? "Free" : `+${formatPrice(opt.price_cents)}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Support */}
          <section>
            <h2 className="text-lg font-bold tracking-tight">Support Level</h2>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-subtle">
              What level of support do you need?
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {config.support.map((opt) => {
                const active = selection.supportId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelection((prev) => ({ ...prev, supportId: opt.id }))}
                    className={active ? radioOptionActive : radioOption}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                        active ? "border-brand" : "border-line"
                      }`}
                    >
                      {active && <span className="h-2 w-2 rounded-full bg-brand" />}
                    </span>
                    <span className="flex-1 text-left">{opt.label}</span>
                    <span className="font-mono text-xs">
                      {opt.price_cents === 0 ? "Free" : `+${formatPrice(opt.price_cents)}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right: plan summary */}
        <aside className="lg:col-span-4">
          <div className="sticky top-20 rounded-[24px] border border-line bg-surface p-6 shadow-panel">
            <h2 className="text-lg font-bold tracking-tight">Your plan</h2>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-subtle">
              Price summary
            </p>

            {selection.productSlugs.length === 0 ? (
              <p className="mt-6 text-sm text-subtle">Select products above to build your plan.</p>
            ) : (
              <div className="mt-5 space-y-3 text-sm">
                {result.breakdown.map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className={item.amount_cents < 0 ? "text-sage" : "text-subtle"}>
                      {item.label}
                    </span>
                    <span
                      className={`font-medium tabular-nums ${
                        item.amount_cents < 0 ? "text-sage" : ""
                      }`}
                    >
                      {item.amount_cents < 0
                        ? `−${formatPrice(Math.abs(item.amount_cents))}`
                        : formatPrice(item.amount_cents)}
                    </span>
                  </div>
                ))}
                <div className="border-t border-line pt-3">
                  <div className="flex items-end justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="text-2xl font-bold tabular-nums">
                      {formatPrice(result.total)}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-subtle">
                    One-time perpetual license
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={addToCart}
              disabled={selection.productSlugs.length === 0}
              className="mt-6 w-full rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground shadow-brand transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add to cart
            </button>

            {result.discount > 0 && (
              <p className="mt-3 text-center font-mono text-[11px] text-sage">
                You save {formatPrice(result.discount)} with bundle discount!
              </p>
            )}

            <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-wider text-subtle">
              Digital delivery · no shipping
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
