import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import QRCode from "react-qr-code";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  BandBadge,
  BloodPressureBadge,
  DateTime,
  Time,
  label,
} from "#/components";
import {
  getMember,
  getScanLinkPath,
  scoreHistory,
  sendChatMessage,
  startWellnessCheck,
} from "#/lib/loops";
import type { Member, WellnessScore } from "#/lib/loops";
import {
  CHECK_WAIT_MS,
  introLine,
  newScoreLine,
  newThreadId,
  updateMember,
  useMembers,
} from "#/lib/members";
import type { LocalMember, Message, OpenCheck } from "#/lib/members";

export const Route = createFileRoute("/members/$memberId")({
  loader: async ({ params }) => {
    const [member, scanLinkPath] = await Promise.all([
      getMember({ data: params.memberId }),
      getScanLinkPath(),
    ]);
    return { member, scanLinkPath };
  },
  component: MemberPage,
});

const STARTERS = [
  "What's my wellness score?",
  "I'd like to do my wellness check",
  "How can I improve my score?",
];

function MemberPage() {
  const { memberId } = Route.useParams();
  const { member } = Route.useLoaderData();
  const members = useMembers();

  if (!members) return null;

  const local = members.find((m) => m.id === memberId);
  if (local) return <MemberView local={local} />;

  // A check started somewhere else, for example from a chat under an id this browser doesn't know.
  return (
    <main className="space-y-6">
      <BackLink />
      <h1 className="text-4xl font-semibold">{memberId}</h1>
      <p className="card text-sm text-neutral-500">
        This member wasn't added in this browser.{" "}
        <Link to="/" className="font-medium underline">
          Add them with this membership number
        </Link>{" "}
        to start a check or chat as them.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <ScoreCard result={member?.metadata.wellnessScore} />
        <History member={member} />
      </div>
    </main>
  );
}

function BackLink() {
  return (
    <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-900">
      ← Members
    </Link>
  );
}

function MemberView({ local }: { local: LocalMember }) {
  const { member } = Route.useLoaderData();
  const checkStatus = useCheckStatus(local, member);

  return (
    <main className="space-y-6">
      <BackLink />

      <section>
        <h1 className="text-4xl font-semibold">{local.name}</h1>
        <p className="mt-2 text-neutral-500">
          {local.id} · {local.age}, {local.gender}
        </p>
      </section>

      <p className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-sm text-neutral-600">
        The wellness score is a wellness indicator, not a diagnosis, and it
        isn't used to decide cover or claims. If you feel unwell, talk to your
        doctor.
      </p>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <Chat local={local} member={member} />
        <div className="space-y-6">
          <ScoreCard result={member?.metadata.wellnessScore} />
          <CheckPanel local={local} member={member} status={checkStatus} />
          <History member={member} />
        </div>
      </div>
    </main>
  );
}

type CheckStatus = "waiting" | "received" | "not-taken" | null;

// Loops can't tell us when a scan finishes, so while a check is open, refetch the member every 10 seconds.
function useCheckStatus(local: LocalMember, member: Member | null) {
  const router = useRouter();
  const [received, setReceived] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const open = local.openCheck;
  const latest = member?.metadata.wellnessScore?.scannedAt ?? null;
  const arrived = Boolean(open) && latest !== open?.previousScannedAt;
  const expired =
    Boolean(open) &&
    !arrived &&
    now - new Date(open!.startedAt).getTime() > CHECK_WAIT_MS;
  const waiting = Boolean(open) && !arrived && !expired;

  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      router.invalidate();
    }, 10_000);
    return () => clearInterval(timer);
  }, [waiting, router]);

  useEffect(() => {
    if (!arrived) return;
    updateMember(local.id, (m) => ({ ...m, openCheck: null }));
    setReceived(true);
  }, [arrived, local.id]);

  useEffect(() => {
    if (open) setReceived(false);
  }, [open]);

  if (waiting) return "waiting";
  if (expired) return "not-taken";
  if (received) return "received";
  return null;
}

function openCheckFor(url: string, member: Member | null): OpenCheck {
  return {
    url,
    startedAt: new Date().toISOString(),
    previousScannedAt: member?.metadata.wellnessScore?.scannedAt ?? null,
  };
}

