-- Migration: Affiliate CAMPAIGN LAYER — additive schema (WS-1 step 1).
--
-- The default affiliate program (per-product rates × lifetime tier bonus) is
-- UNTOUCHED. A campaign is an additive layer on top of it, bundling three facets:
--   1. its own attribution   — a unique campaign link; referrals through it are
--                              tagged affiliate_referrals.campaign_id
--   2. its own commission structure — ladder / flat / inherit (governs the tagged
--                              referral for the lifetime of its commission stream)
--   3. an optional competition overlay — scoring events + public leaderboard +
--                              prizes + a time-boxed window
--
-- THE ONE MECHANISM: affiliate_referrals.campaign_id (nullable). Plain /r/<slug>
-- link → NULL → default program (unchanged). Campaign /c/<campaign>/<slug> link →
-- tagged → that campaign's structure. A referral resolves under EXACTLY ONE rule
-- set → no double-count, default money-path never touched.
--
-- This migration is SCHEMA + SEED ONLY. It writes no money logic — the commission
-- resolver branch, ladder recompute and floors land later (blueprint §13 step 5),
-- behind the campaign_id gate, after the default path is proven unchanged. Adding
-- these tables/columns changes no existing behaviour: every campaign_id defaults
-- NULL, so every current + future referral stays on the default program until a
-- campaign link explicitly tags it.
--
-- Source spec: docs/strategy/AFFILIATE_CAMPAIGN_BLUEPRINT.md §3, §10.
-- All writes go through the service-role client (RLS bypassed) from audited
-- admin / webhook / server-action code; affiliates READ their own rows; public
-- config + leaderboard rows are world-readable so unauthenticated campaign pages
-- (rules, leaderboard) render without the service role.

-- ─── affiliate_campaigns ─────────────────────────────────────────────────────
-- One config row per campaign. Config-in-code for the first run (the Founding
-- Race is seeded below); a builder UI comes later. commission_structure and
-- competition are typed JSON blobs (shapes documented in the blueprint) so the
-- engine can evolve without a migration per tweak.
CREATE TABLE public.affiliate_campaigns (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  text NOT NULL UNIQUE,        -- public; /c/<slug>/...
  name                  text NOT NULL,
  status                text NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','active','ended','archived')),
  starts_at             timestamptz,
  ends_at               timestamptz,                 -- NULL = open-ended commission, no competition close
  -- eligibility
  eligible_partners     text NOT NULL DEFAULT 'all'
                            CHECK (eligible_partners IN ('all','tagged','invite')),
  eligible_referrals    text NOT NULL DEFAULT 'activated_in_window'
                            CHECK (eligible_referrals IN ('all_time','referred_in_window','activated_in_window')),
  -- how tagged referrals earn: { model:'ladder'|'flat'|'inherit', scope, bands, flat_rate,
  --   flat_type, duration:'once'|'recurring'|'lifetime', recurring_periods }
  commission_structure  jsonb NOT NULL DEFAULT '{"model":"inherit"}'::jsonb,
  -- optional competition overlay: { events, scoring_mode:'total'|'net_change',
  --   count_active_only, each_listing_counts, prizes, tie_breaker, leaderboard_visibility }
  competition           jsonb,                       -- NULL = commission-only campaign (no leaderboard)
  rules_doc_slug        text,                        -- → legal_documents.slug (CPA fixed-URL rules page)
  created_by            uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_campaign_model
    CHECK (commission_structure->>'model' IN ('ladder','flat','inherit'))
);
CREATE UNIQUE INDEX idx_affiliate_campaigns_slug_lower ON public.affiliate_campaigns(lower(slug));
CREATE INDEX idx_affiliate_campaigns_status ON public.affiliate_campaigns(status);

ALTER TABLE public.affiliate_campaigns ENABLE ROW LEVEL SECURITY;
-- Public config: anyone may read a non-draft campaign (public rules + leaderboard
-- pages are unauthenticated). Drafts stay hidden until activated. Writes are
-- service-role only.
CREATE POLICY affiliate_campaigns_public_read ON public.affiliate_campaigns
  FOR SELECT USING (status <> 'draft');

