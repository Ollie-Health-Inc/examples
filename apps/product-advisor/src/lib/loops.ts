import { createServerFn } from "@tanstack/react-start";

export type LoopsUser = {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type Quiz = {
  brand?: string;
  goals?: string[];
  lifestyle?: string;
  recommendations?: string[];
  completedAt?: string;
};

export type LoopsUserDetails = LoopsUser & {
  // Other loops can write to metadata too, so only read the keys you need.
  metadata: { quiz?: Quiz };
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

// GET /users: one page of the organization's users, newest first.
export const listUsers = createServerFn({ method: "GET" })
  .validator((data: { cursor?: string }) => data)
  .handler(async ({ data }) => {
    const query = new URLSearchParams({ limit: "50" });
    if (data.cursor) query.set("cursor", data.cursor);

    const { status, body } = await callLoops(`/users?${query}`);

    if (status !== 200) {
      throw new Error(body?.error ?? `Loops returned ${status} for GET /users`);
    }
    return body as { users: LoopsUser[]; nextCursor: string | null };
  });

// GET /users/{userId}: a user's metadata and memory, or null if Loops hasn't saved anything for them yet.
export const getUser = createServerFn({ method: "GET" })
  .validator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const { status, body } = await callLoops(
      `/users/${encodeURIComponent(userId)}`,
    );

    // A JSON 404 means no quiz yet. A plain-text 404 means this Loops doesn't have the endpoint.
    if (status === 404 && body?.error === "User not found") return null;
    if (status !== 200) {
      throw new Error(
        body?.error ?? `Loops returned ${status} for GET /users/{userId}`,
      );
    }
    return body as LoopsUserDetails;
  });
