import { createFileRoute } from "@tanstack/react-router";
import { OrderSuccessPage } from "@/pages/OrderSuccessPage";
export const Route = createFileRoute("/orders/$orderId/success")({ component: Page });
function Page() {
  const { orderId } = Route.useParams();
  return <OrderSuccessPage orderId={orderId} />;
}
