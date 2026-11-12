import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, createFileRoute, useRouter } from "@tanstack/react-router";

import { listUsers } from "#/lib/loops";
import type { LoopsUser } from "#/lib/loops";
import { addShopper, removeShopper, useShoppers } from "#/lib/shoppers";
import type { Shopper } from "#/lib/shoppers";

export const Route = createFileRoute("/")({
  // Runs again whenever you navigate back here, so new Loops users show up.
  loader: () => listUsers({ data: {} }),
  component: ShoppersPage,
});

type Page = Awaited<ReturnType<typeof listUsers>>;

function ShoppersPage() {
  const firstPage = Route.useLoaderData();
  const [morePages, setMorePages] = useState<Page[]>([]);
  const shoppers = useShoppers();
  const router = useRouter();

  // Refetch the list when the tab regains focus, to pick up shoppers whose quiz just saved.
  useEffect(() => {
    const refetch = () => router.invalidate();
    window.addEventListener("focus", refetch);
    return () => window.removeEventListener("focus", refetch);
  }, [router]);

  const pages = [firstPage, ...morePages];
  // Drop repeats, in case new users pushed someone from the first page onto a later one.
  const users = pages
    .flatMap((page) => page.users)
    .filter((user, i, all) => all.findIndex((u) => u.id === user.id) === i);
  const nextCursor = pages[pages.length - 1].nextCursor;

  async function loadMore() {
    if (!nextCursor) return;
    const page = await listUsers({ data: { cursor: nextCursor } });
    setMorePages((loaded) => [...loaded, page]);
  }

  return (
    <main className="space-y-10">
      <section>
        <h1 className="text-5xl font-semibold">Find products that fit.</h1>
        <p className="mt-4 text-lg text-neutral-500">
          Create a shopper, then chat with the advisor as them. It asks a few
          questions and recommends from the brand catalogue.
        </p>
      </section>

      <NewShopperForm />

      {/* Drafts and names live in the browser, so the list renders once the page loads there. */}
      {shoppers && (
        <ShopperList
          users={users}
          shoppers={shoppers}
          onLoadMore={nextCursor ? loadMore : undefined}
        />
      )}
    </main>
  );
}

function ShopperList(props: {
  users: LoopsUser[];
  shoppers: Shopper[];
  onLoadMore?: () => void;
}) {
  // A shopper only exists in Loops after their first saved quiz. Until then they're a local draft.
  const drafts = props.shoppers.filter(
    (shopper) => !props.users.some((user) => user.id === shopper.id),
  );

  function nameFor(id: string) {
    return props.shoppers.find((shopper) => shopper.id === id)?.name || id;
  }

  return (
    <section>
      <h2 className="mb-3 font-semibold">Shoppers</h2>
      {drafts.length === 0 && props.users.length === 0 && (
        <p className="card text-neutral-500">
          No shoppers yet. Create one above to start chatting.
        </p>
      )}
      <ul className="space-y-2">
        {drafts.map((shopper) => (
          <ShopperRow
            key={shopper.id}
            id={shopper.id}
            name={shopper.name || shopper.id}
            detail="No quiz yet"
            onDelete={() => removeShopper(shopper.id)}
          />
        ))}
        {props.users.map((user) => (
          <ShopperRow
            key={user.id}
            id={user.id}
            name={nameFor(user.id)}
            detail={`Updated ${new Date(user.updatedAt).toLocaleString()}`}
          />
        ))}
      </ul>
      {props.onLoadMore && (
        <button onClick={props.onLoadMore} className="chip mt-4 w-full">
          Load more
        </button>
      )}
    </section>
  );
}

function ShopperRow(props: {
  id: string;
  name: string;
  detail: string;
  onDelete?: () => void;
}) {
  return (
    <li className="card flex items-center gap-4 p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sand font-medium text-neutral-700">
        {props.name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{props.name}</p>
        <p className="truncate text-sm text-neutral-500">
          {props.name === props.id
            ? props.detail
            : `${props.id} · ${props.detail}`}
        </p>
      </div>
      {/* Only local drafts can be deleted. There's no API for deleting Loops users. */}
      {props.onDelete && (
        <button
          onClick={props.onDelete}
          className="text-sm text-neutral-500 hover:text-red-600"
        >
          Delete
        </button>
      )}
      <Link
        to="/users/$userId"
        params={{ userId: props.id }}
        className="button py-2"
      >
        Chat
      </Link>
    </li>
  );
}

function NewShopperForm() {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!addShopper(name.trim(), contact.trim())) {
      setError("A shopper with that email or phone already exists.");
      return;
    }
    setName("");
    setContact("");
    setError("");
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h2 className="font-semibold">New shopper</h2>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name"
          className="input shadow-none"
        />
        <input
          required
          value={contact}
          onChange={(event) => setContact(event.target.value)}
          placeholder="Email or phone"
          className="input shadow-none"
        />
        <button type="submit" className="button">
          Create
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
