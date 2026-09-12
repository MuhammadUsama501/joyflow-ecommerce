import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const itemsSchema = z.object({
  items: z.array(z.object({ slug: z.string().min(1), qty: z.number().int().min(1).max(50) })).min(1),
});

function paypalBase() {
  return process.env["PAYPAL_ENV"] === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function paypalToken() {
  const id = process.env["PAYPAL_CLIENT_ID"];
  const secret = process.env["PAYPAL_CLIENT_SECRET"];
  if (!id || !secret) throw new Error("PayPal is not configured yet.");
  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error("Could not authenticate with PayPal.");
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

async function priceCart(items: { slug: string; qty: number }[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("slug, name, price_cents, currency, is_active")
    .in(
      "slug",
      items.map((i) => i.slug),
    );
  if (error) throw new Error(error.message);
  const lines = items.map((i) => {
    const product = data?.find((p) => p.slug === i.slug);
    if (!product || !product.is_active) throw new Error(`Product unavailable: ${i.slug}`);
    return {
      slug: product.slug,
      name: product.name,
      qty: i.qty,
      priceCents: product.price_cents,
      currency: product.currency,
    };
  });
  const amountCents = lines.reduce((n, l) => n + l.qty * l.priceCents, 0);
  return { lines, amountCents, currency: lines[0]?.currency ?? "USD" };
}

export const getPaypalConfig = createServerFn({ method: "GET" }).handler(async () => ({
  clientId: process.env["PAYPAL_CLIENT_ID"] ?? null,
  env: process.env["PAYPAL_ENV"] === "live" ? "live" : "sandbox",
}));

export const createPaypalOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => itemsSchema.parse(input))
  .handler(async ({ data }) => {
    const { amountCents, currency, lines } = await priceCart(data.items);
    const token = await paypalToken();
    const res = await fetch(`${paypalBase()}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: (amountCents / 100).toFixed(2),
            },
            description: lines.map((l) => `${l.name} x${l.qty}`).join(", ").slice(0, 127),
          },
        ],
      }),
    });
    const json = (await res.json()) as { id?: string; message?: string };
    if (!res.ok || !json.id) throw new Error(json.message ?? "Could not start PayPal checkout.");
    return { orderId: json.id };
  });

export const capturePaypalOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        orderId: z.string().min(1),
        email: z.string().email(),
        items: itemsSchema.shape.items,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const token = await paypalToken();
    const res = await fetch(`${paypalBase()}/v2/checkout/orders/${data.orderId}/capture`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    const json = (await res.json()) as { status?: string; message?: string };
    if (!res.ok || json.status !== "COMPLETED") {
      throw new Error(json.message ?? "PayPal could not complete this payment.");
    }

    const { lines, amountCents, currency } = await priceCart(data.items);
    const licenseKey = `LL-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("orders").insert({
      paypal_order_id: data.orderId,
      status: "paid",
      email: data.email,
      items: lines,
      amount_cents: amountCents,
      currency,
      license_key: licenseKey,
    });

    return { licenseKey, amountCents, currency };
  });
