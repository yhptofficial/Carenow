/**
 * CareNow wordmark.
 *
 * The glyph is a rounded "C" holding a cross — clinical, but softened by the
 * full-pill geometry so it doesn't read as a hospital sign.
 */
export function CareNowLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-primary text-white shadow-[0_6px_18px_rgba(31,163,144,0.32)]">
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M16.4 6.6A6.6 6.6 0 1 0 16.4 17.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M12 8.6v6.8M8.6 12h6.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {!compact ? (
        <span className="text-[19px] font-bold tracking-[-0.02em] text-ink">
          Care<span className="text-primary">Now</span>
        </span>
      ) : null}
    </div>
  );
}
