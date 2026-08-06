-- Strategy change (founder, 2026-08-06): no competition runs in the near term.
-- Pause the "Founding Race" affiliate competition by moving it active → draft.
--
-- Why draft (not delete/archive):
--   * 'draft' removes it from EVERY reader — all competition surfaces gate on
--     status = 'active' (signup free-trial via isCampaignWindowOpen, /r?c= tagging,
--     the daily campaign-comms sweep + kickoff/enrollment emails, the public
--     leaderboard/race pages, the partner co-branded banner, the portal campaigns
--     tab). New referrals simply fall back to the default per-product affiliate
--     rate. RLS also hides draft campaigns from public read.
--   * It is fully REVERSIBLE — one "Launch" click in Admin → Affiliates → Campaigns
--     relaunches it when strategy allows.
--   * It is NON-DESTRUCTIVE — hard-deleting would CASCADE daily scores / enrollments
--     / floors / prize awards and NULL out affiliate_referrals.campaign_id (un-tagging
--     any earned commission). We keep commission_structure + competition JSONB intact
--     so already-bound referrals keep paying their snapshotted rate.
--
-- Independent (left untouched): platform_payment_settings.founding_offers_open is
-- already false, and the Founder product keeps its founding_price for future use.
-- Standard's 14-day product trial is unaffected — trials do not depend on the campaign.

UPDATE public.affiliate_campaigns
   SET status = 'draft', updated_at = now()
 WHERE slug = 'founding-race' AND status = 'active';
