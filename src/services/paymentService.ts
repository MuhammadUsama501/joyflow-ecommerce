import { api } from "./api";
export type PaymentStatus =
  "pending" | "processing" | "paid" | "failed" | "cancelled" | "returned" | "refunded";
export type CheckoutInput = {
  customer: { name: string; email: string };
  items: { productId: string; quantity: number }[];
};
export type CheckoutResult = {
  orderId: string;
  paymentId: string;
  amount: number;
  currency: string;
  cryptoAsset: string;
  cryptoNetwork: string;
  status: PaymentStatus;
  failureReason: string | null;
  checkout: { type: "payram"; url: string | null; sessionId: string | null };
};
export type Payment = {
  id: string;
  orderId: string;
  status: PaymentStatus;
  fiatAmount: number;
  fiatCurrency: string;
  failureReason: string | null;
  checkout: CheckoutResult["checkout"];
  transactionHash: string | null;
  paidAt: string | null;
};
export type StoreOrder = {
  id: string;
  status: string;
  totalAmount: number;
  currency: string;
  paidAt: string | null;
  customer: { name: string; email: string };
  items: {
    productId: string;
    productSlug: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
};
export type PaymentConfig = {
  configured: boolean;
  cardEnabled: boolean;
  cryptoAsset: string;
  cryptoNetwork: string;
};
const sessionKey = "ledgerline.payram.";
export function rememberCheckout(result: CheckoutResult, token: string) {
  sessionStorage.setItem(sessionKey + result.paymentId, token);
  sessionStorage.setItem(sessionKey + result.orderId, token);
  sessionStorage.setItem(
    sessionKey + "recent",
    JSON.stringify({ paymentId: result.paymentId, orderId: result.orderId }),
  );
}
export function recentPayment(): string | null {
  try {
    return (
      (
        JSON.parse(sessionStorage.getItem(sessionKey + "recent") || "null") as {
          paymentId: string;
        } | null
      )?.paymentId || null
    );
  } catch {
    return null;
  }
}
function headers(id: string) {
  const token = sessionStorage.getItem(sessionKey + id);
  if (!token)
    throw new Error(
      "Open this order in the browser tab where you checked out. Its private access token is missing.",
    );
  return { Authorization: "Bearer " + token };
}
export function checkoutKey(input: CheckoutInput): string {
  const fingerprint = JSON.stringify(input);
  const raw = sessionStorage.getItem(sessionKey + "attempt");
  const existing = raw ? (JSON.parse(raw) as { fingerprint: string; key: string }) : null;
  if (existing?.fingerprint === fingerprint) return existing.key;
  const key = crypto.randomUUID();
  sessionStorage.setItem(sessionKey + "attempt", JSON.stringify({ fingerprint, key }));
  return key;
}
export function finishAttempt() {
  sessionStorage.removeItem(sessionKey + "attempt");
}
export const createCheckout = (input: CheckoutInput, key: string) =>
  api<CheckoutResult>("/api/checkout", {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: JSON.stringify(input),
  });
export const getPayment = (id: string) =>
  api<Payment>("/api/payments/" + encodeURIComponent(id), { headers: headers(id) });
export const getOrder = (id: string) =>
  api<StoreOrder>("/api/orders/" + encodeURIComponent(id), { headers: headers(id) });
export const getOrderPayment = (id: string) =>
  api<Payment>("/api/orders/" + encodeURIComponent(id) + "/payment-status", {
    headers: headers(id),
  });
export const getPaymentConfig = () => api<PaymentConfig>("/api/payment-config");
