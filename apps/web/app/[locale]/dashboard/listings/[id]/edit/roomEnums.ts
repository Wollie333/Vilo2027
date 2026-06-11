// Enum-ish lists for the per-room drill-in editor. Plain strings so they can
// be stored in `listing_rooms.bed_type` / `listing_rooms.view_type` /
// `listing_rooms.experiences[]` without extra mapping.

export const BED_TYPES: string[] = [
  "King",
  "Queen",
  "Double",
  "Twin (2 singles)",
  "Single",
  "Bunk",
  "Sofa bed",
  "Cot",
];

export const VIEW_TYPES: string[] = [
  "Garden",
  "Pool",
  "Sea",
  "Mountain",
  "City",
  "Courtyard",
  "Bush",
  "River",
];

export const EXPERIENCES: string[] = [
  "Breakfast included",
  "Pet friendly",
  "Family friendly",
  "Wheelchair accessible",
  "Romantic",
  "Workspace",
  "Self check-in",
  "Quiet",
];
