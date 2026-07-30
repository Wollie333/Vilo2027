-- P5 — the campaign Email tab's scheduled-sequence cadence.
--
-- Per-campaign timing for the clock-driven competition emails (standings digest
-- cadence + ending-soon lead time). WHETHER a mail sends stays governed by the
-- global notification_overrides toggles; this column governs only the WHEN, and
-- is read by the P2b scheduler. Kickoff has no timing (fires once at go-live).
--
-- Shape (all keys optional; the app fills defaults):
--   { "standings_digest": { "cadence": "weekly"|"biweekly"|"monthly",
--                           "weekday": 0..6 },
--     "ending_soon":      { "lead_days": 1..90 } }

alter table public.affiliate_campaigns
  add column if not exists email_schedule jsonb not null default '{}'::jsonb;

comment on column public.affiliate_campaigns.email_schedule is
  'Per-campaign cadence for the scheduled competition emails (standings digest + ending-soon). Read by the notification scheduler; the override layer still governs whether each sends.';
