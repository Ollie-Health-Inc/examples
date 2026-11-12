import { useState } from "react";
import { Link, createFileRoute, useRouter } from "@tanstack/react-router";

import { Badge, DateTime } from "#/components";
import { listFlaggedPatients } from "#/lib/loops";
import { usePatients, useReviews } from "#/lib/patients";

export const Route = createFileRoute("/clinician/")({
  loader: () => listFlaggedPatients(),
  component: FollowUpPage,
});

function FollowUpPage() {
  const flagged = Route.useLoaderData();
  const patients = usePatients();
  const reviews = useReviews();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await router.invalidate();
    setRefreshing(false);
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-10">
      <section className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-semibold">Follow-up</h1>
          <p className="mt-4 text-lg text-neutral-500">
            Patients with results flagged for a clinician to review, newest
            first.
          </p>
        </div>
        <button onClick={refresh} disabled={refreshing} className="chip">
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </section>

      {flagged.length === 0 && (
        <p className="card text-neutral-500">Nothing flagged yet.</p>
      )}

      <ul className="space-y-2">
        {flagged.map((patient) => {
          const followUp = patient.metadata.labFollowUp!;
          const name = patients?.find((p) => p.id === patient.id)?.name;
          // A new flag replaces the old one, so a review only counts for the flaggedAt it was made at.
          const reviewed = reviews?.[patient.id] === followUp.flaggedAt;

          return (
            <li key={patient.id}>
              <Link
                to="/clinician/$patientId"
                params={{ patientId: patient.id }}
                className="card block space-y-2 p-4 hover:border-neutral-300"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {reviews &&
                    (reviewed ? (
                      <Badge>reviewed</Badge>
                    ) : (
                      <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-medium text-white">
                        new
                      </span>
                    ))}
                  <span className="font-medium">{name ?? patient.id}</span>
                  {name && (
                    <span className="text-sm text-neutral-500">
                      {patient.id}
                    </span>
                  )}
                  <span className="ml-auto text-sm text-neutral-500">
                    <DateTime value={followUp.flaggedAt} />
                  </span>
                </div>
                <p className="text-sm text-neutral-600">
                  {followUp.tests.join(", ")}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
