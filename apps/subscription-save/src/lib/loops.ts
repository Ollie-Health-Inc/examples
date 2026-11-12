import { createServerFn } from "@tanstack/react-start";

export type Reason =
  | "too_expensive"
  | "too_much_product"
  | "not_feeling_a_difference"
  | "taste_or_format"
  | "travel_or_moving"
  | "other";
export type Offer =
  "pause" | "skip_next" | "swap_product" | "change_frequency" | "none";
export type Outcome = "stayed" | "cancelled";

// What subscription-save-outcome saves when the agent records how a cancel request ended. Only the latest is kept.
export type SaveOutcome = {
  reason: Reason;
  offer: Offer;
  outcome: Outcome;
  details?: string;
  decidedAt: string;
};

// What subscription-cancelled saves once the store confirms a cancellation.
export type Cancellation = {
  status: "cancelled";
  plan: string | null;
  reason: string | null;
  cancelledAt: string;
};

export type Customer = {
  id: string;
  createdAt: string;
  updatedAt: string;
  // Other loops can write to metadata too, so only read the keys this template documents.
  metadata: {
    phone?: string | null;
    subscriptionSave?: SaveOutcome;
    subscription?: Cancellation;
  };
  memory: string;
};

// The app calls two loops: the agent, and the workflow the store starts once it has cancelled.
function loopIds() {
  const { LOOPS_AGENT_LOOP_ID, LOOPS_CANCELLED_LOOP_ID } = process.env;
  if (!LOOPS_AGENT_LOOP_ID || !LOOPS_CANCELLED_LOOP_ID) {
    throw new Error(
      "Loops is not configured. Copy .env.example to .env and fill it in.",
    );
  }
  return { agent: LOOPS_AGENT_LOOP_ID, cancelled: LOOPS_CANCELLED_LOOP_ID };
}

// Every call goes through the server, so the API token never reaches the browser.
async function callLoops(loopId: string, path: string, init?: RequestInit) {
  const { LOOPS_API_URL, LOOPS_ORGANIZATION_ID, LOOPS_API_TOKEN } = process.env;

  if (!LOOPS_API_URL || !LOOPS_ORGANIZATION_ID || !LOOPS_API_TOKEN) {
    throw new Error(
      "Loops is not configured. Copy .env.example to .env and fill it in.",
    );
  }

  const response = await fetch(
    `${LOOPS_API_URL}/loop/${LOOPS_ORGANIZATION_ID}/${loopId}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${LOOPS_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      // The agent replies in one piece once it has finished thinking.
      signal: AbortSignal.timeout(60_000),
    },
  ).catch(() => {
    throw new Error(
      `Couldn't reach Loops at ${LOOPS_API_URL}, or it took too long to reply.`,
    );
  });

  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

async function readCustomer(id: string) {
  const { status, body } = await callLoops(
    loopIds().agent,
    `/users/${encodeURIComponent(id)}`,
  );

  // A JSON 404 means nothing is saved yet. A plain-text 404 means this Loops doesn't have the endpoint.
  if (status === 404 && body?.error === "User not found") return null;
  if (status !== 200) {
    throw new Error(
      body?.error ?? `Loops returned ${status} for GET /users/{userId}`,
    );
  }
  return body as Customer;
}

// POST /chat: send one message on a thread and get the agent's reply.
export const sendChatMessage = createServerFn({ method: "POST" })
  .validator((data: { threadId: string; message: string }) => data)
  .handler(async ({ data }) => {
    const { status, body } = await callLoops(loopIds().agent, "/chat", {
      method: "POST",
      body: JSON.stringify(data),
    });

    if (status !== 200 || typeof body?.reply !== "string") {
      throw new Error(body?.error ?? `Loops returned ${status} for POST /chat`);
    }
    return body.reply as string;
  });

// POST to subscription-cancelled: the store's confirmation that it really cancelled. Texts a win-back if there's a phone.
export const confirmCancellation = createServerFn({ method: "POST" })
  .validator(
    (data: {
      customerId: string;
      plan?: string;
      phone?: string;
      reason?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { status, body } = await callLoops(loopIds().cancelled, "", {
      method: "POST",
      body: JSON.stringify(data),
    });

    // A 200 only means the run started. A bad payload fails inside the run, so check the dashboard.
    if (status !== 200) {
      throw new Error(
        body?.error ??
          `Loops returned ${status} when confirming the cancellation`,
      );
    }
  });

// GET /users/{userId}: what Loops knows about a customer, or null if nothing's been recorded yet.
export const getCustomer = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(({ data: id }) => readCustomer(id));

// GET /users has no metadata, so read each customer on the page too. Fine for a test store.
export const listCustomers = createServerFn({ method: "GET" })
  .validator((data: { cursor?: string }) => data)
  .handler(async ({ data }) => {
    const query = new URLSearchParams({ limit: "50" });
    if (data.cursor) query.set("cursor", data.cursor);

    const { status, body } = await callLoops(
      loopIds().agent,
      `/users?${query}`,
    );
    if (status !== 200) {
      throw new Error(body?.error ?? `Loops returned ${status} for GET /users`);
    }

    const page = body as { users: { id: string }[]; nextCursor: string | null };
    const customers = await Promise.all(
      page.users.map((user) => readCustomer(user.id)),
    );
    return {
      customers: customers.filter((customer) => customer !== null),
      nextCursor: page.nextCursor,
    };
  });

// Memory is a markdown list, one "- " line per thing a loop remembered, oldest first.
export function memoryLines(customer: Customer | null) {
  return (customer?.memory ?? "")
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2));
}
