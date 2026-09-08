"use client";

import { useRef } from "react";
import { toPng } from "html-to-image";
import { Download, FileJson } from "lucide-react";
import type { Snapshot } from "@/store/useRun";
import { fmtMs, fmtThroughput, successRate } from "@/lib/format";

export function Receipt({ snap }: { snap: Snapshot }) {
  const cardRef = useRef<HTMLDivElement>(null);

  const rate = successRate(snap.done, snap.total);

  async function downloadPng() {
    if (!cardRef.current) return;
    const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, backgroundColor: "#0b0d11" });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `conveyor-receipt-${snap.id}.png`;
    a.click();
  }

  // the results are already here: the last frame of the stream is the receipt
  function downloadJson() {
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `conveyor-${snap.id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const rows: [string, string][] = [
    ["Items", String(snap.total)],
    ["Done", String(snap.done)],
    ["Dead", String(snap.dead)],
    ["Retries", String(snap.retries)],
    ["Throughput", fmtThroughput(snap.throughput)],
    ["P50 / P95", `${fmtMs(snap.p50)} / ${fmtMs(snap.p95)}`],
    ["Parallelism", String(snap.parallelism)],
    ["Chaos", `${snap.chaos}%`],
  ];

  return (
    <div className="flex flex-col gap-3">
      <div ref={cardRef} className="rounded-lg border border-line bg-surface p-5 grid-substrate">
        <div className="flex items-baseline justify-between mb-4">
          <span className="font-display font-bold tracking-tight text-text">CONVEYOR</span>
          <span className="tnum text-[10px] text-text-dim">run {snap.id}</span>
        </div>

        <div className="flex items-end gap-2 mb-4">
          <span className="tnum text-4xl text-state-done leading-none">{rate.toFixed(0)}%</span>
          <span className="text-xs text-text-dim mb-1">success rate</span>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between border-b border-line/60 pb-1">
              <span className="text-[10px] tracking-wide uppercase text-text-dim">{k}</span>
              <span className="tnum text-sm text-text">{v}</span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-[9px] text-text-dim/70 tracking-wide">
          serverless · own in-process queue · no broker, no database · no always-on worker
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ReceiptBtn onClick={downloadPng} icon={<Download size={13} />} label="PNG" />
        <ReceiptBtn onClick={downloadJson} icon={<FileJson size={13} />} label="JSON" />
      </div>
    </div>
  );
}

function ReceiptBtn({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 rounded-md border border-line bg-surface-2 hover:bg-line text-xs text-text-dim hover:text-text py-2 transition-colors"
    >
      {icon}
      {label}
    </button>
  );
}
