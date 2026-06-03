import { NextResponse } from "next/server";
import { qstash, FLOW_CONTROL_KEY, MAX_ATTEMPTS, workerUrl } from "@/lib/qstash";
import { redis } from "@/lib/redis";
import { runKey, itemKey, logEvent } from "@/lib/run";

export const runtime = "nodejs";
export const maxDuration = 30;

// Manual retry of a dead item: reset it to queued, decrement the dead counter,
// then re-enqueue it down the exact same path as a fresh dispatch.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const runId = params.id;
  let itemId: string;
  try {
    ({ itemId } = await req.json());
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (itemId == null) {
    return NextResponse.json({ error: "itemId required" }, { status: 400 });
  }

  const item = await redis.hgetall<Record<string, string>>(itemKey(runId, itemId));
  if (!item || Object.keys(item).length === 0) {
    return NextResponse.json({ error: "item not found" }, { status: 404 });
  }
  if (item.status !== "dead") {
    return NextResponse.json({ error: "item is not dead" }, { status: 409 });
  }

  // reset item; keep attempts so the badge reflects history, but the worker will
  // get MAX_ATTEMPTS fresh QStash retries again.
  await redis.hset(itemKey(runId, itemId), {
    status: "queued",
    stage: "QUEUED",
    attempts: 0,
    error: "",
    ms: "",
    result: "",
  });
  await redis.hincrby(runKey(runId), "dead", -1);
  await logEvent(runId, `item#${itemId} re-queued (manual retry)`);

  // re-publish on the same flow-control key (reuse this run's parallelism).
  const parallelism = Math.max(1, Number((await redis.hget(runKey(runId), "parallelism")) ?? 2));
  await qstash.publishJSON({
    url: workerUrl(),
    body: { runId, itemId: String(itemId) },
    retries: MAX_ATTEMPTS,
    flowControl: { key: FLOW_CONTROL_KEY, parallelism },
  });

  return NextResponse.json({ ok: true });
}
