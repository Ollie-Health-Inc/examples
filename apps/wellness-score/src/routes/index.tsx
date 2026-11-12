import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { DateTime } from "#/components";
import { listMembers } from "#/lib/loops";
import { saveMember, useMembers } from "#/lib/members";

export const Route = createFileRoute("/")({
  loader: () => listMembers({ data: {} }),
  component: MembersPage,
});

type Page = Awaited<ReturnType<typeof listMembers>>;

function MembersPage() {
  const firstPage = Route.useLoaderData();
  const [morePages, setMorePages] = useState<Page[]>([]);
  const local = useMembers();

  const pages = [firstPage, ...morePages];
  // Drop repeats, in case new members pushed someone from the first page onto a later one.
  const users = pages
    .flatMap((page) => page.users)
    .filter((user, i, all) => all.findIndex((u) => u.id === user.id) === i);
  const nextCursor = pages[pages.length - 1].nextCursor;

  // Loops only creates a member once their first check starts. Until then they're a draft here.
  const drafts = (local ?? []).filter(
    (member) => !users.some((user) => user.id === member.id),
  );

  async function loadMore() {
    if (!nextCursor) return;
    const page = await listMembers({ data: { cursor: nextCursor } });
    setMorePages((loaded) => [...loaded, page]);
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-10">
      <section>
        <h1 className="text-5xl font-semibold">Your wellness score.</h1>
        <p className="mt-4 text-lg text-neutral-500">
          A member portal. Start a wellness check for a test member, watch their
          30 second face scan come back as a score, and chat with the agent
          about what it means.
        </p>
      </section>

      <NewMemberForm />

      <section>
        <h2 className="mb-3 font-semibold">Members</h2>
        {users.length === 0 && drafts.length === 0 && (
          <p className="card text-neutral-500">No members yet.</p>
        )}
        <ul className="space-y-2">
          {drafts.map((member) => (
            <MemberRow
              key={member.id}
              id={member.id}
              name={member.name}
              detail="No check yet"
            />
          ))}
          {users.map((user) => (
            <MemberRow
              key={user.id}
              id={user.id}
              name={local?.find((m) => m.id === user.id)?.name}
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

function MemberRow({
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
        to="/members/$memberId"
        params={{ memberId: id }}
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

function NewMemberForm() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [memberId, setMemberId] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"female" | "male">("female");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const id = memberId.trim();
    saveMember({ id, name: name.trim(), age: Number(age), gender });
    navigate({ to: "/members/$memberId", params: { memberId: id } });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h2 className="font-semibold">New member</h2>
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
          value={memberId}
          onChange={(event) => setMemberId(event.target.value)}
          placeholder="Membership number, like member-10442"
          className="input shadow-none"
        />
        <input
          required
          type="number"
          min={18}
          max={110}
          value={age}
          onChange={(event) => setAge(event.target.value)}
          placeholder="Age"
          className="input shadow-none"
        />
        <select
          value={gender}
          onChange={(event) =>
            setGender(event.target.value as "female" | "male")
          }
          className="input shadow-none"
        >
          <option value="female">Female</option>
          <option value="male">Male</option>
        </select>
      </div>
      <p className="px-2 text-sm text-neutral-500">
        Members are kept in this browser until their first check starts. Age and
        sex are only used for the risk estimates.
      </p>
      <button type="submit" className="button w-full">
        Add member
      </button>
    </form>
  );
}
