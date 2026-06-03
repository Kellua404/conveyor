import type { ItemSnapshot } from "@/store/useRun";

export type Status = ItemSnapshot["status"];

// state IS the palette — single source of truth for tile color by job state.
export const STATE_COLOR: Record<Status, string> = {
  queued: "var(--state-queued)",
  running: "var(--state-running)",
  done: "var(--state-done)",
  retrying: "var(--state-retrying)",
  dead: "var(--state-dead)",
};

export const STATE_LABEL: Record<Status, string> = {
  queued: "queued",
  running: "running",
  done: "done",
  retrying: "retrying",
  dead: "dead",
};

// the five belt lanes + the dead-letter tray
export const LANES = ["QUEUED", "FETCH", "TRANSFORM", "VALIDATE", "DONE"] as const;
export type Lane = (typeof LANES)[number];

// map an item's stage to the lane column it should ride in
export function laneFor(stage: string): Lane {
  const up = stage.toUpperCase();
  if (up === "FETCH") return "FETCH";
  if (up === "TRANSFORM") return "TRANSFORM";
  if (up === "VALIDATE") return "VALIDATE";
  if (up === "DONE") return "DONE";
  return "QUEUED";
}
