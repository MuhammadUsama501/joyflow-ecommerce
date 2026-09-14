import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { isAdminSession } from "@/lib/admin-auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: () => {
    if (!isAdminSession()) throw redirect({ to: "/auth" });
  },
  component: () => <Outlet />,
});
