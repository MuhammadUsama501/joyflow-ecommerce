import { createFileRoute } from "@tanstack/react-router";
import { PaymentProcessingPage } from "@/pages/PaymentProcessingPage";
export const Route = createFileRoute("/payment-processing/$paymentId")({ component: Page });
function Page() {
  const { paymentId } = Route.useParams();
  return <PaymentProcessingPage paymentId={paymentId} />;
}
