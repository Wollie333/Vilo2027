-- Migration: booking_requests — unified guest→host requests on a booking.
--
-- A guest action on a confirmed booking that the host must see and manage:
-- a date/guest-change request, or (informational) an add-on the guest attached.
-- Refunds keep their own richer `refund_requests` table; the host-side banner
-- reads BOTH. Every guest action also posts an inbox system card + dispatches a
-- host notification (handled in app code, not here).
--
-- Mirrors the refund_requests RLS shape: guest owns/creates/cancels their own
-- pending request; host views + actions requests on their listings.

CREATE TABLE IF NOT EXISTS public.booking_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  host_id       uuid NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  guest_id      uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  -- 'date_change' / 'guest_change' are host-approved; 'addon' is informational
  -- (the charge is applied immediately, the row just surfaces the banner/card).
  type          text NOT NULL CHECK (type IN ('date_change', 'guest_change', 'addon')),
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'declined', 'cancelled')),
  -- The proposed change / attached extra:
  --   date_change  -> { check_in, check_out }
  --   guest_change -> { guests_count }
  --   addon        -> { addon_id, name, amount, currency }
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  guest_message text,
  host_note     text,
  decline_reason text,
  actioned_by   uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  actioned_at   timestamptz,
  deleted_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_requests_host_status_idx
  ON public.booking_requests (host_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS booking_requests_booking_idx
  ON public.booking_requests (booking_id) WHERE deleted_at IS NULL;

-- keep updated_at fresh (shared trigger fn already exists)
DROP TRIGGER IF EXISTS set_updated_at ON public.booking_requests;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.booking_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

-- Guest: own rows; create their own; cancel while still pending.
DROP POLICY IF EXISTS "guest_own_booking_requests" ON public.booking_requests;
CREATE POLICY "guest_own_booking_requests" ON public.booking_requests
  FOR SELECT USING (guest_id = auth.uid());
DROP POLICY IF EXISTS "guest_create_booking_request" ON public.booking_requests;
CREATE POLICY "guest_create_booking_request" ON public.booking_requests
  FOR INSERT WITH CHECK (guest_id = auth.uid());
DROP POLICY IF EXISTS "guest_cancel_pending_booking_request" ON public.booking_requests;
CREATE POLICY "guest_cancel_pending_booking_request" ON public.booking_requests
  FOR UPDATE USING (guest_id = auth.uid() AND status = 'pending');

-- Host: view + action requests on their own listings.
DROP POLICY IF EXISTS "host_view_booking_requests" ON public.booking_requests;
CREATE POLICY "host_view_booking_requests" ON public.booking_requests
  FOR SELECT USING (host_id = get_my_host_id());
DROP POLICY IF EXISTS "host_action_booking_requests" ON public.booking_requests;
CREATE POLICY "host_action_booking_requests" ON public.booking_requests
  FOR UPDATE USING (host_id = get_my_host_id() AND status = 'pending');

-- Staff (delegated host access) mirror the host policies.
DROP POLICY IF EXISTS "staff_view_booking_requests" ON public.booking_requests;
CREATE POLICY "staff_view_booking_requests" ON public.booking_requests
  FOR SELECT USING (host_id = get_my_host_id_as_staff());
DROP POLICY IF EXISTS "staff_action_booking_requests" ON public.booking_requests;
CREATE POLICY "staff_action_booking_requests" ON public.booking_requests
  FOR UPDATE USING (host_id = get_my_host_id_as_staff() AND status = 'pending');

-- Admin full access.
DROP POLICY IF EXISTS "admin_full_booking_requests" ON public.booking_requests;
CREATE POLICY "admin_full_booking_requests" ON public.booking_requests
  FOR ALL USING (is_super_admin());
