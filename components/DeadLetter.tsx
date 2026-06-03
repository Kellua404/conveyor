"use client";

import { Skull, RotateCcw } from "lucide-react";
import type { ItemSnapshot } from "@/store/useRun";
import { useRun } from "@/store/useRun";

export function DeadLetter({ items }: { items: ItemSnapshot[] }) {
  const retryItem = useRun((s) => s.retryItem);

  return (
    <div className="border-t border-line pt-3 mt-3">
      <div className="flex items-center gap-2 mb-2.5">
        <Skull size={13} className="text-state-dead" aria-hidden />
        <span className="text-[10px] font-medium tracking-[0.14em] uppercase text-state-dead">
          Dead-Letter
        </span>
        <span className="tnum text-[10px] text-text-dim">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-text-dim/70">No dead items. The line is clean.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <div
              key={item.idx}
              className="flex items-center gap-2 rounded-md border border-state-dead/40 bg-state-dead/5 pl-2 pr-1 py-1"
            >
              <div className="flex flex-col">
                <span className="tnum text-[11px] text-state-dead leading-tight">#{item.idx}</span>
                <span className="text-[9px] text-text-dim leading-tight max-w-[90px] truncate">
                  {item.error ?? "dead"}
                </span>
              </div>
              <button
                onClick={() => retryItem(item.idx)}
                className="flex items-center gap-1 rounded bg-surface-2 hover:bg-line border border-line px-1.5 py-1 text-[10px] text-text-dim hover:text-text transition-colors"
                aria-label={`Retry item ${item.idx}`}
              >
                <RotateCcw size={10} aria-hidden />
                retry
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
