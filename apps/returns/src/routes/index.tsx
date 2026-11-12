import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { DecisionBadge } from "#/components";
import {
  CONDITIONS,
  addRequest,
  firstMessage,
  readSettings,
  saveSettings,
  useRequests,
  useSettings,
} from "#/lib/desk";
import type { Condition, RequestDetails } from "#/lib/desk";
import { getCustomer, sendChatMessage } from "#/lib/loops";

export const Route = createFileRoute("/")({
  // Set by "New request" on a customer's log, to fill in their id.
  validateSearch: (search): { customerId?: string } => ({
    customerId:
      typeof search.customerId === "string" ? search.customerId : undefined,
  }),
  component: RequestsPage,
});

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

// One example per template starter, to try the agent quickly.
const EXAMPLES: { label: string; details: () => RequestDetails }[] = [
  {
    label: "Unopened tub, delivered 12 days ago",
    details: () => ({
      customerId: "thandi@example.com",
      customerName: "Thandi Mokoena",
      orderId: "ORD-1042",
      items: ["Collagen Peptides tub"],
      deliveredOn: daysAgo(12),
      condition: "unopened",
      reason: "Changed their mind",
      note: "Customer wants to return an unopened tub, delivered 12 days ago",
    }),
  },
  {
    label: "Peptide arrived warm yesterday",
    details: () => ({
      customerId: "sipho@example.com",
      customerName: "Sipho Dlamini",
      orderId: "ORD-1077",
      items: ["BPC-157 vial"],
      deliveredOn: daysAgo(1),
      condition: "arrived warm",
      reason: "The cold pack had melted when it arrived",
      note: "Peptide arrived warm yesterday, customer wants a replacement",
    }),
  },
  {
    label: "Opened bottle, didn't like the taste",
    details: () => ({
      customerId: "lerato@example.com",
      customerName: "Lerato Khumalo",
      orderId: "ORD-1103",
      items: ["Omega-3 Fish Oil bottle"],
      deliveredOn: daysAgo(8),
      condition: "opened",
      reason: "Didn't like the taste",
      note: "Opened bottle, customer says they didn't like the taste",
    }),
  },
];

function RequestsPage() {
  const requests = useRequests();

  return (
    <main className="mx-auto w-full max-w-2xl space-y-10">
      <section>
        <h1 className="text-5xl font-semibold">New return request.</h1>
        <p className="mt-4 text-lg text-neutral-500">
          Describe a customer's return or refund request. The agent applies your
          policy, suggests a decision and drafts the message to the customer.
        </p>
      </section>

      <RequestForm />

      {requests && requests.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">Recent requests</h2>
          <ul className="space-y-2">
            {requests.map((request) => (
              <li key={request.id}>
                <Link
                  to="/requests/$requestId"
                  params={{ requestId: request.id }}
                  className="card flex items-center gap-3 p-4 hover:border-neutral-300"
                >
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">
                      {request.customerName || request.customerId}
                    </span>{" "}
                    <span className="text-sm text-neutral-500">
                      {request.orderId} · {request.items.join(", ")}
                    </span>
                  </span>
                  {request.recorded ? (
                    <DecisionBadge decision={request.recorded.decision} />
                  ) : (
                    <span className="text-sm text-neutral-500">
                      Not recorded
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

const EMPTY: RequestDetails = {
  customerId: "",
  customerName: "",
  orderId: "",
  items: [],
  deliveredOn: "",
  condition: "unopened",
  reason: "",
  note: "",
};

function RequestForm() {
  const navigate = useNavigate();
  const settings = useSettings();
  const { customerId } = Route.useSearch();
  const [details, setDetails] = useState<RequestDetails>({
    ...EMPTY,
    customerId: customerId ?? "",
  });
  const [items, setItems] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  function change(update: Partial<RequestDetails>) {
    setDetails((current) => ({ ...current, ...update }));
  }

  function fillExample(example: RequestDetails) {
    setDetails(example);
    setItems(example.items.join(", "));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError("");

    const request: RequestDetails = {
      ...details,
      customerId: details.customerId.trim().toLowerCase(),
      items: items
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };

    try {
      // Past returns change the decision, and the agent only knows about them if we tell it.
      const customer = await getCustomer({ data: request.customerId });
      const message = firstMessage(request, readSettings(), customer);
      const threadId = `return-${crypto.randomUUID()}`;
      const reply = await sendChatMessage({ data: { threadId, message } });

      const id = crypto.randomUUID();
      addRequest({
        ...request,
        id,
        createdAt: new Date().toISOString(),
        threadId,
        messages: [
          { role: "staff", text: message },
          { role: "agent", text: reply },
        ],
      });
      navigate({ to: "/requests/$requestId", params: { requestId: id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-5">
      <div className="space-y-2">
        <p className="text-sm text-neutral-500">Try an example</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              onClick={() => fillExample(example.details())}
              className="chip"
            >
              {example.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Your name">
          <input
            value={settings?.staffName ?? ""}
            onChange={(event) =>
              saveSettings({ staffName: event.target.value })
            }
            placeholder="Thandi"
            className="field"
          />
        </Field>
        <span className="hidden sm:block" />
        <Field label="Customer id">
          <input
            required
            value={details.customerId}
            onChange={(event) => change({ customerId: event.target.value })}
            placeholder="Email or store customer id"
            className="field"
          />
        </Field>
        <Field label="Customer name">
          <input
            value={details.customerName}
            onChange={(event) => change({ customerName: event.target.value })}
            placeholder="Optional"
            className="field"
          />
        </Field>
        <Field label="Order">
          <input
            required
            value={details.orderId}
            onChange={(event) => change({ orderId: event.target.value })}
            placeholder="ORD-1042"
            className="field"
          />
        </Field>
        <Field label="Delivered on">
          <input
            type="date"
            value={details.deliveredOn}
            onChange={(event) => change({ deliveredOn: event.target.value })}
            className="field"
          />
        </Field>
        <Field label="Items">
          <input
            required
            value={items}
            onChange={(event) => setItems(event.target.value)}
            placeholder="Separate items with commas"
            className="field"
          />
        </Field>
        <Field label="Condition">
          <select
            value={details.condition}
            onChange={(event) =>
              change({ condition: event.target.value as Condition })
            }
            className="field"
          >
            {CONDITIONS.map((condition) => (
              <option key={condition}>{condition}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Reason">
        <input
          required
          value={details.reason}
          onChange={(event) => change({ reason: event.target.value })}
          placeholder="What the customer said"
          className="field"
        />
      </Field>
      <Field label="Note to the agent">
        <textarea
          value={details.note}
          onChange={(event) => change({ note: event.target.value })}
          placeholder="Optional, for example what the customer is asking for"
          rows={2}
          className="field"
        />
      </Field>

      {settings && !settings.policy.trim() && (
        <p className="rounded-xl bg-sand px-4 py-3 text-sm">
          No policy saved, so the agent will use its built-in default.{" "}
          <Link to="/policy" className="font-medium underline">
            Add your policy
          </Link>
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={sending} className="button w-full">
        {sending ? "Asking the agent…" : "Ask the agent"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-neutral-500">{label}</span>
      {children}
    </label>
  );
}
