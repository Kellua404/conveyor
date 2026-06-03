# Conveyor — Build Plan (A→Z)

> ## ⏱ BUILD PROGRESS (live log — updated by the build session)
>
> **Status:** 🟢 **DEPLOYED & LIVE on Vercel — working end-to-end.**
> Live URL: https://conveyor-lyart.vercel.app · Repo (private): github.com/Kellua404/conveyor
>
> Verified on the live deploy: real QStash deliveries to `/api/worker` (QStash event log
> showed 25 DELIVERED 200 + 18 ERROR→RETRY from chaos), items move QUEUED→DONE with real
> retries + recovery (attempt badges hit 2–3), idempotent, honest telemetry, dead-letter
> clean. Two real findings handled:
>   1. **QStash free tier caps queue parallelism at 2** (parallelism≥3 → quota 500). Fixed:
>      dial clamped to 1–2 via `lib/constants.ts`, surfaced as "free-tier cap 2" in UI.
>   2. **Account is in region us-east-1** → must use `QSTASH_URL=https://qstash-us-east-1.upstash.io`
>      (canonical qstash.upstash.io 404s "user not found in region"). The user's `.env.local`
>      already had the correct regional URL; it's set in Vercel prod env too.
> Free-tier delivery is slow/bursty under chaos (exponential retry backoff + sustained-rate
> throttling) — honest behavior; UI handles it with the cold-start state. Single shared
> `conveyor` queue = global parallelism (PLAN §13), so concurrent runs share the backlog.
>
> **✅ MAKE-OR-BREAK MILESTONE PASSED (PLAN §11 step 2):** with creds in `.env.local`,
> dispatched 12 items @ parallelism 3 / chaos 25%. Verified live: QStash genuinely
> re-invokes `/api/worker` per item; real retries with backoff (attempt badges climbed to
> 3); idempotent claim; items recovered to DONE; honest telemetry (p50 1384ms, p95 grew
> to 2733ms as retried items took longer); board renders the real run with state-colored
> tiles. Local dev uses `.env.development.local` (gitignored) to point QStash at the
> `qstash-cli dev` server — production uses the real keys on Vercel.
> **Strategy note:** Steps 1–2 (live-deploy gate) need Upstash + Vercel accounts the
> build session can't create, so we built the *entire* app locally, type-check + build-pass
> it, verified both the idle and data-rendering UI, and hand off the deploy. Architecture
> follows §4–§9 verbatim; SDK confirmed against `@upstash/qstash@2.11.0`
> (queue/upsert/enqueueJSON/Receiver.verify all match).
>
> - [x] Skeleton: package.json, tsconfig, next/tailwind/postcss config, .gitignore, .env.local.example
> - [x] `lib/`: redis, qstash, run (claim/transitions), pipeline (stages+chaos+poison), format, samples
> - [x] API routes: `runs` (dispatch), `worker` (heart), `runs/[id]` (snapshot+JSON export), `runs/[id]/retry`
> - [x] `store/useRun.ts` (polling store)
> - [x] Layout + fonts (Space Grotesk + JetBrains Mono via next/font) + tokens (globals.css)
> - [x] Components: Console, Board, Lane, ItemTile, Telemetry (w/ sparkline), Wire, DeadLetter, Receipt, Wordmark, About, StatusBar, ControlRoom
> - [x] Control-room page (`/`) + permalink page (`/run/[id]`)
> - [x] **Typecheck clean + ESLint clean + production build passes** (all routes dynamic, pages render)
> - [x] Verified UI renders: idle control room + (throwaway preview, since deleted) the
>       full running board — lanes, state-colored tiles, retry flash + attempt badge,
>       dead-letter tray, telemetry sparkline, color-coded wire. State-is-the-palette ✓.
> - [x] README (setup, local qstash-cli gotcha, deploy, free-tier notes) + .env.local.example
> - [x] A11y/motion baked in: reduced-motion (CSS + framer), aria-valuetext sliders,
>       aria-live status, sr-only tile state, focus rings, state never color-only.
> - [x] Creds in `.env.local` verified working (Redis round-trip + QStash token valid).
> - [x] **Local end-to-end loop proven** with `qstash-cli dev`.
> - [x] **Pushed to private GitHub repo** (github.com/Kellua404/conveyor).
> - [x] **Deployed to Vercel** with all 6 env vars (5 + regional `QSTASH_URL`) +
>       `CONVEYOR_APP_URL=https://conveyor-lyart.vercel.app`.
> - [x] **Smoke-tested on the live URL — confirmed working** (real deliveries, retries,
>       recovery; see status block above).
>
> **Local dev recipe:** terminal 1: `npx @upstash/qstash-cli dev` · terminal 2:
> `npm run dev` → http://localhost:3000. (`.env.development.local` wires QStash to the
> local dev server.)
>
> **Deploy/update recipe:** `vercel --prod --yes` (env vars already set on Vercel).
>
> ---

