-- Migration: Banking & Business details — enterprise reshape
--
-- 1. Drops the vestigial hosts.banking_details jsonb (replaced by the dedicated
--    eft_banking_details table — pre-MVP, no real users, safe per CLAUDE.md
--    "Pre-MVP data policy").
-- 2. Reshapes eft_banking_details from a one-row-per-host table into a multi-
--    account table with a default flag (drops UNIQUE host_id, adds label /
--    account_type / is_default / is_archived, with a PARTIAL UNIQUE INDEX
--    enforcing "one default per host, archived rows excluded").
-- 3. Adds host_business_details (1:1) for VAT / company-reg / billing-address
--    info that needs to appear on invoices & quotes.
-- 4. Adds RLS policies for both tables — host-manage-own only. Guest exposure
--    of banking details flows through an Edge Function using the service role,
--    per AGENT_RULES.md §1.5.
-- 5. Seeds a `banking_details` feature key on plan_features for every existing
--    plan, all enabled (mirrors the seasonal_pricing precedent — the gate
--    wiring is in place; future plans can disable it).
-- 6. Replaces on_booking_confirmed_create_invoice() to capture banking +
--    business into invoices.host_snapshot at issue time. account_number is
--    snapshotted AS CIPHERTEXT — the PDF route handler decrypts on demand.

-- ─── 1. Drop vestigial column ─────────────────────────────────
ALTER TABLE public.hosts DROP COLUMN IF EXISTS banking_details;

-- ─── 2. Reshape eft_banking_details ───────────────────────────
ALTER TABLE public.eft_banking_details
  DROP CONSTRAINT IF EXISTS eft_banking_details_host_id_key;

ALTER TABLE public.eft_banking_details
  ADD COLUMN IF NOT EXISTS label        text    NOT NULL DEFAULT 'Primary',
  ADD COLUMN IF NOT EXISTS account_type text    NOT NULL DEFAULT 'cheque'
                                       CHECK (account_type IN
                                         ('cheque','savings','transmission','business')),
  ADD COLUMN IF NOT EXISTS is_default   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_archived  boolean NOT NULL DEFAULT false;

-- Partial unique index — one default per host, ignoring archived rows.
-- The Server Action MUST clear the previous default in the same transaction
-- before promoting a new one, or this index rejects the write.
CREATE UNIQUE INDEX IF NOT EXISTS eft_banking_one_default_per_host
  ON public.eft_banking_details(host_id)
  WHERE is_default = true AND is_archived = false;

CREATE INDEX IF NOT EXISTS idx_eft_banking_host_active
  ON public.eft_banking_details(host_id)
  WHERE is_archived = false;

COMMENT ON COLUMN public.eft_banking_details.label IS
  'Host-facing label, e.g. "FNB Business" or "ABSA Personal". Free text.';
COMMENT ON COLUMN public.eft_banking_details.is_default IS
  'Exactly one default per host (enforced by partial unique index). The default account is what appears on invoices, quotes, and the guest EFT payment flow.';

