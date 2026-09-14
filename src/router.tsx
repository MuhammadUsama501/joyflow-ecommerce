import { QueryClient } from "@tanstack/react-query";
import { createRouter as createRouterInstance } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const createRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouterInstance({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};

export const getRouter = () => createRouter();