> The *how*. Read with `PRODUCT.md` (the *soul*) and the Phase-2 section of the
> root `PORTFOLIO_PLAN.md`. When a decision isn't covered here, decide in favor of
> `PRODUCT.md`. Reference-code blocks are marked **"reference — adapt"**: they exist
> so a build session never has to *guess* the hard parts. Adapt names/styling freely;
> keep the architecture.
>
> **Portfolio context:** B2, the 2nd backend project. B1 Resonance proved
> "real model server-side." Conveyor proves **distributed systems**. Different domain,
> different look (see §3). The Aurora method is the *bar*, not a template — Conveyor
> earns its own identity.

---

## §0 — North Star + the feeling to protect

**North Star:** *A real message queue (Upstash QStash) re-invokes our Vercel function
over HTTP for every item, with server-enforced concurrency, automatic retry-with-backoff,
idempotent state, and a dead-letter lane — there is no always-on worker, nothing is
faked, it costs $0, and you can watch the whole thing stay calm while you try to break
it.*

**Two feelings to protect (every tradeoff serves these):**
1. **"This is a real, resilient system."** The queue truly redelivers; failures and
   retries are real; the telemetry is honest. A backend engineer must *trust* it on sight.
2. **"It's calm — even under load."** A control room is unhurried *because* it's in
   control. Composed, deliberate motion; legible at 40 items and 30% chaos.

If a choice makes the system feel faked, or makes it feel frantic, it's the wrong choice.

---

## §1 — Goal & scope

**In scope (v1):**
- Dispatch a batch of **items** (paste lines OR generate N, capped at 50).
- Two operator dials: **parallelism** (1–5, server-enforced) and **chaos %** (0–40,
  injects transient failures).
- Each item flows through stages `QUEUED → FETCH → TRANSFORM → VALIDATE → DONE`, with a
  `DEAD-LETTER` lane for poison/exhausted items.
- Real serverless queue (QStash) + real Redis state machine + real retry/backoff + DLQ +
  idempotency.
- Live **board** (items animate between lanes), live **telemetry** (throughput, counts,
  p50/p95, retries), live **wire** event log.
- Manual **retry** of a dead item; **re-run** a whole batch.
- Real output: a **run receipt** (counts, latencies, success rate) — downloadable PNG +
  permalink + results JSON.

**Out of scope (v1):** accounts/auth, permanent storage (Redis TTL ok), outbound fetching
of user URLs (SSRF — work stays local/CPU-bound), batches > 50, a generic workflow
builder, exactly-once (we do idempotent at-least-once — the honest model), any paid
service. See §15 for stretch.

---

## §2 — Tech stack (with reasons)

| Choice | Why |
| ------ | --- |
| **Next.js 14+ (App Router), TypeScript** | API Route Handlers = our serverless backend on Vercel; one repo, one deploy. |
| **Upstash QStash** (`@upstash/qstash`) | The hero: an HTTP message queue that re-invokes our function with retries/backoff/delay + **queue parallelism** (backpressure). Serverless-native, **free tier**, no always-on worker. |
| **Upstash Redis** (`@upstash/redis`) | REST Redis that works from serverless functions. Holds run/item state, counters, event log. **Free tier**. |
| **Zustand** | Tiny client store for the polled snapshot + UI dials. |
| **Framer Motion** | Shared-layout animation = tiles gliding between lanes like cargo. |
| **Tailwind CSS** | Fast, consistent control-room styling with design tokens (§3). |
| **lucide-react** | Crisp technical icons (retry, alert, check, skull for DLQ). |
| **html-to-image** | Client-side PNG export of the run receipt ($0, no server render). |
| **Fonts: Space Grotesk + JetBrains Mono** | Engineered/industrial display + true console mono. Distinct from Resonance (Fraunces/Geist Mono) & Aurora (Instrument Serif/IBM Plex Mono) — never reuse a pairing. Load via `next/font/google`. |

> **No paid services.** QStash + Redis are free-tier; everything else is local compute.
> The "$0, serverless, no rented worker" fact is surfaced in the UI as a flex.

---

## §3 — Design language

**Mood:** dispatch control room at 2am (see `PRODUCT.md`). Cool, precise, awake, calm.