-- ─── campaign_id on the referral (THE mechanism) ─────────────────────────────
-- Nullable. NULL = default program. Set = tagged to that campaign, forever
-- (original binding always wins; a campaign link for an already-bound host is
-- ignored, mirroring today's attribution). ON DELETE SET NULL so archiving a
-- campaign row never orphans / deletes a referral (deletes never happen pre-MVP,
-- but keep the money graph safe by construction).
ALTER TABLE public.affiliate_referrals
  ADD COLUMN campaign_id uuid REFERENCES public.affiliate_campaigns(id) ON DELETE SET NULL;
CREATE INDEX idx_affiliate_referrals_campaign ON public.affiliate_referrals(campaign_id)
  WHERE campaign_id IS NOT NULL;

-- ─── campaign_id on the commission row ───────────────────────────────────────
-- Stamped at accrual so a commission row knows its campaign (for reporting,
-- payout and the campaign P&L). Default-program rows leave it NULL. No FK to keep
-- the money ledger decoupled from campaign lifecycle (the referral already holds
-- the FK); it is a reporting/scoping tag only.
ALTER TABLE public.affiliate_commissions
  ADD COLUMN campaign_id uuid;
CREATE INDEX idx_aff_comm_campaign ON public.affiliate_commissions(campaign_id)
  WHERE campaign_id IS NOT NULL;

-- ─── affiliate_campaign_enrollments ──────────────────────────────────────────
-- Presence drives the Competitions tab + the affiliate's campaign link. One row
-- per (affiliate, campaign).
CREATE TABLE public.affiliate_campaign_enrollments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliate_accounts(id) ON DELETE CASCADE,
  campaign_id  uuid NOT NULL REFERENCES public.affiliate_campaigns(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','withdrawn','removed')),
  enrolled_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uniq_campaign_enrollment UNIQUE (affiliate_id, campaign_id)
);
CREATE INDEX idx_campaign_enroll_campaign ON public.affiliate_campaign_enrollments(campaign_id);

ALTER TABLE public.affiliate_campaign_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY affiliate_campaign_enrollments_own_read ON public.affiliate_campaign_enrollments
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM public.affiliate_accounts WHERE user_id = auth.uid()));

-- ─── affiliate_campaign_floors (prizes) ──────────────────────────────────────
-- A won floor is a permanent MINIMUM rate on THAT campaign's ladder:
-- effective = MAX(band_rate, floor). Campaign-scoped; never touches default
-- per-product referrals. Awarding writes GREATEST(existing, won). One row per
-- (affiliate, campaign).
CREATE TABLE public.affiliate_campaign_floors (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliate_accounts(id) ON DELETE CASCADE,
  campaign_id  uuid NOT NULL REFERENCES public.affiliate_campaigns(id) ON DELETE CASCADE,
  floor_rate   numeric NOT NULL CHECK (floor_rate >= 0 AND floor_rate <= 1),
  won_via      text,                                 -- e.g. 'placing_1', 'placing_2'
  awarded_by   uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  awarded_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uniq_campaign_floor UNIQUE (affiliate_id, campaign_id)
);
CREATE INDEX idx_campaign_floors_campaign ON public.affiliate_campaign_floors(campaign_id);

ALTER TABLE public.affiliate_campaign_floors ENABLE ROW LEVEL SECURITY;
CREATE POLICY affiliate_campaign_floors_own_read ON public.affiliate_campaign_floors
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM public.affiliate_accounts WHERE user_id = auth.uid()));

