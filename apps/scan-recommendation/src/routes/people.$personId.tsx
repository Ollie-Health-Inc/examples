import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import QRCode from "react-qr-code";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { BloodPressureBadge, DateTime, Time, label } from "#/components";
import {
  getPerson,
  getScanLinkPath,
  scanHistory,
  scanSummary,
  sendChatMessage,
  startScan,
} from "#/lib/loops";
import type { LatestScan, Person } from "#/lib/loops";
import {
  SCAN_WAIT_MS,
  introLine,
  newThreadId,
  updatePerson,
  usePeople,
} from "#/lib/people";
import type { LocalPerson, Message, OpenScan } from "#/lib/people";

export const Route = createFileRoute("/people/$personId")({
  loader: async ({ params }) => {
    const [person, scanLinkPath] = await Promise.all([
      getPerson({ data: params.personId }),
      getScanLinkPath(),
    ]);
    return { person, scanLinkPath };
  },
  component: PersonPage,
});

const STARTERS = [
  "Can I do the face scan?",
  "I've been stressed and tired lately, what would help?",
  "What did my scan say?",
];

function PersonPage() {
  const { personId } = Route.useParams();
  const people = usePeople();

  if (!people) return null;

  const local = people.find((p) => p.id === personId);
  if (!local) {
    return (
      <p className="card">
        This person isn't in this browser yet.{" "}
        <Link to="/" className="font-medium underline">
          Add them with this email
        </Link>{" "}
        to scan and chat as them.
      </p>
    );
  }

  return <PersonView local={local} />;
}

function PersonView({ local }: { local: LocalPerson }) {
  const { person } = Route.useLoaderData();
  const scanStatus = useScanStatus(local, person);

  return (
    <main className="space-y-6">
      <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← People
      </Link>

      <section>
        <h1 className="text-4xl font-semibold">{local.name}</h1>
        <p className="mt-2 text-neutral-500">{local.id}</p>
      </section>

      <p className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-sm text-neutral-600">
        The face scan is a wellness check, not a medical test. If you feel
        unwell, talk to your doctor.
      </p>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <Chat local={local} person={person} />
        <div className="space-y-6">
          <ScanPanel local={local} person={person} status={scanStatus} />
          <LatestScanCard scan={person?.metadata.latestScan} />
          <ScanHistory person={person} />
        </div>
      </div>
    </main>
  );
}

type ScanStatus = "waiting" | "received" | "not-completed" | null;

// Loops can't tell us when a scan finishes, so while a link is open, refetch the person every 5 seconds.
function useScanStatus(local: LocalPerson, person: Person | null) {
  const router = useRouter();
  const [received, setReceived] = useState(false);
  const open = local.openScan;
  const latestId = person?.metadata.latestScan?.scanId ?? null;
  const arrived = Boolean(open) && latestId !== open?.previousScanId;
  const expired =
    Boolean(open) &&
    !arrived &&
    Date.now() - new Date(open!.startedAt).getTime() > SCAN_WAIT_MS;
  const waiting = Boolean(open) && !arrived && !expired;

  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => router.invalidate(), 5000);
    return () => clearInterval(timer);
  }, [waiting, router]);

  useEffect(() => {
    if (!arrived) return;
    updatePerson(local.id, (p) => ({ ...p, openScan: null }));
    setReceived(true);
  }, [arrived, local.id]);

  useEffect(() => {
    if (open) setReceived(false);
  }, [open]);

  if (waiting) return "waiting";
  if (expired) return "not-completed";
  if (received) return "received";
  return null;
}

function openScanFor(url: string, person: Person | null): OpenScan {
  return {
    url,
    startedAt: new Date().toISOString(),
    previousScanId: person?.metadata.latestScan?.scanId ?? null,
  };
}