function CheckPanel({
  local,
  member,
  status,
}: {
  local: LocalMember;
  member: Member | null;
  status: CheckStatus;
}) {
  const open = local.openCheck;

  return (
    <section className="card space-y-4">
      <h2 className="font-semibold">Wellness check</h2>

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
            Open on a phone or laptop with a camera, in Chrome or Safari.{" "}
            <a
              href={open.url}
              target="_blank"
              rel="noreferrer"
              className="font-medium break-all text-neutral-900 underline"
            >
              {open.url}
            </a>
          </p>
          <p className="text-sm text-neutral-500">
            The scan takes a few minutes, and the link works until{" "}
            <Time
              value={new Date(
                new Date(open.startedAt).getTime() + CHECK_WAIT_MS,
              ).toISOString()}
            />
            . WhatsApp's in-app browser can't run it.
          </p>
        </div>
      )}

      {status === "received" && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Scan received. The score card is up to date.
        </p>
      )}

      {status === "not-taken" && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          The scan wasn't taken. The link expired after an hour. The run's
          wait-for-scan step in the dashboard shows why.
        </p>
      )}

      {status !== "waiting" && (
        <CheckForm
          local={local}
          member={member}
          retry={status === "not-taken"}
        />
      )}
    </section>
  );
}

function CheckForm({
  local,
  member,
  retry,
}: {
  local: LocalMember;
  member: Member | null;
  retry: boolean;
}) {
  const [age, setAge] = useState(String(local.age));
  const [gender, setGender] = useState(local.gender);
  const [smoker, setSmoker] = useState(local.smoker);
  const [hasDiabetes, setHasDiabetes] = useState(local.hasDiabetes);
  const [isTreatedForHypertension, setTreated] = useState(
    local.isTreatedForHypertension,
  );
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const details = {
      age: Number(age),
      gender,
      smoker,
      hasDiabetes,
      isTreatedForHypertension,
    };
    setStarting(true);
    setError("");
    try {
      // Every check is a new run, with its own link and its own hour.
      const { scanUrl } = await startWellnessCheck({
        data: { memberId: local.id, ...details },
      });
      updateMember(local.id, (m) => ({
        ...m,
        ...details,
        openCheck: openCheckFor(scanUrl, member),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setStarting(false);
    }
  }

  const questions: [string, boolean, (value: boolean) => void][] = [
    ["Smokes", smoker, setSmoker],
    ["Has diabetes", hasDiabetes, setHasDiabetes],
    ["Takes blood pressure medicine", isTreatedForHypertension, setTreated],
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-neutral-500">
        Only used for the risk estimates. The scan page asks for height and
        weight, then looks at the camera for 30 seconds.
      </p>
      <div className="flex gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-neutral-500">Age</span>
          <input
            required
            type="number"
            min={18}
            max={110}
            value={age}
            onChange={(event) => setAge(event.target.value)}
            className="field w-20"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-neutral-500">Sex</span>
          <select
            value={gender}
            onChange={(event) =>
              setGender(event.target.value as "female" | "male")
            }
            className="field"
          >
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </label>
      </div>
      <div className="space-y-2 text-sm">
        {questions.map(([question, checked, set]) => (
          <label key={question} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => set(event.target.checked)}
              className="size-4 accent-brand"
            />
            {question}
          </label>
        ))}
      </div>
      <button type="submit" disabled={starting} className="button w-full py-2">
        {starting
          ? "Starting…"
          : retry
            ? "Start a new check"
            : "Start wellness check"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

function ScoreCard({ result }: { result: WellnessScore | undefined }) {
  if (!result) {
    return (
      <section className="card space-y-2">
        <h2 className="font-semibold">Wellness score</h2>
        <p className="text-sm text-neutral-500">No wellness score yet.</p>
      </section>
    );
  }

  const percent = (value: number | null) =>
    value === null ? "Not estimated" : `${value}%`;

  return (
    <section className="card space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Wellness score</h2>
        <span className="text-sm text-neutral-500">
          <DateTime value={result.scannedAt} />
        </span>
      </div>

      <div className="flex items-center gap-3">
        <p>
          <span className="text-5xl font-semibold">{result.score ?? "–"}</span>
          <span className="text-neutral-500"> / 100</span>
        </p>
        <BandBadge band={result.band} />
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-neutral-500">Blood pressure</dt>
          <dd>
            <BloodPressureBadge value={result.bloodPressure} />
          </dd>
        </div>
        <Reading
          name="BMI"
          value={
            result.bmi
              ? `${result.bmi.value}, ${label(result.bmi.category).toLowerCase()}`
              : "Not measured"
          }
        />
      </dl>

      {result.bloodPressure === "hypertensive_crisis_range" && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          This blood pressure reading is in the crisis range. See a doctor
          today, or call emergency services for chest pain, trouble breathing or
          sudden weakness.
        </p>
      )}

      <div className="space-y-2 border-t border-neutral-100 pt-4">
        <h3 className="text-sm font-medium">Screening estimates</h3>
        <dl className="space-y-2 text-sm">
          <Reading
            name="10-year heart risk"
            value={percent(result.tenYearCvdRiskPercent)}
          />
          <Reading
            name="Heart age"
            value={
              result.vascularAgeYears === null
                ? "Not estimated"
                : `${result.vascularAgeYears} years`
            }
          />
          <Reading
            name="Diabetes risk"
            value={percent(result.diabetesRiskPercent)}
          />
        </dl>
        <p className="text-xs text-neutral-500">
          Estimates from a short scan, not a verdict. A reason to check in with
          a doctor.
        </p>
      </div>

      <a
        href={result.reportUrl}
        target="_blank"
        rel="noreferrer"
        className="chip block text-center"
      >
        Download report
      </a>
    </section>
  );
}

function Reading({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-neutral-500">{name}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function History({ member }: { member: Member | null }) {
  const history = scoreHistory(member);
  if (history.length === 0) return null;

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">History</h2>
      <p className="text-sm text-neutral-500">
        Every finished check, oldest first. Loops only keeps the latest one in
        full.
      </p>
      <ol className="space-y-3 text-sm">
        {history.map((line, index) => (
          <li
            key={index}
            className="border-t border-neutral-100 pt-3 break-words text-neutral-700"
          >
            {line}
          </li>
        ))}
      </ol>
    </section>
  );
}

// The agent sends scan links as markdown or bare URLs. Its checks' links contain the org and scan loop ids.
function findScanLink(reply: string, scanLinkPath: string) {
  return reply
    .match(/https?:\/\/[^\s)\]>]+/g)
    ?.map((url) => url.replace(/[.,;!?]+$/, ""))
    .find((url) => url.includes(scanLinkPath));
}

function Chat({
  local,
  member,
}: {
  local: LocalMember;
  member: Member | null;
}) {
  const { scanLinkPath } = Route.useLoaderData();
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  const latest = member?.metadata.wellnessScore;

  function addMessage(message: Message) {
    updateMember(local.id, (m) => ({
      ...m,
      messages: [...m.messages, message],
    }));
  }

  async function send(text: string, sharesScore?: WellnessScore) {
    // Loops remembers the thread, so send only the new message. The first one carries the intro and latest score.
    const isFirstMessage = local.messages.length === 0;
    const message = isFirstMessage
      ? `${introLine(local, latest)}\n\n${text}`
      : text;
    const shared = isFirstMessage ? latest : sharesScore;

    addMessage({ role: "member", text });
    setDraft("");
    setError("");
    setThinking(true);

    try {
      const reply = await sendChatMessage({
        data: { threadId: local.threadId, message },
      });
      const scanLink = findScanLink(reply, scanLinkPath);
      updateMember(local.id, (m) => ({
        ...m,
        messages: [...m.messages, { role: "agent", text: reply }],
        sharedScannedAt: shared ? shared.scannedAt : m.sharedScannedAt,
        // A link in the reply means the agent started a check, so follow it like one we started.
        openCheck: scanLink ? openCheckFor(scanLink, member) : m.openCheck,
      }));
    } catch (err) {
      // Undo the failed turn so it can be resent. Retrying on the same thread is safe.
      updateMember(local.id, (m) => ({
        ...m,
        messages: m.messages.slice(0, -1),
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
    updateMember(local.id, (m) => ({
      ...m,
      threadId: newThreadId(),
      messages: [],
      sharedScannedAt: null,
    }));
    setError("");
  }

  // The agent never hears about a score that arrived during the thread unless we tell it.
  const unsharedScore =
    local.messages.length > 0 &&
    latest &&
    latest.scannedAt !== local.sharedScannedAt
      ? latest
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
        {unsharedScore && !thinking && (
          <button
            onClick={() => send(newScoreLine(unsharedScore), unsharedScore)}
            className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Share my new score →
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
  if (message.role === "member") {
    return (
      <div className="ml-auto w-fit max-w-[85%] rounded-2xl bg-neutral-900 px-4 py-2.5 whitespace-pre-line text-white">
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
