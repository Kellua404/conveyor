import { redis } from "./redis";

// Redis shapes:
//   run:{id}            -> hash  { total, done, dead, retries, parallelism, chaos, createdAt, text? }
//   run:{id}:item:{i}   -> hash  { idx, text, status, stage, attempts, startedAt, ms, result, error }
//   run:{id}:events     -> list  (capped event log, newest first)
//   run:{id}:ids        -> list  (item ids, for snapshot fan-out)
export const RUN_TTL = 60 * 60 * 24; // 24h

export type ItemStatus = "queued" | "running" | "done" | "retrying" | "dead";
export const STAGES_ALL = ["QUEUED", "FETCH", "TRANSFORM", "VALIDATE", "DONE", "DEAD"] as const;

export const runKey = (run: string) => `run:${run}`;
export const itemKey = (run: string, i: string) => `run:${run}:item:${i}`;
export const eventsKey = (run: string) => `run:${run}:events`;
export const idsKey = (run: string) => `run:${run}:ids`;

// Atomic claim: only one invocation may move an item out of queued/retrying into
// running. Returns the new attempt number, or -1 if the item is NOT claimable
// (already running/done/dead) — i.e. a duplicate delivery we should simply ack.
// This is what makes the worker idempotent under QStash's at-least-once delivery.
const CLAIM = `
local s = redis.call('HGET', KEYS[1], 'status')
if s == 'queued' or s == 'retrying' then
  local a = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
  redis.call('HSET', KEYS[1], 'status', 'running', 'stage', 'FETCH', 'startedAt', ARGV[1])
  return a
end
return -1`;

export async function claim(run: string, i: string): Promise<number> {
  return (await redis.eval(CLAIM, [itemKey(run, i)], [Date.now().toString()])) as number;
}

export async function logEvent(run: string, line: string) {
  await redis.lpush(eventsKey(run), `${Date.now()}|${line}`);
  await redis.ltrim(eventsKey(run), 0, 199);
  await redis.expire(eventsKey(run), RUN_TTL);
}

export async function markDone(run: string, i: string, ms: number, result: unknown) {
  await redis.hset(itemKey(run, i), {
    status: "done",
    stage: "DONE",
    ms,
    result: JSON.stringify(result),
    error: "",
  });
  await redis.hincrby(runKey(run), "done", 1);
  await logEvent(run, `item#${i} DONE ${ms}ms`);
}

export async function markRetrying(run: string, i: string, reason: string) {
  await redis.hset(itemKey(run, i), { status: "retrying", error: reason });
  await redis.hincrby(runKey(run), "retries", 1);
  await logEvent(run, `item#${i} RETRY (${reason})`);
}

export async function markDead(run: string, i: string, reason: string) {
  await redis.hset(itemKey(run, i), { status: "dead", stage: "DEAD", error: reason });
  await redis.hincrby(runKey(run), "dead", 1);
  await logEvent(run, `item#${i} → DEAD (${reason})`);
}

export async function setStage(run: string, i: string, stage: string) {
  await redis.hset(itemKey(run, i), { stage });
}
