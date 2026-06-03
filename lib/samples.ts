// Sample text used when a visitor asks Conveyor to "generate N" items instead of
// pasting their own. A few are intentionally too-short ("a", "x") so the poison →
// dead-letter path is demonstrable out of the box.
const POOL = [
  "the river remembers",
  "a",
  "quiet engine at midnight",
  "ship it",
  "x",
  "logistics is poetry in motion",
  "calm under load",
  "retry and recover",
];

export function genSamples(n: number): string[] {
  return Array.from({ length: n }, (_, i) => POOL[i % POOL.length] + (i % 5 === 0 ? "" : ` ${i}`));
}
