-- WS-2 (2e) — Looking-For field additions.
-- Additive, nullable-only. Adds child ages, pet count, and a "not sure where
-- yet" flag to looking_for_posts. No reshape: existing rows and every read
-- path are unaffected (destination_flexible defaults to false).
--
-- DOWN:
--   ALTER TABLE public.looking_for_posts
--     DROP COLUMN IF EXISTS child_ages,
--     DROP COLUMN IF EXISTS pets,
--     DROP COLUMN IF EXISTS destination_flexible;

ALTER TABLE public.looking_for_posts
  ADD COLUMN IF NOT EXISTS child_ages integer[],
  ADD COLUMN IF NOT EXISTS pets integer,
  ADD COLUMN IF NOT EXISTS destination_flexible boolean NOT NULL DEFAULT false;

-- Guard the pet count against negatives (mirrors the children/infants checks).
ALTER TABLE public.looking_for_posts
  ADD CONSTRAINT looking_for_posts_pets_check
  CHECK (pets IS NULL OR pets >= 0);
