import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/money";
import { finishAttempt, getOrder, getOrderPayment } from "@/services/paymentService";
export function OrderSuccessPage({ orderId }: { orderId: string }) {
  const { lines, setQty, ready } = useCart();
  const handled = useRef(false);
  const result = useQuery({
    queryKey: ["payram-order", orderId],
    retry: 1,
    queryFn: async () => {
      const payment = await getOrderPayment(orderId);
      const order = await getOrder(orderId);
      return { payment, order };
    },
  });
  const paid =
    result.data?.payment.status === "paid" &&
    ["paid", "processing", "completed"].includes(result.data.order.status);
  useEffect(() => {
    if (!ready || !paid || !result.data || handled.current) return;
    handled.current = true;
    const marker = "ledgerline.payram.cleared." + orderId;
    if (!sessionStorage.getItem(marker)) {
      for (const item of result.data.order.items) {
        const line = lines.find((entry) => entry.slug === item.productSlug);
        if (line) setQty(line.slug, Math.max(0, line.qty - item.quantity));
      }
      sessionStorage.setItem(marker, "true");
    }
    finishAttempt();
  }, [ready, paid, result.data, lines, setQty, orderId]);
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <section className="rounded-[24px] border border-line bg-surface p-8 shadow-panel">
        <h1 className="text-3xl font-bold">
          {paid
            ? "Payment confirmed"
            : result.isPending
              ? "Verifying your order..."
              : "Payment is not confirmed"}
        </h1>
        {result.error && (
          <p role="alert" className="mt-4 text-red-700">
            {result.error.message}
          </p>
        )}
        {paid && result.data && (
          <>
            <p className="mt-4 text-subtle">
              Thank you, {result.data.order.customer.name}. Your order has been paid. The store will
              arrange your ERP license fulfillment.
            </p>
            <p className="mt-5 text-xl font-semibold">
              {formatPrice(
                Math.round(result.data.order.totalAmount * 100),
                result.data.order.currency,
              )}
            </p>
            <ul className="mt-4 space-y-2">
              {result.data.order.items.map((item) => (
                <li key={item.productId}>
                  {item.productName} × {item.quantity}
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-5 break-all font-mono text-xs text-subtle">Order: {orderId}</p>
        {!paid && result.data && (
          <Link
            to="/payment-processing/$paymentId"
            params={{ paymentId: result.data.payment.id }}
            className="mt-5 block text-brand"
          >
            Check payment status
          </Link>
        )}
        {result.error && (
          <button className="mt-4 text-brand" onClick={() => void result.refetch()}>
            Try again
          </button>
        )}
        <Link to="/catalog" className="mt-6 inline-block text-brand">
          Back to catalog
        </Link>
      </section>
    </main>
  );
}
