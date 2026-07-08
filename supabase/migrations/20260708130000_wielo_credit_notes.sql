-- Migration: Wielo-issued credit notes / refunds / adjustments
--
-- The Wielo equivalent of the host `credit_notes` + refund documents: every
-- platform_ledger row that ISN'T a charge (i.e. a refund, goodwill credit or a
-- signed adjustment) mints one downloadable document, with Wielo as the issuing
-- entity (business details frozen from platform_settings at issue time). This is
-- the credit-note sibling of the `wielo_invoices` stack — charges → invoice,
-- everything else → credit note — so EVERY row in the admin revenue ledger has a
-- downloadable document, matching the host ledger.
--
-- DOWN: DROP TRIGGER trg_mint_wielo_credit_note ON platform_ledger;
--       DROP FUNCTION mint_wielo_credit_note_on_ledger_complete();
--       DROP FUNCTION next_wielo_credit_note_number();
--       DROP TABLE wielo_credit_notes;
--       ALTER TABLE platform_counters DROP COLUMN last_credit_note_number;

-- ─── 1. Extend the singleton counter with a credit-note sequence ────────
ALTER TABLE public.platform_counters
  ADD COLUMN IF NOT EXISTS last_credit_note_number integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION next_wielo_credit_note_number()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_next integer;
BEGIN
  INSERT INTO platform_counters (id, last_credit_note_number)
  VALUES (true, 1)
  ON CONFLICT (id) DO UPDATE
    SET last_credit_note_number = platform_counters.last_credit_note_number + 1,
        updated_at = now()
  RETURNING last_credit_note_number INTO v_next;

  RETURN 'WIELO-CN' || to_char(now(), 'YYYY') || '-' || lpad(v_next::text, 4, '0');
END;
$$;

-- ─── 2. wielo_credit_notes ─────────────────────────────────────────────
CREATE TABLE public.wielo_credit_notes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number text NOT NULL UNIQUE,

  -- 'refund' (cash back), 'credit' (goodwill/write-off), 'adjustment' (signed
  -- correction) — mirrors platform_ledger.type minus 'charge'.
  kind               text NOT NULL CHECK (kind IN ('refund','credit','adjustment')),

  -- The ledger row this documents. One document per ledger entry.
  ledger_id          uuid REFERENCES platform_ledger(id) ON DELETE SET NULL,
  user_id            uuid REFERENCES user_profiles(id) ON DELETE SET NULL,

  -- Frozen at issue time so historic documents never change.
  wielo_snapshot     jsonb NOT NULL,   -- Wielo business details (issuer)
  buyer_snapshot     jsonb NOT NULL,   -- the credited user (name, email)
  line_items         jsonb NOT NULL DEFAULT '[]'::jsonb,

  subtotal           numeric NOT NULL DEFAULT 0,
  vat_amount         numeric NOT NULL DEFAULT 0,
  total_amount       numeric NOT NULL DEFAULT 0,   -- magnitude (always positive)
  signed_amount      numeric NOT NULL DEFAULT 0,   -- the ledger's signed amount
  currency           text NOT NULL DEFAULT 'ZAR',

  reason             text,

  status             text NOT NULL DEFAULT 'issued'
                          CHECK (status IN ('issued','cancelled')),
  environment        text NOT NULL DEFAULT 'live'
                          CHECK (environment IN ('test','live')),

  issued_at          timestamptz NOT NULL DEFAULT now(),
  pdf_storage_path   text,
  hosted_token       text NOT NULL UNIQUE DEFAULT gen_url_token(),

  created_at         timestamptz NOT NULL DEFAULT now()
);

-- One document per ledger entry (idempotent minting).
CREATE UNIQUE INDEX uq_wielo_credit_notes_ledger ON public.wielo_credit_notes(ledger_id)
  WHERE ledger_id IS NOT NULL;
CREATE INDEX idx_wielo_credit_notes_user ON public.wielo_credit_notes(user_id);

