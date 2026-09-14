import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { getPayment, type Payment } from "@/services/paymentService";
export function PaymentProcessingPage({ paymentId }: { paymentId: string }) {
  const navigate = useNavigate();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    setExpired(false);
    async function check() {
      try {
        const next = await getPayment(paymentId);
        if (stopped) return;
        setPayment(next);
        setError("");
        if (next.status === "paid") {
          void navigate({
            to: "/orders/$orderId/success",
            params: { orderId: next.orderId },
            replace: true,
          });
          return;
        }
        if (["failed", "cancelled", "returned", "refunded"].includes(next.status)) {
          void navigate({ to: "/payment-failed/$paymentId", params: { paymentId }, replace: true });
          return;
        }
      } catch (cause) {
        if (!stopped) setError(cause instanceof Error ? cause.message : "Unable to check payment.");
      }
      if (stopped) return;
      if (Date.now() - started >= 10 * 60_000) {
        setExpired(true);
        return;
      }
      timer = setTimeout(() => void check(), 4000);
    }
    void check();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [paymentId, navigate, attempt]);
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <section className="rounded-[24px] border border-line bg-surface p-8 shadow-panel">
        <p className="text-sm font-semibold text-brand">Secure payment</p>
        <h1 className="mt-3 text-3xl font-bold">
          {expired ? "Still waiting for confirmation" : "Payment processing"}
        </h1>
        <p className="mt-4 text-subtle">
          Complete your payment in the PayRam tab. Please do not close this window while we check
          your order.
        </p>
        {payment?.checkout.url && (
          <a
            href={payment.checkout.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-block rounded-xl bg-brand px-5 py-3 font-semibold text-brand-foreground"
          >
            Open secure payment
          </a>
        )}
        {payment?.failureReason && (
          <p className="mt-4 text-sm text-subtle">{payment.failureReason}</p>
        )}
        <p className="mt-5 break-all font-mono text-xs text-subtle">
          Order: {payment?.orderId || "Loading..."}
        </p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        )}
        {expired && (
          <p className="mt-4 text-sm text-subtle">
            Automatic checks have paused. Your payment has not been marked failed. Check again or
            contact the store with your order reference.
          </p>
        )}
        {(expired || error) && (
          <button
            onClick={() => setAttempt((a) => a + 1)}
            className="mt-4 rounded-xl border border-line px-4 py-2"
          >
            Check again
          </button>
        )}
        <Link to="/cart" className="mt-6 block text-sm text-brand">
          Back to cart
        </Link>
      </section>
    </main>
  );
}