**Color tokens** (dark, cool graphite base; *state is the palette*):
```
--bg:        #0b0d11   /* near-black cool ink */
--surface:   #11141a   /* lifted panel */
--surface-2: #161a22   /* lane / card */
--line:      #232834   /* hairline grid + borders */
--text:      #e7ebf2   /* primary */
--text-dim:  #8b93a3   /* labels, secondary */
--accent:    #f5a623   /* SIGNAL AMBER — things in motion */

/* job-state colors (the core visual language) */
--state-queued:   #5b6573   /* slate  */
--state-running:  #f5a623   /* amber (pulses) */
--state-done:     #3fb98c   /* green  */
--state-retrying: #9b7bf0   /* violet (flash on retry) */
--state-dead:     #e5544b   /* red    */
```
**Type scale:** Space Grotesk for display/UI (wordmark in 700, tight tracking; headings
600). JetBrains Mono for *all* numbers, IDs, telemetry, and the wire log. Numbers should
feel like instrument readouts.

**Layout (desktop, single screen):**
```
┌───────────────────────────────────────────────────────────────┐
│  CONVEYOR  ▸ dispatch control            [serverless · $0 · iad1]│  header + env proof
├───────────────┬───────────────────────────────────────────────┤
│  CONSOLE      │  BOARD                                          │
│  items: [50]  │   QUEUED   FETCH   TRANSFORM   VALIDATE   DONE   │
│  parallel:[3] │   ▢▢▢      ▢▢      ▢           ▢▢         ▢▢▢▢   │  tiles ride lanes
│  chaos:  [25%]│   ─────────────────────────────────────────────│
│  [ DISPATCH ] │   DEAD-LETTER ▣▣            [retry] [retry]      │
├───────────────┼───────────────────────────────────────────────┤
│  TELEMETRY    │  WIRE                                           │
│  in-flight 7  │  t+0.42s item#7 TRANSFORM attempt=2 RETRY …     │  mono event stream
│  thrpt 6.1/s  │  t+0.51s item#3 DONE 214ms                      │
│  p50 180 p95… │  t+0.55s item#9 VALIDATE → DEAD (too short)     │
└───────────────┴───────────────────────────────────────────────┘
```
Mobile: console collapses to a top sheet; board lanes stack vertically; wire below.

**Motion law:** tiles move between lanes with `layout` spring (stiffness ~140, damping
~20 — *settled*, not bouncy). Running tiles breathe (amber). Retry = one violet flash.
Nothing strobes. Respect `prefers-reduced-motion` (cross-fade instead of travel).

---

## §4 — THE HARD PART, as reference code (the serverless pipeline)

> This is what a weaker model gets wrong: QStash wiring, signature verification, the
> idempotent Redis state machine, and transient-vs-permanent failure handling. Written
> near-verbatim. **Reference — adapt.**

### §4.1 `lib/redis.ts`
```ts
import { Redis } from "@upstash/redis";
// Reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN from env.
export const redis = Redis.fromEnv();
```

### §4.2 `lib/qstash.ts`
```ts
import { Client, Receiver } from "@upstash/qstash";

export const QUEUE_NAME = "conveyor";
export const MAX_ATTEMPTS = 4; // total tries before we dead-letter an item

export const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

// QStash must call a PUBLICLY reachable URL. On Vercel, VERCEL_URL is the deploy host
// (no protocol). Locally, use the QStash CLI dev server (see §10) which CAN reach
// localhost. Prefer an explicit override for the stable prod domain.
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
```

### §4.3 `lib/run.ts` — the idempotent state machine
```ts
import { redis } from "./redis";

// Keys:  run:{id}            -> hash  { total, done, dead, parallelism, chaos, createdAt, text? }
//        run:{id}:item:{i}   -> hash  { idx, status, stage, attempts, startedAt, ms, result, error }
//        run:{id}:events     -> list  (capped event log)
//        run:{id}:ids        -> list  (item ids, for snapshot fan-out)
export const RUN_TTL = 60 * 60 * 24; // 24h

export type ItemStatus = "queued" | "running" | "done" | "retrying" | "dead";
export const itemKey = (run: string, i: string) => `run:${run}:item:${i}`;

// Atomic claim: only one invocation may move an item out of queued/retrying into running.
// Returns the new attempt number, or -1 if the item is NOT claimable (already running/
// done/dead) — i.e. a duplicate delivery we should simply ack. This is what makes the
// worker idempotent under QStash's at-least-once delivery.
const CLAIM = `
local s = redis.call('HGET', KEYS[1], 'status')
if s == 'queued' or s == 'retrying' then
  local a = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
  redis.call('HSET', KEYS[1], 'status', 'running', 'startedAt', ARGV[1])
  return a
end
return -1`;

export async function claim(run: string, i: string): Promise<number> {
  return (await redis.eval(CLAIM, [itemKey(run, i)], [Date.now().toString()])) as number;
}

export async function logEvent(run: string, line: string) {
  await redis.lpush(`run:${run}:events`, `${Date.now()}|${line}`);
  await redis.ltrim(`run:${run}:events`, 0, 199);
}

export async function markDone(run: string, i: string, ms: number, result: unknown) {
  await redis.hset(itemKey(run, i), { status: "done", stage: "DONE", ms, result: JSON.stringify(result) });
  await redis.hincrby(`run:${run}`, "done", 1);
  await logEvent(run, `item#${i} DONE ${ms}ms`);
}

