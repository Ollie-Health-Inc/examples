import { createServerFn } from "@tanstack/react-start";

export type BloodPressure =
  | "normal"
  | "elevated"
  | "high_blood_pressure_stage_1"
  | "high_blood_pressure_stage_2"
  | "hypertensive_crisis_range";

// What scan-recommendation-scan saves once a scan finishes. Categories only. The raw numbers stay in the report.
// A reading the scan didn't return is null.
export type LatestScan = {
  scanId: string;
  wellnessScore: number | null;
  bloodPressure: BloodPressure | null;
  restingHeartRate: string | null;
  breathing: string | null;
  bmi: string | null;
  reportUrl: string;
  scannedAt: string;
};

export type Person = {
  id: string;
  createdAt: string;
  updatedAt: string;
  // Other loops can write to metadata too, so only read the key this template documents.
  metadata: { latestScan?: LatestScan };
  memory: string;
};

// The app calls two loops: the agent, and the workflow that runs a face scan.
function loopIds() {
  const { LOOPS_AGENT_LOOP_ID, LOOPS_SCAN_LOOP_ID } = process.env;
  if (!LOOPS_AGENT_LOOP_ID || !LOOPS_SCAN_LOOP_ID) {
    throw new Error(
      "Loops is not configured. Copy .env.example to .env and fill it in.",
    );
  }
  return { agent: LOOPS_AGENT_LOOP_ID, scan: LOOPS_SCAN_LOOP_ID };
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

// POST to the scan workflow: opens a scan session and returns its link straight away.
export const startScan = createServerFn({ method: "POST" })
  .validator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const { status, body } = await callLoops(loopIds().scan, "", {
      method: "POST",
      body: JSON.stringify({ userId }),
    });

    if (status !== 200 || typeof body?.scanUrl !== "string") {
      throw new Error(
        body?.error ?? `Loops returned ${status} when starting a scan`,
      );
    }
    return body as { runId: string; scanSessionId: string; scanUrl: string };
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

// GET /users/{userId}: a person's latest scan and memory, or null until a scan has been started for them.
export const getPerson = createServerFn({ method: "GET" })
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
    return body as Person;
  });

// GET /users: every person in the organization, newest first, 50 at a time.
export const listPeople = createServerFn({ method: "GET" })
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

// Scan links look like {scanBaseUrl}/{organizationId}/{scanLoopId}/{scanSessionId}, which is how we spot them in replies.
export const getScanLinkPath = createServerFn({ method: "GET" }).handler(
  () => `/${process.env.LOOPS_ORGANIZATION_ID}/${loopIds().scan}/`,
);

// Every finished scan adds one of these lines. latestScan is replaced each time, so they're the only history.
export function scanHistory(person: Person | null) {
  return (person?.memory ?? "")
    .split("\n")
    .filter((line) => line.startsWith("- Face scan:"))
    .map((line) => line.slice(2));
}

// The same wording as the memory line, for telling the agent about a scan it can't read.
export function scanSummary(scan: LatestScan) {
  const value = (reading: string | number | null) => reading ?? "n/a";
  return [
    `wellness score ${value(scan.wellnessScore)}`,
    `blood pressure ${value(scan.bloodPressure)}`,
    `resting heart rate ${value(scan.restingHeartRate)}`,
    `breathing ${value(scan.breathing)}`,
    `BMI ${value(scan.bmi)}`,
  ].join(", ");
}
