import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { allProductsQuery, type Product } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/money";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin portal — Ledgerline" },
      { name: "description", content: "Manage Ledgerline products, pricing and availability." },
    ],
  }),
  component: AdminPage,
});

type ProductDraft = {
  name: string;
  slug: string;
  sku: string;
  category: string;
  description: string;
  price: string;
  features: string;
  sortOrder: string;
  isActive: boolean;
  isFeatured: boolean;
};

const emptyDraft: ProductDraft = {
  name: "",
  slug: "",
  sku: "",
  category: "ERP",
  description: "",
  price: "0",
  features: "",
  sortOrder: "0",
  isActive: true,
  isFeatured: false,
};

function draftFromProduct(product: Product): ProductDraft {
  return {
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    category: product.category,
    description: product.description,
    price: String(product.price_cents / 100),
    features: product.features.join("\n"),
    sortOrder: String(product.sort_order),
    isActive: product.is_active,
    isFeatured: product.is_featured,
  };
}

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: products = [], isLoading, error } = useQuery(allProductsQuery);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function updateDraft<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setDraft(draftFromProduct(product));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setDraft(emptyDraft);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const price = Number.parseFloat(draft.price);
    const sortOrder = Number.parseInt(draft.sortOrder, 10);
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(sortOrder)) {
      toast.error("Enter a valid price and sort order.");
      return;
    }

    setBusy(true);
    const payload = {
      name: draft.name.trim(),
      slug: draft.slug.trim().toLowerCase(),
      sku: draft.sku.trim().toUpperCase(),
      category: draft.category.trim() || "ERP",
      description: draft.description.trim(),
      features: draft.features.split("\n").map((feature) => feature.trim()).filter(Boolean),
      price_cents: Math.round(price * 100),
      sort_order: sortOrder,
      is_active: draft.isActive,
      is_featured: draft.isFeatured,
    };

    try {
      const result = editingId
        ? await supabase.from("products").update(payload).eq("id", editingId)
        : await supabase.from("products").insert(payload);
      if (result.error) throw new Error(result.error.message);
      await queryClient.invalidateQueries({ queryKey: allProductsQuery.queryKey });
      toast.success(editingId ? "Product updated" : "Product created");
      resetForm();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not save product.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`Delete ${product.name}?`)) return;
    const { error: deleteError } = await supabase.from("products").delete().eq("id", product.id);
    if (deleteError) {
      toast.error(deleteError.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: allProductsQuery.queryKey });
    toast.success("Product deleted");
    if (editingId === product.id) resetForm();
  }

  async function signOut() {
    await supabase.auth.signOut();
    void navigate({ to: "/" });
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand">(07) — Control room</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Product operations</h1>
          <p className="mt-2 text-sm text-subtle">Keep the public catalog, pricing and availability current.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button onClick={() => void navigate({ to: "/catalog" })} className="font-semibold text-brand">
            View storefront
          </button>
          <button onClick={() => void signOut()} className="rounded-xl border border-line bg-surface px-4 py-2 font-semibold hover:border-brand/40">
            Sign out
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <form onSubmit={saveProduct} className="rounded-[24px] border border-line bg-surface p-6 shadow-panel">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-bold">{editingId ? "Edit product" : "Add product"}</h2>
            {editingId ? <button type="button" onClick={resetForm} className="text-sm font-semibold text-brand">Cancel</button> : null}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2"><FieldLabel>Name</FieldLabel><input required value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} className="admin-input" /></label>
            <label><FieldLabel>Slug</FieldLabel><input required value={draft.slug} onChange={(event) => updateDraft("slug", event.target.value)} className="admin-input" /></label>
            <label><FieldLabel>SKU</FieldLabel><input required value={draft.sku} onChange={(event) => updateDraft("sku", event.target.value)} className="admin-input" /></label>
            <label><FieldLabel>Category</FieldLabel><input required value={draft.category} onChange={(event) => updateDraft("category", event.target.value)} className="admin-input" /></label>
            <label><FieldLabel>Price (USD)</FieldLabel><input required min="0" step="0.01" type="number" value={draft.price} onChange={(event) => updateDraft("price", event.target.value)} className="admin-input" /></label>
            <label><FieldLabel>Sort order</FieldLabel><input required type="number" step="1" value={draft.sortOrder} onChange={(event) => updateDraft("sortOrder", event.target.value)} className="admin-input" /></label>
            <label className="sm:col-span-2"><FieldLabel>Description</FieldLabel><textarea required rows={3} value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} className="admin-input resize-y" /></label>
            <label className="sm:col-span-2"><FieldLabel>Features, one per line</FieldLabel><textarea rows={4} value={draft.features} onChange={(event) => updateDraft("features", event.target.value)} className="admin-input resize-y" /></label>
          </div>
          <div className="mt-5 flex flex-wrap gap-5 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={draft.isActive} onChange={(event) => updateDraft("isActive", event.target.checked)} /> Active in catalog</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={draft.isFeatured} onChange={(event) => updateDraft("isFeatured", event.target.checked)} /> Featured product</label>
          </div>
          <button disabled={busy} className="mt-6 w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-60">
            {busy ? "Saving..." : editingId ? "Save changes" : "Add product"}
          </button>
        </form>

        <section>
          <div className="mb-4 flex items-baseline justify-between"><h2 className="text-lg font-bold">Catalog inventory</h2><span className="font-mono text-[11px] uppercase tracking-wider text-subtle">{products.length} products</span></div>
          {isLoading ? <p className="text-sm text-subtle">Loading products...</p> : error ? <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error.message}</p> : products.length === 0 ? <p className="rounded-xl border border-line bg-surface p-5 text-sm text-subtle">No products yet. Add your first edition.</p> : <div className="space-y-3">{products.map((product) => <article key={product.id} className="rounded-[20px] border border-line bg-surface p-5 shadow-card"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[10px] uppercase tracking-wider text-brand">{product.category}</span><span className={product.is_active ? "status-active" : "status-inactive"}>{product.is_active ? "Active" : "Hidden"}</span>{product.is_featured ? <span className="status-featured">Featured</span> : null}</div><h3 className="mt-2 font-semibold">{product.name}</h3><p className="mt-1 text-sm text-subtle">{product.sku} · {formatPrice(product.price_cents, product.currency)}</p></div><div className="flex gap-3 text-sm"><button onClick={() => startEdit(product)} className="font-semibold text-brand">Edit</button><button onClick={() => void deleteProduct(product)} className="font-semibold text-destructive">Delete</button></div></div><p className="mt-3 text-sm text-subtle">{product.description}</p></article>)}</div>}
        </section>
      </div>
    </main>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-subtle">{children}</span>;
}
