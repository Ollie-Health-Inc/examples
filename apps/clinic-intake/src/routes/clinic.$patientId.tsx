import { Link, createFileRoute } from "@tanstack/react-router";

import { Badge, DateTime, LinkifiedText, UrgencyBadge } from "#/components";
import { getPatient, memoryLines } from "#/lib/loops";

export const Route = createFileRoute("/clinic/$patientId")({
  loader: ({ params }) => getPatient({ data: params.patientId }),
  component: PatientPage,
});

function PatientPage() {
  const patient = Route.useLoaderData();
  const { patientId } = Route.useParams();
  const intake = patient?.metadata.lastIntake;

  return (
    <main className="space-y-6">
      <Link
        to="/clinic"
        className="text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Booking requests
      </Link>

      <section>
        <h1 className="text-4xl font-semibold">
          {patient?.metadata.name ?? patientId}
        </h1>
        <p className="mt-2 text-neutral-500">
          {patient?.metadata.contact ?? patientId}
        </p>
      </section>

      {!patient && (
        <p className="card text-neutral-500">
          Nothing saved for this patient yet.
        </p>
      )}

      {intake && (
        <section className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Last booking request</h2>
            <UrgencyBadge urgency={intake.urgency} />
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <Field label="Reason" value={intake.reason} />
            <Field label="Symptoms" value={intake.symptoms} />
            <Field
              label="For"
              value={
                intake.durationDays ? `${intake.durationDays} days` : undefined
              }
            />
            <Field label="Medicines" value={intake.medicines} />
            <Field label="Allergies" value={intake.allergies} />
            <Field label="Prefers" value={intake.preferredTimes} />
            <dt className="text-neutral-500">Submitted</dt>
            <dd>
              <DateTime value={intake.submittedAt} />
            </dd>
          </dl>
        </section>
      )}

      {patient && (
        <section className="card space-y-3">
          <h2 className="font-semibold">History</h2>
          <p className="text-sm text-neutral-500">
            Everything the clinic's loops remembered about this patient, oldest
            first. Earlier requests only survive here.
          </p>
          <ol className="space-y-3 text-sm">
            {memoryLines(patient).map((line, index) => (
              <li
                key={index}
                className="space-y-1 border-t border-neutral-100 pt-3"
              >
                <MemoryTag line={line} />
                <p className="text-neutral-700">
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

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <>
      <dt className="text-neutral-500">{label}</dt>
      <dd>{value || "None given"}</dd>
    </>
  );
}

function MemoryTag({ line }: { line: string }) {
  if (line.includes("Red flags:")) {
    return (
      <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-medium text-white">
        Symptom check · red flag
      </span>
    );
  }
  if (line.startsWith("Symptom check for")) return <Badge>Symptom check</Badge>;
  if (line.startsWith("Booking request:"))
    return <Badge>Booking request</Badge>;
  return null;
}
