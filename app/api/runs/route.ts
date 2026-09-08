import { nanoid } from "nanoid";
import { runQueue } from "@/lib/queue";
import { genSamples } from "@/lib/samples";
import { MAX_ITEMS, MAX_PARALLELISM, MAX_CHAOS, DEFAULT_PARALLELISM, DEFAULT_COUNT, RUN_BUDGET_MS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/* POST /api/runs: the whole run happens inside this one invocation. The response
   is a stream of newline-delimited JSON snapshots; the last one is the receipt. */
export async function POST(req: Request) {
  let payload: { lines?: string[]; count?: number; parallelism?: number; chaos?: number };
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const parallelism = clamp(Math.round(payload.parallelism ?? DEFAULT_PARALLELISM), 1, MAX_PARALLELISM);
  const chaos = clamp(Math.round(payload.chaos ?? 0), 0, MAX_CHAOS);
  const source = payload.lines?.length
    ? payload.lines.map((l) => String(l).trim()).filter(Boolean)
    : genSamples(clamp(payload.count ?? DEFAULT_COUNT, 1, MAX_ITEMS));
  const texts = source.slice(0, MAX_ITEMS);
  if (texts.length === 0) return Response.json({ error: "no items to dispatch" }, { status: 400 });

  const id = nanoid(10);
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (obj: unknown) => {
        try { controller.enqueue(enc.encode(JSON.stringify(obj) + "\n")); } catch { /* client went away */ }
      };
      runQueue({ id, texts, parallelism, chaos, deadlineMs: RUN_BUDGET_MS, signal: req.signal }, send)
        .catch((err) => send({ error: err instanceof Error ? err.message : String(err) }))
        .finally(() => { try { controller.close(); } catch { /* already closed */ } });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
