import { useState } from "react";
import type { FormEvent } from "react";
import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import Markdown from "react-markdown";

import {
  Badge,
  DateTime,
  OutcomeBadge,
  offerLabel,
  reasonLabel,
} from "#/components";
import { getCustomer, memoryLines, sendChatMessage } from "#/lib/loops";
import type { Customer } from "#/lib/loops";
import {
  introLine,
  newThreadId,
  updateSubscriber,
  useSubscribers,
} from "#/lib/subscribers";
import type { Message, Subscriber } from "#/lib/subscribers";

export const Route = createFileRoute("/customers/$customerId")({
  loader: ({ params }) => getCustomer({ data: params.customerId }),
  component: CustomerPage,
});

const STARTERS = [
  "I want to cancel my subscription",
  "I have too much product piling up",
  "It's getting too expensive for me right now",
];

function CustomerPage() {
  const customer = Route.useLoaderData();
  const { customerId } = Route.useParams();
  const subscribers = useSubscribers();
  const subscriber = subscribers?.find((s) => s.id === customerId);

  return (
    <main className="space-y-6">
      <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Subscribers
      </Link>

      <section>
        <h1 className="text-4xl font-semibold">
          {subscriber?.name || customerId}
        </h1>
        <p className="mt-2 text-neutral-500">
          {subscriber
            ? `${customerId} · ${subscriber.product}, delivered ${subscriber.frequency}`
            : customerId}
        </p>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {subscriber ? (
            <Chat customer={customer} subscriber={subscriber} />
          ) : (
            // Wait for the browser to read its subscribers before saying there aren't any.
            subscribers && (
              <p className="card text-sm text-neutral-500">
                This customer wasn't added in this browser, so there's no plan
                to chat about.{" "}
                <Link to="/" className="font-medium underline">
                  Add a subscriber
                </Link>
              </p>
            )
          )}
          {customer && <Timeline customer={customer} />}
        </div>
        <div className="space-y-6">
          <SavePanel customer={customer} />
          <SubscriptionPanel customer={customer} />
        </div>
      </div>
    </main>
  );
}

function Chat({
  customer,
  subscriber,
}: {
  customer: Customer | null;
  subscriber: Subscriber;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");

  // subscription-save-outcome runs after the agent replies, so check the customer for up to 30 seconds.
  async function watchForOutcome() {
    const decidedBefore = customer?.metadata.subscriptionSave?.decidedAt;

    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const latest = await getCustomer({ data: subscriber.id });
      if (latest?.metadata.subscriptionSave?.decidedAt !== decidedBefore) {
        await router.invalidate();
        return;
      }
    }
  }

  function addMessage(message: Message) {
    updateSubscriber(subscriber.id, (s) => ({
      ...s,
      messages: [...s.messages, message],
    }));
  }

  async function send(text: string) {
    // Loops remembers the thread, so send only the new message. The first one carries the intro.
    const isFirstMessage = subscriber.messages.length === 0;
    const message = isFirstMessage
      ? `${introLine(subscriber)}\n\n${text}`
      : text;

    addMessage({ role: "customer", text });
    setDraft("");
    setError("");
    setThinking(true);

    try {
      const reply = await sendChatMessage({
        data: { threadId: subscriber.threadId, message },
      });
      addMessage({ role: "agent", text: reply });
      watchForOutcome();
    } catch (err) {
      // Undo the failed turn so it can be resent. Retrying on the same thread is safe.
      updateSubscriber(subscriber.id, (s) => ({
        ...s,
        messages: s.messages.slice(0, -1),
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
    updateSubscriber(subscriber.id, (s) => ({
      ...s,
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
          Manage your subscription
        </p>
        <button
          onClick={startNewConversation}
          disabled={thinking || subscriber.messages.length === 0}
          className="text-neutral-500 hover:text-neutral-900 disabled:opacity-40"
        >
          New conversation
        </button>
      </div>

      <div className="min-h-64 space-y-3 p-5">
        {subscriber.messages.length === 0 && (
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

        {subscriber.messages.map((message, index) => (
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
          placeholder="Write as the subscriber"
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
  if (message.role === "customer") {
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

function SavePanel({ customer }: { customer: Customer | null }) {
  const save = customer?.metadata.subscriptionSave;

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">Last cancel request</h2>
      {save ? (
        <div className="space-y-2 text-sm">
          <p className="pb-1">
            <OutcomeBadge outcome={save.outcome} />
          </p>
          <p>
            <span className="text-neutral-500">Reason</span>{" "}
            {reasonLabel(save.reason)}
          </p>
          <p>
            <span className="text-neutral-500">Offered</span>{" "}
            {offerLabel(save.offer)}
          </p>
          {save.details && <p className="text-neutral-700">{save.details}</p>}
          <p className="text-neutral-500">
            <DateTime value={save.decidedAt} />
          </p>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">
          Nothing yet. The agent records an outcome once the subscriber decides.
        </p>
      )}
    </section>
  );
}

function SubscriptionPanel({ customer }: { customer: Customer | null }) {
  const subscription = customer?.metadata.subscription;

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">Subscription</h2>
      {subscription ? (
        <div className="space-y-2 text-sm">
          <p>
            <span className="font-medium">Cancelled</span>
            {subscription.plan && ` · ${subscription.plan}`}
          </p>
          {subscription.reason && (
            <p className="text-neutral-600">{subscription.reason}</p>
          )}
          <p className="text-neutral-500">
            <DateTime value={subscription.cancelledAt} />
          </p>
          {customer?.metadata.phone && (
            <p className="text-neutral-500">
              Win-back SMS to {customer.metadata.phone}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-neutral-500">
          Active, as far as Loops knows. The store desk confirms cancellations.
        </p>
      )}
    </section>
  );
}

const TAGS: [prefix: string, label: string][] = [
  ["Cancel request", "Cancel request"],
  ["Subscription cancelled", "Cancelled"],
];

function Timeline({ customer }: { customer: Customer }) {
  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">What Loops knows</h2>
      <p className="text-sm text-neutral-500">
        Everything Loops remembered about this customer, oldest first. The agent
        reads it next time, so it won't offer the same thing twice.
      </p>
      <ol className="space-y-3 text-sm">
        {memoryLines(customer).map((line, index) => {
          const tag = TAGS.find(([prefix]) => line.startsWith(prefix))?.[1];
          return (
            <li
              key={index}
              className="space-y-1 border-t border-neutral-100 pt-3"
            >
              {tag && <Badge>{tag}</Badge>}
              <p className="break-words text-neutral-700">{line}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
