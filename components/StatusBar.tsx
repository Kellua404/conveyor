"use client";

import type { Snapshot } from "@/store/useRun";

// concise aria-live region — the accessible heartbeat of the run.
export function StatusBar({ snap, dispatching }: { snap: Snapshot | null; dispatching: boolean }) {
  let msg: string;
  if (dispatching) {
    msg = "Cold start — waiting for the first delivery from the queue…";
  } else if (!snap) {
    msg = "Idle. Dispatch a batch to bring the line up.";
  } else if (snap.status === "complete") {
    msg = `Complete — ${snap.done} of ${snap.total} done, ${snap.dead} dead.`;
  } else if (snap.done + snap.dead === 0 && snap.inFlight === 0) {
    msg = "Cold start — waiting for the first delivery from the queue…";
  } else {
    msg = `${snap.done} of ${snap.total} done, ${snap.dead} dead, ${snap.inFlight} in flight.`;
  }

  const running = snap?.status === "running" || dispatching;

  return (
    <div className="flex items-center gap-2" aria-live="polite">
      <span
        className={`h-1.5 w-1.5 rounded-full ${running ? "bg-accent animate-breathe" : "bg-state-done"}`}
        aria-hidden
      />
      <span className="text-[11px] text-text-dim tnum">{msg}</span>
    </div>
  );
}
