// Shared notification types — kept dependency-free so both the TS
// dispatcher and edge-side shims can import them. Keep this file in sync
// with the DB CHECK constraints in 20260525000011_notification_system_schema.

export type Channel = "email" | "push" | "in_app";

export type Severity = "info" | "default" | "high" | "critical";

export type Role = "guest" | "host" | "staff" | "super_admin";

// Mirrors the seed rows in 20260525000012_notification_system_seed.sql.
export type CategoryId =
  | "bookings"
  | "payments_refunds"
  | "messages"
  | "quote_requests"
  | "reviews"
  | "calendar_sync"
  | "subscription"
  | "account_security"
  | "admin_broadcasts"
  | "marketing_tips"
  | "looking_for";

// Second axis (the `feature` column on notification_events). Lets the
// admin-side history / audit views group by feature without duplicating
// the user-facing category taxonomy.
export type FeatureId =
  | "booking"
  | "refund"
  | "subscription"
  | "message"
  | "review"
  | "calendar"
  | "account"
  | "admin"
  | "looking_for";

// Push payload shape sent to Expo. Mirrors NOTIFICATIONS.md §3.
export type PushPayload = {
  title: string;
  body: string;
  data?: {
    screen?: string;
    params?: Record<string, string>;
  };
  badge?: number;
  sound?: "default" | null;
  priority?: "default" | "high";
};

// In-app row payload. The RPC enqueue_in_app_notification handles category
// + severity separately, so they're not on this shape.
export type InAppPayload = {
  title: string;
  body?: string;
  link?: string;
  payload?: Record<string, unknown>;
};

// What resolve_notification_prefs() returns. The dispatcher uses these to
// decide which channels to fire.
export type EffectivePrefs = {
  email_enabled: boolean;
  push_enabled: boolean;
  in_app_enabled: boolean;
  digest_mode: "off" | "daily" | "weekly";
  is_locked: boolean;
};

export type UserSettings = {
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  quiet_hours_timezone: string;
  dedupe_enabled: boolean;
};

// One registry entry per notification kind. Builders are lenient — when a
// caller passes thin refs (just IDs), the builders should degrade
// gracefully instead of crashing. The email channel hydrates at drain
// time via apps/web/lib/email/resolvers/* (callers pass refs and the
// resolver fills in the display fields).
export type EventBuilder<R> = {
  category: CategoryId;
  feature: FeatureId;
  severity: Severity;
  /** Key in EMAIL_REGISTRY. Omitted = no email channel for this kind. */
  emailTemplate?: string;
  /**
   * Reference keys the email resolver expects in the payload, e.g. ['booking_id'].
   * Documentation only — not enforced — but enumerates the minimum set so
   * future callers know what to pass.
   */
  refKeys?: readonly string[];
  push?: (refs: R) => PushPayload | null;
  inApp?: (refs: R) => InAppPayload | null;
  dedupeKey?: (refs: R) => string | null;
};
