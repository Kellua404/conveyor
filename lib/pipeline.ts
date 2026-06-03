import { createHash } from "crypto";
import { redis } from "./redis";
import { setStage, logEvent, itemKey, runKey } from "./run";

export class PermanentError extends Error {} // poison → DLQ, never retried
export class TransientError extends Error {} // chaos → retried with backoff

const STAGES = ["FETCH", "TRANSFORM", "VALIDATE"] as const;

export type Analysis = {
  words: number;
  chars: number;
  readability: number;
  keyword: string;
};

export type PipelineResult = Analysis & { checksum: string };

// Genuine (cheap, local, $0) CPU work per item — no fake setTimeout-as-work, no
// outbound calls. The only artificial delay is `tick()`, purely so stage
// transitions are watchable on the belt.
export async function runPipeline(run: string, i: string): Promise<PipelineResult> {
  const item = await redis.hgetall<{ text: string }>(itemKey(run, i));
  const text = (item?.text ?? "").trim();
  const chaos = Number((await redis.hget(runKey(run), "chaos")) ?? 0);

  let normalized = "";
  let analysis: Analysis | null = null;

  for (const stage of STAGES) {
    await setStage(run, i, stage);
    // inject a transient failure with probability = chaos% at a random stage
    if (Math.random() * 100 < chaos) throw new TransientError(`flaky at ${stage}`);
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

  await logEvent(run, `item#${i} processed (${analysis?.words} words)`);
  return {
    ...(analysis as Analysis),
    checksum: createHash("sha256").update(normalized).digest("hex").slice(0, 12),
  };
}

// visible, not fake-long: 60–200ms so the belt reads as motion, not lag.
const tick = () => new Promise((r) => setTimeout(r, 60 + Math.random() * 140));
