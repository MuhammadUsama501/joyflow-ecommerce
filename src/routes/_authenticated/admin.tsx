import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { allProductsQuery, upsertProduct, removeProduct, type Product } from "@/lib/queries";
import {
  getOrders,
  resetOrders,
  getPaypalCredentials,
  savePaypalCredentials,
  getMetamaskCredentials,
  saveMetamaskCredentials,
  type Order,
  type PaypalCreds,
  type MetamaskCreds,
} from "@/lib/local-store";
import {
  getPlanConfig,
  savePlanConfig,
  resetPlanConfig,
  type PricingConfig,
} from "@/lib/pricing-config";
import { isAdminSession, clearAdminSession } from "@/lib/admin-auth";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

const card = "rounded-[24px] border border-line bg-surface p-6 shadow-panel";

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    slug: "",
    sku: "",
    category: "ERP",
    description: "",
    features: "",
    price: "",
  });
  const [paypalDraft, setPaypalDraft] = useState({
    clientId: "",
    secret: "",
    env: "sandbox" as "sandbox" | "live",
  });
  const [metaDraft, setMetaDraft] = useState({ walletAddress: "", chainId: "0x1", rpcUrl: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  const products = useQuery(allProductsQuery);
  const orders = getOrders();
  const planConfig = getPlanConfig();

  useEffect(() => {
    const paypal = getPaypalCredentials();
    if (paypal) {
      setPaypalDraft({ clientId: paypal.clientId, secret: paypal.clientSecret, env: paypal.env });
    }
    const meta = getMetamaskCredentials();
    if (meta) {
      setMetaDraft({
        walletAddress: meta.walletAddress,
        chainId: meta.chainId,
        rpcUrl: meta.rpcUrl,
      });
    }
  }, []);

  if (!isAdminSession()) {
    void navigate({ to: "/auth", replace: true });
    return null;
  }

  function clearDraft() {
    setDraft({
      name: "",
      slug: "",
      sku: "",
      category: "ERP",
      description: "",
      features: "",
      price: "",
    });
  }

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const priceCents = Math.round(Number(draft.price) * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      toast.error("Enter a valid price.");
      setBusy(false);
      return;
    }
    upsertProduct({
      id: `local_${crypto.randomUUID().slice(0, 8)}`,
      slug: draft.slug.trim().toLowerCase() || draft.name.trim().toLowerCase().replace(/\s+/g, "-"),
      sku: draft.sku.trim().toUpperCase(),
      category: draft.category,
      name: draft.name,
      description: draft.description,
      features: draft.features
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean),
      price_cents: priceCents,
      currency: "USD",
      sort_order: 999,
      is_active: true,
      is_featured: false,
    });
    toast.success("Product added.");
    void qc.invalidateQueries({ queryKey: ["products"] });
    clearDraft();
    setBusy(false);
  }

  function patch(id: string, values: Partial<Product>) {
    upsertProduct({ ...products.data!.find((p) => p.id === id)!, ...values });
    void qc.invalidateQueries({ queryKey: ["products"] });
  }

  function remove(id: string) {
    removeProduct(id);
    void qc.invalidateQueries({ queryKey: ["products"] });
  }

  function savePaypal(e: React.FormEvent) {
    e.preventDefault();
    savePaypalCredentials({
      clientId: paypalDraft.clientId.trim(),
      clientSecret: paypalDraft.secret.trim(),
      env: paypalDraft.env,
    });
    toast.success("PayPal credentials saved.");
  }

  function saveMeta(e: React.FormEvent) {
    e.preventDefault();
    saveMetamaskCredentials({
      walletAddress: metaDraft.walletAddress.trim(),
      chainId: metaDraft.chainId.trim() || "0x1",
      rpcUrl: metaDraft.rpcUrl.trim(),
    });
    toast.success("MetaMask wallet saved.");
  }

  function signOut() {
    clearAdminSession();
    void navigate({ to: "/", replace: true });
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand">
            (07) — Admin
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            Products, pricing &amp; payments
          </h1>
          <p className="mt-3 text-sm text-subtle">
            These are legacy browser-only settings. PayRam products and orders use server/data JSON
            files; PayRam credentials belong in server/.env. Changes here do not configure PayRam
            checkout.
          </p>
        </div>
        <button
          onClick={signOut}
          className="rounded-xl border border-line px-4 py-2 text-sm font-semibold"
        >
          Sign out
        </button>
      </div>

      <section className={`${card} mt-8`}>
        <h2 className="text-lg font-bold tracking-tight">Add a product</h2>
        <form onSubmit={addProduct} className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-subtle">
              Name
            </label>
            <input
              required
              className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-subtle">
              Slug
            </label>
            <input
              className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm"
              value={draft.slug}
              onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
              placeholder="auto"
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-subtle">
              SKU
            </label>
            <input
              className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm"
              value={draft.sku}
              onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-subtle">
              Category
            </label>
            <input
              className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-subtle">
              Price (USD)
            </label>
            <input
              required
              inputMode="decimal"
              className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm"
              value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block font-mono text-[10px] uppercase tracking-wider text-subtle">
              Description
            </label>
            <textarea
              rows={2}
              className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block font-mono text-[10px] uppercase tracking-wider text-subtle">
              Features (one per line)
            </label>
            <textarea
              rows={3}
              className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm"
              value={draft.features}
              onChange={(e) => setDraft({ ...draft, features: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground"
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
            <ProductRow key={p.id} product={p} onPatch={patch} onDelete={remove} />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold tracking-tight">PayPal credentials</h2>
        <form onSubmit={savePaypal} className={`${card} mt-4 grid gap-4 md:grid-cols-3`}>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-subtle">
              Client ID
            </label>
            <input
              required
              className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm"
              value={paypalDraft.clientId}
              onChange={(e) => setPaypalDraft({ ...paypalDraft, clientId: e.target.value })}
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-subtle">
              Client secret
            </label>
            <input
              required
              type="password"
              className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm"
              value={paypalDraft.secret}
              onChange={(e) => setPaypalDraft({ ...paypalDraft, secret: e.target.value })}
            />
          </div>
          <div className="flex flex-col justify-end">
            <select
              className="rounded-xl border border-line bg-paper px-3 py-2.5 text-sm"
              value={paypalDraft.env}
              onChange={(e) =>
                setPaypalDraft({ ...paypalDraft, env: e.target.value as "sandbox" | "live" })
              }
            >
              <option value="sandbox">Sandbox</option>
              <option value="live">Live</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <button
              type="submit"
              className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground"
            >
              Save PayPal credentials
            </button>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-subtle">
              Stored in this browser only. Falls back to PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET /
              PAYPAL_ENV environment variables when empty.
            </p>
          </div>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold tracking-tight">MetaMask wallet (payments)</h2>
        <form onSubmit={saveMeta} className={`${card} mt-4 grid gap-4 md:grid-cols-3`}>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-subtle">
              Wallet address
            </label>
            <input
              required
              placeholder="0x…"
              className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-mono"
              value={metaDraft.walletAddress}
              onChange={(e) => setMetaDraft({ ...metaDraft, walletAddress: e.target.value })}
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-subtle">
              Chain ID
            </label>
            <input
              required
              placeholder="0x1"
              className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-mono"
              value={metaDraft.chainId}
              onChange={(e) => setMetaDraft({ ...metaDraft, chainId: e.target.value })}
            />
          </div>
          <div className="flex flex-col justify-end">
            <button
              type="submit"
              className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground"
            >
              Save wallet
            </button>
          </div>
          <div className="md:col-span-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-subtle">
              Customers pay directly to this wallet from their MetaMask. Stored in this browser;
              falls back to METAMASK_WALLET_ADDRESS / METAMASK_CHAIN_ID env vars.
            </p>
          </div>
        </form>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Recent orders</h2>
          <button
            onClick={() => {
              resetOrders();
              window.location.reload();
            }}
            className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-brand"
          >
            Reset orders
          </button>
        </div>
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
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-line">
                  <td className="py-3">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="py-3">{o.email}</td>
                  <td className="py-3">
                    {((o.amount_cents ?? 0) / 100).toFixed(2)} {o.currency}
                  </td>
                  <td className="py-3">{o.status}</td>
                  <td className="py-3 font-mono text-xs">{o.license_key}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <p className="text-subtle">No orders yet.</p>}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold tracking-tight">Plan pricing</h2>
        <PlanPricingSection
          config={planConfig}
          onSave={(c) => {
            savePlanConfig(c);
            toast.success("Plan pricing saved.");
          }}
          onReset={() => {
            resetPlanConfig();
            toast.success("Plan pricing reset.");
          }}
        />
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
    <div className="grid items-end gap-4 rounded-[24px] border border-line bg-surface p-5 md:grid-cols-[1fr_1fr_auto]">
      <div>
        <label className="block font-mono text-[10px] uppercase tracking-wider text-subtle">
          Name ({product.sku})
        </label>
        <input
          className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="block font-mono text-[10px] uppercase tracking-wider text-subtle">
          Price (USD)
        </label>
        <input
          inputMode="decimal"
          className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm"
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
}: {
  config: PricingConfig;
  onSave: (config: PricingConfig) => void;
  onReset: () => void;
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
      <div key={opt.id} className="flex items-center gap-2">
        <input
          className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
          value={opt.label}
          onChange={(e) => updateOption(group, opt.id, "label", e.target.value)}
        />
        <div className="flex items-center w-32">
          <span className="font-mono text-[10px] text-subtle">$</span>
          <input
            inputMode="decimal"
            className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
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
          <label className="block font-mono text-[10px] uppercase tracking-wider text-subtle">
            Bundle discount (%)
          </label>
          <input
            inputMode="decimal"
            className="mt-1.5 w-28 rounded-xl border border-line bg-paper px-3 py-2 text-sm"
            value={draft.bundleDiscountPercent}
            onChange={(e) => setDraft({ ...draft, bundleDiscountPercent: Number(e.target.value) })}
          />
        </div>
        <button
          onClick={() => onSave(draft)}
          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground"
        >
          Save changes
        </button>
        <button
          onClick={onReset}
          className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-brand"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
