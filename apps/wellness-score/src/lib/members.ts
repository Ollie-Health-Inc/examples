import { useSyncExternalStore } from "react";

import { scoreSummary } from "#/lib/loops";
import type { CheckDetails, WellnessScore } from "#/lib/loops";

export type Message = {
  role: "member" | "agent";
  text: string;
};

// A scan link we've handed out. Loops can't tell us about it until it finishes, so we track it here.
export type OpenCheck = {
  url: string;
  startedAt: string;
  // When the member's previous score was saved, so we can tell when a new one arrives.
  previousScannedAt: string | null;
};

// The run waits this long for the scan, counted from when the check starts, not from when the link is opened.
export const CHECK_WAIT_MS = 60 * 60 * 1000;

// What Loops doesn't store, kept in the browser and keyed by membership number.
export type LocalMember = CheckDetails & {
  // The membership or policy number. Loops uses the same value as its user id.
  id: string;
  name: string;
  // The current conversation. A new thread id starts a fresh one.
  threadId: string;
  // Loops has no history endpoint, so we keep our own copy of the transcript.
  messages: Message[];
  // The score this thread has been told about. The agent can't read wellnessScore.
  sharedScannedAt: string | null;
  openCheck: OpenCheck | null;
};

const STORAGE_KEY = "wellness-score:members";
const listeners = new Set<() => void>();
let cache: LocalMember[] | undefined;

function read() {
  cache ??= JSON.parse(
    localStorage.getItem(STORAGE_KEY) ?? "[]",
  ) as LocalMember[];
  return cache;
}

function write(members: LocalMember[]) {
  cache = members;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

// Returns null during server rendering, where localStorage doesn't exist.
export function useMembers() {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function newThreadId() {
  return `wellness-${crypto.randomUUID()}`;
}

// Adds the member, or updates their details. Loops only creates them once their first check starts.
export function saveMember(
  details: Pick<LocalMember, "id" | "name" | "age" | "gender">,
) {
  if (read().some((member) => member.id === details.id)) {
    updateMember(details.id, (member) => ({ ...member, ...details }));
    return;
  }
  write([
    ...read(),
    {
      ...details,
      smoker: false,
      hasDiabetes: false,
      isTreatedForHypertension: false,
      threadId: newThreadId(),
      messages: [],
      sharedScannedAt: null,
      openCheck: null,
    },
  ]);
}

export function updateMember(
  id: string,
  change: (member: LocalMember) => LocalMember,
) {
  write(read().map((member) => (member.id === id ? change(member) : member)));
}

function healthAnswers(member: LocalMember) {
  const answers = [
    member.smoker ? "I smoke" : "I don't smoke",
    member.hasDiabetes ? "I have diabetes" : "I don't have diabetes",
    member.isTreatedForHypertension
      ? "I take blood pressure medicine"
      : "I don't take blood pressure medicine",
  ];
  return `I'm ${member.age} and ${member.gender}. ${answers.join(", ")}.`;
}

// Written in the browser, so the date is in the member's own time zone.
function scoreDate(result: WellnessScore) {
  return new Date(result.scannedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
  });
}

// The chat API has no user field, and the agent can't read the score, so the first message carries both.
// The age, sex and health answers save the agent asking for them before a check.
export function introLine(member: LocalMember, result?: WellnessScore) {
  const intro = `Hi, I'm ${member.name}. My membership number is ${member.id}. ${healthAnswers(member)}`;
  return result
    ? `${intro} My wellness score from ${scoreDate(result)} is ${scoreSummary(result)}`
    : intro;
}

// For a score that arrives while a thread is open.
export function newScoreLine(result: WellnessScore) {
  return `My scan just finished: my wellness score is ${scoreSummary(result)}`;
}
