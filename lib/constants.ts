// Shared, dependency-free limits (safe to import from both client and server).

export const MAX_ITEMS = 50; // batch cap (demo-sane; respects free tiers)
export const MAX_CHAOS = 40; // max transient-failure injection %

// QStash FREE TIER caps queue parallelism at 2. We honor the "$0, no paid
// services" constraint, so the operator dial maxes at 2. 1-vs-2 still visibly
// demonstrates server-enforced backpressure.
export const MAX_PARALLELISM = 2;
export const DEFAULT_PARALLELISM = 2;
// Default chaos is modest so the first dispatch drains fast/clean on the QStash
// free tier (every failure reschedules with backoff, which is slow there). The
// "try to break it" story is cranking this up toward MAX_CHAOS.
export const DEFAULT_CHAOS = 10;
export const DEFAULT_COUNT = 12;
