-- Migration: Founding Programme config alignment (SoT §10.3 / §10.5 / §10.6).
-- Source of truth: docs/strategy/WIELO_FOUNDING_PROGRAMME.md.
--
-- Low-risk config/data only (pre-MVP, admin-editable):
--   • Cookie window 30 → 90 days (§3.1 / §10.3). Payload-shape + click-time rate
--     stamping are a separate, larger change (§10.4) — not here.
--   • Commission hold 30 → 33 days: payable on day 33 after a payment clears
--     (§4.1 — 30-day refund window + 3-day settlement).
--   • Founding Race dates: opens 1 Oct 2026, closes 28 Feb 2027 (§5.1, confirmed).
--   • Add the monthly net-change prize (R1 000 to each month's top mover, §5.5).
--     Placings + milestones already present; Fast Start (non-competitive) needs a
--     new award type and lands with the prize-engine work, not here.

UPDATE public.affiliate_settings
SET cookie_days = 90,
    hold_days   = 33,
    updated_at  = now()
WHERE id = true;

UPDATE public.affiliate_campaigns
SET starts_at = '2026-10-01T00:00:00+02:00',
    ends_at   = '2027-02-28T23:59:59+02:00',
    competition = jsonb_set(
      competition,
      '{prizes}',
      '[
        {"placing": 1, "cash": 15000},
        {"placing": 2, "cash": 7500},
        {"placing": 3, "cash": 5000},
        {"milestone": "first_host_live", "cash": 500},
        {"milestone": "first_to_10", "cash": 2000},
        {"milestone": "first_to_25", "cash": 5000},
        {"monthly_top_net_change": 1000}
      ]'::jsonb
    )
WHERE slug = 'founding-race';
