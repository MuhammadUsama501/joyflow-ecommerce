import { createFileRoute } from "@tanstack/react-router";
import { PaymentFailedPage } from "@/pages/PaymentFailedPage";
export const Route = createFileRoute("/payment-failed/$paymentId")({ component: Page });
function Page() {
  const { paymentId } = Route.useParams();
  return <PaymentFailedPage paymentId={paymentId} />;
}
