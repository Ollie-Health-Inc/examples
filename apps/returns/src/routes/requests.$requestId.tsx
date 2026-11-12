import { useState } from "react";
import type { FormEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";

import { DateTime, DecisionBadge, words } from "#/components";
import { draftCustomerMessage, updateRequest, useRequests } from "#/lib/desk";
import type { Message, ReturnRequest } from "#/lib/desk";
import { getCustomer, sendChatMessage } from "#/lib/loops";
import type { Resolution } from "#/lib/loops";

export const Route = createFileRoute("/requests/$requestId")({
  component: RequestPage,
});

const AGREE = "Agreed, please record it.";

function RequestPage() {
  const { requestId } = Route.useParams();
  const requests = useRequests();

  if (!requests) return null;

  const request = requests.find((r) => r.id === requestId);
  if (!request) {
    return (
      <p className="card">
        This request isn't in this browser.{" "}
        <Link to="/" className="font-medium underline">
          Start a new one
        </Link>
      </p>
    );
  }

  return <RequestView request={request} />;
}

function RequestView({ request }: { request: ReturnRequest }) {
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [watching, setWatching] = useState(false);
  const [error, setError] = useState("");

  // The decision is saved by a workflow that finishes after the reply, so check the customer for up to 30 seconds.
  async function watchForDecision(decidedBefore: string | undefined) {
    setWatching(true);
    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const latest = await getCustomer({ data: request.customerId });
      const lastReturn = latest?.metadata.lastReturn;
      if (lastReturn && lastReturn.decidedAt !== decidedBefore) {
        updateRequest(request.id, (r) => ({ ...r, recorded: lastReturn }));
        break;
      }
    }
    setWatching(false);
  }

  function addMessage(message: Message) {
    updateRequest(request.id, (r) => ({
      ...r,
      messages: [...r.messages, message],
    }));
  }

  async function send(text: string) {
    addMessage({ role: "staff", text });
    setDraft("");
    setError("");
    setThinking(true);

    try {
      const before = await getCustomer({ data: request.customerId });
      const reply = await sendChatMessage({
        data: { threadId: request.threadId, message: text },
      });
      addMessage({ role: "agent", text: reply });
      watchForDecision(before?.metadata.lastReturn?.decidedAt);
    } catch (err) {
      // Undo the failed turn so it can be resent. Retrying on the same thread is safe.
      updateRequest(request.id, (r) => ({
        ...r,
        messages: r.messages.slice(0, -1),
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

  const [firstMessage, ...conversation] = request.messages;

  return (
    <main className="space-y-6">
      <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Requests
      </Link>

      <section>
        <h1 className="text-4xl font-semibold">
          {request.customerName || request.customerId}
        </h1>
        <p className="mt-2 text-neutral-500">
          {request.orderId} · {request.items.join(", ")} · {request.condition}
          {request.deliveredOn && `, delivered ${request.deliveredOn}`} ·{" "}
          <Link
            to="/customers/$customerId"
            params={{ customerId: request.customerId }}
            className="underline underline-offset-2"
          >
            Returns log
          </Link>
        </p>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <section className="card flex flex-col p-0">
          <div className="space-y-3 p-5">
            {firstMessage && (
              <details className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm">
                <summary className="cursor-pointer text-neutral-500">
                  What the desk sent the agent
                </summary>
                <pre className="mt-3 font-sans whitespace-pre-wrap">
                  {firstMessage.text}
                </pre>
              </details>
            )}

            {conversation.map((message, index) => (
              <ChatBubble key={index} message={message} />
            ))}

            {thinking && <TypingIndicator />}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <div className="space-y-3 border-t border-neutral-200 p-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => send(AGREE)}
                disabled={thinking}
                className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
              >
                Agree and record
              </button>
              {request.recorded?.decision === "needs_approval" && (
                <ManagerApproved disabled={thinking} onApprove={send} />
              )}
            </div>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Answer the agent, or ask for changes"
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

        <div className="space-y-6">
          <RecordedPanel request={request} watching={watching} />
          <CustomerMessagePanel messages={request.messages} />
        </div>
      </div>
    </main>
  );
}

// needs_approval doesn't pause anything in Loops. The manager decides elsewhere, and we record the outcome in the same thread.
function ManagerApproved({
  disabled,
  onApprove,
}: {
  disabled: boolean;
  onApprove: (message: string) => void;
}) {
  const [resolution, setResolution] = useState<Resolution>("refund");

  return (
    <div className="flex items-center gap-2">
      <select
        value={resolution}
        onChange={(event) => setResolution(event.target.value as Resolution)}
        aria-label="Approved resolution"
        className="field w-auto py-1.5 text-sm"
      >
        <option value="refund">refund</option>
        <option value="replacement">replacement</option>
        <option value="store_credit">store credit</option>
      </select>
      <button
        onClick={() =>
          onApprove(
            `The manager approved a goodwill ${words(resolution)}, please record it.`,
          )
        }
        disabled={disabled}
        className="chip"
      >
        Manager approved
      </button>
    </div>
  );
}

function RecordedPanel({
  request,
  watching,
}: {
  request: ReturnRequest;
  watching: boolean;
}) {
  const recorded = request.recorded;

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">Recorded decision</h2>
      {watching && (
        <p className="text-sm text-neutral-500">Checking Loops for it…</p>
      )}
      {!recorded && !watching && (
        <p className="text-sm text-neutral-500">
          Not recorded yet. The agent records the decision once you agree with
          it.
        </p>
      )}
      {recorded && (
        <div className="space-y-2 text-sm">
          <p className="flex items-center gap-2">
            <DecisionBadge decision={recorded.decision} />
            <span className="font-medium">{words(recorded.resolution)}</span>
          </p>
          <p className="text-neutral-600">{recorded.rationale}</p>
          <p className="text-neutral-500">
            <DateTime value={recorded.decidedAt} />
          </p>
        </div>
      )}
    </section>
  );
}

// The agent only drafts the message. Nothing in this template sends it.
function CustomerMessagePanel({ messages }: { messages: Message[] }) {
  const draft = draftCustomerMessage(messages);
  const [copied, setCopied] = useState(false);

  if (!draft) return null;

  async function copy() {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">Customer message</h2>
      <p className="text-sm whitespace-pre-wrap text-neutral-700">{draft}</p>
      <button onClick={copy} className="chip w-full">
        {copied ? "Copied" : "Copy customer message"}
      </button>
    </section>
  );
}

function ChatBubble({ message }: { message: Message }) {
  if (message.role === "staff") {
    return (
      <div className="ml-auto w-fit max-w-[85%] rounded-2xl bg-neutral-900 px-4 py-2.5 text-white">
        {message.text}
      </div>
    );
  }

  // Replies are markdown. The Decision, Why, Resolution lines are separated by single line breaks, so keep them.
  return (
    <div className="markdown w-fit max-w-[85%] rounded-2xl bg-sand px-4 py-2.5">
      <Markdown
        remarkPlugins={[remarkBreaks]}
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
