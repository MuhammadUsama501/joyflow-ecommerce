import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/policy")({
  head: () => ({
    meta: [
      { title: "No-Refund & No-Return Policy — Ledgerline" },
      {
        name: "description",
        content:
          "All Ledgerline software licenses are digital and delivered instantly. All sales are final: no refunds, no returns.",
      },
      { property: "og:title", content: "No-Refund & No-Return Policy — Ledgerline" },
      {
        property: "og:description",
        content: "Digital licenses are delivered instantly and are non-refundable.",
      },
    ],
  }),
  component: Policy,
});

const sections = [
  {
    title: "1. Digital delivery",
    body: "Every product sold on Ledgerline is a digital software license. After your PayPal payment is confirmed, an activation key is generated and shown on screen and sent to the email address used at checkout. There is no physical shipment and no delivery address is collected.",
  },
  {
    title: "2. No refunds",
    body: "Because licenses are delivered and usable immediately, all sales are final. Once payment is captured we do not issue refunds, partial refunds, credits or exchanges — including for accidental purchases, duplicate purchases, change of mind, or unused licenses.",
  },
  {
    title: "3. No returns",
    body: "Digital licenses cannot be returned. An issued activation key cannot be revoked and re-sold, so no return, cancellation or buy-back is accepted after checkout completes.",
  },
  {
    title: "4. Before you buy",
    body: "Please review the edition, features and price on the product page before completing checkout. If you are unsure which edition fits your operation, contact us before paying and we will help you choose.",
  },
  {
    title: "5. Faulty or undelivered keys",
    body: "If a key is never delivered or does not activate, we will re-issue a working key for the same edition. Re-issuing a key is the only remedy offered; it does not entitle you to a refund.",
  },
  {
    title: "6. Chargebacks",
    body: "Opening a PayPal dispute or chargeback for a delivered license is a breach of these terms. The related license key will be deactivated and the account may be blocked from future purchases.",
  },
];

function Policy() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand">(05) — Policy</p>
      <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight">
        No-refund &amp; no-return policy
      </h1>
      <p className="mt-4 leading-relaxed text-subtle">
        This policy applies to every purchase made on Ledgerline. By completing checkout you accept it
        in full.
      </p>

      <div className="mt-10 space-y-4">
        {sections.map((s) => (
          <section key={s.title} className="rounded-[20px] border border-line bg-surface p-6 shadow-card">
            <h2 className="text-lg font-bold tracking-tight">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-subtle">{s.body}</p>
          </section>
        ))}
      </div>

      <p className="mt-8 font-mono text-[11px] uppercase tracking-wider text-subtle">
        Digital licenses only · All sales final · Payments processed by PayPal
      </p>
    </main>
  );
}
