/**
 * Guided-tour step definitions.
 *
 * Each step anchors onto an always-present element in the dashboard shell — the
 * left `Sidebar` nav (rendered on every route) plus the header booking-link
 * button — so the tour behaves identically in the onboarding state and the live
 * dashboard.
 *
 * Selectors use an href *suffix* match because `Link` from `@/i18n/navigation`
 * renders the locale prefix for non-default locales (`/fr/dashboard/bookings`)
 * while the default locale has none (`/dashboard/bookings`) — a suffix match
 * catches both. `key` maps to the `tour` i18n namespace (`<key>Title` /
 * `<key>Body`).
 */
export type TourPlacement = "right" | "bottom";

export type TourStep = {
  key: string;
  /** CSS selector for the anchor, or null for a centered (no-spotlight) card. */
  selector: string | null;
  placement: TourPlacement;
};

export const TOUR_STEPS: TourStep[] = [
  {
    key: "overview",
    selector: 'nav a[href$="/dashboard"]',
    placement: "right",
  },
  {
    key: "bookings",
    selector: 'nav a[href$="/dashboard/bookings"]',
    placement: "right",
  },
  {
    key: "inbox",
    selector: 'nav a[href$="/dashboard/inbox"]',
    placement: "right",
  },
  {
    key: "calendar",
    selector: 'nav a[href$="/dashboard/calendar"]',
    placement: "right",
  },
  {
    key: "listings",
    selector: 'nav a[href$="/dashboard/listings"]',
    placement: "right",
  },
  {
    key: "finances",
    selector: 'nav a[href$="/dashboard/ledger"]',
    placement: "right",
  },
  {
    key: "settings",
    selector: 'nav a[href$="/dashboard/settings"]',
    placement: "right",
  },
  {
    key: "bookingLink",
    selector: 'header a[href*="/book/"]',
    placement: "bottom",
  },
];
