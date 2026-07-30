-- Migration: click-time commission capture + first-click attribution (SoT §3, §10.4).
--
-- SoT §3.2 rule 2: "the rate is taken at CLICK, not at signup." A host who clicks
-- a competition link during the Race but signs up after it closes must still be
-- stamped at the competition rate.
--
-- SECURITY: the rate must NOT be trusted from the client cookie (a forged cookie
-- could claim 100%). So the competition's commission_structure is captured
-- SERVER-SIDE into the click row at click time; bindAffiliateReferral reads it
-- back via the cookie's click id and stamps the referral snapshot from it —
-- regardless of the campaign's current status. This both fixes the shipped
-- "signup after close drops to default" gap and keeps the money server-trusted.
--
-- SoT §3.2 rule 1 (first touch wins): attribution_model → 'first_click' activates
-- the existing guard in /r/[slug] that keeps a still-valid first cookie.

ALTER TABLE public.affiliate_clicks
  ADD COLUMN IF NOT EXISTS commission_snapshot jsonb;

COMMENT ON COLUMN public.affiliate_clicks.commission_snapshot IS
  'Competition commission_structure captured at click time (server-trusted). bindAffiliateReferral copies it onto affiliate_referrals.commission_snapshot so the rate is fixed at click, survives campaign end, and cannot be forged via the cookie. NULL for default-programme clicks.';

-- First-touch-wins (rule 1). The /r/[slug] handler already honours this when the
-- model is 'first_click' — it keeps an existing, still-valid cookie.
UPDATE public.affiliate_settings
SET attribution_model = 'first_click',
    updated_at = now()
WHERE id = true;
