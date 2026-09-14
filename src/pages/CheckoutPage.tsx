import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "@/lib/cart";
import { loadCartProduct } from "@/lib/queries";
import { CartSummary } from "@/components/CartSummary";
import {
  checkoutKey,
  createCheckout,
  getPaymentConfig,
  rememberCheckout,
  type CheckoutInput,
} from "@/services/paymentService";
export function CheckoutPage() {
  const { lines } = useCart();
  const navigate = useNavigate();
  const products = useQuery({
    queryKey: ["cart-products", lines.map((line) => line.slug)],
    queryFn: () => Promise.all(lines.map((line) => loadCartProduct(line.slug))),
    retry: 1,
  });
  const config = useQuery({ queryKey: ["payram-config"], queryFn: getPaymentConfig, retry: 1 });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = lines.map((line) => ({
    line,
    product: products.data?.find((p) => p.slug === line.slug),
  }));
  const unavailable = selected.some(({ product }) => !product);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    try {
      if (!lines.length || unavailable)
        throw new Error("Some products are unavailable. Review your cart.");
      const input: CheckoutInput = {
        customer: { name: name.trim(), email: email.trim() },
        items: selected.map(({ line, product }) => ({
          productId: product!.id,
          quantity: line.qty,
        })),
      };
      const token = checkoutKey(input);
      const result = await createCheckout(input, token);
      rememberCheckout(result, token);
      if (result.checkout.url && popup) popup.location.href = result.checkout.url;
      else popup?.close();
      await navigate({
        to: "/payment-processing/$paymentId",
        params: { paymentId: result.paymentId },
      });
    } catch (cause) {
      popup?.close();
      setError(cause instanceof Error ? cause.message : "Checkout could not be opened.");
    } finally {
      setBusy(false);
    }
  }
  if (!lines.length)
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold">Your cart is empty</h1>
        <Link to="/catalog" className="mt-5 inline-block text-brand">
          Browse products
        </Link>
      </main>
    );
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <Link to="/cart" className="text-sm text-brand">
        Back to cart
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Secure checkout</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <form
          onSubmit={submit}
          className="rounded-[24px] border border-line bg-surface p-6 shadow-panel"
        >
          <h2 className="text-lg font-bold">Customer information</h2>
          <label htmlFor="checkout-name" className="mt-5 block text-sm font-medium">
            Full name
          </label>
          <input
            id="checkout-name"
            autoComplete="name"
            required
            minLength={2}
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-paper px-4 py-3"
          />
          <label htmlFor="checkout-email" className="mt-5 block text-sm font-medium">
            Email address
          </label>
          <input
            id="checkout-email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-paper px-4 py-3"
          />
          <h2 className="mt-8 text-lg font-bold">Payment</h2>
          <p className="mt-2 font-medium">
            {config.data?.cardEnabled
              ? "Pay with Card / Crypto via PayRam"
              : "Pay with Crypto via PayRam"}
          </p>
          <p className="mt-2 text-sm text-subtle">
            Complete payment on PayRam secure checkout. Your order is confirmed after payment is
            verified.
          </p>
          {config.data?.cardEnabled && (
            <p className="mt-2 text-sm text-subtle">
              Card availability and fees depend on the payment provider. A wallet setup and identity
              check may be required.
            </p>
          )}
          {config.data?.configured === false && (
            <p role="status" className="mt-4 text-sm text-subtle">
              PayRam checkout is not available yet. Please contact the store.
            </p>
          )}
          {(error || products.error || config.error || unavailable) && (
            <p role="alert" className="mt-4 text-sm text-red-700">
              {error ||
                products.error?.message ||
                config.error?.message ||
                "A product in your cart is no longer available."}
            </p>
          )}
          <button
            disabled={busy || !config.data?.configured || products.isPending || unavailable}
            className="mt-6 w-full rounded-xl bg-brand px-5 py-3 font-semibold text-brand-foreground disabled:opacity-50"
          >
            {busy ? "Preparing secure payment..." : "Continue to Secure Payment"}
          </button>
          <p className="mt-3 text-center text-xs text-subtle">
            Payment opens in a separate tab. Keep this tab open to track your order.
          </p>
        </form>
        <CartSummary
          items={selected.map(({ line, product }) => ({
            name: product?.name || line.name,
            quantity: line.qty,
            priceCents: product?.price_cents || 0,
          }))}
        />
      </div>
    </main>
  );
}
