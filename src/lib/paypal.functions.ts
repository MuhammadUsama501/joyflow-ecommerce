import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
// The previous local stub returned the merchant secret and never captured a PayPal payment.
// Fail closed until a real server-side PayPal integration is restored.
export const getPaypalConfig = createServerFn({ method: "GET" }).handler(async () => ({
  clientId: "",
  env: "sandbox" as const,
}));
export const createPaypalOrder = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    z
      .object({
        email: z.string().email(),
        items: z.array(z.object({ slug: z.string(), qty: z.number().int().positive() })),
      })
      .parse(value),
  )
  .handler(async (): Promise<{ orderId: string }> => {
    throw new Error("PayPal checkout is unavailable. Please use the verified PayRam checkout.");
  });
export const capturePaypalOrder = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    z
      .object({
        orderId: z.string(),
        email: z.string().email(),
        items: z.array(z.object({ slug: z.string(), qty: z.number().int().positive() })),
      })
      .parse(value),
  )
  .handler(async (): Promise<{ licenseKey: string }> => {
    throw new Error("PayPal capture is unavailable. No payment has been confirmed.");
  });
