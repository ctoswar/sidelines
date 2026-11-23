// Inline icons for the stats surfaces — same hand-rolled style as the
// Discover set so every glyph inherits the surrounding colour.

type IconProps = { className?: string; size?: number };

function base(size = 18) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

/** List-with-lines glyph for the "Player Statistics" heading. */
export function ClipboardIcon({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
      <path d="M9 8h6M9 12h6M9 16h3.5" />
    </svg>
  );
}

/** Trophy for tournament history and performance cards. */
export function TrophyIcon({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5H5.5a0 0 0 0 0 0 0c0 2.5 1 4.5 2.7 5.2M16 5h2.5c0 2.5-1 4.5-2.7 5.2" />
      <path d="M12 13v3M9 20h6M10 20l.6-4h2.8l.6 4" />
    </svg>
  );
}

/** Percent glyph for the win-rate tile. */
export function PercentIcon({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M19 5 5 19" />
      <circle cx="7.5" cy="7.5" r="2.5" />
      <circle cx="16.5" cy="16.5" r="2.5" />
    </svg>
  );
}

/** Flame for the streak tile. */
export function FlameIcon({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 3c.6 3-1.6 4.6-3 6.4A6.6 6.6 0 0 0 7.4 14a4.9 4.9 0 0 0 9.8.2c.1-2.4-1-4.3-2.4-5.8-.3 1-.9 1.8-1.8 2.2.3-2.6-.2-5.6-1-7.6Z" />
    </svg>
  );
}

/** Target for the points-per-game tile. */
export function TargetIcon({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

/** Trend line for the match-statistics heading. */
export function TrendIcon({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="m3.5 17 5-5 3.5 3.5L20.5 7" />
      <path d="M15.5 7h5v5" />
    </svg>
  );
}

/** Ticket for voucher rows. */
export function TicketIcon({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v2a1.9 1.9 0 0 0 0 3v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 15.5v-2a1.9 1.9 0 0 0 0-3v-2Z" />
      <path d="M14 7v10" strokeDasharray="2 2.4" />
    </svg>
  );
}

/** People for the checkout's players header. */
export function PlayersIcon({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.8 19a5.2 5.2 0 0 1 10.4 0" />
      <path d="M15.5 6.2a3 3 0 0 1 0 5.6M17.2 14.6a5.2 5.2 0 0 1 3 4.4" />
    </svg>
  );
}