export async function markRetrying(run: string, i: string, reason: string) {
  await redis.hset(itemKey(run, i), { status: "retrying", error: reason });
  await logEvent(run, `item#${i} RETRY (${reason})`);
}

export async function markDead(run: string, i: string, reason: string) {
  await redis.hset(itemKey(run, i), { status: "dead", stage: "DEAD", error: reason });
  await redis.hincrby(`run:${run}`, "dead", 1);
  await logEvent(run, `item#${i} → DEAD (${reason})`);
}

export async function setStage(run: string, i: string, stage: string) {
  await redis.hset(itemKey(run, i), { stage });
}
```

### §4.4 `app/api/runs/route.ts` — submit (create run + enqueue)
```ts
import { NextResponse } from "next/server";
import { qstash, QUEUE_NAME, MAX_ATTEMPTS, workerUrl } from "@/lib/qstash";
import { redis } from "@/lib/redis";
import { RUN_TTL, itemKey } from "@/lib/run";
import { nanoid } from "nanoid";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const { lines, count, parallelism = 3, chaos = 0 } = await req.json();
  // items: either user-pasted lines, or N generated samples. Cap hard.
  const items: string[] = (lines?.length ? lines : genSamples(count ?? 20)).slice(0, 50);
  const runId = nanoid(10);

  // 1) seed run + item state in Redis
  await redis.hset(`run:${runId}`, {
    total: items.length, done: 0, dead: 0,
    parallelism, chaos, createdAt: Date.now(),
  });
  const pipe = redis.pipeline();
  items.forEach((text, idx) => {
    pipe.hset(itemKey(runId, String(idx)), {
      idx, text, status: "queued", stage: "QUEUED", attempts: 0,
    });
    pipe.rpush(`run:${runId}:ids`, String(idx));
  });
  await pipe.exec();
  await redis.expire(`run:${runId}`, RUN_TTL);

  // 2) set backpressure, then enqueue one QStash message per item
  const queue = qstash.queue({ queueName: QUEUE_NAME });
  await queue.upsert({ parallelism: Math.min(5, Math.max(1, parallelism)) });
  await Promise.all(items.map((_, idx) =>
    queue.enqueueJSON({
      url: workerUrl(),
      body: { runId, itemId: String(idx) },
      retries: MAX_ATTEMPTS, // QStash is willing to redeliver up to this many times
    })
  ));

  return NextResponse.json({ runId });
}

function genSamples(n: number): string[] {
  const pool = ["the river remembers", "a", "quiet engine at midnight", "ship it",
    "x", "logistics is poetry in motion", "calm under load", "retry and recover"];
  return Array.from({ length: n }, (_, i) => pool[i % pool.length] + (i % 5 === 0 ? "" : ` ${i}`));
}
```

### §4.5 `app/api/worker/route.ts` — THE HEART (QStash invokes this per item)
```ts
import { receiver } from "@/lib/qstash";
import { claim, markDone, markRetrying, markDead } from "@/lib/run";
import { runPipeline, PermanentError } from "@/lib/pipeline";
import { MAX_ATTEMPTS } from "@/lib/qstash";

export const runtime = "nodejs";
export const maxDuration = 60;

