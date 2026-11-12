import { useState } from "react";
import type { FormEvent } from "react";
import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import Markdown from "react-markdown";

import { LinkifiedText } from "#/components";
import { getPatient, sendChatMessage, symptomChecks } from "#/lib/loops";
import {
  introLine,
  newThreadId,
  updatePatient,
  usePatients,
} from "#/lib/patients";
import type { LocalPatient, Message } from "#/lib/patients";

export const Route = createFileRoute("/intake/$patientId")({
  loader: ({ params }) => getPatient({ data: params.patientId }),
  component: IntakePage,
});

const STARTERS = [
  "I'd like to book an appointment for a sore throat",
  "I've had a headache for three days",
  "Can I see someone about my back pain this week?",
];

function IntakePage() {
  const { patientId } = Route.useParams();
  const patients = usePatients();

  if (!patients) return null;

  const patient = patients.find((p) => p.id === patientId);
  if (!patient) {
    return (
      <p className="card">
        Start from the form so we know who you are.{" "}
        <Link to="/" className="font-medium underline">
          Book a visit
        </Link>
      </p>
    );
  }

  return <Intake patient={patient} />;
}

function Intake({ patient }: { patient: LocalPatient }) {
  const loopsPatient = Route.useLoaderData();
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  const [urgentCheck, setUrgentCheck] = useState("");
  const [requestSent, setRequestSent] = useState(false);

  // The agent's tools finish a few seconds after it replies, so check the patient for up to 30 seconds.
  async function watchForResults() {
    const checksBefore = symptomChecks(loopsPatient).length;
    const sentBefore = loopsPatient?.metadata.lastIntake?.submittedAt;

    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const latest = await getPatient({ data: patient.id });

      const newChecks = symptomChecks(latest).slice(checksBefore);
      const sentNow = latest?.metadata.lastIntake?.submittedAt;
      if (newChecks.length === 0 && sentNow === sentBefore) continue;

      // The agent never sees the check's result, so the app shows urgent ones itself.
      const urgent = newChecks.find((line) => line.includes("Red flags:"));
      if (urgent) setUrgentCheck(urgent);
      if (sentNow !== sentBefore) setRequestSent(true);
      await router.invalidate();
      return;
    }
  }

  function addMessage(message: Message) {
    updatePatient(patient.id, (p) => ({
      ...p,
      messages: [...p.messages, message],
    }));
  }

  async function send(text: string) {
    // Loops remembers the thread, so send only the new message. The first one carries the intro.
    const isFirstMessage = patient.messages.length === 0;
    const message = isFirstMessage ? `${introLine(patient)}\n\n${text}` : text;

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
      // Undo the failed turn so the patient can resend it. Retrying on the same thread is safe.
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

  function startNewIntake() {
    updatePatient(patient.id, (p) => ({
      ...p,
      threadId: newThreadId(),
      messages: [],
    }));
    setError("");
    setUrgentCheck("");
    setRequestSent(false);
  }

  const [firstStarter, ...otherStarters] = STARTERS;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4">
      {/* Always shown. Don't rely on the agent for this, since it never sees the symptom check. */}
      <p className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-sm text-neutral-600">
        This chat collects your details for a booking request. It isn't medical
        advice.{" "}
        <strong className="text-neutral-900">
          If this is an emergency, call emergency services now.
        </strong>
      </p>

      {urgentCheck && (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800">
          <p className="font-semibold">
            What you've described may need urgent care.
          </p>
          <p className="mt-1">
            <LinkifiedText text={urgentCheck} />
          </p>
        </div>
      )}

      {requestSent && (
        <p className="rounded-2xl bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
          Your request has been sent to the clinic. They'll contact you to
          confirm a time.
        </p>
      )}

      <div className="card flex flex-1 flex-col p-0">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <span className="size-2 rounded-full bg-orange-500" />
            Intake
          </p>
          <button
            onClick={startNewIntake}
            disabled={thinking || patient.messages.length === 0}
            className="text-neutral-500 hover:text-neutral-900 disabled:opacity-40"
          >
            Start over
          </button>
        </div>

        <div className="flex-1 space-y-3 p-5">
          {patient.messages.length === 0 && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold">Hi {patient.name}</h1>
              <p className="text-neutral-600">
                What would you like to be seen for? I'll ask a few short
                questions, then send your request to the clinic.
              </p>
              <button
                onClick={() => send(firstStarter)}
                disabled={thinking}
                className="rounded-full bg-brand px-4 py-2 text-left text-sm font-medium text-white hover:opacity-90"
              >
                {firstStarter} →
              </button>
              <div className="flex flex-wrap gap-2">
                {otherStarters.map((starter) => (
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
            placeholder="Type your answer"
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
      </div>
    </main>
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
