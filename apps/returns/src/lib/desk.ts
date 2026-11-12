import { useSyncExternalStore } from "react";

import type { Customer, ReturnDecision } from "#/lib/loops";
import { returnHistory } from "#/lib/loops";

export type Message = {
  role: "staff" | "agent";
  text: string;
};

export type Condition =
  "unopened" | "opened" | "damaged" | "wrong item" | "missing" | "arrived warm";

export const CONDITIONS: Condition[] = [
  "unopened",
  "opened",
  "damaged",
  "wrong item",
  "missing",
  "arrived warm",
];

export type RequestDetails = {
  customerId: string;
  customerName: string;
  orderId: string;
  items: string[];
  deliveredOn: string;
  condition: Condition;
  reason: string;
  note: string;
};

// One return request and its conversation with the agent.
export type ReturnRequest = RequestDetails & {
  id: string;
  createdAt: string;
  // One thread per request. It keeps the policy it started with.
  threadId: string;
  // Loops has no history endpoint, so we keep our own copy of the transcript.
  messages: Message[];
  // The last decision Loops recorded for this request's order.
  recorded?: ReturnDecision;
};

export type Settings = {
  staffName: string;
  // There's nowhere to store the policy in Loops, so it lives here and goes out with each new thread.
  policy: string;
};

// A tiny localStorage store that React components can subscribe to.
function createLocalStore<T>(key: string, empty: T) {
  const listeners = new Set<() => void>();
  let cache: T | undefined;

  function read() {
    cache ??= JSON.parse(localStorage.getItem(key) ?? "null") ?? empty;
    return cache as T;
  }

  function write(value: T) {
    cache = value;
    localStorage.setItem(key, JSON.stringify(value));
    listeners.forEach((notify) => notify());
  }

  function subscribe(notify: () => void) {
    listeners.add(notify);
    return () => listeners.delete(notify);
  }

  // Returns null during server rendering, where localStorage doesn't exist.
  function use() {
    return useSyncExternalStore(subscribe, read, () => null);
  }

  return { read, write, use };
}

const settings = createLocalStore<Settings>("returns:settings", {
  staffName: "",
  policy: "",
});
export const useSettings = settings.use;
export const readSettings = settings.read;

export function saveSettings(change: Partial<Settings>) {
  settings.write({ ...settings.read(), ...change });
}

const requests = createLocalStore<ReturnRequest[]>("returns:requests", []);
export const useRequests = requests.use;

export function addRequest(request: ReturnRequest) {
  requests.write([request, ...requests.read()]);
}

export function updateRequest(
  id: string,
  change: (request: ReturnRequest) => ReturnRequest,
) {
  requests.write(
    requests
      .read()
      .map((request) => (request.id === id ? change(request) : request)),
  );
}

// Loops only stores ids, so names come from the requests made in this browser.
export function customerName(all: ReturnRequest[] | null, customerId: string) {
  return all?.find((r) => r.customerId === customerId && r.customerName)
    ?.customerName;
}

// The agent can't read the customer, and isn't told to ask for their id, so the first message says everything.
export function firstMessage(
  details: RequestDetails,
  { staffName, policy }: Settings,
  customer: Customer | null,
) {
  const history = returnHistory(customer);
  const pastReturns = history.length
    ? `${customer?.metadata.returnCount ?? history.length} recorded\n${history.map((line) => `- ${line}`).join("\n")}`
    : "none";

  return [
    staffName
      ? `I'm ${staffName} from the returns team.`
      : "I'm from the returns team.",
    // Without a policy, the agent uses the default written into its instructions.
    policy.trim() && `Our return policy:\n${policy.trim()}`,
    [
      `Customer: ${details.customerId}`,
      // Left out when blank, so the agent asks for it before deciding.
      `Order: ${details.orderId}${details.deliveredOn ? `, delivered ${details.deliveredOn}` : ""}`,
      `Items: ${details.items.join(", ")}`,
      `Condition: ${details.condition}`,
      `Reason: ${details.reason}`,
      `Past returns: ${pastReturns}`,
    ].join("\n"),
    details.note.trim() || "Please decide on this return.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// The agent drafts the customer message at the end of its reply, after "Customer message:".
export function draftCustomerMessage(messages: Message[]) {
  for (const message of [...messages].reverse()) {
    if (message.role !== "agent") continue;
    const match = message.text.match(/Customer message:\**\s*([\s\S]+)$/i);
    if (match) return match[1].trim().replace(/^["“]|["”]$/g, "");
  }
  return "";
}

export const EXAMPLE_POLICY = `- Unopened items within 30 days of delivery: refund or store credit.
- Opened items: store credit only, within 14 days of delivery.
- Damaged or wrong items reported within 14 days, with a photo: free replacement or refund.`;
