import { useState } from "react";
import type { FormEvent } from "react";
import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import Markdown from "react-markdown";

import { DateTime, ResultsTable } from "#/components";
import {
  getPatient,
  referenceLineCount,
  referencePages,
  sendChatMessage,
} from "#/lib/loops";
import type { Patient } from "#/lib/loops";
import {
  firstMessage,
  newThreadId,
  replaceResults,
  updatePatient,
  usePatients,
} from "#/lib/patients";
import type { LocalPatient, Message } from "#/lib/patients";
import { SAMPLE_SETS } from "#/lib/samples";
import type { Flag, LabResult } from "#/lib/samples";

export const Route = createFileRoute("/patients/$patientId")({
  loader: ({ params }) => getPatient({ data: params.patientId }),
  component: PatientPage,
});

const STARTERS = [
  "Can you explain my results?",
  "What does a high HbA1c mean?",
  "My vitamin D is 42 nmol/L, is that low?",
];

function PatientPage() {
  const { patientId } = Route.useParams();
  const patients = usePatients();

  if (!patients) return null;

  const patient = patients.find((p) => p.id === patientId);
  if (!patient) {
    return (
      <p className="card">
        This patient isn't in this browser yet.{" "}
        <Link to="/" className="font-medium underline">
          Add them
        </Link>
      </p>
    );
  }

  return <PatientView patient={patient} />;
}

function PatientView({ patient }: { patient: LocalPatient }) {
  const loopsPatient = Route.useLoaderData();

  return (
    <main className="space-y-6">
      <section>
        <h1 className="text-4xl font-semibold">{patient.name}</h1>
        <p className="mt-2 text-neutral-500">{patient.id}</p>
      </section>

      <p className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-sm text-neutral-600">
        The agent explains what your results mean. It doesn't diagnose or
        suggest treatment.{" "}
        <strong className="text-neutral-900">
          Review any flagged results with a clinician.
        </strong>
      </p>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <ResultsPanel patient={patient} />
          <Chat patient={patient} />
        </div>
        <div className="space-y-6">
          <FollowUpPanel loopsPatient={loopsPatient} />
          <ReferencePanel loopsPatient={loopsPatient} />
        </div>
      </div>
    </main>
  );
}

