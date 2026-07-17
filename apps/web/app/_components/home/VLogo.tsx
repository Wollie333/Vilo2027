// Wielo primary brand mark (green "W" roundel). `gradientId` namespaces the
// internal gradients so multiple logos can render on one page without id clashes.
//
// This is the ONE mark. The auth surfaces (login + all three signup wizards) each
// used to inline their own hand-rolled "V"-in-a-squircle — the PREVIOUS logo — so
// the first thing a new host ever saw was the old brand. Import this instead of
// pasting an <svg>: a copy is a logo that can't be updated.
export function VLogo({
  size = 32,
  gradientId,
  className,
}: {
  size?: number;
  gradientId: string;
  /** Extra classes (e.g. `wielo-logo-pulse`). Merged after the base rounding. */
  className?: string;
}) {
  return (
    <svg
      className={`rounded-full ${className ?? ""}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${gradientId}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#12B886" />
          <stop offset="1" stopColor="#0B7A5A" />
        </linearGradient>
        <linearGradient id={`${gradientId}-wf`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#C8EBDC" />
        </linearGradient>
        <linearGradient id={`${gradientId}-wb`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0E9D74" />
          <stop offset="1" stopColor="#075740" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="100" fill={`url(#${gradientId}-bg)`} />
      <path
        d="M52 62 L79 138 L100 92 L121 138 L148 62"
        fill="none"
        stroke={`url(#${gradientId}-wb)`}
        strokeWidth="26"
        strokeLinejoin="round"
        transform="translate(6,7)"
        opacity="0.9"
      />
      <path
        d="M52 62 L79 138 L100 92 L121 138 L148 62"
        fill="none"
        stroke={`url(#${gradientId}-wf)`}
        strokeWidth="26"
        strokeLinejoin="round"
      />
    </svg>
  );
}
