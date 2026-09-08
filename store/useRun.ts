import { create } from "zustand";
import type { Snapshot as ServerSnapshot, Item } from "@/lib/queue";

export type ItemSnapshot = Item;
export type WireEvent = { ts: number; msg: string };
export type Snapshot = ServerSnapshot;

export type DispatchOpts = {
  lines?: string[];
  count?: number;
  parallelism: number;
  chaos: number;
};

type State = {
  snap: Snapshot | null;
  error: string | null;
  dispatching: boolean;
  dispatch: (opts: DispatchOpts) => Promise<string | null>;
  retryItem: (idx: number) => Promise<void>;
  stop: () => void;
  reset: () => void;
};

let ctrl: AbortController | null = null;

/* Read one run off the wire: the server streams a JSON snapshot per line and
   closes when the queue has drained. `onSnap` gets every frame. */
async function readRun(opts: DispatchOpts, signal: AbortSignal, onSnap: (s: Snapshot) => void): Promise<Snapshot | null> {
  const res = await fetch("/api/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(opts),
    signal,
  });
  if (!res.ok || !res.body) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error ?? "dispatch failed");
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", last: Snapshot | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const obj = JSON.parse(line);
      if (obj.error) throw new Error(obj.error);
      last = obj as Snapshot;
      onSnap(last);
    }
  }
  return last;
}

export const useRun = create<State>((set, get) => ({
  snap: null,
  error: null,
  dispatching: false,

  dispatch: async (opts) => {
    get().stop();
    ctrl = new AbortController();
    set({ dispatching: true, error: null });
    try {
      const last = await readRun(opts, ctrl.signal, (snap) => set({ snap, dispatching: false, error: null }));
      set({ dispatching: false });
      return last?.id ?? null;
    } catch (err) {
      if (ctrl?.signal.aborted) return null;
      set({ error: err instanceof Error ? err.message : "network error", dispatching: false });
      return null;
    }
  },

  /* A dead item goes back on the line as a run of one, with the same parallelism
     and chaos; its frames are merged into the board under the original index. */
  retryItem: async (idx) => {
    const snap = get().snap;
    const item = snap?.items.find((x) => x.idx === idx);
    if (!snap || !item || item.status !== "dead") return;
    ctrl = new AbortController();
    const base = { ...snap, dead: snap.dead - 1, status: "running" as const };
    set({ snap: base, error: null });
    try {
      await readRun({ lines: [item.text], parallelism: snap.parallelism, chaos: snap.chaos }, ctrl.signal, (mini) => {
        const cur = get().snap;
        if (!cur) return;
        const m = mini.items[0];
        const items = cur.items.map((x) => (x.idx === idx ? { ...m, idx, text: x.text, attempts: item.attempts + m.attempts } : x));
        const finished = mini.status === "complete";
        set({
          snap: {
            ...cur,
            status: finished ? "complete" : "running",
            done: cur.done + (finished && m.status === "done" ? 1 : 0),
            dead: cur.dead + (finished && m.status === "dead" ? 1 : 0),
            retries: cur.retries + (finished ? mini.retries : 0),
            inFlight: items.filter((x) => x.status === "running").length,
            items,
            events: [...mini.events.map((e) => ({ ...e, msg: e.msg.replace(/item#0\b/g, `item#${idx}`).replace(/^run \S+/, "retry") })), ...cur.events].slice(0, 50),
          },
        });
      });
    } catch (err) {
      if (!ctrl?.signal.aborted) set({ error: err instanceof Error ? err.message : "retry failed" });
    }
  },

  stop: () => {
    if (ctrl) ctrl.abort();
    ctrl = null;
  },

  reset: () => {
    get().stop();
    set({ snap: null, error: null, dispatching: false });
  },
}));
