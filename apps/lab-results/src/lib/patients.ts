import { useSyncExternalStore } from "react";

import { SAMPLE_SETS, resultLine } from "#/lib/samples";
import type { LabResult } from "#/lib/samples";

export type Message = {
  role: "patient" | "agent";
  text: string;
};

// What Loops doesn't store, kept in the browser and keyed by the patient's email.
export type LocalPatient = {
  // The patient's email. Loops uses the same value as its user id.
  id: string;
  name: string;
  // Loops never stores the values, only reference pages and the follow-up flag.
  results: LabResult[];
  takenOn: string;
  // The current conversation, about one set of results. Changing the results starts a new one.
  threadId: string;
  // Loops has no history endpoint, so we keep our own copy of the transcript.
  messages: Message[];
};

// A tiny localStorage store that React components can subscribe to.
function createLocalStore<T>(key: string, empty: T) {
  const listeners = new Set<() => void>();
  let cache: T | undefined;

  function read() {
    cache ??= JSON.parse(localStorage.getItem(key) ?? "null") ?? empty;
    return cache as T;
  }

  function write(value: T) {
    cache = value;
    localStorage.setItem(key, JSON.stringify(value));
    listeners.forEach((notify) => notify());
  }

  function subscribe(notify: () => void) {
    listeners.add(notify);
    return () => listeners.delete(notify);
  }

  // Returns null during server rendering, where localStorage doesn't exist.
  function use() {
    return useSyncExternalStore(subscribe, read, () => null);
  }

  return { read, write, use };
}

const patients = createLocalStore<LocalPatient[]>("lab-results:patients", []);
export const usePatients = patients.use;

export function newThreadId() {
  return `results-${crypto.randomUUID()}`;
}

// Adds the patient with the first sample results, or updates their name and keeps everything else.
export function savePatient(name: string, id: string) {
  const existing = patients.read().find((patient) => patient.id === id);
  if (existing) {
    updatePatient(id, (patient) => ({ ...patient, name }));
    return;
  }
  const [sample] = SAMPLE_SETS;
  patients.write([
    ...patients.read(),
    {
      id,
      name,
      results: sample.results,
      takenOn: sample.takenOn,
      threadId: newThreadId(),
      messages: [],
    },
  ]);
}

export function updatePatient(
  id: string,
  change: (patient: LocalPatient) => LocalPatient,
) {
  patients.write(
    patients
      .read()
      .map((patient) => (patient.id === id ? change(patient) : patient)),
  );
}

// Each conversation is about one set of results, so new results get a new thread.
export function replaceResults(
  id: string,
  results: LabResult[],
  takenOn: string,
) {
  updatePatient(id, (patient) => ({
    ...patient,
    results,
    takenOn,
    threadId: newThreadId(),
    messages: [],
  }));
}

// The chat API takes text only, so the first message says who's asking and lists the results.
export function firstMessage(patient: LocalPatient, question: string) {
  const intro = `Hi, I'm ${patient.name}. My email is ${patient.id}.`;
  if (patient.results.length === 0) return `${intro}\n\n${question}`;

  const results = patient.results.map(resultLine).join("\n");
  return `${intro}\n\nHere are my results from ${patient.takenOn}:\n${results}\n\n${question}`;
}

// Loops can't record reviews, and the flag never clears, so remember which flaggedAt each patient was reviewed at.
const reviews = createLocalStore<Record<string, string>>(
  "lab-results:reviewed",
  {},
);
export const useReviews = reviews.use;

export function markReviewed(id: string, flaggedAt: string) {
  reviews.write({ ...reviews.read(), [id]: flaggedAt });
}

export function markNotReviewed(id: string) {
  const { [id]: _, ...rest } = reviews.read();
  reviews.write(rest);
}