function ScanPanel({
  local,
  person,
  status,
}: {
  local: LocalPerson;
  person: Person | null;
  status: ScanStatus;
}) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setStarting(true);
    setError("");
    try {
      // Every start opens a new scan session with its own link and its own 30 minutes.
      const { scanUrl } = await startScan({ data: local.id });
      updatePerson(local.id, (p) => ({
        ...p,
        openScan: openScanFor(scanUrl, person),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setStarting(false);
    }
  }

  const open = local.openScan;

  return (
    <section className="card space-y-4">
      <h2 className="font-semibold">Face scan</h2>

      {status === "waiting" && open && (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm">
            <span className="size-2 animate-pulse rounded-full bg-orange-500" />
            Waiting for the scan
          </p>
          <div className="flex justify-center rounded-xl border border-neutral-200 p-4">
            <QRCode value={open.url} size={168} />
          </div>
          <p className="text-sm text-neutral-500">
            Scan the code with a phone, or{" "}
            <a
              href={open.url}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-neutral-900 underline"
            >
              open the scan
            </a>{" "}
            on this device. Find good light and keep still for 30 seconds. The
            link expires at{" "}
            <Time
              value={new Date(
                new Date(open.startedAt).getTime() + SCAN_WAIT_MS,
              ).toISOString()}
            />
            .
          </p>
        </div>
      )}

      {status === "received" && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Scan received.
        </p>
      )}

      {status === "not-completed" && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          Scan not completed. The link expired after 30 minutes. The run in the
          dashboard shows why, for example if it was never opened.
        </p>
      )}

      {status !== "waiting" && (
        <>
          <p className="text-sm text-neutral-500">
            The person opens a link on a phone or laptop with a camera, fills in
            a short form, and looks at the camera for about 30 seconds.
          </p>
          <button
            onClick={start}
            disabled={starting}
            className="button w-full py-2"
          >
            {starting
              ? "Starting…"
              : status === "not-completed"
                ? "Start a new scan"
                : "Start scan"}
          </button>
        </>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}

function LatestScanCard({ scan }: { scan: LatestScan | undefined }) {
  if (!scan) {
    return (
      <section className="card space-y-2">
        <h2 className="font-semibold">Latest scan</h2>
        <p className="text-sm text-neutral-500">No scan yet.</p>
      </section>
    );
  }

  return (
    <section className="card space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Latest scan</h2>
        <span className="text-sm text-neutral-500">
          <DateTime value={scan.scannedAt} />
        </span>
      </div>

      <p>
        <span className="text-5xl font-semibold">
          {scan.wellnessScore ?? "–"}
        </span>{" "}
        <span className="text-sm text-neutral-500">wellness score</span>
      </p>

      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-neutral-500">Blood pressure</dt>
          <dd>
            <BloodPressureBadge value={scan.bloodPressure} />
          </dd>
        </div>
        <Reading name="Resting heart rate" value={scan.restingHeartRate} />
        <Reading name="Breathing" value={scan.breathing} />
        <Reading name="BMI" value={scan.bmi} />
      </dl>

      {scan.bloodPressure === "hypertensive_crisis_range" && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          This blood pressure reading is in the crisis range. See a doctor
          today, or call emergency services for chest pain, trouble breathing or
          sudden weakness.
        </p>
      )}

      <a
        href={scan.reportUrl}
        target="_blank"
        rel="noreferrer"
        className="chip block text-center"
      >
        Download report
      </a>
    </section>
  );
}

function Reading({ name, value }: { name: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-neutral-500">{name}</dt>
      <dd>{label(value)}</dd>
    </div>
  );
}

function ScanHistory({ person }: { person: Person | null }) {
  const history = scanHistory(person);
  if (history.length === 0) return null;

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">Scan history</h2>
      <p className="text-sm text-neutral-500">
        Every finished scan, oldest first. Loops only keeps the latest one in
        full.
      </p>
      <ol className="space-y-3 text-sm">
        {history.map((line, index) => (
          <li
            key={index}
            className="border-t border-neutral-100 pt-3 text-neutral-700"
          >
            {line}
          </li>
        ))}
      </ol>
    </section>
  );
}

