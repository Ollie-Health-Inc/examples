import { mkdir, readFile, writeFile } from "node:fs/promises";

import type { Offer, Outcome, Reason } from "#/lib/loops";

// The body subscription-save-outcome posts to our webhook, plus what the store desk tracks.
export type StoredOutcome = {
  userId?: string;
  reason: Reason;
  offer: Offer;
  outcome: Outcome;
  details?: string;
  decidedAt: string;
  receivedAt: string;
  applied: boolean;
  cancellationConfirmed: boolean;
};

// Kept in a file so a demo survives restarts. Use a database for anything real.
const FILE = ".data/outcomes.json";

export async function readOutcomes(): Promise<StoredOutcome[]> {
  try {
    return JSON.parse(await readFile(FILE, "utf8"));
  } catch {
    return [];
  }
}

async function writeOutcomes(outcomes: StoredOutcome[]) {
  await mkdir(".data", { recursive: true });
  await writeFile(FILE, JSON.stringify(outcomes, null, 2));
}

// Loops may retry a failed step, so the same outcome can arrive twice. userId and decidedAt together are the key.
export function outcomeKey(outcome: { userId?: string; decidedAt: string }) {
  return `${outcome.userId ?? ""}|${outcome.decidedAt}`;
}

export async function recordOutcome(
  body: Omit<StoredOutcome, "receivedAt" | "applied" | "cancellationConfirmed">,
) {
  const outcomes = await readOutcomes();
  if (outcomes.some((o) => outcomeKey(o) === outcomeKey(body))) return;
  outcomes.push({
    ...body,
    receivedAt: new Date().toISOString(),
    applied: false,
    cancellationConfirmed: false,
  });
  await writeOutcomes(outcomes);
}

export async function updateOutcome(
  key: string,
  change: Partial<Pick<StoredOutcome, "applied" | "cancellationConfirmed">>,
) {
  const outcomes = await readOutcomes();
  await writeOutcomes(
    outcomes.map((o) => (outcomeKey(o) === key ? { ...o, ...change } : o)),
  );
}
