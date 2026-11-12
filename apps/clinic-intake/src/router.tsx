import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    // Shown when a loader's call to Loops fails, for example with a bad token.
    defaultErrorComponent: ({ error }) => (
      <p className="card text-red-600">
        {error instanceof Error ? error.message : String(error)}
      </p>
    ),
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
