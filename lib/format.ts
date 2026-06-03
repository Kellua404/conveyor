// Small, dependency-free formatters for instrument-style readouts.

export const fmtMs = (ms: number | null | undefined): string => {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

export const fmtThroughput = (n: number): string => `${n.toFixed(1)}/s`;

export const fmtPct = (n: number): string => `${Math.round(n)}%`;

// percentile from a pre-sorted ascending array
export const pct = (sorted: number[], p: number): number =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0;

export const successRate = (done: number, total: number): number =>
  total > 0 ? (done / total) * 100 : 0;
