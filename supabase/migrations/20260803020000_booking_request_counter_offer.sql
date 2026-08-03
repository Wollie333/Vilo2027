-- Counter-offer on host decline — a host can decline a guest's date-change
-- request while SUGGESTING alternative dates. The request goes back to the
-- guest, who accepts (applies the new dates) or declines.
--
-- Adds a 'countered' status (the ball is in the guest's court) and the two
-- notification_events rows for the new events (push + in-app only, no email
-- template). Pre-MVP: reshaping the CHECK constraint in place is fine.
--
--   Lifecycle:  pending ──host counter──▶ countered ──guest accept──▶ approved
--                                                    └─guest decline─▶ declined
--   The counter dates live in payload.counter = { check_in, check_out, at }.

-- ─── 1. Allow the 'countered' status ───────────────────────────────────
ALTER TABLE public.booking_requests
  DROP CONSTRAINT IF EXISTS booking_requests_status_check;
ALTER TABLE public.booking_requests
  ADD CONSTRAINT booking_requests_status_check
  CHECK (status IN ('pending', 'countered', 'approved', 'declined', 'cancelled'));

-- Let the guest UPDATE their own countered request (accept/decline). The server
-- actions use the service-role client, so this only keeps RLS coherent for any
-- direct client access. WITH CHECK omitted → USING also gates the new row, so a
-- guest can only touch a row that is (still) theirs + countered.
DROP POLICY IF EXISTS "guest_respond_countered_booking_request" ON public.booking_requests;
CREATE POLICY "guest_respond_countered_booking_request" ON public.booking_requests
  FOR UPDATE USING (guest_id = auth.uid() AND status = 'countered');

-- ─── 2. Seed the two counter-offer events ──────────────────────────────
INSERT INTO public.notification_events
  (kind, category_id, feature, severity, email_template_key,
   push_supported, in_app_supported, human_label, human_description)
VALUES
  ('booking_change_countered_guest', 'bookings', 'booking', 'high', NULL,
   true, true,
   'Host suggested alternative dates',
   'Sent to the guest when the host declines their date-change request but proposes different dates to consider.'),

  ('booking_counter_response_host', 'bookings', 'booking', 'high', NULL,
   true, true,
   'Guest responded to your suggested dates',
   'Sent to the host when the guest accepts or declines the alternative dates the host suggested.')
ON CONFLICT (kind) DO UPDATE
  SET category_id        = EXCLUDED.category_id,
      feature            = EXCLUDED.feature,
      severity           = EXCLUDED.severity,
      email_template_key = EXCLUDED.email_template_key,
      push_supported     = EXCLUDED.push_supported,
      in_app_supported   = EXCLUDED.in_app_supported,
      human_label        = EXCLUDED.human_label,
      human_description  = EXCLUDED.human_description;
