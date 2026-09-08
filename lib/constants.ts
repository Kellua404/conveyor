// Shared, dependency-free limits (safe to import from both client and server).

export const MAX_ITEMS = 50; // batch cap: a run must finish inside one function's budget
export const MAX_CHAOS = 40; // max transient-failure injection %

// The queue is ours, so parallelism is whatever the worker pool is told. Eight is
// plenty to see backpressure against one.
export const MAX_PARALLELISM = 8;
export const DEFAULT_PARALLELISM = 2;
export const DEFAULT_CHAOS = 10;
export const DEFAULT_COUNT = 12;

// Wall-clock budget for one run, under the function's 60 s limit. Anything still
// queued when it expires is dead-lettered with the reason "deadline".
export const RUN_BUDGET_MS = 50_000;
