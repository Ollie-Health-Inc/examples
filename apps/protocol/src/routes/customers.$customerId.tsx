import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import Markdown from "react-markdown";

import { Badge, DateTime } from "#/components";
import {
  introLine,
  newThreadId,
  startConversation,
  updateCustomer,
  useCustomers,
} from "#/lib/customers";
import type { LocalCustomer, Message } from "#/lib/customers";
import { getCustomer, memoryLines, sendChatMessage } from "#/lib/loops";
import type { Customer } from "#/lib/loops";

export const Route = createFileRoute("/customers/$customerId")({
  // Set by the store after placing an order, so this page knows to wait for it.
  validateSearch: (search): { order?: string } => ({
    order: typeof search.order === "string" ? search.order : undefined,
  }),
  loader: ({ params }) => getCustomer({ data: params.customerId }),
  component: CustomerPage,
});

const CHECK_IN_STARTER = "I'd like to do my weekly check-in";
const STARTERS = [
  "When is the best time of day to take this?",
  "I keep forgetting to take it, any tips?",
  "Does this need to go in the fridge?",
];

function CustomerPage() {
  const customer = Route.useLoaderData();
  const { customerId } = Route.useParams();
  const local = useCustomers()?.find((c) => c.id === customerId);
  const orderStatus = useOrderStatus(customer);
  const name = local?.name || customerId;

  return (
    <main className="space-y-6">
      <Link
        to="/customers"
        className="text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Customers
      </Link>

      <section>
        <h1 className="text-4xl font-semibold">{name}</h1>
        {local?.name && <p className="mt-2 text-neutral-500">{customerId}</p>}
      </section>

      {orderStatus === "waiting" && (
        <p className="rounded-2xl bg-sand px-5 py-4 text-sm">
          Recording the order in Loops. This takes a few seconds.
        </p>
      )}
      {orderStatus === "timed-out" && (
        <p className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800">
          The order still isn't in Loops after 30 seconds. Check the
          protocol-order-welcome run in the dashboard.
        </p>
      )}
      {!customer && !orderStatus && (
        <p className="card text-neutral-500">
          Loops doesn't know this customer yet.{" "}
          <Link to="/" className="font-medium underline">
            Place an order
          </Link>
        </p>
      )}

      {customer && (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            {local ? (
              <Chat customer={customer} local={local} />
            ) : (
              <section className="card flex items-center justify-between gap-4">
                <p className="text-sm text-neutral-500">
                  This customer ordered somewhere else.
                </p>
                <button
                  onClick={() => startConversation(customerId)}
                  className="button py-2"
                >
                  Chat as them
                </button>
              </section>
            )}
            <Timeline customer={customer} />
          </div>
          <div className="space-y-6">
            <OrderPanel customer={customer} />
            <CheckInPanel customer={customer} />
          </div>
        </div>
      )}
    </main>
  );
}

// Placing an order only starts the workflow, so refetch until the order shows up on the customer.
function useOrderStatus(customer: Customer | null) {
  const { order } = Route.useSearch();
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const waiting = Boolean(order) && customer?.metadata.lastOrderId !== order;

  useEffect(() => {
    if (!waiting) return;
    let attempts = 0;
    const timer = setInterval(() => {
      if (++attempts > 10) {
        clearInterval(timer);
        setTimedOut(true);
        return;
      }
      router.invalidate();
    }, 3000);
    return () => clearInterval(timer);
  }, [waiting, router]);

  if (!waiting) return null;
  return timedOut ? "timed-out" : "waiting";
}

