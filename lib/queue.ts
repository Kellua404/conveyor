import { runPipeline, PermanentError, type PipelineResult } from "./pipeline";
import { pct } from "./format";

/* Conveyor's own queue. It lives inside one function invocation: a worker pool
   drains an in-memory queue with a fixed parallelism, transient failures go back
   on the queue with exponential backoff, poison and exhausted items land in the
   dead-letter lane, and every state change is streamed to the client as a
   snapshot. Nothing is stored anywhere else; when the stream closes, the run is
   over. No broker, no database, no account with anyone. */

export const MAX_ATTEMPTS = 4; // total tries before an item is dead-lettered
const BACKOFF_MS = 250; // first retry waits this long, then doubles
const SNAP_EVERY = 120; // ms between snapshots while the belt moves

export type ItemStatus = "queued" | "running" | "done" | "retrying" | "dead";

export type Item = {
  idx: number;
  text: string;
  status: ItemStatus;
  stage: string;
  attempts: number;
  ms: number | null;
  error: string | null;
  result: PipelineResult | null;
};

export type Event = { ts: number; msg: string };

export type Snapshot = {
  id: string;
  status: "running" | "complete";
  total: number;
  done: number;
  dead: number;
  retries: number;
  throughput: number;
  p50: number;
  p95: number;
  inFlight: number;
  elapsed: number;
  parallelism: number;
  chaos: number;
  items: Item[];
  events: Event[];
};

export type RunOpts = {
  id: string;
  texts: string[];
  parallelism: number;
  chaos: number;
  deadlineMs: number; // wall-clock budget for the whole run
  signal?: AbortSignal;
};

export async function runQueue(opts: RunOpts, emit: (snap: Snapshot) => void): Promise<Snapshot> {
  const t0 = Date.now();
  const items: Item[] = opts.texts.map((text, idx) => ({
    idx, text, status: "queued", stage: "QUEUED", attempts: 0, ms: null, error: null, result: null,
  }));
  const events: Event[] = [];
  let done = 0, dead = 0, retries = 0;
  const log = (msg: string) => { events.unshift({ ts: Date.now(), msg }); if (events.length > 200) events.pop(); };

  // the queue itself: item indexes, plus a "not before" time for backoff
  const queue: { idx: number; notBefore: number }[] = items.map((it) => ({ idx: it.idx, notBefore: 0 }));
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const snapshot = (status: Snapshot["status"]): Snapshot => {
    const elapsed = (Date.now() - t0) / 1000;
    const durations = items.filter((x) => x.ms != null).map((x) => x.ms as number).sort((a, b) => a - b);
    return {
      id: opts.id, status, total: items.length, done, dead, retries,
      throughput: done > 0 ? +(done / Math.max(elapsed, 0.001)).toFixed(2) : 0,
      p50: pct(durations, 0.5), p95: pct(durations, 0.95),
      inFlight: items.filter((x) => x.status === "running").length,
      elapsed: +elapsed.toFixed(2), parallelism: opts.parallelism, chaos: opts.chaos,
      items: items.map((x) => ({ ...x })), events: events.slice(0, 50),
    };
  };

  // coalesced snapshots: the belt changes many times a second, the wire gets one frame per SNAP_EVERY
  let dirty = false, lastSent = 0, ticking = false;
  const touch = () => {
    dirty = true;
    if (ticking) return;
    ticking = true;
    const wait = Math.max(0, SNAP_EVERY - (Date.now() - lastSent));
    setTimeout(() => { ticking = false; if (dirty) { dirty = false; lastSent = Date.now(); emit(snapshot("running")); } }, wait);
  };

  const stopped = () => opts.signal?.aborted || Date.now() - t0 > opts.deadlineMs;

  // one worker: take the next ready item, run it, decide its fate, repeat
  async function worker() {
    for (;;) {
      if (stopped()) return;
      const i = queue.findIndex((q) => q.notBefore <= Date.now());
      if (i < 0) {
        if (queue.length === 0) return; // drained
        await sleep(25); // something is backing off, wait for it
        continue;
      }
      const [{ idx }] = queue.splice(i, 1);
      const it = items[idx];
      it.status = "running"; it.attempts += 1; it.error = null;
      const started = Date.now();
      touch();
      try {
        const result = await runPipeline(it.text, opts.chaos, (stage) => { it.stage = stage; touch(); });
        it.status = "done"; it.stage = "DONE"; it.ms = Date.now() - started; it.result = result;
        done += 1; log(`item#${idx} DONE ${it.ms}ms (${result.words} words)`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (err instanceof PermanentError) {
          it.status = "dead"; it.stage = "DEAD"; it.error = message; dead += 1;
          log(`item#${idx} → DEAD (${message})`);
        } else if (it.attempts >= MAX_ATTEMPTS) {
          it.status = "dead"; it.stage = "DEAD"; it.error = `exhausted: ${message}`; dead += 1;
          log(`item#${idx} → DEAD (exhausted after ${it.attempts} tries: ${message})`);
        } else {
          const wait = BACKOFF_MS * 2 ** (it.attempts - 1);
          it.status = "retrying"; it.stage = "QUEUED"; it.error = message; retries += 1;
          queue.push({ idx, notBefore: Date.now() + wait });
          log(`item#${idx} RETRY in ${wait}ms (${message}, try ${it.attempts}/${MAX_ATTEMPTS})`);
        }
      }
      touch();
    }
  }

  log(`run ${opts.id}: ${items.length} items, parallelism ${opts.parallelism}, chaos ${opts.chaos}%`);
  emit(snapshot("running"));
  await Promise.all(Array.from({ length: opts.parallelism }, worker));

  // whatever is still queued when the budget runs out is dead-lettered honestly
  for (const q of queue) {
    const it = items[q.idx];
    it.status = "dead"; it.stage = "DEAD"; it.error = opts.signal?.aborted ? "stream closed" : "deadline"; dead += 1;
  }
  queue.length = 0;
  log(`run ${opts.id} complete: ${done} done, ${dead} dead, ${retries} retries, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  const final = snapshot("complete");
  emit(final);
  return final;
}
