import { Link, createFileRoute } from "@tanstack/react-router";

import { Badge, DateTime, ResultsTable } from "#/components";
import { getPatient, memoryLines } from "#/lib/loops";
import {
  markNotReviewed,
  markReviewed,
  usePatients,
  useReviews,
} from "#/lib/patients";

export const Route = createFileRoute("/clinician/$patientId")({
  loader: ({ params }) => getPatient({ data: params.patientId }),
  component: ClinicianPatientPage,
});

function ClinicianPatientPage() {
  const patient = Route.useLoaderData();
  const { patientId } = Route.useParams();
  const local = usePatients()?.find((p) => p.id === patientId);
  const reviews = useReviews();
  const followUp = patient?.metadata.labFollowUp;
  const reviewed = followUp && reviews?.[patientId] === followUp.flaggedAt;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6">
      <Link
        to="/clinician"
        className="text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Follow-up
      </Link>

      <section>
        <h1 className="text-4xl font-semibold">{local?.name ?? patientId}</h1>
        {local && <p className="mt-2 text-neutral-500">{patientId}</p>}
      </section>

      {!patient && (
        <p className="card text-neutral-500">
          Nothing saved for this patient yet.
        </p>
      )}

      {followUp && (
        <section className="card flex flex-wrap items-center gap-4">
          <div className="flex-1 space-y-1">
            <h2 className="font-semibold">{followUp.tests.join(", ")}</h2>
            <p className="text-sm text-neutral-500">
              Flagged <DateTime value={followUp.flaggedAt} />
            </p>
          </div>
          {reviews &&
            (reviewed ? (
              <button
                onClick={() => markNotReviewed(patientId)}
                className="chip"
              >
                Reviewed ✓
              </button>
            ) : (
              <button
                onClick={() => markReviewed(patientId, followUp.flaggedAt)}
                className="button py-2"
              >
                Mark reviewed
              </button>
            ))}
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="font-semibold">
          Results{local && ` from ${local.takenOn}`}
        </h2>
        {local ? (
          <ResultsTable results={local.results} />
        ) : (
          <p className="text-sm text-neutral-500">
            Loops doesn't store result values. They're only in the browser that
            entered them.
          </p>
        )}
      </section>

      {patient && (
        <section className="card space-y-3">
          <h2 className="font-semibold">Timeline</h2>
          <p className="text-sm text-neutral-500">
            Everything Loops remembered about this patient, oldest first.
          </p>
          <ol className="space-y-3 text-sm">
            {memoryLines(patient).map((line, index) => (
              <li
                key={index}
                className="space-y-1 border-t border-neutral-100 pt-3"
              >
                <MemoryTag line={line} />
                <p className="break-words text-neutral-700">
                  <LinkifiedText text={line} />
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}

// Memory lines are plain text, so turn the reference page URLs into real links.
function LinkifiedText({ text }: { text: string }) {
  return text.split(/(https?:\/\/\S+?)(?=\.?(?:\s|$))/).map((part, index) =>
    part.startsWith("http") ? (
      <a
        key={index}
        href={part}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2"
      >
        {part}
      </a>
    ) : (
      part
    ),
  );
}

function MemoryTag({ line }: { line: string }) {
  if (line.startsWith("Out of range, flagged for clinician follow-up:")) {
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
        Flagged for follow-up
      </span>
    );
  }
  if (line.startsWith("Reference for")) return <Badge>Reference page</Badge>;
  return null;
}