function Chat({
  customer,
  local,
}: {
  customer: Customer;
  local: LocalCustomer;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  const products = customer.metadata.products ?? [];

  // The workflows finish a few seconds after the agent replies, so check the customer for up to 30 seconds.
  async function watchForResults() {
    const linesBefore = memoryLines(customer).length;
    const checkedInBefore = customer.metadata.lastCheckIn?.checkedInAt;

    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const latest = await getCustomer({ data: customer.id });
      if (
        memoryLines(latest).length > linesBefore ||
        latest?.metadata.lastCheckIn?.checkedInAt !== checkedInBefore
      ) {
        await router.invalidate();
        return;
      }
    }
  }

  function addMessage(message: Message) {
    updateCustomer(local.id, (c) => ({
      ...c,
      messages: [...c.messages, message],
    }));
  }

  async function send(text: string) {
    // Loops remembers the thread, so send only the new message. The first one carries the intro.
    const isFirstMessage = local.messages.length === 0;
    const message = isFirstMessage
      ? `${introLine(local.id, local.name, products)}\n\n${text}`
      : text;

    addMessage({ role: "customer", text });
    setDraft("");
    setError("");
    setThinking(true);

    try {
      const reply = await sendChatMessage({
        data: { threadId: local.threadId, message },
      });
      addMessage({ role: "agent", text: reply });
      watchForResults();
    } catch (err) {
      // Undo the failed turn so it can be resent. Retrying on the same thread is safe.
      updateCustomer(local.id, (c) => ({
        ...c,
        messages: c.messages.slice(0, -1),
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
    updateCustomer(local.id, (c) => ({
      ...c,
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
          Your routine
        </p>
        <button
          onClick={startNewConversation}
          disabled={thinking || local.messages.length === 0}
          className="text-neutral-500 hover:text-neutral-900 disabled:opacity-40"
        >
          New conversation
        </button>
      </div>

      <div className="min-h-64 space-y-3 p-5">
        {local.messages.length === 0 && (
          <div className="space-y-3">
            <button
              onClick={() => send(CHECK_IN_STARTER)}
              disabled={thinking}
              className="rounded-full bg-brand px-4 py-2 text-left text-sm font-medium text-white hover:opacity-90"
            >
              {CHECK_IN_STARTER} →
            </button>
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
          </div>
        )}

        {local.messages.map((message, index) => (
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
          placeholder="Ask about your routine"
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

function OrderPanel({ customer }: { customer: Customer }) {
  const { products, lastOrderId, lastOrderAt, phone } = customer.metadata;

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">Last order</h2>
      {products?.length ? (
        <>
          <ul className="flex flex-wrap gap-2">
            {products.map((product) => (
              <li
                key={product}
                className="rounded-full bg-sand px-3 py-1 text-sm"
              >
                {product}
              </li>
            ))}
          </ul>
          <p className="text-sm text-neutral-500">
            {lastOrderId}
            {lastOrderAt && (
              <>
                {" · "}
                <DateTime value={lastOrderAt} />
              </>
            )}
          </p>
          {phone && (
            <p className="text-sm text-neutral-500">Welcome SMS to {phone}</p>
          )}
        </>
      ) : (
        <p className="text-sm text-neutral-500">No order yet.</p>
      )}
    </section>
  );
}

function CheckInPanel({ customer }: { customer: Customer }) {
  const checkIn = customer.metadata.lastCheckIn;

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">Last check-in</h2>
      {checkIn ? (
        <div className="space-y-2 text-sm">
          <p>
            <span className="font-medium">{checkIn.product}</span>, taken{" "}
            {checkIn.daysTakenThisWeek} of 7 days
          </p>
          <p className="text-neutral-600">Feels {checkIn.feeling}</p>
          <p className="text-neutral-500">
            <DateTime value={checkIn.checkedInAt} />
          </p>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">No check-in yet.</p>
      )}
    </section>
  );
}

const TAGS: [prefix: string, label: string][] = [
  ["Ordered", "Order"],
  ["Check-in:", "Check-in"],
  ["Public label for", "Label"],
  ["Label interaction check:", "Interaction check"],
];

function Timeline({ customer }: { customer: Customer }) {
  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">Timeline</h2>
      <p className="text-sm text-neutral-500">
        Everything Loops remembered about this customer, oldest first.
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
