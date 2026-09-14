import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getPayment, finishAttempt } from "@/services/paymentService";
export function PaymentFailedPage({ paymentId }: { paymentId: string }) {
  const result = useQuery({
    queryKey: ["payram-failed", paymentId],
    queryFn: () => getPayment(paymentId),
    retry: 1,
  });
  const terminal =
    result.data && ["cancelled", "failed", "refunded", "returned"].includes(result.data.status);
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <section className="rounded-[24px] border border-line bg-surface p-8 shadow-panel">
        <h1 className="text-3xl font-bold">
          {terminal ? "Payment " + result.data!.status : "Check your payment"}
        </h1>
        <p className="mt-4 text-subtle">
          {result.error?.message ||
            result.data?.failureReason ||
            "We are checking the latest payment status."}
        </p>
        <p className="mt-4 break-all font-mono text-xs text-subtle">{result.data?.orderId}</p>
        {terminal ? (
          <Link
            to="/checkout"
            onClick={() => finishAttempt()}
            className="mt-6 inline-block text-brand"
          >
            Return to checkout
          </Link>
        ) : (
          <Link
            to="/payment-processing/$paymentId"
            params={{ paymentId }}
            className="mt-6 inline-block text-brand"
          >
            View payment status
          </Link>
        )}
      </section>
    </main>
  );
}
