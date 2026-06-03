"use client";

import { useState } from "react";
import { Play, RotateCw } from "lucide-react";
import { useRun } from "@/store/useRun";
import {
  MAX_ITEMS,
  MAX_PARALLELISM,
  MAX_CHAOS,
  DEFAULT_PARALLELISM,
  DEFAULT_CHAOS,
  DEFAULT_COUNT,
} from "@/lib/constants";

type Mode = "count" | "paste";

export function Console() {
  const { snap, dispatch, dispatching, error, reset } = useRun();
  const [mode, setMode] = useState<Mode>("count");
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [text, setText] = useState("");
  const [parallelism, setParallelism] = useState(DEFAULT_PARALLELISM);
  const [chaos, setChaos] = useState(DEFAULT_CHAOS);

  const inFlight = snap?.status === "running";
  const busy = dispatching || inFlight;
  const hasRun = !!snap;

  async function onDispatch() {
    const lines = mode === "paste" ? text.split("\n").map((l) => l.trim()).filter(Boolean) : undefined;
    await dispatch({
      lines,
      count: mode === "count" ? count : undefined,
      parallelism,
      chaos,
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* items source */}
      <Field label="Items">
        <div className="flex rounded-md border border-line overflow-hidden mb-2.5 text-xs">
          <ModeTab active={mode === "count"} onClick={() => setMode("count")} disabled={busy}>
            generate
          </ModeTab>
          <ModeTab active={mode === "paste"} onClick={() => setMode("paste")} disabled={busy}>
            paste
          </ModeTab>
        </div>

        {mode === "count" ? (
          <SliderRow
            value={count}
            min={1}
            max={MAX_ITEMS}
            onChange={setCount}
            disabled={busy}
            valueText={`${count} items`}
            display={`${count}`}
          />
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            rows={4}
            placeholder="one item per line…"
            className="w-full resize-none rounded-md bg-surface-2 border border-line px-2.5 py-2 text-xs tnum text-text placeholder:text-text-dim/50 focus:border-accent/60 disabled:opacity-50"
            aria-label="Items, one per line"
          />
        )}
      </Field>

      <Field label="Parallelism" hint="free-tier cap 2">
        <SliderRow
          value={parallelism}
          min={1}
          max={MAX_PARALLELISM}
          onChange={setParallelism}
          disabled={busy}
          valueText={`parallelism ${parallelism}`}
          display={`${parallelism}`}
        />
      </Field>

      <Field label="Chaos" hint="transient failure rate">
        <SliderRow
          value={chaos}
          min={0}
          max={MAX_CHAOS}
          onChange={setChaos}
          disabled={busy}
          valueText={`chaos ${chaos} percent`}
          display={`${chaos}%`}
        />
      </Field>

      <div className="flex flex-col gap-2 pt-1">
        <button
          onClick={onDispatch}
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-md bg-accent text-bg font-display font-semibold text-sm tracking-wide py-2.5 transition-[filter,opacity] hover:brightness-105 active:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Play size={15} aria-hidden />
          {dispatching ? "DISPATCHING…" : hasRun && !inFlight ? "RE-RUN" : "DISPATCH"}
        </button>

        {hasRun && !busy && (
          <button
            onClick={reset}
            className="flex items-center justify-center gap-1.5 rounded-md border border-line text-text-dim hover:text-text text-xs py-2 transition-colors"
          >
            <RotateCw size={12} aria-hidden />
            clear board
          </button>
        )}

        {error && (
          <p role="alert" className="text-xs text-state-dead">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[11px] font-medium tracking-[0.14em] uppercase text-text-dim">{label}</span>
        {hint && <span className="text-[9px] text-text-dim/60">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 py-1.5 transition-colors disabled:opacity-50 ${
        active ? "bg-surface-2 text-text" : "text-text-dim hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

function SliderRow({
  value,
  min,
  max,
  onChange,
  disabled,
  valueText,
  display,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  valueText: string;
  display: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={valueText}
        className="flex-1 disabled:opacity-50"
      />
      <span className="tnum text-sm text-text w-10 text-right tabular-nums">{display}</span>
    </div>
  );
}
