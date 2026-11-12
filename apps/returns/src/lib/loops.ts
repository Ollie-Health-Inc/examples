import { createServerFn } from "@tanstack/react-start";

export type Decision = "eligible" | "needs_approval" | "not_eligible";
export type Resolution = "refund" | "replacement" | "store_credit" | "none";

// What return-decision saves each time the agent records a decision. Only the latest is kept here.
export type ReturnDecision = {
  orderId: string;
  items: string[];
  reason: string;
  decision: Decision;
  resolution: Resolution;
  rationale: string;
  decidedAt: string;
};

export type Customer = {
  id: string;
  createdAt: string;
  updatedAt: string;
  // Other loops can write to metadata too, so only read the keys this template documents.
  metadata: { returnCount?: number; lastReturn?: ReturnDecision };
  memory: string;
};

// Every call goes through the server, so the API token never reaches the browser.
async function callLoops(path: string, init?: RequestInit) {
  const {
    LOOPS_API_URL,
    LOOPS_ORGANIZATION_ID,
    LOOPS_LOOP_ID,
    LOOPS_API_TOKEN,
  } = process.env;

  if (
    !LOOPS_API_URL ||
    !LOOPS_ORGANIZATION_ID ||
    !LOOPS_LOOP_ID ||
    !LOOPS_API_TOKEN
  ) {
    throw new Error(
      "Loops is not configured. Copy .env.example to .env and fill it in.",
    );
  }

  const response = await fetch(
    `${LOOPS_API_URL}/loop/${LOOPS_ORGANIZATION_ID}/${LOOPS_LOOP_ID}${path}`,
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

// POST /chat: send one message on a thread and get the agent's reply.
export const sendChatMessage = createServerFn({ method: "POST" })
  .validator((data: { threadId: string; message: string }) => data)
  .handler(async ({ data }) => {
    const { status, body } = await callLoops("/chat", {
      method: "POST",
      body: JSON.stringify(data),
    });

    if (status !== 200 || typeof body?.reply !== "string") {
      throw new Error(body?.error ?? `Loops returned ${status} for POST /chat`);
    }
    return body.reply as string;
  });

// GET /users/{userId}: a customer's returns, or null if nothing has been recorded for them yet.
export const getCustomer = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { status, body } = await callLoops(
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
  });

// GET /users: every user in the organization, newest first, 50 at a time.
export const listCustomers = createServerFn({ method: "GET" })
  .validator((data: { cursor?: string }) => data)
  .handler(async ({ data }) => {
    const query = new URLSearchParams({ limit: "50" });
    if (data.cursor) query.set("cursor", data.cursor);

    const { status, body } = await callLoops(`/users?${query}`);
    if (status !== 200) {
      throw new Error(body?.error ?? `Loops returned ${status} for GET /users`);
    }
    return body as {
      users: { id: string; createdAt: string }[];
      nextCursor: string | null;
    };
  });

// Every recorded decision adds one of these lines. They're the only full history, and they have no dates.
export function returnHistory(customer: Customer | null) {
  return (customer?.memory ?? "")
    .split("\n")
    .filter((line) => line.startsWith("- Return on order"))
    .map((line) => line.slice(2));
}
