import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-6 border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-6 py-8 text-sm text-subtle sm:flex-row sm:items-center">
        <span className="font-mono text-[11px] uppercase tracking-wider">
          Ledgerline · B2B Software Licenses
        </span>
        <Link to="/policy" className="font-mono text-[11px] uppercase tracking-wider hover:text-ink">
          © {new Date().getFullYear()} · Digital licenses only · All sales final
        </Link>
      </div>
    </footer>
  );
}
