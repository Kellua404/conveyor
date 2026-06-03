export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <BeltGlyph />
      <span className="font-display font-bold tracking-tight text-[19px] leading-none text-text">
        CONVEYOR
      </span>
      <span className="hidden sm:inline-block h-3 w-px bg-line" aria-hidden />
      <span className="hidden sm:inline text-text-dim text-xs tracking-wide">
        dispatch control
      </span>
    </div>
  );
}

// a small belt glyph: three rollers under a moving plate
function BeltGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="8" width="20" height="4" rx="1" fill="var(--accent)" />
      <circle cx="6" cy="16" r="2.4" stroke="var(--text-dim)" strokeWidth="1.4" />
      <circle cx="12" cy="16" r="2.4" stroke="var(--text-dim)" strokeWidth="1.4" />
      <circle cx="18" cy="16" r="2.4" stroke="var(--text-dim)" strokeWidth="1.4" />
    </svg>
  );
}
