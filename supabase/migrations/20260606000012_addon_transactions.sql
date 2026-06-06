-- Migration: post-booking add-on transactions = supplementary invoices.
--
-- A booking can now carry MORE than one invoice: the original 'booking' invoice
-- (minted on confirm) plus one 'addon' invoice per post-booking add-on charge,
-- each linked to its own payment record. This drops the one-invoice-per-booking
-- rule and tags every invoice with a kind. Add-on rows also record where they
-- came from (quote / host_added / guest_added) and which invoice billed them.

-- ── invoices: allow many per booking, tag kind, link a payment ─────
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_booking_id_key;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'booking'
    CHECK (kind IN ('booking','addon')),
  ADD COLUMN IF NOT EXISTS payment_id uuid
    REFERENCES public.payments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_booking_id ON public.invoices(booking_id);

COMMENT ON COLUMN public.invoices.kind IS
  'booking = the original stay invoice (one per booking); addon = a supplementary invoice for a post-booking add-on charge.';
COMMENT ON COLUMN public.invoices.payment_id IS
  'The payment this invoice was settled by (set for paid addon invoices).';

-- ── booking_addons: provenance + which invoice billed it ───────────
ALTER TABLE public.booking_addons
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'quote'
    CHECK (source IN ('quote','host_added','guest_added')),
  ADD COLUMN IF NOT EXISTS invoice_id uuid
    REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS added_by uuid
    REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at_tx timestamptz;

COMMENT ON COLUMN public.booking_addons.source IS
  'quote = came across from the quote/booking at creation; host_added / guest_added = added to the booking after it was created (its own addon invoice).';

-- A guest may add extras to their OWN booking after it is created. Inserts still
-- go through a service-role server action (which verifies ownership), so no new
-- write policy is needed — guests keep their existing read access.

-- ── confirm-invoice trigger: scope idempotency to the booking invoice ─
-- With multiple invoices per booking, the "skip if one exists" guard must only
-- look at the kind='booking' invoice, or an addon invoice would block the main
-- one. (Addons are only ever added AFTER confirm, so the main one comes first —
-- this is belt-and-braces.)
CREATE OR REPLACE FUNCTION on_booking_confirmed_create_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_host       hosts%ROWTYPE;
  v_listing    listings%ROWTYPE;
  v_lines      jsonb;
  v_addons     jsonb;
  v_rooms      jsonb;
  v_number     text;
BEGIN
  IF NEW.status = 'confirmed' AND COALESCE(OLD.status, '') <> 'confirmed' THEN
    IF EXISTS (
      SELECT 1 FROM invoices WHERE booking_id = NEW.id AND kind = 'booking'
    ) THEN
      RETURN NEW;
    END IF;

    SELECT * INTO v_host    FROM hosts    WHERE id = NEW.host_id;
    SELECT * INTO v_listing FROM listings WHERE id = NEW.listing_id;

    -- Only the add-ons that came with the original booking belong on the main
    -- invoice; post-booking add-ons get their own supplementary invoices.
    SELECT jsonb_agg(jsonb_build_object(
             'label',      label,
             'quantity',   quantity,
             'unit_price', unit_price,
             'subtotal',   subtotal
           ) ORDER BY sort_order)
      INTO v_addons
      FROM booking_addons WHERE booking_id = NEW.id AND source = 'quote';

    SELECT jsonb_agg(jsonb_build_object(
             'room_id',       br.room_id,
             'room_name',     lr.name,
             'base_amount',   br.base_amount,
             'cleaning_fee',  br.cleaning_fee
           ))
      INTO v_rooms
      FROM booking_rooms br
      JOIN listing_rooms lr ON lr.id = br.room_id
      WHERE br.booking_id = NEW.id;

    v_lines := jsonb_build_object(
      'listing_name',  v_listing.name,
      'check_in',      NEW.check_in,
      'check_out',     NEW.check_out,
      'nights',        NEW.nights,
      'scope',         NEW.scope,
      'base_amount',   NEW.base_amount,
      'cleaning_fee',  NEW.cleaning_fee,
      'rooms',         COALESCE(v_rooms, '[]'::jsonb),
      'addons',        COALESCE(v_addons, '[]'::jsonb)
    );

    v_number := next_invoice_number(NEW.host_id);

    INSERT INTO invoices (
      invoice_number, booking_id, host_id, guest_id, kind,
      host_snapshot, guest_snapshot, line_items,
      subtotal, vat_amount, total_amount, currency,
      status, issued_at, paid_at
    ) VALUES (
      v_number, NEW.id, NEW.host_id, NEW.guest_id, 'booking',
      jsonb_build_object(
        'host_id',      v_host.id,
        'display_name', v_host.display_name,
        'handle',       v_host.handle,
        'email',        v_host.contact_email,
        'phone',        v_host.contact_phone
      ),
      jsonb_build_object(
        'guest_id', NEW.guest_id,
        'name',     COALESCE(NEW.guest_name,  (SELECT full_name FROM user_profiles WHERE id = NEW.guest_id)),
        'email',    COALESCE(NEW.guest_email, (SELECT email     FROM user_profiles WHERE id = NEW.guest_id)),
        'phone',    NEW.guest_phone
      ),
      v_lines,
      NEW.total_amount, 0, NEW.total_amount, NEW.currency,
      CASE WHEN NEW.payment_status = 'completed' THEN 'paid' ELSE 'issued' END,
      now(),
      CASE WHEN NEW.payment_status = 'completed' THEN now() ELSE NULL END
    );
  END IF;
  RETURN NEW;
END;
$$;
