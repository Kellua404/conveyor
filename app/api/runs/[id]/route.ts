import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { runKey, itemKey, eventsKey, idsKey } from "@/lib/run";
import { pct } from "@/lib/format";

export const runtime = "nodejs";

type RawItem = Record<string, string | number | null> | null;

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  const run = await redis.hgetall<Record<string, string>>(runKey(id));
  if (!run || Object.keys(run).length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const ids = ((await redis.lrange(idsKey(id), 0, -1)) as string[]) ?? [];
  const pipe = redis.pipeline();
  ids.forEach((i) => pipe.hgetall(itemKey(id, i)));
  const rawItems = (ids.length ? ((await pipe.exec()) as RawItem[]) : []).filter(Boolean) as Record<
    string,
    string | number
  >[];

  const events = ((await redis.lrange(eventsKey(id), 0, 49)) as string[]) ?? [];

  const total = Number(run.total);
  const done = Number(run.done ?? 0);
  const dead = Number(run.dead ?? 0);
  const retries = Number(run.retries ?? 0);
  const terminal = done + dead;
  const elapsed = (Date.now() - Number(run.createdAt)) / 1000;
  const durations = rawItems
    .filter((x) => x?.ms)
    .map((x) => Number(x.ms))
    .sort((a, b) => a - b);

  const items = rawItems.map((x) => ({
    idx: Number(x.idx),
    status: String(x.status),
    stage: String(x.stage),
    attempts: Number(x.attempts ?? 0),
    ms: x.ms ? Number(x.ms) : null,
    error: x.error ? String(x.error) : null,
    text: String(x.text ?? ""),
    result: x.result ? safeParse(String(x.result)) : null,
  }));

  const snapshot = {
    id,
    total,
    done,
    dead,
    retries,
    status: terminal >= total ? "complete" : "running",
    parallelism: Number(run.parallelism),
    chaos: Number(run.chaos),
    throughput: done > 0 ? +(done / Math.max(elapsed, 0.001)).toFixed(2) : 0,
    p50: pct(durations, 0.5),
    p95: pct(durations, 0.95),
    inFlight: items.filter((x) => x.status === "running").length,
    elapsed: +elapsed.toFixed(2),
    items,
    events: events.map((e) => {
      const [ts, ...m] = e.split("|");
      return { ts: Number(ts), msg: m.join("|") };
    }),
  };

  // Results JSON export (proof the work was real): GET /api/runs/{id}?format=json
  const format = new URL(req.url).searchParams.get("format");
  if (format === "json") {
    return new NextResponse(JSON.stringify(snapshot, null, 2), {
      headers: {
        "content-type": "application/json",
        "content-disposition": `attachment; filename="conveyor-${id}.json"`,
      },
    });
  }

  return NextResponse.json(snapshot);
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
