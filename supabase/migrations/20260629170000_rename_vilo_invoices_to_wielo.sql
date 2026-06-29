-- Migration: rename the Vilo-issued invoice stack → Wielo (brand rename).
--
-- Pre-MVP: there is no production data to preserve beyond the rename itself, so
-- this simply realigns every "vilo" object name with the Wielo brand:
--   table vilo_invoices            → wielo_invoices
--   column vilo_snapshot           → wielo_snapshot
--   indexes / constraints / policy → wielo_*
--   fn next_vilo_invoice_number    → next_wielo_invoice_number (+ WIELO-INV prefix)
--   fn mint_vilo_invoice_*         → mint_wielo_invoice_* (+ trigger trg_mint_wielo_invoice)
--   platform_settings key 'vilo_business' → 'wielo_business'
--
-- Guarded with IF EXISTS / catalog checks so it is idempotent and never
-- half-applies. The public invoice route moves to /wielo-invoice/[token] in app code.

-- ─── 1. Table + column ─────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.vilo_invoices RENAME TO wielo_invoices;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wielo_invoices'
      AND column_name = 'vilo_snapshot'
  ) THEN
    ALTER TABLE public.wielo_invoices RENAME COLUMN vilo_snapshot TO wielo_snapshot;
  END IF;
END $$;

-- ─── 2. Indexes ────────────────────────────────────────────────────────
ALTER INDEX IF EXISTS public.uq_vilo_invoices_ledger RENAME TO uq_wielo_invoices_ledger;
ALTER INDEX IF EXISTS public.idx_vilo_invoices_user  RENAME TO idx_wielo_invoices_user;
ALTER INDEX IF EXISTS public.idx_vilo_invoices_order RENAME TO idx_wielo_invoices_order;

-- ─── 3. Constraints (PK / unique / FK) ─────────────────────────────────
DO $$
DECLARE
  pair text[];
  pairs text[][] := ARRAY[
    ['vilo_invoices_pkey',                 'wielo_invoices_pkey'],
    ['vilo_invoices_invoice_number_key',   'wielo_invoices_invoice_number_key'],
    ['vilo_invoices_hosted_token_key',     'wielo_invoices_hosted_token_key'],
    ['vilo_invoices_ledger_id_fkey',       'wielo_invoices_ledger_id_fkey'],
    ['vilo_invoices_order_id_fkey',        'wielo_invoices_order_id_fkey'],
    ['vilo_invoices_subscription_id_fkey', 'wielo_invoices_subscription_id_fkey'],
    ['vilo_invoices_user_id_fkey',         'wielo_invoices_user_id_fkey']
  ];
BEGIN
  FOREACH pair SLICE 1 IN ARRAY pairs LOOP
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = pair[1] AND conrelid = 'public.wielo_invoices'::regclass
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.wielo_invoices RENAME CONSTRAINT %I TO %I', pair[1], pair[2]
      );
    END IF;
  END LOOP;
END $$;

-- ─── 4. RLS policy ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'wielo_invoices'
      AND policyname = 'vilo_invoices_own_read'
  ) THEN
    ALTER POLICY vilo_invoices_own_read ON public.wielo_invoices
      RENAME TO wielo_invoices_own_read;
  END IF;
END $$;

-- ─── 5. platform_settings key (issuer business identity) ───────────────
UPDATE public.platform_settings SET key = 'wielo_business' WHERE key = 'vilo_business';

-- ─── 6. Invoice number generator (new name + WIELO-INV prefix) ─────────
CREATE OR REPLACE FUNCTION next_wielo_invoice_number()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_next integer;
BEGIN
  INSERT INTO platform_counters (id, last_invoice_number)
  VALUES (true, 1)
  ON CONFLICT (id) DO UPDATE
    SET last_invoice_number = platform_counters.last_invoice_number + 1,
        updated_at = now()
  RETURNING last_invoice_number INTO v_next;

  RETURN 'WIELO-INV' || to_char(now(), 'YYYY') || '-' || lpad(v_next::text, 4, '0');
END;
$$;
DROP FUNCTION IF EXISTS next_vilo_invoice_number();

-- ─── 7. Mint trigger function + trigger (drop old, create renamed) ─────
DROP TRIGGER IF EXISTS trg_mint_vilo_invoice ON public.platform_ledger;
DROP FUNCTION IF EXISTS mint_vilo_invoice_on_ledger_complete();

CREATE OR REPLACE FUNCTION mint_wielo_invoice_on_ledger_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_biz      jsonb;
  v_buyer    jsonb;
  v_lines    jsonb;
  v_subtotal numeric;
  v_vat      numeric;
  v_total    numeric;
  v_has_vat  boolean;
  v_desc     text;
  v_pname    text;
  v_order_id uuid;
  v_inv_id   uuid;
BEGIN
  -- Only completed inbound charges, once per ledger row. Skip zero/free.
  IF NEW.status <> 'completed' OR NEW.type <> 'charge' THEN RETURN NEW; END IF;
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM wielo_invoices WHERE ledger_id = NEW.id) THEN RETURN NEW; END IF;

  -- Wielo issuer details (single jsonb settings key, '{}' when unset).
  SELECT value INTO v_biz FROM platform_settings WHERE key = 'wielo_business';
  v_biz := COALESCE(v_biz, '{}'::jsonb);

  -- Buyer snapshot.
  SELECT jsonb_build_object('name', full_name, 'email', email)
    INTO v_buyer FROM user_profiles WHERE id = NEW.user_id;
  v_buyer := COALESCE(v_buyer, '{}'::jsonb);

  -- Description: the product name if we can resolve the order, else the reason.
  SELECT id, product_name INTO v_order_id, v_pname
    FROM product_orders WHERE provider_reference = NEW.provider_reference;
  v_desc := COALESCE(v_pname, NEW.reason, 'Wielo purchase');

  -- VAT is split out of the (inclusive) total only when Wielo is VAT-registered.
  v_total   := NEW.amount;
  v_has_vat := NULLIF(btrim(v_biz->>'vat_number'), '') IS NOT NULL;
  IF v_has_vat THEN
    v_subtotal := round(v_total / 1.15, 2);
    v_vat      := round(v_total - v_subtotal, 2);
  ELSE
    v_subtotal := v_total;
    v_vat      := 0;
  END IF;

  v_lines := jsonb_build_array(jsonb_build_object(
    'description', v_desc, 'quantity', 1, 'unit_price', v_total, 'subtotal', v_total));

  INSERT INTO wielo_invoices (
    invoice_number, ledger_id, order_id, subscription_id, user_id,
    wielo_snapshot, buyer_snapshot, line_items,
    subtotal, vat_amount, total_amount, currency,
    status, environment, issued_at, paid_at
  ) VALUES (
    next_wielo_invoice_number(), NEW.id, v_order_id, NEW.subscription_id, NEW.user_id,
    v_biz, v_buyer, v_lines,
    v_subtotal, v_vat, v_total, NEW.currency,
    'paid', NEW.environment, now(), COALESCE(NEW.paid_at, now())
  )
  RETURNING id INTO v_inv_id;

  -- Link the ledger row to its invoice (UPDATE OF invoice_id won't re-fire).
  UPDATE platform_ledger SET invoice_id = v_inv_id WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mint_wielo_invoice
  AFTER INSERT OR UPDATE OF status ON public.platform_ledger
  FOR EACH ROW EXECUTE FUNCTION mint_wielo_invoice_on_ledger_complete();

COMMENT ON TABLE public.wielo_invoices IS
  'Wielo-issued invoices for product/subscription purchases. Wielo is the issuer (wielo_snapshot). Not the host booking invoice (see invoices).';