const ACK = () => new Response("ok", { status: 200 });          // tell QStash: done, stop
const RETRY = () => new Response("retry", { status: 500 });     // tell QStash: redeliver

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("upstash-signature") ?? "";
  const valid = await receiver.verify({ signature, body }).catch(() => false);
  if (!valid) return new Response("bad signature", { status: 401 });

  const { runId, itemId } = JSON.parse(body) as { runId: string; itemId: string };

  // Idempotency: only one invocation claims the item. Duplicates just ack.
  const attempt = await claim(runId, itemId);
  if (attempt < 0) return ACK();

  const t0 = Date.now();
  try {
    const result = await runPipeline(runId, itemId); // stages + injected chaos (§5)
    await markDone(runId, itemId, Date.now() - t0, result);
    return ACK();
  } catch (err: any) {
    if (err instanceof PermanentError) {           // poison: never retry
      await markDead(runId, itemId, err.message);
      return ACK();
    }
    if (attempt >= MAX_ATTEMPTS) {                  // transient, but out of tries
      await markDead(runId, itemId, `exhausted: ${err.message}`);
      return ACK();
    }
    await markRetrying(runId, itemId, err.message); // transient: let QStash back off + redeliver
    return RETRY();
  }
}
```

### §4.6 `app/api/runs/[id]/route.ts` — the polled snapshot
```ts
import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  const run = await redis.hgetall<Record<string, string>>(`run:${id}`);
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });

  const ids = (await redis.lrange(`run:${id}:ids`, 0, -1)) as string[];
  const pipe = redis.pipeline();
  ids.forEach((i) => pipe.hgetall(`run:${id}:item:${i}`));
  const items = (await pipe.exec()) as any[];

  const events = (await redis.lrange(`run:${id}:events`, 0, 49)) as string[];
  const total = Number(run.total);
  const done = Number(run.done ?? 0);
  const dead = Number(run.dead ?? 0);
  const terminal = done + dead;
  const elapsed = (Date.now() - Number(run.createdAt)) / 1000;
  const durations = items.filter((x) => x?.ms).map((x) => Number(x.ms)).sort((a, b) => a - b);

  return NextResponse.json({
    id, total, done, dead,
    status: terminal >= total ? "complete" : "running",
    parallelism: Number(run.parallelism), chaos: Number(run.chaos),
    throughput: done > 0 ? +(done / Math.max(elapsed, 0.001)).toFixed(2) : 0,
    p50: pct(durations, 0.5), p95: pct(durations, 0.95),
    inFlight: items.filter((x) => x?.status === "running").length,
    items: items.map((x) => ({ idx: Number(x.idx), status: x.status, stage: x.stage,
      attempts: Number(x.attempts ?? 0), ms: x.ms ? Number(x.ms) : null,
      error: x.error ?? null, text: x.text })),
    events: events.map((e) => { const [ts, ...m] = e.split("|"); return { ts: Number(ts), msg: m.join("|") }; }),
  });
}
const pct = (s: number[], p: number) => s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0;
```

---

## §5 — The work + chaos + the live client (second system, as reference code)

### §5.1 `lib/pipeline.ts` — real per-stage work + failure injection
```ts
import { createHash } from "crypto";
import { redis } from "./redis";
import { setStage, logEvent, itemKey } from "./run";

export class PermanentError extends Error {}   // poison → DLQ, never retried
class TransientError extends Error {}          // chaos → retried with backoff

const STAGES = ["FETCH", "TRANSFORM", "VALIDATE"] as const;

// Genuine (cheap, local, $0) CPU work per item — no fake setTimeout, no outbound calls.
export async function runPipeline(run: string, i: string) {
  const item = await redis.hgetall<{ text: string }>(itemKey(run, i));
  const text = (item?.text ?? "").trim();
  const chaos = Number((await redis.hget(`run:${run}`, "chaos")) ?? 0);

  let normalized = "";
  let analysis: { words: number; chars: number; readability: number; keyword: string } | null = null;

  for (const stage of STAGES) {
    await setStage(run, i, stage);
    // inject a transient failure with probability = chaos% at a random stage
    if (Math.random() * 100 < chaos) throw new TransientError(`flaky at ${stage}`);
    await tick();

    if (stage === "FETCH") {
      normalized = text.toLowerCase().replace(/\s+/g, " ");
    } else if (stage === "TRANSFORM") {
      const words = normalized.split(" ").filter(Boolean);
      analysis = {
        words: words.length, chars: normalized.length,
        readability: +(normalized.length / Math.max(words.length, 1)).toFixed(2),
        keyword: words.sort((a, b) => b.length - a.length)[0] ?? "",
      };
    } else if (stage === "VALIDATE") {
      if ((analysis?.words ?? 0) < 2) throw new PermanentError("too short"); // poison
    }
  }
  await logEvent(run, `item#${i} processed (${analysis?.words} words)`);
  return { ...analysis, checksum: createHash("sha256").update(normalized).digest("hex").slice(0, 12) };
}

const tick = () => new Promise((r) => setTimeout(r, 60 + Math.random() * 140)); // visible, not fake-long
```
> The `tick()` delay is *only* to make stage transitions watchable on the belt — the work
> (normalize/analyze/checksum) is real. Keep it small; the demo, not the delay, is the point.

### §5.2 `store/useRun.ts` — polling the snapshot (rock-solid on serverless)
```ts
import { create } from "zustand";

type Snapshot = { id: string; status: "running" | "complete"; total: number; done: number;
  dead: number; throughput: number; p50: number; p95: number; inFlight: number;
  parallelism: number; chaos: number; items: any[]; events: { ts: number; msg: string }[] };

type State = { snap: Snapshot | null; dispatch: (o: any) => Promise<string>; watch: (id: string) => void; stop: () => void };
let timer: any = null;

