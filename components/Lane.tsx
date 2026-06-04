"use client";

import type { ItemSnapshot } from "@/store/useRun";
import { ItemTile } from "./ItemTile";

export function Lane({
  label,
  items,
  accent,
}: {
  label: string;
  items: ItemSnapshot[];
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col flex-1 min-w-[6.5rem]">
      <div className="flex items-baseline justify-between px-1 pb-2 mb-2 border-b">
        <span
          className={`text-[10px] font-medium tracking-[0.14em] uppercase ${
            accent ? "text-state-done" : "text-text-dim"
          }`}
        >
          {label}
        </span>
        <span className="tnum text-[10px] text-text-dim">{items.length}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 content-start min-h-[3.5rem]">
        {items.map((item) => (
          <ItemTile key={item.idx} item={item} />
        ))}
      </div>
    </div>
  );
}
