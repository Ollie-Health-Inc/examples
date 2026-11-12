import { createServerFn } from "@tanstack/react-start";

export type BloodPressure =
  | "normal"
  | "elevated"
  | "high_blood_pressure_stage_1"
  | "high_blood_pressure_stage_2"
  | "hypertensive_crisis_range";

export type Band = "strong" | "steady" | "room to improve";

// What wellness-score-scan saves once a scan finishes. Anything the scan or the risk model couldn't work out is null.
export type WellnessScore = {
  score: number | null;
  band: Band | null;
  bmi: { value: number; category: string } | null;
  bloodPressure: BloodPressure | null;
  tenYearCvdRiskPercent: number | null;
  vascularAgeYears: number | null;
  diabetesRiskPercent: number | null;
  reportUrl: string;
  scannedAt: string;
};

export type Member = {
  id: string;
  createdAt: string;
  updatedAt: string;
  // Other loops can write to metadata too, so only read the key this template documents.
  metadata: { wellnessScore?: WellnessScore };
  memory: string;
};

// The age, sex and health answers the risk estimates need. They aren't passed to the scan page.
export type CheckDetails = {
  age: number;
  gender: "male" | "female";
  smoker: boolean;
  hasDiabetes: boolean;
  isTreatedForHypertension: boolean;
};

// The app calls two loops: the agent, and the workflow that runs a wellness check.
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

// POST to wellness-score-scan: creates the member if they're new, opens a scan session and returns its link.
export const startWellnessCheck = createServerFn({ method: "POST" })
  .validator((data: CheckDetails & { memberId: string }) => data)
  .handler(async ({ data }) => {
    const { status, body } = await callLoops(loopIds().scan, "", {
      method: "POST",
      body: JSON.stringify(data),
    });

    if (status !== 200 || typeof body?.scanUrl !== "string") {
      throw new Error(
        body?.error ??
          `Loops returned ${status} when starting a wellness check`,
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

// GET /users/{userId}: a member's latest score and memory, or null until a check has started for them.
export const getMember = createServerFn({ method: "GET" })
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
    return body as Member;
  });

// GET /users: every member in the organization, newest first, 50 at a time.
export const listMembers = createServerFn({ method: "GET" })
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

// Every finished check adds one of these lines. wellnessScore is replaced each time, so they're the only history.
export function scoreHistory(member: Member | null) {
  return (member?.memory ?? "")
    .split("\n")
    .filter((line) => line.startsWith("- Wellness score"))
    .map((line) => line.slice(2));
}

// The agent can't read the score, so the app puts it in the message, in the same order as the template's example.
export function scoreSummary(result: WellnessScore) {
  const value = (reading: number | string | null) => reading ?? "n/a";
  return [
    `${value(result.score)} (${value(result.band)}).`,
    `Blood pressure: ${value(result.bloodPressure)}.`,
    `BMI: ${result.bmi ? `${result.bmi.value} (${result.bmi.category})` : "n/a"}.`,
    `10-year heart risk: ${value(result.tenYearCvdRiskPercent)}%.`,
    `Vascular age: ${value(result.vascularAgeYears)}.`,
    `Diabetes risk: ${value(result.diabetesRiskPercent)}%.`,
  ].join(" ");
}