export const useRun = create<State>((set, get) => ({
  snap: null,
  dispatch: async (opts) => {
    const { runId } = await (await fetch("/api/runs", { method: "POST", body: JSON.stringify(opts) })).json();
    get().watch(runId);
    return runId;
  },
  watch: (id) => {
    get().stop();
    const poll = async () => {
      const snap = await (await fetch(`/api/runs/${id}`)).json();
      set({ snap });
      if (snap.status === "complete") get().stop();        // stop when drained
    };
    poll();
    timer = setInterval(poll, 500);                         // 500ms = smooth belt, tiny free-tier cost
  },
  stop: () => { if (timer) clearInterval(timer); timer = null; },
}));
```

### §5.3 Board animation (the belt)
Render five lane columns + a dead-letter tray. Each item is one `<ItemTile>` keyed by
`idx`. Place each tile in the column matching `item.stage` (DEAD → tray). Wrap tiles in
Framer Motion with a shared `layoutId={idx}` so moving a tile to another lane animates as
a *glide*. Color the tile by `item.status` (§3 tokens). `retrying` → one violet flash via
`animate` key bump. `prefers-reduced-motion` → cross-fade, no travel.

---

## §6 — Component breakdown

- `app/page.tsx` — control room: `<Console>` + `<Board>` + `<Telemetry>` + `<Wire>`, wired to `useRun`.
- `app/run/[id]/page.tsx` — permalink: hydrate `watch(id)`; if `complete`, show `<Receipt>`.
- `Console` — items input (paste / count), `parallelism` slider (1–5), `chaos` slider (0–40%), `DISPATCH`. Disabled while a run is in flight; `RE-RUN` after.
- `Board` / `Lane` / `ItemTile` — the belt (§5.3). Tile shows `#idx`, mini stage dot, attempt badge if >1.
- `Telemetry` — in-flight, done/dead counters, throughput value + tiny sparkline, p50/p95, total retries, parallelism + chaos echo, env proof line.
- `Wire` — reverse-chronological mono event stream from `snap.events`; auto-scroll; color-code RETRY (violet) / DEAD (red) / DONE (green).
- `DeadLetter` — tray of dead tiles, each with a `retry` button → `POST /api/runs/[id]/retry`.
- `Receipt` — summary card (total, done, dead, success rate, p50/p95, throughput, settings) + `Download PNG` (html-to-image) + `Copy permalink` + `Download results JSON`.
- `Wordmark` — "CONVEYOR" in Space Grotesk 700, tight tracking, a small belt glyph.

---

## §7 — State / data model + key systems

- **Server truth = Redis** (shapes in §4.3). State is *derivable*: run completeness =
  `done + dead >= total`; no coordinator process needed (pure serverless).
- **Client truth = `useRun` snapshot** (polled). UI is a pure function of the snapshot +
  the console dials.
- **Idempotency** via the `claim` Lua script (§4.3) — the linchpin for at-least-once.
- **Retry route** `app/api/runs/[id]/retry/route.ts`: reset a dead item to `queued`
  (decrement `dead`), then `queue.enqueueJSON` it again — same path as dispatch.

---

## §8 — The "real output" system

1. **Run receipt PNG** — `<Receipt>` rendered node → `html-to-image` `toPng` → download.
   A keepable artifact: counts, success rate, p50/p95, throughput, parallelism, chaos.
2. **Permalink** — `/run/{id}` (Redis TTL 24h). Re-opens the run; shows live board if
   still running, receipt if complete.
3. **Results JSON** — `GET /api/runs/[id]?format=json` (or a button) → the per-item
   results (checksum, analysis) as a downloadable file. Proof the work was real.

---

## §9 — File / folder structure
```
conveyor/
  app/
    layout.tsx                       # fonts, <body> tokens, metadata
    page.tsx                         # control room
    run/[id]/page.tsx                # permalink + receipt
    api/
      runs/route.ts                  # §4.4 POST submit
      runs/[id]/route.ts             # §4.6 GET snapshot
      runs/[id]/retry/route.ts       # POST manual retry of a dead item
      worker/route.ts                # §4.5 the heart (QStash → here)
  lib/
    redis.ts                         # §4.1
    qstash.ts                        # §4.2
    run.ts                           # §4.3 state machine
    pipeline.ts                      # §5.1 work + chaos
    format.ts                        # ms / pct / throughput formatting
  store/useRun.ts                    # §5.2
  components/
    Console.tsx  Board.tsx  Lane.tsx  ItemTile.tsx
    Telemetry.tsx  Wire.tsx  DeadLetter.tsx  Receipt.tsx  Wordmark.tsx
  tailwind.config.ts  next.config.mjs  .env.local.example  README.md
```

---

