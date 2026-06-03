import { create } from "zustand";

export type ItemSnapshot = {
  idx: number;
  status: "queued" | "running" | "done" | "retrying" | "dead";
  stage: string;
  attempts: number;
  ms: number | null;
  error: string | null;
  text: string;
  result: {
    words?: number;
    chars?: number;
    readability?: number;
    keyword?: string;
    checksum?: string;
  } | null;
};

export type WireEvent = { ts: number; msg: string };

export type Snapshot = {
  id: string;
  status: "running" | "complete";
  total: number;
  done: number;
  dead: number;
  retries: number;
  throughput: number;
  p50: number;
  p95: number;
  inFlight: number;
  elapsed: number;
  parallelism: number;
  chaos: number;
  items: ItemSnapshot[];
  events: WireEvent[];
};

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
  watch: (id: string) => void;
  retryItem: (idx: number) => Promise<void>;
  stop: () => void;
  reset: () => void;
};

let timer: ReturnType<typeof setInterval> | null = null;

export const useRun = create<State>((set, get) => ({
  snap: null,
  error: null,
  dispatching: false,

  dispatch: async (opts) => {
    set({ dispatching: true, error: null });
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(opts),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        set({ error: e.error ?? "dispatch failed", dispatching: false });
        return null;
      }
      const { runId } = await res.json();
      set({ dispatching: false });
      get().watch(runId);
      return runId;
    } catch {
      set({ error: "network error", dispatching: false });
      return null;
    }
  },

  watch: (id) => {
    get().stop();
    const poll = async () => {
      try {
        const res = await fetch(`/api/runs/${id}`);
        if (!res.ok) {
          if (res.status === 404) set({ error: "run not found (expired?)" });
          return;
        }
        const snap = (await res.json()) as Snapshot;
        set({ snap, error: null });
        if (snap.status === "complete") get().stop(); // stop when drained
      } catch {
        /* transient network blip — keep polling */
      }
    };
    poll();
    timer = setInterval(poll, 500); // 500ms = smooth belt, tiny free-tier cost
  },

  retryItem: async (idx) => {
    const snap = get().snap;
    if (!snap) return;
    await fetch(`/api/runs/${snap.id}/retry`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemId: String(idx) }),
    }).catch(() => {});
    get().watch(snap.id); // resume polling if it had stopped on complete
  },

  stop: () => {
    if (timer) clearInterval(timer);
    timer = null;
  },

  reset: () => {
    get().stop();
    set({ snap: null, error: null, dispatching: false });
  },
}));
