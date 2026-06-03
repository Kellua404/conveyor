import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { qstash, QUEUE_NAME, MAX_ATTEMPTS, workerUrl } from "@/lib/qstash";
import { redis } from "@/lib/redis";
import { RUN_TTL, runKey, itemKey, idsKey } from "@/lib/run";
import { genSamples } from "@/lib/samples";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_ITEMS = 50;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export async function POST(req: Request) {
  let payload: { lines?: string[]; count?: number; parallelism?: number; chaos?: number };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const { lines, count } = payload;
  const parallelism = clamp(Math.round(payload.parallelism ?? 3), 1, 5);
  const chaos = clamp(Math.round(payload.chaos ?? 0), 0, 40);

  // items: either user-pasted lines, or N generated samples. Cap hard.
  const source = lines?.length ? lines.map((l) => l.trim()).filter(Boolean) : genSamples(clamp(count ?? 20, 1, MAX_ITEMS));
  const items = source.slice(0, MAX_ITEMS);
  if (items.length === 0) {
    return NextResponse.json({ error: "no items to dispatch" }, { status: 400 });
  }

  const runId = nanoid(10);

  // 1) seed run + item state in Redis
  await redis.hset(runKey(runId), {
    total: items.length,
    done: 0,
    dead: 0,
    retries: 0,
    parallelism,
    chaos,
    createdAt: Date.now(),
  });

  const pipe = redis.pipeline();
  items.forEach((text, idx) => {
    pipe.hset(itemKey(runId, String(idx)), {
      idx,
      text,
      status: "queued",
      stage: "QUEUED",
      attempts: 0,
      ms: "",
      error: "",
      result: "",
    });
    pipe.rpush(idsKey(runId), String(idx));
  });
  await pipe.exec();
  await redis.expire(runKey(runId), RUN_TTL);
  await redis.expire(idsKey(runId), RUN_TTL);

  // 2) set backpressure, then enqueue one QStash message per item
  const queue = qstash.queue({ queueName: QUEUE_NAME });
  await queue.upsert({ parallelism });
  await Promise.all(
    items.map((_, idx) =>
      queue.enqueueJSON({
        url: workerUrl(),
        body: { runId, itemId: String(idx) },
        retries: MAX_ATTEMPTS, // QStash will redeliver up to this many times on 5xx
      })
    )
  );

  return NextResponse.json({ runId });
}
