-- Website CMS contact form → inbox "Website Enquiry" (Phase 5).
--
-- A website contact-form submission lands in the host inbox exactly like a quote
-- request (a conversation + messages), built on the proven enquiry plumbing. To
-- let the inbox tell the two apart (a sky "Website" chip + an optional filter) we
-- tag where a thread originated. Nullable — legacy/booking threads stay NULL and
-- read as "unspecified". No CHECK constraint, matching the inbox's other open
-- text enums (status, pipeline_stage is the only constrained one).
--
-- The message that represents the enquiry uses messages.system_event =
-- 'website_enquiry' (system_event has no CHECK, so no constraint change needed),
-- and the lead lands in Guests CRM via the shared upsertHostContact path — so the
-- guest-identity principle (BUSINESS_PRINCIPLES #1) is satisfied automatically.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS source text;

COMMENT ON COLUMN public.conversations.source IS
  'Where this thread originated: quote | website | booking | message. NULL = legacy/unspecified.';

-- Find website enquiries fast for the inbox chip + per-host rate limiting.
CREATE INDEX IF NOT EXISTS conversations_source_idx
  ON public.conversations (host_id, source)
  WHERE source IS NOT NULL;
