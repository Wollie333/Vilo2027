-- Founding Race leaderboard — the partner's community identity.
--
-- The leaderboard design shows each partner as "Marié van der Merwe · Karoo &
-- Kalahari Stays · 4,200 members · Karoo". The first two words came from
-- user_profiles/affiliate_accounts; the rest had nowhere to live, and inventing
-- them at render time would put fiction on a public page.
--
-- These are partner-declared profile fields (same class as display_headline /
-- bio / photo_url): the group they represent, roughly how many people are in it,
-- and the region they cover. All optional — the leaderboard degrades to the
-- partner's name alone when they are empty.

ALTER TABLE public.affiliate_accounts
  ADD COLUMN IF NOT EXISTS community_name text,
  ADD COLUMN IF NOT EXISTS community_members integer,
  ADD COLUMN IF NOT EXISTS region text;

ALTER TABLE public.affiliate_accounts
  DROP CONSTRAINT IF EXISTS affiliate_accounts_community_members_check;
ALTER TABLE public.affiliate_accounts
  ADD CONSTRAINT affiliate_accounts_community_members_check
  CHECK (community_members IS NULL OR (community_members >= 0 AND community_members <= 10000000));

COMMENT ON COLUMN public.affiliate_accounts.community_name IS
  'The group/community this partner represents, e.g. "Karoo & Kalahari Stays". Shown on the public leaderboard.';
COMMENT ON COLUMN public.affiliate_accounts.community_members IS
  'Rough size of that community. Partner-declared, display only — never used in scoring.';
COMMENT ON COLUMN public.affiliate_accounts.region IS
  'Region the partner covers, e.g. "Drakensberg". Shown on the leaderboard.';
