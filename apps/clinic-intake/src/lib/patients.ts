import { useSyncExternalStore } from "react";

export type Message = {
  role: "patient" | "agent";
  text: string;
};

// What Loops doesn't store, kept in the browser and keyed by the patient's email.
export type LocalPatient = {
  // The patient's email. Loops uses the same value as its user id.
  id: string;
  name: string;
  // Optional. The symptom check only looks up nearby hospitals when the agent knows it.
  area: string;
  // The current conversation. A new thread id starts a fresh intake.
  threadId: string;
  // Loops has no history endpoint, so we keep our own copy of the transcript.
  messages: Message[];
};

const STORAGE_KEY = "clinic-intake:patients";
const listeners = new Set<() => void>();
let cache: LocalPatient[] | undefined;

function read() {
  cache ??= JSON.parse(
    localStorage.getItem(STORAGE_KEY) ?? "[]",
  ) as LocalPatient[];
  return cache;
}

function write(patients: LocalPatient[]) {
  cache = patients;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

// Returns null during server rendering, where localStorage doesn't exist.
export function usePatients() {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function newThreadId() {
  return `intake-${crypto.randomUUID()}`;
}

// Adds the patient, or updates their name and area and keeps their conversation.
export function savePatient(name: string, id: string, area: string) {
  const existing = read().find((patient) => patient.id === id);
  if (existing) {
    updatePatient(id, (patient) => ({ ...patient, name, area }));
  } else {
    write([
      ...read(),
      { id, name, area, threadId: newThreadId(), messages: [] },
    ]);
  }
}

export function updatePatient(
  id: string,
  change: (patient: LocalPatient) => LocalPatient,
) {
  write(
    read().map((patient) => (patient.id === id ? change(patient) : patient)),
  );
}

// The chat API has no user field, so the first message tells the agent who it's talking to.
export function introLine(patient: LocalPatient) {
  const area = patient.area ? ` I'm in ${patient.area}.` : "";
  return `Hi, I'm ${patient.name}. My email is ${patient.id}.${area}`;
}
