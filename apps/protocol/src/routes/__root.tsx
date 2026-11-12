import type { ReactNode } from "react";
import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Protocol" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 text-sm">
            <Link
              to="/"
              className="flex items-center gap-2 text-base font-semibold tracking-tight"
            >
              <span className="size-2 rounded-full bg-orange-500" />
              Protocol
            </Link>
            <nav className="flex gap-5 text-neutral-500">
              <Link
                to="/"
                activeOptions={{ exact: true }}
                activeProps={{ className: "text-neutral-900" }}
              >
                Store
              </Link>
              <Link
                to="/customers"
                activeProps={{ className: "text-neutral-900" }}
              >
                Customers
              </Link>
            </nav>
          </div>
        </header>
        <div className="mx-auto flex min-h-[calc(100vh-57px)] max-w-5xl flex-col px-4 py-10">
          {children}
        </div>
        <Scripts />
      </body>
    </html>
  );
}
