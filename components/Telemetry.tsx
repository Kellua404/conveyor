"use client";

import { useEffect, useRef, useState } from "react";
import type { Snapshot } from "@/store/useRun";
import { fmtMs, fmtThroughput } from "@/lib/format";

export function Telemetry({ snap }: { snap: Snapshot | null }) {
  const history = useThroughputHistory(snap);

  const stats: { label: string; value: string; tone?: "dead" | "retry" | "running" }[] = [
    { label: "In Flight", value: String(snap?.inFlight ?? 0), tone: "running" },
    { label: "Done", value: String(snap?.done ?? 0) },
    { label: "Dead", value: String(snap?.dead ?? 0), tone: "dead" },
    { label: "Retries", value: String(snap?.retries ?? 0), tone: "retry" },
    { label: "P50", value: fmtMs(snap?.p50 ?? null) },
    { label: "P95", value: fmtMs(snap?.p95 ?? null) },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* throughput hero + sparkline */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[10px] font-medium tracking-[0.14em] uppercase text-text-dim">
            Throughput
          </span>
          <span className="tnum text-lg text-accent">{fmtThroughput(snap?.throughput ?? 0)}</span>
        </div>
        <Sparkline data={history} />
      </div>

      <div className="grid grid-cols-3 gap-x-3 gap-y-3">
        {stats.map((s) => (
          <Stat key={s.label} {...s} />
        ))}
      </div>

      <div className="flex items-center gap-4 text-[10px] text-text-dim border-t border-line pt-3">
        <span>
          parallelism <span className="tnum text-text">{snap?.parallelism ?? "—"}</span>
        </span>
        <span>
          chaos <span className="tnum text-text">{snap ? `${snap.chaos}%` : "—"}</span>
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "dead" | "retry" | "running" }) {
  const color =
    tone === "dead"
      ? "text-state-dead"
      : tone === "retry"
        ? "text-state-retrying"
        : tone === "running"
          ? "text-accent"
          : "text-text";
  return (
    <div className="flex flex-col">
      <span className="text-[9px] tracking-[0.12em] uppercase text-text-dim mb-0.5">{label}</span>
      <span className={`tnum text-base ${color}`}>{value}</span>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) {
    return <div className="h-8 rounded bg-surface-2 border border-line" aria-hidden />;
  }
  const w = 200;
  const h = 32;
  const max = Math.max(...data, 0.001);
  const step = w / (data.length - 1);
  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 4) - 2).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8" preserveAspectRatio="none" aria-hidden>
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function useThroughputHistory(snap: Snapshot | null): number[] {
  const [history, setHistory] = useState<number[]>([]);
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    if (!snap) return;
    if (snap.id !== lastId.current) {
      lastId.current = snap.id;
      setHistory([]);
    }
    setHistory((h) => [...h.slice(-39), snap.throughput]);
  }, [snap]);

  return history;
}
