import { Client, Receiver } from "@upstash/qstash";

export const QUEUE_NAME = "conveyor";
export const MAX_ATTEMPTS = 4; // total tries before an item is dead-lettered

export const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

// QStash must call a PUBLICLY reachable URL. On Vercel, VERCEL_URL is the deploy
// host (no protocol). Locally, the QStash CLI dev server (`npx @upstash/qstash-cli
// dev`) CAN reach localhost. Prefer an explicit override for the stable prod domain.
export function getBaseUrl(): string {
  if (process.env.CONVEYOR_APP_URL) return process.env.CONVEYOR_APP_URL; // e.g. https://conveyor.vercel.app
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export const workerUrl = () => `${getBaseUrl()}/api/worker`;

// Verifies that an incoming request really came from QStash (not a spoofer).
export const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});
