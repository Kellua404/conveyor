import { receiver, MAX_ATTEMPTS } from "@/lib/qstash";
import { claim, markDone, markRetrying, markDead } from "@/lib/run";
import { runPipeline, PermanentError } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

const ACK = () => new Response("ok", { status: 200 }); // tell QStash: done, stop
const RETRY = () => new Response("retry", { status: 500 }); // tell QStash: redeliver

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("upstash-signature") ?? "";
  const valid = await receiver.verify({ signature, body }).catch(() => false);
  if (!valid) return new Response("bad signature", { status: 401 });

  let parsed: { runId: string; itemId: string };
  try {
    parsed = JSON.parse(body);
  } catch {
    return ACK(); // unparseable — don't make QStash retry a malformed message
  }
  const { runId, itemId } = parsed;

  // Idempotency: only one invocation claims the item. Duplicate deliveries just ack.
  const attempt = await claim(runId, itemId);
  if (attempt < 0) return ACK();

  const t0 = Date.now();
  try {
    const result = await runPipeline(runId, itemId); // stages + injected chaos
    await markDone(runId, itemId, Date.now() - t0, result);
    return ACK();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (err instanceof PermanentError) {
      await markDead(runId, itemId, message); // poison: never retry
      return ACK();
    }
    if (attempt >= MAX_ATTEMPTS) {
      await markDead(runId, itemId, `exhausted: ${message}`); // transient, out of tries
      return ACK();
    }
    await markRetrying(runId, itemId, message); // transient: let QStash back off + redeliver
    return RETRY();
  }
}