ALTER TABLE public.wielo_credit_notes ENABLE ROW LEVEL SECURITY;

-- The credited user may read their own documents (Transaction History tab). The
-- public token page + all writes go through the service-role client (RLS bypassed).
CREATE POLICY wielo_credit_notes_own_read ON public.wielo_credit_notes
  FOR SELECT USING (user_id = auth.uid());

COMMENT ON TABLE public.wielo_credit_notes IS
  'Wielo-issued credit notes / refunds / adjustments — one per non-charge platform_ledger row. Wielo is the issuer (wielo_snapshot). Sibling of wielo_invoices.';
COMMENT ON COLUMN public.wielo_credit_notes.total_amount IS
  'Magnitude (always positive); signed_amount keeps the ledger sign for adjustments.';

-- ─── 3. Auto-mint on a completed refund / credit / adjustment ──────────
-- Mirrors mint_wielo_invoice_on_ledger_complete but for the non-charge types, so
-- every completed ledger row gets exactly one document (charge → invoice, else →
-- credit note). Fires on insert of an already-completed row OR when status flips.
CREATE OR REPLACE FUNCTION mint_wielo_credit_note_on_ledger_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_biz      jsonb;
  v_buyer    jsonb;
  v_lines    jsonb;
  v_mag      numeric;
  v_subtotal numeric;
  v_vat      numeric;
  v_has_vat  boolean;
  v_desc     text;
BEGIN
  -- Only completed non-charge rows, once per ledger row. Skip zero.
  IF NEW.status <> 'completed' OR NEW.type NOT IN ('refund','credit','adjustment') THEN
    RETURN NEW;
  END IF;
  IF NEW.amount IS NULL OR NEW.amount = 0 THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM wielo_credit_notes WHERE ledger_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  v_mag := abs(NEW.amount);

  -- Wielo issuer details (single jsonb settings key, '{}' when unset).
  SELECT value INTO v_biz FROM platform_settings WHERE key = 'wielo_business';
  v_biz := COALESCE(v_biz, '{}'::jsonb);

  -- Buyer snapshot.
  SELECT jsonb_build_object('name', full_name, 'email', email)
    INTO v_buyer FROM user_profiles WHERE id = NEW.user_id;
  v_buyer := COALESCE(v_buyer, '{}'::jsonb);

  v_desc := COALESCE(NULLIF(btrim(NEW.reason), ''),
    CASE NEW.type
      WHEN 'refund' THEN 'Refund'
      WHEN 'credit' THEN 'Goodwill credit'
      ELSE 'Account adjustment'
    END);

  -- VAT split out of the (inclusive) magnitude only when Wielo is VAT-registered.
  v_has_vat := NULLIF(btrim(v_biz->>'vat_number'), '') IS NOT NULL;
  IF v_has_vat THEN
    v_subtotal := round(v_mag / 1.15, 2);
    v_vat      := round(v_mag - v_subtotal, 2);
  ELSE
    v_subtotal := v_mag;
    v_vat      := 0;
  END IF;

  v_lines := jsonb_build_array(jsonb_build_object(
    'description', v_desc, 'quantity', 1, 'unit_price', v_mag, 'subtotal', v_mag));

  INSERT INTO wielo_credit_notes (
    credit_note_number, kind, ledger_id, user_id,
    wielo_snapshot, buyer_snapshot, line_items,
    subtotal, vat_amount, total_amount, signed_amount, currency,
    reason, status, environment, issued_at
  ) VALUES (
    next_wielo_credit_note_number(), NEW.type, NEW.id, NEW.user_id,
    v_biz, v_buyer, v_lines,
    v_subtotal, v_vat, v_mag, NEW.amount, NEW.currency,
    NEW.reason, 'issued', NEW.environment, now()
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mint_wielo_credit_note
  AFTER INSERT OR UPDATE OF status ON public.platform_ledger
  FOR EACH ROW EXECUTE FUNCTION mint_wielo_credit_note_on_ledger_complete();