## §10 — Setup commands
```bash
npx create-next-app@latest conveyor --ts --tailwind --app --eslint
cd conveyor
npm i @upstash/qstash @upstash/redis zustand framer-motion lucide-react nanoid html-to-image

# Free accounts (both $0): create an Upstash Redis DB and enable QStash, then copy keys.
# .env.local:
#   UPSTASH_REDIS_REST_URL=...
#   UPSTASH_REDIS_REST_TOKEN=...
#   QSTASH_TOKEN=...
#   QSTASH_CURRENT_SIGNING_KEY=...
#   QSTASH_NEXT_SIGNING_KEY=...
#   CONVEYOR_APP_URL=          # leave empty locally; set to prod domain on Vercel (optional)

# LOCAL DEV — QStash can't reach localhost by default. Run its dev server, which CAN,
# and prints local QSTASH_* values to use while developing:
npx @upstash/qstash-cli dev
# (point QSTASH_TOKEN/SIGNING keys at the dev server's output during local dev)

npm run dev
```
> **The one true gotcha:** QStash invokes a *public URL*. In prod that's the Vercel
> deployment (`VERCEL_URL` / `CONVEYOR_APP_URL`). Locally you MUST use `qstash-cli dev`
> (or a tunnel) or the worker is never called. Get this right at build step 1 (§11).

---

## §11 — Build order with milestones

> **Prove the queue loop on a live deploy FIRST** — same discipline as Resonance proving
> the engine before the UI. The risk is the serverless wiring, not the pixels.

1. **Skeleton + secrets.** `create-next-app`, install, add `.env.local`, `lib/redis.ts`,
   `lib/qstash.ts`. Push to GitHub (private) → import to Vercel → add the 5 env vars in
   Vercel → confirm it builds & deploys.
2. **Prove the loop (the make-or-break).** Minimal `/api/runs` that enqueues ONE message;
   `/api/worker` that verifies the signature and writes `worked:true` to Redis. Dispatch
   on the **live Vercel URL**, confirm Redis shows the write. *Do not proceed until a real
   QStash delivery hits the live worker.* Then verify locally via `qstash-cli dev`.
3. **State machine + pipeline.** Add `lib/run.ts` (claim/transitions) + `lib/pipeline.ts`
   (stages + chaos + poison). Worker runs the full item lifecycle. Verify in Redis:
   done/dead counts, attempts increment, retries actually redeliver.
4. **Snapshot API + polling store.** `/api/runs/[id]` + `store/useRun.ts`. Log snapshots
   to console; confirm counts/throughput/p50/p95 move as a batch drains.
5. **The Board.** Lanes + tiles + Framer layout animation. Watch items glide QUEUED→DONE.
6. **Console dials.** Items input, parallelism, chaos. Confirm parallelism caps in-flight
   (raise N, set parallelism=1, watch them go one at a time) and chaos triggers retries.
7. **Telemetry + Wire.** Live counters, sparkline, p50/p95, event stream with color codes.
8. **Dead-letter + manual retry.** Tray + retry route + re-run.
9. **Receipt + permalink + JSON export** (§8).
10. **Polish:** motion law (§3), reduced-motion, responsive, env-proof line, empty/error
    states, cold-start grace.
11. **A11y + perf pass** (§13, §14). **Definition of Done** (§17). **Deploy + close loop** (§18).

Milestones 1–3 are the project. If they work on a live deploy, the rest is craft.

---

## §12 — Interaction & motion spec

- **Dispatch:** console buttons settle (no bounce); board fills from QUEUED lane.
- **Lane travel:** spring stiffness ~140 / damping ~20; ~280ms glides. Staggered naturally
  by real timing, never artificially.
- **Running:** soft amber breathing (opacity/scale ±, 1.6s ease-in-out loop).
- **Retry:** single violet flash + attempt badge increments. Never strobe.
- **Done:** quick green settle + check. **Dead:** drop to tray, red, slight desaturate.
- **Telemetry numbers:** tween value changes (~200ms) so readouts feel instrument-smooth.
- **Reduced motion:** all travel → cross-fades; breathing off; flashes → static color.

---

## §13 — Accessibility, fallback, robustness

- WCAG AA contrast on all state colors against `--surface-2` (verify amber/violet/red).
- State is never color-only: each tile also shows a stage label/icon + attempt count;
  the wire log states transitions in words.
- Full keyboard path: dials, dispatch, retry buttons, downloads. Visible focus rings.
- Sliders are real `<input type=range>` with `aria-valuetext` ("parallelism 3", "chaos 25%").
- `aria-live="polite"` on a concise status ("18 of 30 done, 2 dead").
- **Robustness / the real risks:**
  - *QStash can't reach the worker* → nothing moves. Mitighome: §10 gotcha + step 2 gate;
    surface a "waiting for first delivery…" state so a stuck deploy is obvious, not silent.
  - *At-least-once duplicates* → handled by the `claim` script (idempotent).
  - *Free-tier limits* (QStash messages/day, Redis commands) → cap N at 50, poll at 500ms,
    TTL runs at 24h; note limits in README.
  - *Cold start* → first dispatch may lag; show a calm "spinning up" state, never a fake bar.
  - *Queue parallelism is queue-global* (single `conveyor` queue) → for a single-user demo,
    fine; note it. (Stretch: queue-per-run, mind free-tier queue count.)

