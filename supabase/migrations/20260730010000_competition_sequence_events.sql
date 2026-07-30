-- Migration: register the six competition-sequence notification events.
--
-- These back the new Founding Race emails managed from the Communications hub /
-- competition Email tab. The registry (apps/web/lib/notifications/registry.ts) +
-- email registry hold the runtime builders; this row set is what the settings UI,
-- admin send-history, override layer, and audit read from.
--
-- category_id maps to notification_categories (partner opt-out grouping):
--   • enrolled           → account_security (an account milestone)
--   • referral_activated → payments_refunds (progress toward commission)
--   • milestone_hit      → payments_refunds (carries a cash prize)
--   • kickoff/standings/ending_soon → marketing_tips (competition updates)

INSERT INTO public.notification_events
  (kind, category_id, feature, severity, email_template_key,
   push_supported, in_app_supported, human_label, human_description)
VALUES
  ('campaign_partner_enrolled', 'account_security', 'subscription', 'default',
   'campaign_partner_enrolled', true, true,
   'Partner enrolled',
   'Sent to a partner when they join a competition — the "you''re in" welcome.'),

  ('campaign_referral_activated', 'payments_refunds', 'subscription', 'default',
   'campaign_referral_activated', true, true,
   'Referral activated',
   'Sent to a partner when a host they referred publishes a listing (a point on the competition board).'),

  ('campaign_milestone_hit', 'payments_refunds', 'subscription', 'high',
   'campaign_milestone_hit', true, true,
   'Milestone hit',
   'Sent to a partner when they reach a competition milestone (e.g. first to 10 live listings), with the prize.'),

  ('campaign_kickoff', 'marketing_tips', 'subscription', 'default',
   'campaign_kickoff', true, true,
   'Kickoff announcement',
   'Sent to partners when a competition opens — the launch announcement.'),

  ('campaign_standings_digest', 'marketing_tips', 'subscription', 'info',
   'campaign_standings_digest', true, true,
   'Standings digest',
   'Scheduled rank/score update to each partner (weekly or monthly), showing where they stand.'),

  ('campaign_ending_soon', 'marketing_tips', 'subscription', 'default',
   'campaign_ending_soon', true, true,
   'Ending soon',
   'Scheduled final-push reminder to partners a set time before a competition ends.')
ON CONFLICT (kind) DO UPDATE
  SET category_id       = EXCLUDED.category_id,
      feature           = EXCLUDED.feature,
      severity          = EXCLUDED.severity,
      email_template_key = EXCLUDED.email_template_key,
      push_supported    = EXCLUDED.push_supported,
      in_app_supported  = EXCLUDED.in_app_supported,
      human_label       = EXCLUDED.human_label,
      human_description = EXCLUDED.human_description;
