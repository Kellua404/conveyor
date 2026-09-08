import { createHash } from "crypto";

export class PermanentError extends Error {} // poison: straight to the dead-letter lane, never retried
export class TransientError extends Error {} // chaos: retried with backoff

export const STAGES = ["FETCH", "TRANSFORM", "VALIDATE"] as const;
export type Stage = (typeof STAGES)[number];

export type Analysis = {
  words: number;
  chars: number;
  readability: number;
  keyword: string;
};

export type PipelineResult = Analysis & { checksum: string };

// Real, cheap CPU work per item. No outbound calls, nothing pretending to be work.
// The only artificial delay is `tick()`, so each stage stays visible on the belt.
export async function runPipeline(
  text: string,
  chaos: number,
  onStage: (stage: Stage) => void
): Promise<PipelineResult> {
  let normalized = "";
  let analysis: Analysis | null = null;
  // chaos is the chance that one attempt fails somewhere; spread evenly over the stages
  const pStage = 1 - Math.pow(1 - chaos / 100, 1 / STAGES.length);

  for (const stage of STAGES) {
    onStage(stage);
    if (Math.random() < pStage) throw new TransientError(`flaky at ${stage}`);
    await tick();

    if (stage === "FETCH") {
      normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
    } else if (stage === "TRANSFORM") {
      const words = normalized.split(" ").filter(Boolean);
      analysis = {
        words: words.length,
        chars: normalized.length,
        readability: +(normalized.length / Math.max(words.length, 1)).toFixed(2),
        keyword: [...words].sort((a, b) => b.length - a.length)[0] ?? "",
      };
    } else if (stage === "VALIDATE") {
      if ((analysis?.words ?? 0) < 2) throw new PermanentError("too short"); // poison
    }
  }

  return {
    ...(analysis as Analysis),
    checksum: createHash("sha256").update(normalized).digest("hex").slice(0, 12),
  };
}

// visible, not slow: 60 to 200 ms per stage so the belt reads as motion
const tick = () => new Promise((r) => setTimeout(r, 60 + Math.random() * 140));
