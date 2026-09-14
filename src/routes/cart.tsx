import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CartItem } from "@/components/CartItem";
import { recentPayment } from "@/services/paymentService";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/money";
import { getPaypalConfig, createPaypalOrder, capturePaypalOrder } from "@/lib/paypal.functions";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Checkout — Ledgerline" },
      { name: "description", content: "Review your licenses and pay securely with PayPal." },
      { property: "og:title", content: "Checkout — Ledgerline" },
      { property: "og:description", content: "Review your licenses and pay securely with PayPal." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { lines, totalCents, setQty, remove, clear } = useCart();
  const [email, setEmail] = useState("");
  const [recentId, setRecentId] = useState<string | null>(null);
  useEffect(() => {
    setRecentId(recentPayment());
  }, []);
  const [licenseKey, setLicenseKey] = useState<string | null>(null);

  const configFn = useServerFn(getPaypalConfig);
  const createOrder = useServerFn(createPaypalOrder);
  const captureOrder = useServerFn(capturePaypalOrder);
  const { data: config } = useQuery({ queryKey: ["paypal-config"], queryFn: () => configFn({}) });

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const items = lines.map((l) => ({ slug: l.slug, qty: l.qty }));

  if (licenseKey) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="rounded-[24px] border border-line bg-surface p-8 shadow-panel">
          <p className="font-mono text-[11px] uppercase tracking-wider text-sage">
            Payment received
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Your license is ready</h1>
          <p className="mt-3 text-subtle">
            Keep this activation key safe — it has also been recorded against your order.
          </p>
          <div className="mt-6 rounded-xl border border-line bg-paper px-5 py-4 font-mono text-lg tracking-wider">
            {licenseKey}
          </div>
          <Link to="/catalog" className="mt-6 inline-block font-semibold text-brand">
            Back to catalog →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand">(03) — Cart</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Your cart</h1>
      {recentId && (
        <Link
          to="/payment-processing/$paymentId"
          params={{ paymentId: recentId }}
          className="mt-3 inline-block text-sm text-brand"
        >
          View recent PayRam order
        </Link>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7">
          {lines.length === 0 ? (
            <div className="rounded-[20px] border border-line bg-surface p-6 shadow-card">
              <p className="text-subtle">Your cart is empty.</p>
              <Link to="/catalog" className="mt-3 inline-block font-semibold text-brand">
                Browse the catalog →
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {lines.map((l) => (
                <CartItem key={l.slug} line={l} setQty={setQty} remove={remove} />
              ))}
            </ul>
          )}
        </div>

        <aside className="lg:col-span-5">
          <div className="rounded-[24px] border border-line bg-surface p-6 shadow-panel">
            <h2 className="text-lg font-bold tracking-tight">Order summary</h2>
            <div className="mt-4 flex items-end justify-between border-t border-line pt-4">
              <span className="font-medium text-subtle">Total</span>
              <span className="text-2xl font-bold tabular-nums">{formatPrice(totalCents)}</span>
            </div>

            {lines.length > 0 && (
              <Link
                to="/checkout"
                className="mt-5 block rounded-xl bg-brand px-5 py-3 text-center font-semibold text-brand-foreground"
              >
                Continue with PayRam
              </Link>
            )}

            <label className="mt-5 block font-mono text-[10px] uppercase tracking-wider text-subtle">
              Email for license delivery
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-brand/50"
            />

            <div className="mt-5">
              {!config?.clientId ? (
                <p className="rounded-xl border border-line bg-paper px-4 py-3 text-sm text-subtle">
                  PayPal checkout is currently unavailable. Use PayRam above.
                </p>
              ) : lines.length === 0 || !emailValid ? (
                <p className="rounded-xl border border-line bg-paper px-4 py-3 text-sm text-subtle">
                  Add a license and a valid email address to pay.
                </p>
              ) : (
                <PayPalScriptProvider
                  options={{ clientId: config.clientId, currency: "USD", intent: "capture" }}
                >
                  <PayPalButtons
                    style={{ layout: "vertical", color: "blue", shape: "rect" }}
                    createOrder={async () => {
                      const res = await createOrder({ data: { items, email } });
                      return res.orderId;
                    }}
                    onApprove={async (data) => {
                      const res = await captureOrder({
                        data: { orderId: data.orderID, email, items },
                      });
                      clear();
                      setLicenseKey(res.licenseKey);
                    }}
                    onError={() => toast.error("Payment could not be completed.")}
                  />
                </PayPalScriptProvider>
              )}
            </div>

            <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-wider text-subtle">
              Digital delivery · no refunds ·{" "}
              <Link to="/policy" className="underline">
                policy
              </Link>
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
