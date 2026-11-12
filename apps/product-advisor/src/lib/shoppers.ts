import { useSyncExternalStore } from "react";

export type Message = {
  role: "shopper" | "advisor";
  text: string;
};

// What Loops doesn't store, kept in the browser and keyed by the Loops user id.
export type Shopper = {
  // The shopper's email or phone. Loops uses the same value as its user id.
  id: string;
  // Loops only stores the id, so names live here. Empty for users created elsewhere.
  name: string;
  // The current conversation. A new thread id starts a fresh chat.
  threadId: string;
  // Loops has no history endpoint, so we keep our own copy of the transcript.
  messages: Message[];
};

const STORAGE_KEY = "product-advisor:shoppers";
const listeners = new Set<() => void>();
let cache: Shopper[] | undefined;

function read() {
  cache ??= JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as Shopper[];
  return cache;
}

function write(shoppers: Shopper[]) {
  cache = shoppers;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shoppers));
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

// Returns null during server rendering, where localStorage doesn't exist.
export function useShoppers() {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function newThreadId() {
  return `advisor-${crypto.randomUUID()}`;
}

export function addShopper(name: string, id: string) {
  if (read().some((shopper) => shopper.id === id)) return false;
  write([...read(), { id, name, threadId: newThreadId(), messages: [] }]);
  return true;
}

// Loops users created elsewhere have no local record until we first chat with them.
export function ensureShopper(id: string) {
  addShopper("", id);
  return read().find((shopper) => shopper.id === id)!;
}

export function removeShopper(id: string) {
  write(read().filter((shopper) => shopper.id !== id));
}

export function updateShopper(
  id: string,
  change: (shopper: Shopper) => Shopper,
) {
  write(
    read().map((shopper) => (shopper.id === id ? change(shopper) : shopper)),
  );
}

// The chat API has no user field, so the first message tells the agent who it's talking to.
export function introLine(shopper: Shopper) {
  const greeting = shopper.name ? `Hi, I'm ${shopper.name}.` : "Hi.";
  const contact = shopper.id.includes("@")
    ? `My email is ${shopper.id}.`
    : `My phone number is ${shopper.id}.`;
  return `${greeting} ${contact}`;
}
