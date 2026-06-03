"use client";

import { LayoutGroup } from "framer-motion";
import { useMemo } from "react";
import type { Snapshot, ItemSnapshot } from "@/store/useRun";
import { LANES, laneFor } from "./state";
import { Lane } from "./Lane";
import { DeadLetter } from "./DeadLetter";

export function Board({ snap }: { snap: Snapshot | null }) {
  const { byLane, dead } = useMemo(() => {
    const byLane: Record<string, ItemSnapshot[]> = {
      QUEUED: [],
      FETCH: [],
      TRANSFORM: [],
      VALIDATE: [],
      DONE: [],
    };
    const dead: ItemSnapshot[] = [];
    for (const item of snap?.items ?? []) {
      if (item.status === "dead") dead.push(item);
      else byLane[laneFor(item.stage)].push(item);
    }
    // keep tiles stably ordered by idx within a lane (no shuffle on re-poll)
    for (const k of Object.keys(byLane)) byLane[k].sort((a, b) => a.idx - b.idx);
    dead.sort((a, b) => a.idx - b.idx);
    return { byLane, dead };
  }, [snap]);

  if (!snap) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-16">
        <p className="text-text-dim text-sm">Idle. Dispatch a batch to bring the line up.</p>
        <p className="text-text-dim/60 text-xs max-w-xs">
          Raise chaos to watch the system retry and recover.
        </p>
      </div>
    );
  }

  return (
    <LayoutGroup>
      <div className="flex flex-col">
        <div className="flex gap-3 items-start min-h-[160px]">
          {LANES.map((lane) => (
            <Lane key={lane} label={lane} items={byLane[lane]} accent={lane === "DONE"} />
          ))}
        </div>
        <DeadLetter items={dead} />
      </div>
    </LayoutGroup>
  );
}
