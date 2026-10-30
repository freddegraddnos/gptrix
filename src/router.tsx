import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Keep /page and /page/ both rendering (no redirect) so build-time static pages work; canonical tags pick one URL.
    trailingSlash: "preserve",
    defaultPreloadStaleTime: 0,
    // Start fetching the next screen as soon as a finger touches a link, so
    // the first tap lands on an already-loaded page instead of feeling dead.
    defaultPreload: "intent",
    defaultPreloadDelay: 30,
    // Show the pending UI quickly rather than leaving the old screen frozen.
    defaultPendingMs: 120,
    defaultPendingMinMs: 200,
  });


  return router;
};