-- ─── 3. host_business_details ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.host_business_details (
  host_id                     uuid PRIMARY KEY
                               REFERENCES public.hosts(id) ON DELETE CASCADE,
  legal_name                  text,
  trading_name                text,
  vat_number                  text,
  company_registration_number text,
  billing_address_line1       text,
  billing_address_line2       text,
  billing_city                text,
  billing_postcode            text,
  billing_country             text NOT NULL DEFAULT 'ZA',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.host_business_details ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.host_business_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_eft_banking BEFORE UPDATE ON public.eft_banking_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE public.host_business_details IS
  'Tax / business registration / billing-address info shown on invoices and quotes. 1:1 with hosts.';

-- ─── 4. RLS policies — host manage own, no anon SELECT ────────
-- The Edge Function eft-banking-details uses the service role to expose
-- banking to a verified guest on a pending_eft booking; no anon policy needed.

DROP POLICY IF EXISTS eft_banking_owner_all ON public.eft_banking_details;
CREATE POLICY eft_banking_owner_all ON public.eft_banking_details
  FOR ALL TO authenticated
  USING (host_id IN (SELECT id FROM public.hosts WHERE user_id = auth.uid()))
  WITH CHECK (host_id IN (SELECT id FROM public.hosts WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS business_owner_all ON public.host_business_details;
CREATE POLICY business_owner_all ON public.host_business_details
  FOR ALL TO authenticated
  USING (host_id IN (SELECT id FROM public.hosts WHERE user_id = auth.uid()))
  WITH CHECK (host_id IN (SELECT id FROM public.hosts WHERE user_id = auth.uid()));

-- ─── 5. plan_features — banking_details key ───────────────────
-- Enabled across every existing plan. Gate wiring is in place via
-- check_feature_permission so it can be disabled per-plan later without
-- code changes.
INSERT INTO public.plan_features (plan, feature_key, is_enabled, limit_value, description)
SELECT DISTINCT plan, 'banking_details', true, NULL::integer,
       'Banking accounts + tax/business details for EFT and invoicing'
FROM public.plan_features
ON CONFLICT (plan, feature_key) DO UPDATE
  SET is_enabled = true,
      limit_value = NULL::integer;

-- ─── 6. Invoice trigger — capture banking + business ──────────
CREATE OR REPLACE FUNCTION on_booking_confirmed_create_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_host_id          uuid;
  v_host_handle      text;
  v_host_display     text;
  v_host_email       text;
  v_host_phone       text;
  v_listing_name     text;
  v_guest_full_name  text;
  v_guest_email      text;
  v_guest_phone      text;
  v_lines            jsonb;
  v_addons           jsonb;
  v_rooms            jsonb;
  v_banking          jsonb;
  v_business         jsonb;
  v_number           text;
BEGIN
  IF NEW.status = 'confirmed' AND COALESCE(OLD.status, '') <> 'confirmed' THEN
    -- Idempotent: skip if an invoice already exists.
    IF EXISTS (SELECT 1 FROM invoices WHERE booking_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    SELECT h.id, h.handle, h.display_name, up.email, up.phone
      INTO v_host_id, v_host_handle, v_host_display, v_host_email, v_host_phone
      FROM hosts h
      JOIN user_profiles up ON up.id = h.user_id
      WHERE h.id = NEW.host_id;

    SELECT name INTO v_listing_name FROM listings WHERE id = NEW.listing_id;

    SELECT full_name, email, phone
      INTO v_guest_full_name, v_guest_email, v_guest_phone
      FROM user_profiles WHERE id = NEW.guest_id;

    -- Snapshot the host's default non-archived banking account. account_number
    -- is encrypted at app layer; we copy the ciphertext verbatim and let the
    -- PDF route handler decrypt on demand. NULL if the host has not set up
    -- banking yet — invoice still issues, banking block just doesn't render.
    SELECT jsonb_build_object(
             'label',            label,
             'bank_name',        bank_name,
             'account_holder',   account_holder,
             'account_number',   account_number,
             'account_type',     account_type,
             'branch_code',      branch_code,
             'swift_code',       swift_code,
             'reference_format', reference_format
           )
      INTO v_banking
      FROM eft_banking_details
      WHERE host_id = NEW.host_id
        AND is_default = true
        AND is_archived = false
      LIMIT 1;

    SELECT jsonb_build_object(
             'legal_name',                  legal_name,
             'trading_name',                trading_name,
             'vat_number',                  vat_number,
             'company_registration_number', company_registration_number,
             'billing_address_line1',       billing_address_line1,
             'billing_address_line2',       billing_address_line2,
             'billing_city',                billing_city,
             'billing_postcode',            billing_postcode,
             'billing_country',             billing_country
           )
      INTO v_business
      FROM host_business_details
      WHERE host_id = NEW.host_id;

    SELECT jsonb_agg(jsonb_build_object(
             'label',      label,
             'quantity',   quantity,
             'unit_price', unit_price,
             'subtotal',   subtotal
           ) ORDER BY sort_order)
      INTO v_addons
      FROM booking_addons WHERE booking_id = NEW.id;

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
      'listing_name',  v_listing_name,
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
      invoice_number, booking_id, host_id, guest_id,
      host_snapshot, guest_snapshot, line_items,
      subtotal, vat_amount, total_amount, currency,
      status, issued_at, paid_at
    ) VALUES (
      v_number, NEW.id, NEW.host_id, NEW.guest_id,
      jsonb_build_object(
        'host_id',       v_host_id,
        'display_name',  v_host_display,
        'handle',        v_host_handle,
        'email',         v_host_email,
        'phone',         v_host_phone,
        'banking',       v_banking,
        'business',      v_business,
        'booking_ref',   NEW.reference
      ),
      jsonb_build_object(
        'guest_id', NEW.guest_id,
        'name',     COALESCE(NEW.guest_name,  v_guest_full_name),
        'email',    COALESCE(NEW.guest_email, v_guest_email),
        'phone',    COALESCE(NEW.guest_phone, v_guest_phone)
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
