import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { verifyAdminLogin, setAdminSession, getAdminConfig } from "@/lib/admin-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Admin sign in — Ledgerline" },
      { name: "description", content: "Sign in to manage Ledgerline products and pricing." },
      { property: "og:title", content: "Admin sign in — Ledgerline" },
      { property: "og:description", content: "Sign in to the Ledgerline admin portal." },
    ],
  }),
  component: AuthPage,
});

const inputCls =
  "mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-brand/50";
const labelCls = "font-mono text-[10px] uppercase tracking-wider text-subtle";

function AuthPage() {
  const navigate = useNavigate();
  const admin = getAdminConfig();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const ok = await verifyAdminLogin(email, password);
      if (!ok) {
        toast.error("Invalid email or password.");
        return;
      }
      setAdminSession();
      toast.success("Signed in as admin.");
      void navigate({ to: "/admin", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col px-6 py-20">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand">
        (06) — Internal
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Admin sign in</h1>
      <form
        onSubmit={onSubmit}
        className="mt-8 rounded-[24px] border border-line bg-surface p-6 shadow-panel"
      >
        <label className={labelCls}>Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
        <label className="mt-4 block font-mono text-[10px] uppercase tracking-wider text-subtle">
          Password
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />
        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-brand-foreground shadow-brand transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        >
          {busy ? "Please wait…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-wider text-subtle">
        Admin access provided by this project — no external service
      </p>
    </main>
  );
}
