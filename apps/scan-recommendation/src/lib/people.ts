import { useSyncExternalStore } from "react";

import { scanSummary } from "#/lib/loops";
import type { LatestScan } from "#/lib/loops";

export type Message = {
  role: "person" | "agent";
  text: string;
};

// A scan link we've handed out. Loops can't tell us about it until it finishes, so we track it here.
export type OpenScan = {
  url: string;
  startedAt: string;
  // The scan the person already had, so we can tell when a new one arrives.
  previousScanId: string | null;
};

// The workflow waits this long from when the link is created, not from when it's opened.
export const SCAN_WAIT_MS = 30 * 60 * 1000;

// What Loops doesn't store, kept in the browser and keyed by the person's email.
export type LocalPerson = {
  // The person's email. Loops uses the same value as its user id.
  id: string;
  name: string;
  // The current conversation. A new thread id starts a fresh one.
  threadId: string;
  // Loops has no history endpoint, so we keep our own copy of the transcript.
  messages: Message[];
  // The scan this thread has been told about. The agent can't read latestScan.
  sharedScanId: string | null;
  openScan: OpenScan | null;
};

const STORAGE_KEY = "scan-recommendation:people";
const listeners = new Set<() => void>();
let cache: LocalPerson[] | undefined;

function read() {
  cache ??= JSON.parse(
    localStorage.getItem(STORAGE_KEY) ?? "[]",
  ) as LocalPerson[];
  return cache;
}

function write(people: LocalPerson[]) {
  cache = people;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

// Returns null during server rendering, where localStorage doesn't exist.
export function usePeople() {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function newThreadId() {
  return `scan-${crypto.randomUUID()}`;
}

// Adds the person, or updates their name. Loops only creates them once their first scan starts.
export function savePerson(name: string, id: string) {
  if (read().some((person) => person.id === id)) {
    updatePerson(id, (person) => ({ ...person, name }));
    return;
  }
  write([
    ...read(),
    {
      id,
      name,
      threadId: newThreadId(),
      messages: [],
      sharedScanId: null,
      openScan: null,
    },
  ]);
}

export function updatePerson(
  id: string,
  change: (person: LocalPerson) => LocalPerson,
) {
  write(read().map((person) => (person.id === id ? change(person) : person)));
}

// The chat API has no user field, and the agent can't read the scan, so the first message carries both.
export function introLine(person: LocalPerson, scan: LatestScan | undefined) {
  const intro = `Hi, I'm ${person.name}. My email is ${person.id}.`;
  return scan ? `${intro} My last face scan: ${scanSummary(scan)}.` : intro;
}
