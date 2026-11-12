import { Link, createFileRoute } from "@tanstack/react-router";

import { DateTime, DecisionBadge, words } from "#/components";
import { customerName, useRequests } from "#/lib/desk";
import { getCustomer, returnHistory } from "#/lib/loops";

export const Route = createFileRoute("/customers/$customerId")({
  loader: ({ params }) => getCustomer({ data: params.customerId }),
  component: ReturnsLogPage,
});

function ReturnsLogPage() {
  const customer = Route.useLoaderData();
  const { customerId } = Route.useParams();
  const name = customerName(useRequests(), customerId);
  const lastReturn = customer?.metadata.lastReturn;
  const returnCount = customer?.metadata.returnCount;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6">
      <Link
        to="/customers"
        className="text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Customers
      </Link>

      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold">{name ?? customerId}</h1>
          <p className="mt-2 text-neutral-500">
            {name && `${customerId} · `}
            {returnCount
              ? `${returnCount} recorded ${returnCount === 1 ? "decision" : "decisions"}`
              : "No returns yet"}
          </p>
        </div>
        <Link to="/" search={{ customerId }} className="button py-2">
          New request
        </Link>
      </section>

      {lastReturn && (
        <section className="card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Latest decision</h2>
            <DecisionBadge decision={lastReturn.decision} />
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-neutral-500">Order</dt>
            <dd>{lastReturn.orderId}</dd>
            <dt className="text-neutral-500">Items</dt>
            <dd>{lastReturn.items.join(", ")}</dd>
            <dt className="text-neutral-500">Reason</dt>
            <dd>{lastReturn.reason}</dd>
            <dt className="text-neutral-500">Resolution</dt>
            <dd>{words(lastReturn.resolution)}</dd>
            <dt className="text-neutral-500">Why</dt>
            <dd>{lastReturn.rationale}</dd>
            <dt className="text-neutral-500">Decided</dt>
            <dd>
              <DateTime value={lastReturn.decidedAt} />
            </dd>
          </dl>
        </section>
      )}

      {customer && (
        <section className="card space-y-3">
          <h2 className="font-semibold">History</h2>
          <p className="text-sm text-neutral-500">
            Every recorded decision, oldest first. Loops only keeps the latest
            one in full, and these lines have no dates.
          </p>
          <ol className="space-y-3 text-sm">
            {returnHistory(customer).map((line, index) => (
              <li
                key={index}
                className="border-t border-neutral-100 pt-3 text-neutral-700"
              >
                {line}
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
