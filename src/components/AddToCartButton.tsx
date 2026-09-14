import { useCart } from "@/lib/cart";
import type { Product } from "@/lib/queries";
export function AddToCartButton({ product }: { product: Product }) {
  const { add } = useCart();
  return (
    <button
      type="button"
      onClick={() =>
        add({ slug: product.slug, name: product.name, priceCents: product.price_cents })
      }
      className="mt-4 w-full rounded-xl border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand/10"
    >
      Add to cart
    </button>
  );
}
