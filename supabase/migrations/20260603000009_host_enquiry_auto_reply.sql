-- Migration: optional "away" auto-reply for enquiries.
--
-- When a guest sends a quote request during the host's notification quiet hours,
-- Vilo posts this message into the thread automatically so the guest's
-- expectations are set ("I'm away right now, I'll reply in the morning").
-- NULL / empty = disabled. The quiet-hours window itself lives in
-- user_notification_settings (per the host's user_id).
--
-- Pre-MVP data policy (CLAUDE.md): purely additive.

ALTER TABLE public.hosts
  ADD COLUMN IF NOT EXISTS enquiry_auto_reply text;

COMMENT ON COLUMN public.hosts.enquiry_auto_reply IS
  'Optional away auto-reply posted to a new enquiry thread when it arrives during the host''s notification quiet hours (user_notification_settings). NULL/empty = disabled.';