function ResultsPanel({ patient }: { patient: LocalPatient }) {
  const [editing, setEditing] = useState(false);

  return (
    <section className="card space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Results from {patient.takenOn}</h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-neutral-500 hover:text-neutral-900"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <ResultsEditor patient={patient} onDone={() => setEditing(false)} />
      ) : (
        <>
          {patient.results.length > 0 ? (
            <ResultsTable results={patient.results} />
          ) : (
            <p className="text-sm text-neutral-500">No results.</p>
          )}
          <div className="space-y-2 border-t border-neutral-100 pt-4">
            <p className="text-sm text-neutral-500">
              Or use a sample set. Changing results starts a new conversation.
            </p>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_SETS.map((sample) => (
                <button
                  key={sample.label}
                  onClick={() =>
                    replaceResults(patient.id, sample.results, sample.takenOn)
                  }
                  className="chip"
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

const EMPTY_RESULT: LabResult = {
  name: "",
  value: "",
  unit: "",
  referenceRange: "",
  flag: "normal",
};

function ResultsEditor({
  patient,
  onDone,
}: {
  patient: LocalPatient;
  onDone: () => void;
}) {
  const [takenOn, setTakenOn] = useState(patient.takenOn);
  const [rows, setRows] = useState(patient.results);

  function changeRow(index: number, change: Partial<LabResult>) {
    setRows(rows.map((row, i) => (i === index ? { ...row, ...change } : row)));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    replaceResults(
      patient.id,
      rows.filter((row) => row.name.trim()),
      takenOn,
    );
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-sm">
      <label className="flex items-center gap-3">
        <span className="text-neutral-500">Taken on</span>
        <input
          value={takenOn}
          onChange={(event) => setTakenOn(event.target.value)}
          className="field w-40"
        />
      </label>

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div
            key={index}
            className="grid grid-cols-[2fr_1fr_1fr_1.2fr_auto_auto] gap-2"
          >
            <input
              value={row.name}
              onChange={(event) =>
                changeRow(index, { name: event.target.value })
              }
              placeholder="Full test name"
              aria-label="Test"
              className="field"
            />
            <input
              value={row.value}
              onChange={(event) =>
                changeRow(index, { value: event.target.value })
              }
              placeholder="Value"
              aria-label="Value"
              className="field"
            />
            <input
              value={row.unit}
              onChange={(event) =>
                changeRow(index, { unit: event.target.value })
              }
              placeholder="Unit"
              aria-label="Unit"
              className="field"
            />
            <input
              value={row.referenceRange}
              onChange={(event) =>
                changeRow(index, { referenceRange: event.target.value })
              }
              placeholder="Range"
              aria-label="Reference range"
              className="field"
            />
            <select
              value={row.flag}
              onChange={(event) =>
                changeRow(index, { flag: event.target.value as Flag })
              }
              aria-label="Flag"
              className="field"
            >
              <option value="normal">normal</option>
              <option value="low">low</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
            <button
              type="button"
              onClick={() => setRows(rows.filter((_, i) => i !== index))}
              aria-label="Remove test"
              className="px-2 text-neutral-400 hover:text-neutral-900"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setRows([...rows, EMPTY_RESULT])}
          className="chip"
        >
          Add a test
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={onDone}
          className="px-3 text-neutral-500 hover:text-neutral-900"
        >
          Cancel
        </button>
        <button type="submit" className="button py-2">
          Save results
        </button>
      </div>
    </form>
  );
}

function Chat({ patient }: { patient: LocalPatient }) {
  const loopsPatient = Route.useLoaderData();
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");

  // The lookup finishes a few seconds after the agent replies, so check the patient for up to 30 seconds.
  async function watchForResults() {
    const referencesBefore = referenceLineCount(loopsPatient);
    const flaggedBefore = loopsPatient?.metadata.labFollowUp?.flaggedAt;

    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const latest = await getPatient({ data: patient.id });
      if (
        referenceLineCount(latest) > referencesBefore ||
        latest?.metadata.labFollowUp?.flaggedAt !== flaggedBefore
      ) {
        await router.invalidate();
        return;
      }
    }
  }

  function addMessage(message: Message) {
    updatePatient(patient.id, (p) => ({
      ...p,
      messages: [...p.messages, message],
    }));
  }

  async function send(text: string) {
    // Loops remembers the thread, so send only the new message. The first one carries the intro and results.
    const isFirstMessage = patient.messages.length === 0;
    const message = isFirstMessage ? firstMessage(patient, text) : text;

    addMessage({ role: "patient", text });
    setDraft("");
    setError("");
    setThinking(true);

    try {
      const reply = await sendChatMessage({
        data: { threadId: patient.threadId, message },
      });
      addMessage({ role: "agent", text: reply });
      watchForResults();
    } catch (err) {
      // Undo the failed turn so it can be resent. Retrying on the same thread is safe.
      updatePatient(patient.id, (p) => ({
        ...p,
        messages: p.messages.slice(0, -1),
      }));
      setDraft(text);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setThinking(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (draft.trim()) send(draft.trim());
  }

  function startNewConversation() {
    updatePatient(patient.id, (p) => ({
      ...p,
      threadId: newThreadId(),
      messages: [],
    }));
    setError("");
  }

  return (
    <section className="card flex flex-col p-0">
      <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <span className="size-2 rounded-full bg-orange-500" />
          Ask about your results
        </p>
        <button
          onClick={startNewConversation}
          disabled={thinking || patient.messages.length === 0}
          className="text-neutral-500 hover:text-neutral-900 disabled:opacity-40"
        >
          New conversation
        </button>
      </div>

      <div className="min-h-64 space-y-3 p-5">
        {patient.messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((starter) => (
              <button
                key={starter}
                onClick={() => send(starter)}
                disabled={thinking}
                className="chip"
              >
                {starter}
              </button>
            ))}
          </div>
        )}

        {patient.messages.map((message, index) => (
          <ChatBubble key={index} message={message} />
        ))}

        {thinking && <TypingIndicator />}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <form
        onSubmit={handleSubmit}
        className="sticky bottom-0 flex gap-2 rounded-b-2xl bg-white p-4"
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask a question"
          disabled={thinking}
          className="input"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={thinking || !draft.trim()}
          className="button size-12 px-0"
        >
          ↑
        </button>
      </form>
    </section>
  );
}

function ChatBubble({ message }: { message: Message }) {
  if (message.role === "patient") {
    return (
      <div className="ml-auto w-fit max-w-[85%] rounded-2xl bg-neutral-900 px-4 py-2.5 text-white">
        {message.text}
      </div>
    );
  }

  // Replies are markdown, so render them as such to keep lists and links working.
  return (
    <div className="markdown w-fit max-w-[85%] rounded-2xl bg-sand px-4 py-2.5">
      <Markdown
        components={{
          a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
        }}
      >
        {message.text}
      </Markdown>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex w-fit gap-1 rounded-2xl bg-sand px-4 py-3.5">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-1.5 animate-bounce rounded-full bg-neutral-500"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

function FollowUpPanel({ loopsPatient }: { loopsPatient: Patient | null }) {
  const followUp = loopsPatient?.metadata.labFollowUp;

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">Clinician follow-up</h2>
      {followUp ? (
        <>
          <ul className="flex flex-wrap gap-2">
            {followUp.tests.map((test) => (
              <li
                key={test}
                className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-800"
              >
                {test}
              </li>
            ))}
          </ul>
          <p className="text-sm text-neutral-500">
            Flagged <DateTime value={followUp.flaggedAt} />
          </p>
        </>
      ) : (
        <p className="text-sm text-neutral-500">Nothing flagged.</p>
      )}
    </section>
  );
}

function ReferencePanel({ loopsPatient }: { loopsPatient: Patient | null }) {
  const pages = referencePages(loopsPatient);

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">Reference pages</h2>
      {pages.length === 0 && (
        <p className="text-sm text-neutral-500">
          None saved yet. After the agent explains your results, it looks up
          plain-language pages from MedlinePlus.
        </p>
      )}
      <ul className="space-y-4">
        {pages.map((page) => (
          <li key={page.url} className="space-y-1 text-sm">
            <p className="text-xs text-neutral-500">{page.test}</p>
            <a
              href={page.url}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-2"
            >
              {page.title}
            </a>
            {page.summary && <p className="text-neutral-600">{page.summary}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
