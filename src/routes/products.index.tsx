import { createFileRoute } from "@tanstack/react-router";
import { redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/products/")({
  beforeLoad: () => {
    throw redirect({ to: "/catalog" });
  },
});
