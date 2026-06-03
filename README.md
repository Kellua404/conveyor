# Conveyor

**A job pipeline you can watch.** Dispatch a batch of work and see every item ride the
belt through each stage — fetch, transform, validate — failing, retrying, and recovering
in real time. Built entirely serverless on Vercel: **no always-on worker, no paid
services, $0**.

> Portfolio project **B2** (backend). Where Resonance (B1) proved *"a real model
> server-side,"* Conveyor proves *distributed systems*: queues, bounded concurrency,
> retry/backoff, dead-letter handling, idempotency, and at-least-once delivery — done the
> serverless-native way.

---

## How it actually works

Every item is a **real message on a real queue** ([Upstash QStash](https://upstash.com/docs/qstash)).
QStash re-invokes the Vercel function `POST /api/worker` over HTTP for each item, with:

- **Server-enforced concurrency** — every message is published with a shared QStash
  **flow-control key**, so QStash caps how many run at once (`parallelism` = backpressure)
  while retrying each message **independently** — no FIFO head-of-line blocking, so one
  retrying item never freezes the rest. Set parallelism = 1 vs 2 to see the cap. (The
  QStash **free tier caps parallelism at 2**, so the dial is 1–2 — enough to see
  backpressure while honoring the "$0, no paid services" constraint.)
- **Automatic retry with backoff** — a transient failure returns `500`; QStash redelivers
  with backoff. The **chaos %** dial injects transient failures so you can watch the
  system recover.
- **Idempotent state** — an atomic Redis Lua `claim` script ensures only one invocation
  processes an item, so QStash's at-least-once delivery never double-counts.
- **Dead-letter lane** — *poison* items (too short to validate) go straight to DEAD;
  items that exhaust their retries land there too. Each is manually retryable.

State lives in **Upstash Redis** (REST, serverless-friendly). The UI polls a compact
snapshot every 500ms and renders the board, telemetry, and wire log as a pure function of
that snapshot. There is **no long-running process** — the whole pipeline is stitched from
short-lived serverless invocations.

```
QUEUED → FETCH → TRANSFORM → VALIDATE → DONE        (+ DEAD-LETTER lane)
```

The per-item work (normalize → word/readability analysis → SHA-256 checksum) is **real
CPU work**, not a faked `setTimeout`. A small 60–200ms tick per stage exists only so the
belt is watchable.

---

## Tech stack

| Choice | Why |
| --- | --- |
| **Next.js 14 (App Router), TypeScript** | API Route Handlers = the serverless backend; one repo, one deploy. |
| **Upstash QStash** | The hero: an HTTP message queue with retries/backoff + queue parallelism. Serverless-native, free tier. |
| **Upstash Redis** | REST Redis usable from serverless functions. Holds run/item state, counters, event log. Free tier. |
| **Zustand** | Tiny client store for the polled snapshot + UI dials. |
| **Framer Motion** | Shared-layout animation — tiles glide between lanes like cargo. |
| **Tailwind CSS** | Control-room styling with design tokens. |
| **html-to-image** | Client-side PNG export of the run receipt ($0, no server render). |
| **Space Grotesk + JetBrains Mono** | Engineered display + true console mono. |

---

## Local development

> **The one true gotcha:** QStash invokes a **public URL**. It cannot reach `localhost`
> on its own. Locally you must run the QStash CLI dev server, which *can* reach localhost
> and prints local signing keys to use.

```bash
# 1. Install
npm install

# 2. Configure secrets
cp .env.local.example .env.local
#   Fill UPSTASH_REDIS_REST_URL / _TOKEN from the Upstash console.

# 3. Start the QStash dev server (reaches localhost; prints local QSTASH_* values)
npx @upstash/qstash-cli dev
#   Copy the printed QSTASH_TOKEN + signing keys into .env.local.
#   Leave CONVEYOR_APP_URL empty locally.

# 4. Run the app
npm run dev      # http://localhost:3000
```

Then dispatch a batch (e.g. 30 items, parallelism 3, chaos 25%) and watch the belt.

### Scripts

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — Next.js ESLint

---

## Deploy (Vercel)

1. Push to a **private** GitHub repo. (`.gitignore` already excludes `.env*` — secrets
   live only in `.env.local` / Vercel env, never committed.)
2. Import the repo into **Vercel**.
3. Add the env vars in Vercel: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
   `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, and — **if your
   Upstash account is in a non-default region** — `QSTASH_URL` (e.g.
   `https://qstash-us-east-1.upstash.io`; see Troubleshooting). Set `CONVEYOR_APP_URL` to
   the production domain (otherwise `VERCEL_URL` is used).
   > Use the **production** QStash token + signing keys here, *not* the dev-server ones.
4. Deploy (`vercel --prod` from the CLI, or via the Git integration), then smoke-test on
   the live URL: dispatch ~12 items @ parallelism 2, chaos ~10% — confirm items drain,
   retries (violet flashes) recover, dead-letter, and the receipt.

---

## Free-tier notes / limits

- Batches are capped at **50 items**; queue **parallelism caps at 2** (QStash free-tier
  quota); the snapshot poll runs at **500ms**; runs **TTL at 24h** in Redis — all to stay
  comfortably inside free tiers.
- Queue parallelism is **queue-global** (single `conveyor` queue) — fine for a
  single-user demo. (Stretch: queue-per-run.)
- Cold starts: the first dispatch may lag while the function spins up; the UI shows a calm
  "Cold start — waiting for the first delivery…" state, never a fake progress bar.

---

## Troubleshooting / Operations

> A field guide to the gotchas already hit, so future changes are quick to debug.
> Diagnose QStash directly via its REST API at **your `QSTASH_URL`** (see below):
> `GET /v2/queues/conveyor` (depth = `lag`) and `GET /v2/events?queueName=conveyor`
> (per-delivery `state`/`responseStatus`), both with `Authorization: Bearer $QSTASH_TOKEN`.

**Dispatch returns 500 with `quota maxParallelism`.**
The QStash **free tier caps queue parallelism at 2**. The dial is clamped to 1–2 in
`lib/constants.ts` (`MAX_PARALLELISM`). If you upgrade the QStash plan, raise that constant.

**Dispatch returns 500 / enqueue fails with `user not found in this region`.**
Your Upstash account lives in a specific region and the **canonical `https://qstash.upstash.io`
won't route to it**. Set `QSTASH_URL` to the regional endpoint (e.g.
`https://qstash-us-east-1.upstash.io`) — the SDK reads `QSTASH_URL` as its base URL. This
must be set in `.env.local` **and** in Vercel's production env. (Find the right URL in the
Upstash QStash console's `.env` snippet.)

**Items enqueue but nothing moves on the board for a while, then drains in bursts.**
Two causes, both addressed:
- *Head-of-line blocking (fixed):* we originally used an **ordered QStash queue**
  (`queue.enqueueJSON`), where a single retrying message blocks everything behind it during
  its backoff — under chaos the board looked frozen. Now we publish with a **flow-control
  key** (`qstash.publishJSON({ flowControl: { key, parallelism } })`), which keeps the
  concurrency cap but retries each message independently. If you ever reintroduce a queue,
  expect this behavior back.
- *Free-tier delivery (inherent):* the cold start before the first delivery can take ~1 min,
  and free-tier throughput is modest. Keep `DEFAULT_CHAOS` low and batches small; a paid
  QStash plan raises the limits.

**QStash calls the worker but it 401s (`bad signature`) every time.**
The signing keys are wrong/mismatched. Ensure `QSTASH_CURRENT_SIGNING_KEY` /
`QSTASH_NEXT_SIGNING_KEY` in Vercel match the **production** keys (not the `qstash-cli dev`
keys, which only belong in `.env.development.local`).

**QStash can't reach the worker at all (no `POST /api/worker` in Vercel logs).**
`CONVEYOR_APP_URL` must be a **public** URL. In prod that's the Vercel domain; locally you
must run `npx @upstash/qstash-cli dev` (QStash can't reach `localhost` otherwise). Also
confirm Vercel **Deployment Protection** isn't gating the production URL.

**Clear a stuck/backlogged queue (e.g. after heavy testing):**
`curl -X DELETE "$QSTASH_URL/v2/queues/conveyor" -H "Authorization: Bearer $QSTASH_TOKEN"`
— the app recreates the queue (via `upsert`) on the next dispatch.

**Redeploy after a change:** `vercel --prod --yes` (env vars persist on Vercel). Env vars
live only in `.env.local` (local) and Vercel's encrypted store — never committed.

---

## Project structure

```
app/
  layout.tsx                  fonts, tokens, metadata
  page.tsx                    control room
  run/[id]/page.tsx           permalink (live board or receipt)
  api/
    runs/route.ts             POST: create run + enqueue
    runs/[id]/route.ts        GET: snapshot (+ ?format=json export)
    runs/[id]/retry/route.ts  POST: manual retry of a dead item
    worker/route.ts           POST: the heart — QStash calls this per item
lib/
  redis.ts qstash.ts          clients
  run.ts                      idempotent state machine (claim, transitions)
  pipeline.ts                 real per-stage work + chaos + poison
  format.ts samples.ts        helpers
store/useRun.ts               polling store
components/                   Console, Board, Lane, ItemTile, Telemetry,
                              Wire, DeadLetter, Receipt, Wordmark, About, …
```