// The agent sends scan links as markdown or bare URLs. Its scans' links contain the org and scan loop ids.
function findScanLink(reply: string, scanLinkPath: string) {
  return reply
    .match(/https?:\/\/[^\s)\]>]+/g)
    ?.map((url) => url.replace(/[.,;!?]+$/, ""))
    .find((url) => url.includes(scanLinkPath));
}

function Chat({
  local,
  person,
}: {
  local: LocalPerson;
  person: Person | null;
}) {
  const { scanLinkPath } = Route.useLoaderData();
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  const latestScan = person?.metadata.latestScan;

  function addMessage(message: Message) {
    updatePerson(local.id, (p) => ({
      ...p,
      messages: [...p.messages, message],
    }));
  }

  async function send(text: string, sharesScan?: LatestScan) {
    // Loops remembers the thread, so send only the new message. The first one carries the intro and latest scan.
    const isFirstMessage = local.messages.length === 0;
    const message = isFirstMessage
      ? `${introLine(local, latestScan)}\n\n${text}`
      : text;
    const shared = isFirstMessage ? latestScan : sharesScan;

    addMessage({ role: "person", text });
    setDraft("");
    setError("");
    setThinking(true);

    try {
      const reply = await sendChatMessage({
        data: { threadId: local.threadId, message },
      });
      const scanLink = findScanLink(reply, scanLinkPath);
      updatePerson(local.id, (p) => ({
        ...p,
        messages: [...p.messages, { role: "agent", text: reply }],
        sharedScanId: shared ? shared.scanId : p.sharedScanId,
        // A link in the reply means the agent started a scan, so watch for it like one we started.
        openScan: scanLink ? openScanFor(scanLink, person) : p.openScan,
      }));
    } catch (err) {
      // Undo the failed turn so it can be resent. Retrying on the same thread is safe.
      updatePerson(local.id, (p) => ({
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
    updatePerson(local.id, (p) => ({
      ...p,
      threadId: newThreadId(),
      messages: [],
      sharedScanId: null,
    }));
    setError("");
  }

  // The agent never hears about a scan that finished during the thread unless we tell it.
  const unsharedScan =
    local.messages.length > 0 &&
    latestScan &&
    latestScan.scanId !== local.sharedScanId
      ? latestScan
      : undefined;

  return (
    <section className="card flex flex-col p-0">
      <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <span className="size-2 rounded-full bg-orange-500" />
          Chat
        </p>
        <button
          onClick={startNewConversation}
          disabled={thinking || local.messages.length === 0}
          className="text-neutral-500 hover:text-neutral-900 disabled:opacity-40"
        >
          New conversation
        </button>
      </div>

      <div className="min-h-80 space-y-3 p-5">
        {local.messages.length === 0 && (
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

        {local.messages.map((message, index) => (
          <ChatBubble key={index} message={message} />
        ))}

        {thinking && <TypingIndicator />}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="sticky bottom-0 space-y-3 rounded-b-2xl bg-white p-4">
        {unsharedScan && !thinking && (
          <button
            onClick={() =>
              send(
                `Here are my face scan results: ${scanSummary(unsharedScan)}.`,
                unsharedScan,
              )
            }
            className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Share my results →
          </button>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type a message"
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
    </section>
  );
}

function ChatBubble({ message }: { message: Message }) {
  if (message.role === "person") {
    return (
      <div className="ml-auto w-fit max-w-[85%] rounded-2xl bg-neutral-900 px-4 py-2.5 text-white">
        {message.text}
      </div>
    );
  }

  // Replies are markdown. remark-gfm also turns bare URLs, like a scan link, into links.
  return (
    <div className="markdown w-fit max-w-[85%] rounded-2xl bg-sand px-4 py-2.5 break-words">
      <Markdown
        remarkPlugins={[remarkGfm]}
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
