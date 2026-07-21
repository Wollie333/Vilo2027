-- WS-6b — signed affiliate agreement.
--
-- Until now, a partner "signing" the affiliate agreement left ONE mutable trace:
-- affiliate_accounts.terms_version + accepted_at on the account row. The body
-- text itself lives in affiliate_settings.terms_content, which the admin editor
-- OVERWRITES in place — so after any edit there is no way to prove what a given
-- partner actually agreed to, and a version bump silently applies to partners
-- who never saw it. The CPA (and the Founding Partner commission ladder resting
-- on it) needs a per-partner, per-version, tamper-evident record.
--
-- This table is that record: INSERT-only, one row per (affiliate, version),
-- carrying a full SNAPSHOT of the body signed plus its sha256, the accepted_at
-- timestamp and the signing IP. The editable body text stays where it is.
--
-- Retention: legal record, kept for 3 years minimum. The FKs are ON DELETE SET
-- NULL (never CASCADE) so purging a user cannot erase evidence of the agreement;
-- signatory_email snapshots who signed so the row still reads on its own.

CREATE TABLE IF NOT EXISTS public.affiliate_agreement_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid REFERENCES public.affiliate_accounts(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  -- Snapshot of the signatory, so the record survives a purged account.
  signatory_email text,
  signatory_name text,
  -- What was signed. version mirrors affiliate_settings.terms_version at the
  -- moment of acceptance; body_snapshot is the exact text shown on the gate.
  version text NOT NULL,
  body_snapshot text NOT NULL,
  body_sha256 text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  -- Evidence of the signing session. ip is inet — normalise before insert.
  ip inet,
  user_agent text,
  CONSTRAINT affiliate_agreement_acceptances_version_len
    CHECK (char_length(version) BETWEEN 1 AND 32),
  CONSTRAINT affiliate_agreement_acceptances_sha_format
    CHECK (body_sha256 ~ '^[0-9a-f]{64}$')
);

-- One acceptance per partner per version: re-rendering the gate for a version
-- already signed must not mint duplicate rows.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_affiliate_agreement_acceptance
  ON public.affiliate_agreement_acceptances (affiliate_id, version)
  WHERE affiliate_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_affiliate_agreement_acceptances_affiliate
  ON public.affiliate_agreement_acceptances (affiliate_id, accepted_at DESC);

ALTER TABLE public.affiliate_agreement_acceptances ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.affiliate_agreement_acceptances IS
  'INSERT-only legal record of each affiliate accepting a version of the affiliate agreement, with a full body snapshot + sha256 + signing IP. Partners read their own rows; writes are service_role-only. Immutable (see trg_affiliate_agreement_acceptances_immutable).';

-- A partner may read their own signed agreements (portal shows "you signed vX
-- on <date>"). No write policy → INSERT/UPDATE/DELETE are service_role-only.
DROP POLICY IF EXISTS "affiliate reads own agreement acceptances"
  ON public.affiliate_agreement_acceptances;
CREATE POLICY "affiliate reads own agreement acceptances"
  ON public.affiliate_agreement_acceptances FOR SELECT
  USING (
    affiliate_id IN (
      SELECT id FROM public.affiliate_accounts WHERE user_id = auth.uid()
    )
  );

-- Immutability. The service-role client bypasses RLS, so nothing above stops a
-- stray UPDATE (rewriting what someone agreed to) or DELETE (erasing it). Block
-- both at row level — mirroring policy_snapshots (20260712150000).
--
-- The ONE permitted UPDATE is the FK SET NULL that fires when an affiliate
-- account or user profile is deleted: the evidence must survive the purge, so
-- the link may be severed but no substantive column may change.
CREATE OR REPLACE FUNCTION public.forbid_affiliate_agreement_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id                IS DISTINCT FROM OLD.id
    OR NEW.signatory_email   IS DISTINCT FROM OLD.signatory_email
    OR NEW.signatory_name    IS DISTINCT FROM OLD.signatory_name
    OR NEW.version           IS DISTINCT FROM OLD.version
    OR NEW.body_snapshot     IS DISTINCT FROM OLD.body_snapshot
    OR NEW.body_sha256       IS DISTINCT FROM OLD.body_sha256
    OR NEW.accepted_at       IS DISTINCT FROM OLD.accepted_at
    OR NEW.ip                IS DISTINCT FROM OLD.ip
    OR NEW.user_agent        IS DISTINCT FROM OLD.user_agent
    OR (NEW.affiliate_id IS DISTINCT FROM OLD.affiliate_id AND NEW.affiliate_id IS NOT NULL)
    OR (NEW.user_id      IS DISTINCT FROM OLD.user_id      AND NEW.user_id      IS NOT NULL)
    THEN
      RAISE EXCEPTION
        'affiliate_agreement_acceptances is immutable: the signed agreement (% v%) cannot be altered.',
        OLD.id, OLD.version
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'affiliate_agreement_acceptances rows cannot be deleted (signed agreement % v%, 3-year retention).',
    OLD.id, OLD.version
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_affiliate_agreement_acceptances_immutable
  ON public.affiliate_agreement_acceptances;
CREATE TRIGGER trg_affiliate_agreement_acceptances_immutable
  BEFORE UPDATE OR DELETE ON public.affiliate_agreement_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.forbid_affiliate_agreement_mutation();

COMMENT ON FUNCTION public.forbid_affiliate_agreement_mutation IS
  'Enforces affiliate_agreement_acceptances immutability: blocks DELETE always and blocks UPDATE except the FK SET NULL that severs affiliate_id/user_id when the account is purged.';
