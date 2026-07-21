// WS-7 — the funnel vocabulary, shared by the browser beacon, the server
// recorder and the admin read-out so the three cannot drift apart. Client-safe:
// no node imports, no DB.

export const FUNNEL_LOOKING_FOR = "looking_for";
export const FUNNEL_CALCULATOR = "calculator";

/** Funnels the beacon will accept. Anything else is dropped, so a stray or
 *  forged payload cannot invent a funnel that pollutes the admin read-out. */
export const FUNNELS: readonly string[] = [
  FUNNEL_LOOKING_FOR,
  FUNNEL_CALCULATOR,
];

export type FunnelEvent =
  | "landing_view"
  | "wizard_start"
  | "step_complete"
  | "review_reached"
  | "account_created"
  | "published";

/** Events the BROWSER may report. publish-side events are server-recorded only,
 *  so a forged beacon cannot inflate the conversion numbers. */
export const CLIENT_EVENTS: readonly FunnelEvent[] = [
  "landing_view",
  "wizard_start",
  "step_complete",
  "review_reached",
];

/** Looking-For wizard steps, in order — mirrors SECTIONS in RequestForm.tsx. */
export const LF_STEPS = [
  "basics",
  "dates",
  "location",
  "requirements",
  "photo",
  "review",
] as const;

export type LfStep = (typeof LF_STEPS)[number];

export const LF_STEP_LABELS: Record<LfStep, string> = {
  basics: "Basics",
  dates: "Dates & guests",
  location: "Location & budget",
  requirements: "Requirements",
  photo: "Photo & preferences",
  review: "Review",
};
