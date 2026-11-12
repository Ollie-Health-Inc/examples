import { useEffect, useState } from "react";
import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { Badge, DateTime, UrgencyBadge } from "#/components";
import { readArrivals } from "#/lib/arrivals.server";
import { hasRedFlag, listPatients, symptomChecks } from "#/lib/loops";
import type { Patient } from "#/lib/loops";

// When each patient's request reached our webhook. See routes/api/booking-requests.$token.ts.
const getArrivals = createServerFn({ method: "GET" }).handler(() =>
  readArrivals(),
);

export const Route = createFileRoute("/clinic/")({
  loader: async () => {
    const [firstPage, arrivals] = await Promise.all([
      listPatients({ data: {} }),
      getArrivals(),
    ]);
    return { firstPage, arrivals };
  },
  component: BookingRequestsPage,
});

type Page = Awaited<ReturnType<typeof listPatients>>;

const LAST_SEEN_KEY = "clinic-intake:last-seen";

function BookingRequestsPage() {
  const { firstPage, arrivals } = Route.useLoaderData();
  const [morePages, setMorePages] = useState<Page[]>([]);
  const lastSeen = useLastSeen();
  const router = useRouter();

  // Refetch when the tab regains focus, to pick up requests filed since.
  useEffect(() => {
    const refetch = () => router.invalidate();
    window.addEventListener("focus", refetch);
    return () => window.removeEventListener("focus", refetch);
  }, [router]);

  const pages = [firstPage, ...morePages];
  // Drop repeats, in case new patients pushed someone from the first page onto a later one.
  const patients = pages
    .flatMap((page) => page.patients)
    .filter(
      (patient, i, all) => all.findIndex((p) => p.id === patient.id) === i,
    );
  const nextCursor = pages[pages.length - 1].nextCursor;

  const requests = patients
    .filter((patient) => patient.metadata.lastIntake)
    .sort((a, b) =>
      b.metadata.lastIntake!.submittedAt.localeCompare(
        a.metadata.lastIntake!.submittedAt,
      ),
    );

  // Patients who chatted but never confirmed have symptom checks and no lastIntake.
  const unfinished = patients.filter(
    (patient) =>
      !patient.metadata.lastIntake && symptomChecks(patient).length > 0,
  );

  function isNew(patient: Patient) {
    const arrivedAt = arrivals[patient.id];
    return Boolean(arrivedAt && lastSeen && arrivedAt > lastSeen);
  }

  async function loadMore() {
    if (!nextCursor) return;
    const page = await listPatients({ data: { cursor: nextCursor } });
    setMorePages((loaded) => [...loaded, page]);
  }

  return (
    <main className="space-y-10">
      <section>
        <h1 className="text-5xl font-semibold">Booking requests</h1>
        <p className="mt-4 text-lg text-neutral-500">
          Requests the intake agent has filed, newest first. Contact each
          patient to confirm a time.
        </p>
      </section>

      <section>
        {requests.length === 0 && (
          <p className="card text-neutral-500">No booking requests yet.</p>
        )}
        <ul className="space-y-2">
          {requests.map((patient) => (
            <RequestRow
              key={patient.id}
              patient={patient}
              isNew={isNew(patient)}
            />
          ))}
        </ul>
        {nextCursor && (
          <button onClick={loadMore} className="chip mt-4 w-full">
            Load more
          </button>
        )}
      </section>

      {unfinished.length > 0 && (
        <section>
          <h2 className="mb-1 font-semibold">Unfinished intakes</h2>
          <p className="mb-3 text-sm text-neutral-500">
            Started chatting but never confirmed a request.
          </p>
          <ul className="space-y-2">
            {unfinished.map((patient) => (
              <li key={patient.id}>
                <Link
                  to="/clinic/$patientId"
                  params={{ patientId: patient.id }}
                  className="card flex items-center justify-between gap-3 p-4 hover:border-neutral-300"
                >
                  <span className="truncate">{patient.id}</span>
                  {hasRedFlag(patient) && <Badge>red flag</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function RequestRow({ patient, isNew }: { patient: Patient; isNew: boolean }) {
  const intake = patient.metadata.lastIntake!;

  return (
    <li>
      <Link
        to="/clinic/$patientId"
        params={{ patientId: patient.id }}
        className="card block space-y-2 p-4 hover:border-neutral-300"
      >
        <div className="flex flex-wrap items-center gap-2">
          <UrgencyBadge urgency={intake.urgency} />
          {hasRedFlag(patient) && (
            <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-medium text-white">
              red flag
            </span>
          )}
          {isNew && <Badge>new</Badge>}
          <span className="ml-auto text-sm text-neutral-500">
            <DateTime value={intake.submittedAt} />
          </span>
        </div>
        <p>
          <span className="font-medium">
            {patient.metadata.name ?? intake.name}
          </span>{" "}
          <span className="text-sm text-neutral-500">
            {patient.metadata.contact ?? intake.contact}
          </span>
        </p>
        <p className="text-sm">
          <span className="font-medium">{intake.reason}.</span>{" "}
          <span className="text-neutral-600">{intake.symptoms}</span>
        </p>
        <p className="text-sm text-neutral-500">
          Prefers {intake.preferredTimes}
        </p>
      </Link>
    </li>
  );
}

// Read once per page load, so effects running twice in development, or going to a patient and back, keep the badges.
let previousVisit: string | undefined;

// When the clinic last opened this page, so requests that arrived since get a "new" badge.
function useLastSeen() {
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  useEffect(() => {
    previousVisit ??= localStorage.getItem(LAST_SEEN_KEY) ?? "";
    localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
    setLastSeen(previousVisit);
  }, []);

  return lastSeen;
}
