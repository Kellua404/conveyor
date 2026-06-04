"use client";

import { useEffect } from "react";
import { useRun } from "@/store/useRun";
import { Wordmark } from "./Wordmark";
import { Console } from "./Console";
import { Board } from "./Board";
import { Telemetry } from "./Telemetry";
import { Wire } from "./Wire";
import { Receipt } from "./Receipt";
import { StatusBar } from "./StatusBar";
import { About } from "./About";

const ENV_PROOF = "serverless · QStash queue · Upstash Redis · no always-on worker · $0";

export function ControlRoom({ runId }: { runId?: string }) {
  const { snap, dispatching, watch, stop } = useRun();

  // permalink hydration: if mounted with a runId, start watching it.
  useEffect(() => {
    if (runId) watch(runId);
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const complete = snap?.status === "complete";

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden grid-substrate flex flex-col">
      {/* header */}
      <header className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-line bg-surface/60 backdrop-blur-sm">
        <Wordmark />
        <div className="flex items-center gap-4">
          <span className="hidden md:inline tnum text-[10px] text-text-dim">{ENV_PROOF}</span>
          <About />
        </div>
      </header>

      {/* status line */}
      <div className="px-4 sm:px-6 py-2 border-b border-line bg-surface/30">
        <StatusBar snap={snap} dispatching={dispatching} />
      </div>

      {/* main grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-px bg-line/40 min-h-0">
        {/* left column: console + receipt + telemetry */}
        <div className="bg-bg flex flex-col lg:min-h-0 lg:overflow-y-auto">
          <Panel title="Console">
            <Console />
          </Panel>
          {complete && snap && (
            <Panel title="Receipt">
              <Receipt snap={snap} />
            </Panel>
          )}
          <Panel title="Telemetry" className="flex-1">
            <Telemetry snap={snap} />
          </Panel>
        </div>

        {/* right column: board (sized to content) + wire (fills the rest) */}
        <div className="bg-bg flex flex-col min-h-0">
          <div className="p-4 sm:p-6 shrink-0">
            <SectionLabel>Board</SectionLabel>
            <Board snap={snap} />
          </div>
          <div className="border-t border-line p-4 sm:p-6 flex-1 min-h-[200px]">
            <Wire snap={snap} />
          </div>
        </div>
      </main>
    </div>
  );
}

function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`p-4 sm:p-5 border-b border-line ${className}`}>
      <SectionLabel>{title}</SectionLabel>
      {children}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-medium tracking-[0.16em] uppercase text-text-dim mb-3">{children}</h2>
  );
}
