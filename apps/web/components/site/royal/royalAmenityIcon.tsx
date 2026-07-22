import type { ReactNode } from "react";

// Amenity / room-fact icons for the Royal theme. Our live facts are free-text
// strings ("Sleeps 4", "King bed", "Ensuite", "Sea view", "36 m²"…), so instead
// of a single generic tick we pick a meaningful icon by matching keywords in the
// fact — mirroring the reference design's varied `.amen` icons — and fall back to
// a clean check when nothing matches (never a wrong icon). Line style matches the
// reference: 20×20, 24-viewBox, 1.8 stroke, currentColor, round caps/joins.
const svg = (path: ReactNode) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {path}
  </svg>
);

const ICONS = {
  guests: svg(
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 6.2a3 3 0 0 1 0 5.6M17.5 20a5.5 5.5 0 0 0-3-4.9" />
    </>,
  ),
  bed: svg(
    <>
      <path d="M3 18V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9M3 14h18M3 18v2M21 18v2" />
      <path d="M7 10.5h4v3H7z" />
    </>,
  ),
  bath: svg(
    <>
      <path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
      <path d="M6 12V6a2 2 0 0 1 2-2 2 2 0 0 1 2 2M8 19l-1 2M17 19l1 2" />
    </>,
  ),
  shower: svg(
    <>
      <path d="M4 20V9a5 5 0 0 1 10 0M14 4h4a2 2 0 0 1 2 2v3" />
      <path d="M9 13v.01M12 15v.01M6 15v.01M10 18v.01M7 18v.01" />
    </>,
  ),
  view: svg(
    <>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="2.6" />
    </>,
  ),
  water: svg(
    <path d="M3 8c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0M3 13c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0M3 18c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0" />,
  ),
  mountain: svg(<path d="M3 20 9 8l4 6 2-3 5 9zM8.5 9.5 6 14" />),
  size: svg(
    <>
      <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" />
    </>,
  ),
  aircon: svg(
    <>
      <path d="M12 2v20M12 6 8.5 4M12 6l3.5-2M12 12l-4-2M12 12l4-2M12 18l-3.5 2M12 18l3.5 2" />
    </>,
  ),
  balcony: svg(
    <>
      <path d="M3 10h18M4 10V21M20 10V21M9 10v11M15 10v11M3 21h18M6 10 6 5h12v5" />
    </>,
  ),
  wifi: svg(
    <>
      <path d="M5 12.5a10 10 0 0 1 14 0M8 15.5a6 6 0 0 1 8 0" />
      <path d="M12 19h.01" />
    </>,
  ),
  breakfast: svg(
    <>
      <path d="M4 8h11v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM15 9h2a2.5 2.5 0 0 1 0 5h-2M6 3v2M9 3v2M12 3v2" />
    </>,
  ),
  pool: svg(
    <>
      <path d="M3 16c1.5-1.2 3-1.2 4.5 0S10.5 17.2 12 16s3-1.2 4.5 0 3 1.2 4.5 0M3 20c1.5-1.2 3-1.2 4.5 0S10.5 21.2 12 20s3-1.2 4.5 0 3 1.2 4.5 0" />
      <path d="M7 14V6a2 2 0 0 1 4 0M13 14V6" />
    </>,
  ),
  fire: svg(
    <path d="M12 2c1 3-2 4-2 7a4 4 0 0 0 8 0c0-1-.5-2-1-2.5.2 3-2.5 3.5-2.5 1.5C12 5 12 3 12 2Z" />,
  ),
  parking: svg(
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 16V8h3.5a2.5 2.5 0 0 1 0 5H9" />
    </>,
  ),
  pet: svg(
    <>
      <circle cx="5.5" cy="12" r="1.6" />
      <circle cx="9.5" cy="8.5" r="1.6" />
      <circle cx="14.5" cy="8.5" r="1.6" />
      <circle cx="18.5" cy="12" r="1.6" />
      <path d="M8 16.5c0-2 1.8-3.5 4-3.5s4 1.5 4 3.5-1.8 3-4 3-4-1-4-3Z" />
    </>,
  ),
  check: svg(<path d="M20 6 9 17l-5-5" />),
} as const;

// Ordered keyword → icon rules; first match wins, so more specific comes first.
const RULES: { re: RegExp; icon: ReactNode }[] = [
  { re: /ensuite|bathroom|bath\b|tub/, icon: ICONS.bath },
  { re: /shower|rain\s?shower/, icon: ICONS.shower },
  { re: /bed|king|queen|twin|double|sleeper/, icon: ICONS.bed },
  { re: /sleeps?|guests?|people|adults?|persons?/, icon: ICONS.guests },
  { re: /sea|ocean|beach/, icon: ICONS.water },
  { re: /pool|plunge|jacuzzi|spa/, icon: ICONS.pool },
  { re: /mountain|bush|forest|garden|nature/, icon: ICONS.mountain },
  { re: /view|vista|outlook/, icon: ICONS.view },
  { re: /balcon|terrace|patio|deck|veranda/, icon: ICONS.balcony },
  { re: /m²|m2|sqm|sq\s?m|square|size/, icon: ICONS.size },
  { re: /air|a\/c|aircon|climate|heating/, icon: ICONS.aircon },
  { re: /wifi|wi-fi|internet|fibre|fiber/, icon: ICONS.wifi },
  { re: /breakfast|meal|dining|kitchen|self-cater/, icon: ICONS.breakfast },
  { re: /fire|braai|hearth|log/, icon: ICONS.fire },
  { re: /park|garage|carport/, icon: ICONS.parking },
  { re: /pet|dog|animal/, icon: ICONS.pet },
];

/** Pick a meaningful icon for a room-fact/amenity string (check as a fallback). */
export function amenityIcon(fact: string): ReactNode {
  const f = fact.toLowerCase();
  for (const r of RULES) if (r.re.test(f)) return r.icon;
  return ICONS.check;
}
