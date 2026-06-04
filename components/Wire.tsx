"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Snapshot, WireEvent } from "@/store/useRun";

export function Wire({ snap }: { snap: Snapshot | null }) {
  const t0 = snap?.events.length ? Math.min(...snap.events.map((e) => e.ts)) : 0;
  const events = snap?.events ?? [];

  // auto-scroll to the newest line, like a terminal — unless the user has
  // scrolled up to read history, in which case we leave their position alone.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-medium tracking-[0.14em] uppercase text-text-dim">Wire</span>
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-breathe" aria-hidden />
      </div>
      <div
        ref={scrollRef}
        className="wire-scroll flex-1 min-h-0 max-h-[45vh] lg:max-h-none overflow-y-auto rounded-md bg-surface-2/60 border border-line p-2.5 space-y-0.5"
        role="log"
        aria-label="Event wire"
        aria-live="off"
      >
        {events.length === 0 ? (
          <p className="text-xs text-text-dim/60">— awaiting events —</p>
        ) : (
          events.map((e, i) => <WireLine key={`${e.ts}-${i}`} event={e} t0={t0} />)
        )}
      </div>
    </div>
  );
}

function WireLine({ event, t0 }: { event: WireEvent; t0: number }) {
  const color = useMemo(() => toneFor(event.msg), [event.msg]);
  const rel = ((event.ts - t0) / 1000).toFixed(2);
  return (
    <div className="tnum text-[11px] leading-relaxed flex gap-2">
      <span className="text-text-dim/70 shrink-0">t+{rel}s</span>
      <span className={color}>{event.msg}</span>
    </div>
  );
}

function toneFor(msg: string): string {
  if (msg.includes("DEAD")) return "text-state-dead";
  if (msg.includes("RETRY")) return "text-state-retrying";
  if (msg.includes("DONE")) return "text-state-done";
  if (msg.includes("re-queued")) return "text-accent";
  return "text-text-dim";
}