-- ─── affiliate_campaign_daily_scores ─────────────────────────────────────────
-- Only used for 'net_change' scoring (a window's net change = end − start) and to
-- render leaderboard history. 'total' mode recomputes live and needs no snapshot.
-- One snapshot row per (campaign, affiliate, day). Public-readable — leaderboard
-- history is public aggregate data, no PII.
CREATE TABLE public.affiliate_campaign_daily_scores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL REFERENCES public.affiliate_campaigns(id) ON DELETE CASCADE,
  affiliate_id    uuid NOT NULL REFERENCES public.affiliate_accounts(id) ON DELETE CASCADE,
  score_date      date NOT NULL,
  active_listings integer NOT NULL DEFAULT 0,
  score           numeric NOT NULL DEFAULT 0,        -- weighted score (events × weights)
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uniq_campaign_daily_score UNIQUE (campaign_id, affiliate_id, score_date)
);
CREATE INDEX idx_campaign_daily_scores_lookup
  ON public.affiliate_campaign_daily_scores(campaign_id, score_date);

ALTER TABLE public.affiliate_campaign_daily_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY affiliate_campaign_daily_scores_public_read ON public.affiliate_campaign_daily_scores
  FOR SELECT USING (true);

-- ─── affiliate_accounts presentation fields (co-branded /partners/<slug>) ─────
ALTER TABLE public.affiliate_accounts
  ADD COLUMN display_headline text,
  ADD COLUMN bio              text,
  ADD COLUMN photo_url        text;

COMMENT ON TABLE public.affiliate_campaigns IS
  'Additive campaign layer over the default affiliate program. Referrals tagged via affiliate_referrals.campaign_id earn under this campaign''s commission_structure; the default program is untouched.';
COMMENT ON COLUMN public.affiliate_referrals.campaign_id IS
  'THE mechanism. NULL = default program (per-product + tier). Set = that campaign''s structure. A referral resolves under exactly one rule set → no double-count.';
COMMENT ON COLUMN public.affiliate_commissions.campaign_id IS
  'Reporting/scoping tag stamped at accrual (campaign P&L / payout). NULL for default-program rows. No FK: the referral holds the campaign binding; this is a denormalised tag.';

-- ─── Seed: the Founding Race campaign ────────────────────────────────────────
-- 8-month lifetime ladder + public leaderboard. Config from blueprint §10.
-- Seeded 'draft' so no attribution goes live until the founder flips it to
-- 'active' (and the rules doc + legal store, WS-6, are published). starts_at /
-- ends_at are left NULL here — set at activation (Date.now() is deliberately not
-- computed in a migration; the founder sets the concrete 8-month window on flip).
INSERT INTO public.affiliate_campaigns (slug, name, status, commission_structure, competition, rules_doc_slug)
VALUES (
  'founding-race',
  'Founding Race',
  'draft',
  jsonb_build_object(
    'model', 'ladder',
    'scope', 'subscription',
    'duration', 'lifetime',
    'bands', jsonb_build_array(
      jsonb_build_object('max', 10000, 'rate', 0.10),
      jsonb_build_object('max', 25000, 'rate', 0.15),
      jsonb_build_object('max', 50000, 'rate', 0.20),
      jsonb_build_object('max', null,  'rate', 0.25)
    )
  ),
  jsonb_build_object(
    'events', jsonb_build_object('listing_published', 1),
    'scoring_mode', 'total',
    'count_active_only', true,
    'each_listing_counts', true,
    'tie_breaker', 'earliest_to_final_score',
    'leaderboard_visibility', 'public',
    'prizes', jsonb_build_array(
      jsonb_build_object('placing', 1, 'cash', 15000, 'floor', 0.20),
      jsonb_build_object('placing', 2, 'cash', 7000,  'floor', 0.15),
      jsonb_build_object('placing', 3, 'cash', 3000,  'floor', 0.12),
      jsonb_build_object('milestone', 'first_to_10', 'cash', 2000),
      jsonb_build_object('milestone', 'any_reaching_5_in_30d', 'cash', 1000),
      jsonb_build_object('monthly_top_net_change', 1000)
    )
  ),
  'founding-race-rules'
)
ON CONFLICT (slug) DO NOTHING;
