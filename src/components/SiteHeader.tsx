import { Link } from "@tanstack/react-router";
import { useCart } from "@/lib/cart";
import { useSession } from "@/hooks/useSession";

const navLink = "text-subtle transition-colors hover:text-ink";

export function SiteHeader() {
  const { count } = useCart();
  const { session } = useSession();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="text-lg font-bold tracking-tight">Ledgerline</span>
          <span className="hidden font-mono text-[10px] uppercase tracking-wider text-subtle sm:inline">
            B2B Software Licenses
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium md:flex">
          <Link to="/catalog" className={navLink}>
            Catalog
          </Link>
          <Link to="/policy" className={navLink}>
            License policy
          </Link>
          <Link to={session ? "/admin" : "/auth"} className={navLink}>
            Admin
          </Link>
        </nav>
        <nav className="mr-3 flex items-center gap-3 text-xs font-semibold md:hidden">
          <Link to="/catalog" className={navLink}>Catalog</Link>
          <Link to={session ? "/admin" : "/auth"} className={navLink}>Admin</Link>
        </nav>
        <Link
          to="/cart"
          className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold shadow-card transition-colors hover:border-brand/40"
        >
          Cart{" "}
          <span className="ml-1 rounded-md bg-brand/10 px-1.5 py-0.5 font-mono text-[11px] text-brand">
            {count}
          </span>
        </Link>
      </div>
    </header>
  );
}
