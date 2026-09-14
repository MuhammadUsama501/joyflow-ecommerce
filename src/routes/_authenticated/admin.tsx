import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { allProductsQuery, type Product } from "@/lib/queries";
import { formatPrice } from "@/lib/money";
import { isAdminSession, clearAdminSession } from "@/lib/admin-auth";
import {
  getPlanConfig,
  savePlanConfig,
  resetPlanConfig,
  type PricingConfig,
} from "@/lib/pricing-config";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin portal — Ledgerline" },
      { name: "description", content: "Manage Ledgerline products, pricing and orders." },
      { property: "og:title", content: "Admin portal — Ledgerline" },
      { property: "og:description", content: "Manage Ledgerline products, pricing and orders." },
    ],
  }),
  component: AdminPage,
});

const input =
  "w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-brand/50";
const label = "block font-mono text-[10px] uppercase tracking-wider text-subtle";
const card = "rounded-[24px] border border-line bg-surface p-6 shadow-panel";

type Draft = {
  name: string;
  slug: string;
  sku: string;
  category: string;
  description: string;
  features: string;
  price: string;
};

const emptyDraft: Draft = {
  name: "",
  slug: "",
  sku: "",
  category: "ERP",
  description: "",
  features: "",
  price: "",
};

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(isAdminSession());
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [planConfig, setPlanConfig] = useState<PricingConfig>(getPlanConfig);
  const fileRef = useRef<HTMLInputElement>(null);

  const products = useQuery({ ...allProductsQuery, enabled: isAdmin === true });
  const orders = useQuery({
    queryKey: ["orders"],
    enabled: isAdmin === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["products"] });
    void qc.invalidateQueries({ queryKey: ["orders"] });
  };

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    clearAdminSession();
    void navigate({ to: "/auth", replace: true });
  }

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const priceCents = Math.round(Number(draft.price) * 100);
      if (!Number.isFinite(priceCents) || priceCents < 0) throw new Error("Enter a valid price.");
      const { error } = await supabase.from("products").insert({
        name: draft.name,
        slug: draft.slug.trim().toLowerCase(),
        sku: draft.sku.trim().toUpperCase(),
        category: draft.category,
        description: draft.description,
        features: draft.features
          .split("\n")
          .map((f) => f.trim())
          .filter(Boolean),
        price_cents: priceCents,
      });
      if (error) throw new Error(error.message);
      setDraft(emptyDraft);
      toast.success("Product added.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add product.");
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, values: Partial<Product>) {
    const { error } = await supabase.from("products").update(values).eq("id", id);
    if (error) toast.error(error.message);
    else refresh();
  }

  async function removeProduct(id: string) {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Product deleted.");
      refresh();
    }
  }

  function savePlan(updated: PricingConfig) {
    setPlanConfig(updated);
    savePlanConfig(updated);
    toast.success("Plan pricing saved.");
  }

  function resetPlan() {
    resetPlanConfig();
    setPlanConfig(getPlanConfig());
    toast.success("Plan pricing reset to defaults.");
  }

  function exportPlan() {
    const blob = new Blob([JSON.stringify(getPlanConfig(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pricing-config.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importPlan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as PricingConfig;
        if (!parsed.terminals || !parsed.locations || !parsed.support) {
          throw new Error("Invalid config file.");
        }
        savePlan(parsed);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not import config.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  if (isAdmin === null) {
    return <main className="mx-auto max-w-3xl px-6 py-24 text-subtle">Checking access…</main>;
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24">
        <div className={card}>
          <h1 className="text-2xl font-bold tracking-tight">Admin access required</h1>
          <p className="mt-3 text-subtle">
            This account is not an administrator. Ask an existing administrator to grant you access.
          </p>
          <button onClick={signOut} className="mt-6 font-semibold text-brand">
            Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand">
            (07) — Admin portal
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Products &amp; pricing</h1>
        </div>
        <button
          onClick={signOut}
          className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold"
        >
          Sign out
        </button>
      </div>

      <section className={`${card} mt-8`}>
        <h2 className="text-lg font-bold tracking-tight">Add a product</h2>
        <form onSubmit={addProduct} className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label className={label}>Name</label>
            <input
              required
              className={`${input} mt-1.5`}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>Slug</label>
            <input
              required
              className={`${input} mt-1.5`}
              value={draft.slug}
              onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>SKU</label>
            <input
              required
              className={`${input} mt-1.5`}
              value={draft.sku}
              onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>Category</label>
            <input
              className={`${input} mt-1.5`}
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>Price (USD)</label>
            <input
              required
              inputMode="decimal"
              className={`${input} mt-1.5`}
              value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <label className={label}>Description</label>
            <textarea
              rows={2}
              className={`${input} mt-1.5`}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <label className={label}>Features (one per line)</label>
            <textarea
              rows={3}
              className={`${input} mt-1.5`}
              value={draft.features}
              onChange={(e) => setDraft({ ...draft, features: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-60"
            >
              {busy ? "Saving…" : "Add product"}
            </button>
          </div>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold tracking-tight">Catalog</h2>
        <div className="mt-4 grid gap-4">
          {(products.data ?? []).map((p) => (
            <ProductRow key={p.id} product={p} onPatch={patch} onDelete={removeProduct} />
          ))}
          {products.isLoading && <p className="text-subtle">Loading products…</p>}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-bold tracking-tight">Plan pricing</h2>
        <PlanPricingSection
          config={planConfig}
          onSave={savePlan}
          onReset={resetPlan}
          onExport={exportPlan}
          onImport={() => fileRef.current?.click()}
          fileRef={fileRef}
          onFileChange={importPlan}
        />
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-bold tracking-tight">Recent orders</h2>
        <div className={`${card} mt-4 overflow-x-auto`}>
          <table className="w-full text-left text-sm">
            <thead className="font-mono text-[10px] uppercase tracking-wider text-subtle">
              <tr>
                <th className="pb-3">Date</th>
                <th className="pb-3">Email</th>
                <th className="pb-3">Amount</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">License</th>
              </tr>
            </thead>
            <tbody>
              {(orders.data ?? []).map((o) => (
                <tr key={o.id} className="border-t border-line">
                  <td className="py-3">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="py-3">{o.email ?? "—"}</td>
                  <td className="py-3">{formatPrice(o.amount_cents, o.currency)}</td>
                  <td className="py-3">{o.status}</td>
                  <td className="py-3 font-mono text-xs">{o.license_key ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(orders.data ?? []).length === 0 && !orders.isLoading && (
            <p className="text-subtle">No orders yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}

function ProductRow({
  product,
  onPatch,
  onDelete,
}: {
  product: Product;
  onPatch: (id: string, values: Partial<Product>) => void;
  onDelete: (id: string) => void;
}) {
  const [price, setPrice] = useState((product.price_cents / 100).toFixed(2));
  const [name, setName] = useState(product.name);

  return (
    <div className={`${card} grid gap-4 md:grid-cols-[2fr_1fr_auto] md:items-end`}>
      <div>
        <label className={label}>Name — {product.sku}</label>
        <input
          className={`${input} mt-1.5`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className={label}>Price (USD)</label>
        <input
          className={`${input} mt-1.5`}
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() =>
            onPatch(product.id, { name, price_cents: Math.round(Number(price) * 100) })
          }
          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground"
        >
          Save
        </button>
        <button
          onClick={() => onPatch(product.id, { is_active: !product.is_active })}
          className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold"
        >
          {product.is_active ? "Unpublish" : "Publish"}
        </button>
        <button
          onClick={() => onPatch(product.id, { is_featured: !product.is_featured })}
          className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold"
        >
          {product.is_featured ? "Unfeature" : "Feature"}
        </button>
        <button
          onClick={() => onDelete(product.id)}
          className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-brand"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function PlanPricingSection({
  config,
  onSave,
  onReset,
  onExport,
  onImport,
  fileRef,
  onFileChange,
}: {
  config: PricingConfig;
  onSave: (config: PricingConfig) => void;
  onReset: () => void;
  onExport: () => void;
  onImport: () => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const [draft, setDraft] = useState<PricingConfig>(config);

  function updateOption(
    group: "terminals" | "locations" | "support",
    id: string,
    field: "label" | "price_cents",
    value: string | number,
  ) {
    setDraft((prev) => ({
      ...prev,
      [group]: prev[group].map((opt) => (opt.id === id ? { ...opt, [field]: value } : opt)),
    }));
  }

  function optionRows(group: "terminals" | "locations" | "support") {
    return draft[group].map((opt) => (
      <div key={opt.id} className="grid gap-2 sm:grid-cols-[1fr_140px]">
        <input
          className={`${input} mt-0`}
          value={opt.label}
          onChange={(e) => updateOption(group, opt.id, "label", e.target.value)}
        />
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-subtle">$</span>
          <input
            className={`${input} mt-0`}
            inputMode="decimal"
            value={(opt.price_cents / 100).toFixed(2)}
            onChange={(e) =>
              updateOption(group, opt.id, "price_cents", Math.round(Number(e.target.value) * 100))
            }
          />
        </div>
      </div>
    ));
  }

  return (
    <div className={`${card} mt-4`}>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={onFileChange}
      />

      <div className="grid gap-8 lg:grid-cols-3">
        <div>
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-subtle">Terminals</h3>
          <div className="mt-3 space-y-2">{optionRows("terminals")}</div>
        </div>
        <div>
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-subtle">Locations</h3>
          <div className="mt-3 space-y-2">{optionRows("locations")}</div>
        </div>
        <div>
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-subtle">Support</h3>
          <div className="mt-3 space-y-2">{optionRows("support")}</div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-6 border-t border-line pt-5">
        <div>
          <label className={label}>Bundle discount (%)</label>
          <input
            className={`${input} mt-1.5 w-28`}
            inputMode="decimal"
            value={draft.bundleDiscountPercent}
            onChange={(e) =>
              setDraft({
                ...draft,
                bundleDiscountPercent: Number(e.target.value),
              })
            }
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onSave(draft)}
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground"
          >
            Save changes
          </button>
          <button
            onClick={onExport}
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold"
          >
            Export config
          </button>
          <button
            onClick={onImport}
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold"
          >
            Import config
          </button>
          <button
            onClick={onReset}
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-brand"
          >
            Reset to defaults
          </button>
        </div>
        <p className="w-full font-mono text-[10px] uppercase tracking-wider text-subtle">
          Changes apply to the pricing page in this browser. Use Export/Import to move config across
          devices.
        </p>
      </div>
    </div>
  );
}
