import { useState } from "react";
import type { FormEvent } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { OutcomeBadge } from "#/components";
import { listCustomers } from "#/lib/loops";
import type { Customer } from "#/lib/loops";
import {
  FREQUENCIES,
  PRODUCTS,
  addSubscriber,
  useSubscribers,
} from "#/lib/subscribers";
import type { Subscriber } from "#/lib/subscribers";

export const Route = createFileRoute("/")({
  loader: () => listCustomers({ data: {} }),
  component: CustomersPage,
});

type Page = Awaited<ReturnType<typeof listCustomers>>;

function CustomersPage() {
  const firstPage = Route.useLoaderData();
  const [morePages, setMorePages] = useState<Page[]>([]);
  const subscribers = useSubscribers();

  const pages = [firstPage, ...morePages];
  const known = new Map(
    pages.flatMap((page) => page.customers).map((c) => [c.id, c]),
  );
  // Subscribers this app added, then anyone else Loops knows about.
  const ids = [
    ...(subscribers ?? []).map((s) => s.id).reverse(),
    ...known.keys(),
  ].filter((id, i, all) => all.indexOf(id) === i);
  const nextCursor = pages[pages.length - 1].nextCursor;

  async function loadMore() {
    if (!nextCursor) return;
    const page = await listCustomers({ data: { cursor: nextCursor } });
    setMorePages((loaded) => [...loaded, page]);
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-10">
      <section>
        <h1 className="text-5xl font-semibold">Subscribers</h1>
        <p className="mt-4 text-lg text-neutral-500">
          Add a test subscriber, then open them and ask to cancel. The agent
          finds out why and offers something that fits before letting them go.
        </p>
      </section>

      <AddSubscriberForm />

      <section>
        {ids.length === 0 && (
          <p className="card text-neutral-500">No subscribers yet.</p>
        )}
        <ul className="space-y-2">
          {ids.map((id) => (
            <SubscriberRow
              key={id}
              id={id}
              subscriber={subscribers?.find((s) => s.id === id)}
              customer={known.get(id)}
            />
          ))}
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

function SubscriberRow({
  id,
  subscriber,
  customer,
}: {
  id: string;
  subscriber?: Subscriber;
  customer?: Customer;
}) {
  const save = customer?.metadata.subscriptionSave;
  const cancelledAt = customer?.metadata.subscription?.cancelledAt;
  // Show whichever happened last. A subscriber can come back and ask again after cancelling.
  const cancelled = Boolean(
    cancelledAt && (!save || cancelledAt > save.decidedAt),
  );

  return (
    <li>
      <Link
        to="/customers/$customerId"
        params={{ customerId: id }}
        className="card flex items-center justify-between gap-3 p-4 hover:border-neutral-300"
      >
        <span className="min-w-0">
          <span className="block truncate">
            <span className="font-medium">{subscriber?.name || id}</span>{" "}
            {subscriber && (
              <span className="text-sm text-neutral-500">{id}</span>
            )}
          </span>
          {subscriber && (
            <span className="block text-sm text-neutral-500">
              {subscriber.product}, {subscriber.frequency}
            </span>
          )}
        </span>
        <span className="flex shrink-0 gap-2">
          {save && !cancelled && <OutcomeBadge outcome={save.outcome} />}
          {cancelled && (
            <span className="rounded-full bg-neutral-900 px-2.5 py-0.5 text-xs font-medium text-white">
              Cancelled
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

function AddSubscriberForm() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [product, setProduct] = useState(PRODUCTS[0]);
  const [frequency, setFrequency] = useState("monthly");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const id = email.trim().toLowerCase();
    addSubscriber({
      id,
      name: name.trim(),
      product,
      frequency,
      phone: phone.trim(),
    });
    navigate({ to: "/customers/$customerId", params: { customerId: id } });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-5">
      <h2 className="font-semibold">Add a subscriber</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name"
          className="input shadow-none"
        />
        <input
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          className="input shadow-none"
        />
        <select
          value={product}
          onChange={(event) => setProduct(event.target.value)}
          className="input shadow-none"
        >
          {PRODUCTS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select
          value={frequency}
          onChange={(event) => setFrequency(event.target.value)}
          className="input shadow-none"
        >
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              Delivered {f}
            </option>
          ))}
        </select>
        <input
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="Phone (optional)"
          className="input shadow-none sm:col-span-2"
        />
      </div>
      <p className="px-2 text-sm text-neutral-500">
        Subscribers are kept in this browser. Loops creates the customer once a
        cancel request ends. With a phone, confirming a cancellation sends a
        real win-back SMS.
      </p>
      <button type="submit" className="button w-full">
        Add subscriber
      </button>
    </form>
  );
}
