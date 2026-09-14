import { createServerFn } from "@tanstack/react-start";
import { catalog } from "@/lib/queries";
import { z } from "zod";
export const getFullCatalog = createServerFn({ method: "GET" }).handler(async () => catalog);
// Legacy browser-written orders are not trusted PayRam orders.
export const addOrder = createServerFn({ method: "POST" })
  .validator((value: unknown) => z.unknown().parse(value))
  .handler(async () => {
    throw new Error("Orders can only be created through the verified checkout API.");
  });
export const listOrders = createServerFn({ method: "GET" }).handler(async () => {
  throw new Error("Use the authenticated order endpoint with the order access token.");
});
export const resetAllOrders = createServerFn({ method: "POST" }).handler(async () => {
  throw new Error("Payment records cannot be reset from the browser.");
});
