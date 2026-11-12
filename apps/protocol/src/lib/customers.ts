import { useSyncExternalStore } from "react";

export type Message = {
  role: "customer" | "agent";
  text: string;
};

// What Loops doesn't store, kept in the browser and keyed by the customer's email.
export type LocalCustomer = {
  // The customer's email. Loops uses the same value as its user id.
  id: string;
  name: string;
  // The current conversation. A new thread id starts a fresh one.
  threadId: string;
  // Loops has no history endpoint, so we keep our own copy of the transcript.
  messages: Message[];
};

const STORAGE_KEY = "protocol:customers";
const listeners = new Set<() => void>();
let cache: LocalCustomer[] | undefined;

function read() {
  cache ??= JSON.parse(
    localStorage.getItem(STORAGE_KEY) ?? "[]",
  ) as LocalCustomer[];
  return cache;
}

function write(customers: LocalCustomer[]) {
  cache = customers;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

// Returns null during server rendering, where localStorage doesn't exist.
export function useCustomers() {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function newThreadId() {
  return `protocol-${crypto.randomUUID()}`;
}

// A new order changes what the customer has, so it also starts a new conversation about it.
export function saveOrderedCustomer(name: string, id: string) {
  const others = read().filter((customer) => customer.id !== id);
  write([...others, { id, name, threadId: newThreadId(), messages: [] }]);
}

// For customers ordered from another browser or app, where we don't know their name.
export function startConversation(id: string) {
  write([...read(), { id, name: "", threadId: newThreadId(), messages: [] }]);
}

export function updateCustomer(
  id: string,
  change: (customer: LocalCustomer) => LocalCustomer,
) {
  write(
    read().map((customer) =>
      customer.id === id ? change(customer) : customer,
    ),
  );
}

// The agent can't read metadata, so the first message says who's asking and what they ordered.
export function introLine(
  id: string,
  name: string | undefined,
  products: string[],
) {
  const greeting = name ? `Hi, I'm ${name}.` : "Hi.";
  const ordered = products.length ? ` I ordered ${listOf(products)}.` : "";
  return `${greeting} My email is ${id}.${ordered}`;
}

function listOf(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
