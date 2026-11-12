import { createServerFn } from "@tanstack/react-start";

// What lab-education-lookup saves when the agent judged some tests out of range.
export type FollowUp = {
  tests: string[];
  flaggedAt: string;
};

export type Patient = {
  id: string;
  createdAt: string;
  updatedAt: string;
  // Other loops can write to metadata too, so only read the key this template documents.
  metadata: { labFollowUp?: FollowUp };
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

async function readPatient(id: string) {
  const { status, body } = await callLoops(`/users/${encodeURIComponent(id)}`);

  // A JSON 404 means nothing is saved yet. A plain-text 404 means this Loops doesn't have the endpoint.
  if (status === 404 && body?.error === "User not found") return null;
  if (status !== 200) {
    throw new Error(
      body?.error ?? `Loops returned ${status} for GET /users/{userId}`,
    );
  }
  return body as Patient;
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

// GET /users/{userId}: a patient's follow-up flag and memory, or null if Loops hasn't saved anything yet.
export const getPatient = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(({ data: id }) => readPatient(id));

// Loops can't filter users by metadata, so read every user and keep the flagged ones.
// That's one request per user: fine for a test organization, too slow for a real one.
export const listFlaggedPatients = createServerFn({ method: "GET" }).handler(
  async () => {
    const ids: string[] = [];
    let cursor: string | null = null;

    do {
      const query = new URLSearchParams({ limit: "50" });
      if (cursor) query.set("cursor", cursor);

      const { status, body } = await callLoops(`/users?${query}`);
      if (status !== 200) {
        throw new Error(
          body?.error ?? `Loops returned ${status} for GET /users`,
        );
      }
      const page = body as {
        users: { id: string }[];
        nextCursor: string | null;
      };
      ids.push(...page.users.map((user) => user.id));
      cursor = page.nextCursor;
    } while (cursor);

    const patients = await Promise.all(ids.map((id) => readPatient(id)));
    return patients
      .filter((patient) => patient?.metadata.labFollowUp)
      .map((patient) => patient!)
      .sort((a, b) =>
        b.metadata.labFollowUp!.flaggedAt.localeCompare(
          a.metadata.labFollowUp!.flaggedAt,
        ),
      );
  },
);

// Memory is a markdown list, one "- " line per thing a loop remembered, oldest first.
export function memoryLines(patient: Patient | null) {
  return (patient?.memory ?? "")
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2));
}

export type ReferencePage = {
  test: string;
  title: string;
  url: string;
  summary: string;
};

// Lines look like "Reference for {test}: {title} {url}. {summary}", and the summary is optional.
const REFERENCE_LINE =
  /^Reference for (.+?): (.+?) (https?:\/\/\S+?)(?:\. (.*))?$/;

// Every lookup saves its pages again, so keep the first line for each URL.
export function referencePages(patient: Patient | null) {
  const pages: ReferencePage[] = [];
  for (const line of memoryLines(patient)) {
    const match = line.match(REFERENCE_LINE);
    if (!match || pages.some((page) => page.url === match[3])) continue;
    pages.push({
      test: match[1],
      title: match[2],
      url: match[3],
      summary: match[4] ?? "",
    });
  }
  return pages;
}

export function referenceLineCount(patient: Patient | null) {
  return memoryLines(patient).filter((line) => line.startsWith("Reference for"))
    .length;
}
