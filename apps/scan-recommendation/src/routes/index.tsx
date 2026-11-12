import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { DateTime } from "#/components";
import { listPeople } from "#/lib/loops";
import { savePerson, usePeople } from "#/lib/people";

export const Route = createFileRoute("/")({
  loader: () => listPeople({ data: {} }),
  component: PeoplePage,
});

type Page = Awaited<ReturnType<typeof listPeople>>;

function PeoplePage() {
  const firstPage = Route.useLoaderData();
  const [morePages, setMorePages] = useState<Page[]>([]);
  const local = usePeople();

  const pages = [firstPage, ...morePages];
  // Drop repeats, in case new people pushed someone from the first page onto a later one.
  const users = pages
    .flatMap((page) => page.users)
    .filter((user, i, all) => all.findIndex((u) => u.id === user.id) === i);
  const nextCursor = pages[pages.length - 1].nextCursor;

  // Loops only creates a person once their first scan starts. Until then they're a draft here.
  const drafts = (local ?? []).filter(
    (person) => !users.some((user) => user.id === person.id),
  );

  async function loadMore() {
    if (!nextCursor) return;
    const page = await listPeople({ data: { cursor: nextCursor } });
    setMorePages((loaded) => [...loaded, page]);
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-10">
      <section>
        <h1 className="text-5xl font-semibold">How are you, really?</h1>
        <p className="mt-4 text-lg text-neutral-500">
          A 30 second face scan reads a few wellness signals. Add a person, send
          them through a scan, and chat with the agent about products that fit.
        </p>
      </section>

      <AddPersonForm />

      <section>
        <h2 className="mb-3 font-semibold">People</h2>
        {users.length === 0 && drafts.length === 0 && (
          <p className="card text-neutral-500">No one yet.</p>
        )}
        <ul className="space-y-2">
          {drafts.map((person) => (
            <PersonRow
              key={person.id}
              id={person.id}
              name={person.name}
              detail="Not scanned yet"
            />
          ))}
          {users.map((user) => (
            <PersonRow
              key={user.id}
              id={user.id}
              name={local?.find((p) => p.id === user.id)?.name}
              detail={<DateTime value={user.createdAt} />}
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

function PersonRow({
  id,
  name,
  detail,
}: {
  id: string;
  name?: string;
  detail: ReactNode;
}) {
  return (
    <li>
      <Link
        to="/people/$personId"
        params={{ personId: id }}
        className="card flex items-center justify-between gap-3 p-4 hover:border-neutral-300"
      >
        <span className="truncate">
          <span className="font-medium">{name || id}</span>{" "}
          {name && <span className="text-sm text-neutral-500">{id}</span>}
        </span>
        <span className="shrink-0 text-sm text-neutral-500">{detail}</span>
      </Link>
    </li>
  );
}

function AddPersonForm() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const id = email.trim().toLowerCase();
    savePerson(name.trim(), id);
    navigate({ to: "/people/$personId", params: { personId: id } });
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-wrap gap-3">
      <input
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Name"
        className="input min-w-40 flex-1 shadow-none"
      />
      <input
        required
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
        className="input min-w-52 flex-1 shadow-none"
      />
      <button type="submit" className="button">
        Add person
      </button>
    </form>
  );
}
