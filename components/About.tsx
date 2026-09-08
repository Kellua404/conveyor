"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Info, X } from "lucide-react";

export function About() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // portal target only exists on the client
  useEffect(() => setMounted(true), []);

  // close on Escape + lock background scroll while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-[11px] text-text-dim hover:text-text transition-colors"
        aria-label="About Conveyor"
      >
        <Info size={13} aria-hidden />
        about
      </button>

      {/* Portal to body so the dialog escapes the header's backdrop-filter
          containing block — otherwise `fixed` anchors to the 56px header. */}
      {open &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-bg/80 backdrop-blur-sm p-4"
            role="dialog"
            aria-modal="true"
            aria-label="About Conveyor"
            onClick={() => setOpen(false)}
          >
            <div
              className="relative my-auto w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg border border-line bg-surface p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setOpen(false)}
                className="absolute top-3 right-3 text-text-dim hover:text-text"
                aria-label="Close"
              >
                <X size={16} />
              </button>
              <h2 className="font-display font-semibold text-text mb-3">What is this?</h2>
              <p className="text-sm text-text-dim leading-relaxed">
                The queue is Conveyor&apos;s own. One serverless function holds the batch in
                memory, a worker pool drains it at the parallelism you set, transient failures
                go back on the line with exponential backoff, and poison or exhausted items
                land in the dead-letter lane. Every state change streams to this page as it
                happens. No message broker, no database, no account with anyone. Crank up the
                chaos and try to break it.
              </p>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
