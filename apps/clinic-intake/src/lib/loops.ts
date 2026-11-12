import { createServerFn } from "@tanstack/react-start";

export type Urgency = "routine" | "soon" | "urgent";

// What clinic-intake-record saves when the patient confirms their summary.
export type Intake = {
  name: string;
  contact: string;
  reason: string;
  symptoms: string;
  durationDays?: number;
  medicines?: string;
  allergies?: string;
  preferredTimes: string;
  urgency: Urgency;
  submittedAt: string;
};

export type Patient = {
  id: string;
  createdAt: string;
  updatedAt: string;
  // Other loops can write to metadata too, so only read the keys this template documents.
  metadata: { name?: string; contact?: string; lastIntake?: Intake };
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

// GET /users/{userId}: a patient's metadata and memory, or null if Loops hasn't saved anything yet.
export const getPatient = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(({ data: id }) => readPatient(id));

// GET /users has no metadata, so read each user on the page too. Fine for a small clinic.
export const listPatients = createServerFn({ method: "GET" })
  .validator((data: { cursor?: string }) => data)
  .handler(async ({ data }) => {
    const query = new URLSearchParams({ limit: "50" });
    if (data.cursor) query.set("cursor", data.cursor);

    const { status, body } = await callLoops(`/users?${query}`);
    if (status !== 200) {
      throw new Error(body?.error ?? `Loops returned ${status} for GET /users`);
    }

    const page = body as { users: { id: string }[]; nextCursor: string | null };
    const patients = await Promise.all(
      page.users.map((user) => readPatient(user.id)),
    );
    return {
      patients: patients.filter((patient) => patient !== null),
      nextCursor: page.nextCursor,
    };
  });

// Memory is a markdown list, one "- " line per thing a loop remembered, oldest first.
export function memoryLines(patient: Patient | null) {
  return (patient?.memory ?? "")
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2));
}

// The symptom check's result only lives in these memory lines. The agent never sees it.
export function symptomChecks(patient: Patient | null) {
  return memoryLines(patient).filter((line) =>
    line.startsWith("Symptom check for"),
  );
}

export function hasRedFlag(patient: Patient | null) {
  return symptomChecks(patient).some((line) => line.includes("Red flags:"));
}
