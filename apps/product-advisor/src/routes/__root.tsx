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
      { title: "Product advisor" },
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
          <div className="mx-auto flex max-w-2xl items-center px-4 py-4">
            <Link
              to="/"
              className="flex items-center gap-2 font-semibold tracking-tight"
            >
              <span className="size-2 rounded-full bg-orange-500" />
              Product advisor
            </Link>
          </div>
        </header>
        <div className="mx-auto flex min-h-[calc(100vh-57px)] max-w-2xl flex-col px-4 py-10">
          {children}
        </div>
        <Scripts />
      </body>
    </html>
  );
}
