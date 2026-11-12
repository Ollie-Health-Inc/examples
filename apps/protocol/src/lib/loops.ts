import { createServerFn } from "@tanstack/react-start";

// What protocol-check-in saves. Only the latest check-in is kept here. Memory has them all.
export type CheckIn = {
  product: string;
  daysTakenThisWeek: number;
  feeling: string;
  checkedInAt: string;
};

export type Customer = {
  id: string;
  createdAt: string;
  updatedAt: string;
  // Other loops can write to metadata too, so only read the keys this template documents.
  metadata: {
    phone?: string;
    products?: string[];
    lastOrderId?: string;
    lastOrderAt?: string;
    lastCheckIn?: CheckIn;
  };
  memory: string;
};

// The app calls two loops: the agent, and the workflow that records orders.
function loopIds() {
  const { LOOPS_AGENT_LOOP_ID, LOOPS_ORDER_LOOP_ID } = process.env;
  if (!LOOPS_AGENT_LOOP_ID || !LOOPS_ORDER_LOOP_ID) {
    throw new Error(
      "Loops is not configured. Copy .env.example to .env and fill it in.",
    );
  }
  return { agent: LOOPS_AGENT_LOOP_ID, orders: LOOPS_ORDER_LOOP_ID };
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

// POST to the workflow itself: records the order on the customer, and texts them if there's a phone.
export const placeOrder = createServerFn({ method: "POST" })
  .validator(
    (data: {
      customerId: string;
      products: string[];
      phone?: string;
      orderId?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { status, body } = await callLoops(loopIds().orders, "", {
      method: "POST",
      body: JSON.stringify(data),
    });

    // A 200 only means the run started. A bad payload fails inside the run, so check the dashboard.
    if (status !== 200) {
      throw new Error(
        body?.error ?? `Loops returned ${status} when placing the order`,
      );
    }
    return body as { runId: string };
  });

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

// GET /users/{userId}: what Loops knows about a customer, or null until their first order is recorded.
export const getCustomer = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
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
  });

// GET /users: every customer in the organization, newest first, 50 at a time.
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
    return body as {
      users: { id: string; createdAt: string }[];
      nextCursor: string | null;
    };
  });

// Memory is a markdown list, one "- " line per thing a loop remembered, oldest first.
export function memoryLines(customer: Customer | null) {
  return (customer?.memory ?? "")
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2));
}
