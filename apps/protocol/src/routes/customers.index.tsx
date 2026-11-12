import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";

import { DateTime } from "#/components";
import { useCustomers } from "#/lib/customers";
import { listCustomers } from "#/lib/loops";

export const Route = createFileRoute("/customers/")({
  loader: () => listCustomers({ data: {} }),
  component: CustomersPage,
});

type Page = Awaited<ReturnType<typeof listCustomers>>;

function CustomersPage() {
  const firstPage = Route.useLoaderData();
  const [morePages, setMorePages] = useState<Page[]>([]);
  const local = useCustomers();

  const pages = [firstPage, ...morePages];
  // Drop repeats, in case new customers pushed someone from the first page onto a later one.
  const users = pages
    .flatMap((page) => page.users)
    .filter((user, i, all) => all.findIndex((u) => u.id === user.id) === i);
  const nextCursor = pages[pages.length - 1].nextCursor;

  async function loadMore() {
    if (!nextCursor) return;
    const page = await listCustomers({ data: { cursor: nextCursor } });
    setMorePages((loaded) => [...loaded, page]);
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-10">
      <section>
        <h1 className="text-5xl font-semibold">Customers</h1>
        <p className="mt-4 text-lg text-neutral-500">
          Everyone Loops knows about, newest first. An order creates the
          customer within a few seconds.
        </p>
      </section>

      <section>
        {users.length === 0 && (
          <p className="card text-neutral-500">
            No customers yet.{" "}
            <Link to="/" className="font-medium underline">
              Place an order
            </Link>
          </p>
        )}
        <ul className="space-y-2">
          {users.map((user) => {
            const name = local?.find((c) => c.id === user.id)?.name;
            return (
              <li key={user.id}>
                <Link
                  to="/customers/$customerId"
                  params={{ customerId: user.id }}
                  className="card flex items-center justify-between gap-3 p-4 hover:border-neutral-300"
                >
                  <span className="truncate">
                    <span className="font-medium">{name || user.id}</span>{" "}
                    {name && (
                      <span className="text-sm text-neutral-500">
                        {user.id}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm text-neutral-500">
                    <DateTime value={user.createdAt} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {nextCursor && (
          <button onClick={loadMore} className="chip mt-4 w-full">
            Load more
          </button>
        )}
      </section>
    </main>
  );
}
