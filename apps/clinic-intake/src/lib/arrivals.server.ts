import { mkdir, readFile, writeFile } from "node:fs/promises";

// When each patient's booking request last reached our webhook, keyed by patient id.
// Kept in a file so a demo survives restarts. Use a database for anything real.
const FILE = ".data/booking-arrivals.json";

export async function readArrivals(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await readFile(FILE, "utf8"));
  } catch {
    return {};
  }
}

export async function recordArrival(patientId: string) {
  const arrivals = await readArrivals();
  arrivals[patientId] = new Date().toISOString();
  await mkdir(".data", { recursive: true });
  await writeFile(FILE, JSON.stringify(arrivals, null, 2));
}
