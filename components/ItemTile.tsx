"use client";

import { motion, useReducedMotion } from "framer-motion";
import { memo } from "react";
import type { ItemSnapshot } from "@/store/useRun";
import { STATE_COLOR } from "./state";

function ItemTileImpl({ item }: { item: ItemSnapshot }) {
  const reduce = useReducedMotion();
  const color = STATE_COLOR[item.status];
  const running = item.status === "running";
  const retrying = item.status === "retrying";

  return (
    <motion.div
      layout={!reduce}
      layoutId={`item-${item.idx}`}
      // settled spring, not bouncy (§3 motion law)
      transition={reduce ? { duration: 0.18 } : { type: "spring", stiffness: 140, damping: 20 }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      // retry: one violet flash, keyed by attempt count so it re-fires per retry
      key={retrying ? `retry-${item.attempts}` : undefined}
      title={`#${item.idx} · ${item.status}${item.error ? ` · ${item.error}` : ""}\n${item.text}`}
      className={[
        "relative h-7 w-7 rounded-[5px] border flex items-center justify-center",
        "tnum text-[10px] leading-none",
        running && !reduce ? "animate-breathe" : "",
        retrying && !reduce ? "animate-violet-flash" : "",
      ].join(" ")}
      style={{
        backgroundColor: `${color}1f`, // 12% tint
        borderColor: color,
        color,
      }}
    >
      <span aria-hidden>{item.idx}</span>
      {/* attempt badge if retried */}
      {item.attempts > 1 && (
        <span
          className="absolute -top-1.5 -right-1.5 h-3.5 min-w-3.5 px-[3px] rounded-full bg-bg border tnum text-[8px] flex items-center justify-center"
          style={{ borderColor: color, color }}
        >
          {item.attempts}
        </span>
      )}
      {/* screen-reader status, since color alone is never the signal */}
      <span className="sr-only">
        item {item.idx}, {item.status}, stage {item.stage}, attempt {item.attempts}
        {item.error ? `, ${item.error}` : ""}
      </span>
    </motion.div>
  );
}

export const ItemTile = memo(ItemTileImpl);
