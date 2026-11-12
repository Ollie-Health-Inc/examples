import { useSyncExternalStore } from "react";

export type Message = {
  role: "customer" | "agent";
  text: string;
};

// The store's products and delivery options. Use the names in the brand's catalogue, so swaps match.
export const PRODUCTS = [
  "Magnesium Glycinate",
  "Ashwagandha",
  "Vitamin D3",
  "Omega-3 Fish Oil",
  "Collagen Peptides",
];
export const FREQUENCIES = ["weekly", "every two weeks", "monthly"];

// Loops only learns about a customer once an outcome or cancellation is recorded, so subscribers live here.
export type Subscriber = {
  // The customer's email. Loops uses the same value as its user id.
  id: string;
  name: string;
  product: string;
  frequency: string;
  phone: string;
  // The current conversation. A new thread id starts a fresh one.
  threadId: string;
  // Loops has no history endpoint, so we keep our own copy of the transcript.
  messages: Message[];
};

const STORAGE_KEY = "subscription-save:subscribers";
const listeners = new Set<() => void>();
let cache: Subscriber[] | undefined;

function read() {
  cache ??= JSON.parse(
    localStorage.getItem(STORAGE_KEY) ?? "[]",
  ) as Subscriber[];
  return cache;
}

function write(subscribers: Subscriber[]) {
  cache = subscribers;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(subscribers));
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

// Returns null during server rendering, where localStorage doesn't exist.
export function useSubscribers() {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function newThreadId() {
  return `save-${crypto.randomUUID()}`;
}

export function addSubscriber(
  details: Pick<Subscriber, "id" | "name" | "product" | "frequency" | "phone">,
) {
  const others = read().filter((s) => s.id !== details.id);
  write([...others, { ...details, threadId: newThreadId(), messages: [] }]);
}

export function updateSubscriber(
  id: string,
  change: (subscriber: Subscriber) => Subscriber,
) {
  write(read().map((s) => (s.id === id ? change(s) : s)));
}

// The plan name the store sends to subscription-cancelled, for example "Magnesium Glycinate monthly".
export function planName(subscriber: Subscriber) {
  return `${subscriber.product} ${subscriber.frequency}`;
}

// The agent can't read the store, so the first message says who's asking and what they subscribe to.
export function introLine(subscriber: Subscriber) {
  return `Hi, I'm ${subscriber.name}. My email is ${subscriber.id}. I have the ${subscriber.product} subscription, delivered ${subscriber.frequency}.`;
}
