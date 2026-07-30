-- Migration: free notification_overrides.event_kind from the notification_events FK.
--
-- BUG (found in browser verification of the Communications hub): saving an
-- override for most messages failed silently. notification_overrides.event_kind
-- had a FK to notification_events(kind), but notification_events is a SPARSE
-- mirror (only ~12 kinds have rows) while the Communications catalogue is driven
-- by the CODE registry (~40 kinds). So an override for any kind not in
-- notification_events hit a foreign-key violation.
--
-- The override layer's authority for a valid kind is the code registry
-- (isRegisteredEvent, enforced in saveMessageOverrideAction), not the DB mirror.
-- Drop the FK; event_kind stays the PK (one row per kind).

ALTER TABLE public.notification_overrides
  DROP CONSTRAINT IF EXISTS notification_overrides_event_kind_fkey;
