import { AddToCartButton } from "./AddToCartButton";
import { Link } from "@tanstack/react-router";
import { formatPrice } from "@/lib/money";
import type { Product } from "@/lib/queries";

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="rounded-[20px] border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="rounded-md bg-brand/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-brand">
          {product.category}
        </span>
        <span className="font-mono text-[11px] text-subtle">SKU {product.sku}</span>
      </div>
      <h3 className="mt-3 text-lg font-bold tracking-tight">{product.name}</h3>
      <p className="mt-1 text-sm text-subtle">{product.description}</p>
      <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
        <span className="text-xl font-bold tabular-nums">
          {formatPrice(product.price_cents, product.currency)}
        </span>
        <Link
          to="/products/$slug"
          params={{ slug: product.slug }}
          className="text-sm font-semibold text-brand transition-colors hover:text-ink"
        >
          Details →
        </Link>
      </div>
      <AddToCartButton product={product} />
    </article>
  );
}