---

## §14 — Performance targets

- Lighthouse ≥ 90 (perf/a11y/best-practices). Board smooth at 50 tiles (use `layout`, avoid
  re-mounting tiles; key by idx; memoize lanes).
- Snapshot payload small (tail 50 events, compact item shape). Poll 500ms; stop on complete.
- Worker p50 well under `maxDuration`; real work is milliseconds + the small visible tick.
- No layout thrash: tiles use transform-based motion only.

---

## §15 — Stretch goals (captured, not blocking)

SSE/WebSocket live updates (replace polling); queue-per-run isolated parallelism; a
real **QStash schedule** (cron) demo lane; `@vercel/og` for rich permalink OG receipt
images; priority lanes / weighted items; pause/resume a run; configurable pipeline stages;
exponential-backoff visualization (show the next-retry countdown per item); a "replay" of a
completed run; swap the toy work for a real CPU task (e.g. server-side image thumbnailing
with `sharp`) to bridge toward Lens (B3).

---

## §16 — Ready-to-use copy

- **Wordmark:** `CONVEYOR`
- **Tagline (header):** `a job pipeline you can watch`
- **Env proof line:** `serverless · QStash queue · Upstash Redis · no always-on worker · $0`
- **Console labels:** `ITEMS` · `PARALLELISM` · `CHAOS` · `DISPATCH` · `RE-RUN`
- **Lane labels:** `QUEUED` `FETCH` `TRANSFORM` `VALIDATE` `DONE` `DEAD-LETTER`
- **Telemetry labels:** `IN FLIGHT` `DONE` `DEAD` `THROUGHPUT` `P50` `P95` `RETRIES`
- **Empty state:** `Idle. Dispatch a batch to bring the line up.`
- **Spinning up:** `Cold start — waiting for the first delivery from the queue…`
- **Chaos hint:** `Raise chaos to watch the system retry and recover.`
- **About blurb (footer/modal):** `Every item is a real message on a real queue (Upstash
  QStash) that re-invokes this Vercel function over HTTP — with server-enforced
  concurrency, automatic retry/backoff, idempotent state, and a dead-letter lane. No
  always-on worker. No paid services. Crank up the chaos and try to break it.`

---

## §17 — Definition of Done

- [ ] On the **live Vercel URL**, dispatching a batch causes real QStash deliveries to the
      worker; items move QUEUED→DONE on the board.
- [ ] **Parallelism** visibly caps in-flight items (set 1 vs 5, watch the difference).
- [ ] **Chaos** triggers real retries (violet flashes, attempt badges climb) and the run
      still drains/recovers.
- [ ] **Poison** items (too short) go straight to **DEAD-LETTER**; **exhausted** retries
      also land there; **manual retry** works.
- [ ] Telemetry is honest and live: throughput, p50/p95, counts, retries.
- [ ] Wire log streams real transitions, color-coded.
- [ ] Receipt PNG downloads; permalink reopens the run; results JSON downloads.
- [ ] Idempotent under duplicate delivery (no double-counts).
- [ ] AA contrast, keyboard-complete, `prefers-reduced-motion` honored, responsive.
- [ ] Lighthouse ≥ 90. No console errors. `.env.local.example` + README accurate.
- [ ] Reads as **calm + real** — the two feelings in §0.

---

## §18 — Deploy + close the loop

1. `git init`, commit. Confirm `.gitignore` excludes `.env*`, `node_modules`, `.next`.
   **Audit for secrets** before pushing (per the github-push-rules: keys live only in
   `.env.local` / Vercel env, never committed).
2. Create **private** repo `github.com/Kellua404/conveyor` (default private), push.
3. Import to **Vercel**; add all 5 env vars (`UPSTASH_REDIS_REST_URL/TOKEN`, `QSTASH_TOKEN`,
   `QSTASH_CURRENT/NEXT_SIGNING_KEY`); optionally set `CONVEYOR_APP_URL` to the prod domain.
4. Deploy. **Smoke-test on the live URL:** dispatch 30 items @ parallelism 3, chaos 25% —
   confirm retries, recovery, dead-letter, receipt.
5. Update root `PORTFOLIO_PLAN.md`: mark **Conveyor ✅ Done** with repo + live URL; set
   next action to **Lens (B3)**.
6. Add Conveyor's live URL to the portfolio hub when it's built.

> **Build-session note:** before relying on any SDK signature in §4–§5, confirm the
> current `@upstash/qstash` API (Client/Queue/Receiver method names can shift between
> majors). The *architecture* here is correct; verify the exact method names against the
> installed version, like Resonance's "confirm the model id" note.
