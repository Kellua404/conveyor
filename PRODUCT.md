# Conveyor — Product Definition

> The "why and for whom." `PLAN.md` is the "how." When a build decision isn't
> covered by the plan, decide in favor of these principles.
>
> Portfolio Project **B2** — the second *backend* project. Read alongside
> `PLAN.md` and the Phase-2 section of the root `PORTFOLIO_PLAN.md`.

## One-liner

**Conveyor is a job pipeline you can watch — submit a batch of work and see every
item ride the belt through each stage, fail, retry, and recover, in real time — built
entirely serverless on Vercel with no always-on worker and no paid services.**

## What it actually is

A single-page **dispatch control room** with a real distributed backend. You dispatch
a batch of items (paste lines, or generate N) and tune two dials: **parallelism** (how
many run at once) and **chaos %** (how often the system injects a transient failure).
Each item is then processed through a fixed pipeline of named stages
(`QUEUED → FETCH → TRANSFORM → VALIDATE → DONE`), and you watch the items physically
travel across a belt, lane by lane, live.

The machinery underneath is the point: a **serverless message queue** (Upstash QStash)
delivers each item to a Vercel function over HTTP, with **server-enforced concurrency**,
**automatic retries with backoff**, a **dead-letter lane** for poison items, and
**idempotent** state transitions in Redis. There is **no long-running worker process** —
the whole pipeline is stitched from short-lived serverless invocations, the modern way.

A precise **telemetry panel** proves it's real: live throughput (items/s), success/fail/
dead counts, p50/p95 stage latency, total retries, the queue's parallelism setting, and
a streaming **wire log** of every state transition.

> Where Resonance (B1) proved *"I can run a real model server-side,"* Conveyor proves
> *"I understand asynchronous, distributed, fault-tolerant systems"* — the other half of
> backend craft. Deliberately a different domain, mood, and look from Resonance.

## Who it's for

- **Recruiters / backend engineers** evaluating the portfolio — Conveyor is proof of
  **distributed-systems** literacy: queues, bounded concurrency/backpressure, retry &
  backoff, dead-letter handling, idempotency, and at-least-once delivery — implemented
  the *serverless-native* way (no rented worker, no paid queue, all on Vercel for $0).
- **Curious visitors** who'll stay because watching a swarm of jobs flow, stall, retry,
  and recover on a calm control board is genuinely satisfying to operate.
- **Anyone who's run real systems** and will immediately recognize that the chaos dial +
  retry/DLQ behavior is the honest, hard part — not a faked animation.

## The job it does

> "Show me that this pipeline is real — make me dispatch work, crank up the failure
> rate, and watch the system stay calm and recover — and make the resilience *legible*,
> not hidden behind a spinner."

## Brand & personality

- **Mood:** a **dispatch control room at 2am** — a well-run operations board / industrial
  switchboard / SCADA screen, but quiet and composed. Precise, utilitarian, awake,
  confident. Motion is *deliberate*, never frantic, even under load.
- **Voice:** terse operator language. Labels read like a control panel (`DISPATCH`,
  `PARALLELISM`, `IN FLIGHT`, `DEAD-LETTER`, `THROUGHPUT`, `RETRY`). Logs read like a
  real event stream. No marketing copy on the instrument itself.
- **Visual signature:** **state IS the palette** — every item tile is colored by its job
  state (queued = slate, running = amber pulse, done = green, retrying = violet, dead =
  red), so the whole board's health is readable at a glance. A hairline technical grid,
  a single **signal-amber** accent for things in motion, and tiles that animate smoothly
  between lanes (shared-layout motion) like cargo on a belt.
- **Type signature:** **Space Grotesk** (display + UI — engineered, geometric, a touch
  industrial; reads "systems," not "marketing") + **JetBrains Mono** (the wire log, IDs,
  counters, telemetry — a true engineering console face). Deliberately different from
  Resonance's Fraunces + Geist Mono and Aurora's Instrument Serif + IBM Plex Mono — the
  portfolio never reuses a pairing.
- **Anti-brand:** NOT a generic SaaS dashboard. No Inter/Roboto, no rounded pastel cards,
  no "Tasks ✅" to-do aesthetic, no fake progress bar that just animates to 100%, no
  hidden `setTimeout` pretending to be work. The queue is **real** (QStash actually
  re-invokes the function), the failures are **real**, the retries are **real**, and we
  show the receipts.

## Design principles (in priority order)

1. **The backend is the substance; the board is its instrument.** Every visible element
   exists to make the pipeline's behavior — concurrency, retries, recovery — *felt* and
   *trusted*. Nothing on screen is decorative theater.
2. **Resilience is the hero. Make failure visible.** The chaos dial + retry + dead-letter
   lane are the centerpiece, not an edge case. A visitor should be able to *break* the
   system on purpose and watch it stay calm and recover.
3. **Show the engine, don't fake it.** Real QStash delivery, real Redis state, honest
   telemetry (throughput, p50/p95, attempt counts). We never animate a result we didn't
   actually compute. "No always-on worker, all serverless, $0" is a fact we surface.
4. **Calm under load.** Even with 40 items and 30% chaos, motion stays composed and
   legible. A control room is unhurried *because* it's in control. (Contrast Creeper's
   maximalism; sibling to Resonance's calm, different domain.)
5. **Operable, not just watchable.** Real controls (parallelism, chaos, manual retry of a
   dead item, re-run) — it's an instrument you *drive*, not a demo you press play on.
6. **Honest output + fast and inclusive.** A real run-receipt (counts, latencies, success
   rate) as a shareable card + permalink + downloadable results JSON. Cold-start handled
   gracefully, AA accessible, reduced-motion respected, works without heavy GPU tricks.

## Success looks like

- A visitor sets parallelism = 3, chaos = 25%, dispatches 30 items, and watches the belt
  fill, stall, throw retries (violet flashes), recover, and drain — finishing with a
  clean receipt — and thinks *"wait, this is a real queue retrying real serverless calls,
  for free?"* That reaction is the North Star.
- A reviewing backend engineer immediately reads the telemetry + dead-letter behavior and
  trusts there's genuine distributed-systems work here, not a wrapper or an animation.
- Someone cranks chaos to max just to try to break it, sees it recover, and exports the
  run receipt because it's good enough to keep.

## Explicit non-goals (v1)

Accounts/auth, persisting runs forever (Redis TTL is fine), arbitrary outbound fetching
of user URLs (SSRF risk — item "work" stays local/CPU-bound and safe), processing huge
batches (cap at a demo-sane N), a generic workflow builder, multi-tenant queues, exactly-
once semantics (we do **idempotent at-least-once**, the honest real-world model), any paid
service. Several live in `PLAN.md` §15 as stretch goals. Keep v1 small and perfect.
