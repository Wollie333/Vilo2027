-- WS-1i (follow-up) — competition rules must be ACCEPTED to enter.
--
-- The campaign builder can now author its rules document (published live at
-- /legal/<slug>). CPA requires the rules to sit at a fixed retained URL AND that
-- each entrant accepted them, so entering a competition now records a signature
-- exactly like the affiliate agreement does (20260721090000):
-- one immutable row per (campaign, partner, rules version) with a full snapshot
-- of the text they entered under, its sha256, and the signing IP.
--
-- Enrolment without a signature is refused server-side (see
-- enrollInCampaignAction), so the row here IS the proof of entry.

CREATE TABLE IF NOT EXISTS public.affiliate_campaign_rule_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- FKs are SET NULL, never CASCADE: purging a campaign or a partner must not
  -- erase evidence of who entered under which rules.
  campaign_id uuid REFERENCES public.affiliate_campaigns(id) ON DELETE SET NULL,
  affiliate_id uuid REFERENCES public.affiliate_accounts(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  signatory_email text,
  signatory_name text,
  -- Which document, at which version, with the exact text shown.
  doc_slug text NOT NULL,
  doc_version integer NOT NULL,
  body_snapshot text NOT NULL,
  body_sha256 text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip inet,
  user_agent text,
  CONSTRAINT campaign_rule_acceptances_sha_format
    CHECK (body_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT campaign_rule_acceptances_version_positive
    CHECK (doc_version > 0)
);

-- One signature per partner per campaign per rules version: a double-submit or
-- a repeat entry is a no-op, not a second signature.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_campaign_rule_acceptance
  ON public.affiliate_campaign_rule_acceptances
     (campaign_id, affiliate_id, doc_version)
  WHERE campaign_id IS NOT NULL AND affiliate_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_rule_acceptances_campaign
  ON public.affiliate_campaign_rule_acceptances (campaign_id, accepted_at DESC);

ALTER TABLE public.affiliate_campaign_rule_acceptances ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.affiliate_campaign_rule_acceptances IS
  'INSERT-only proof that a partner accepted a competition''s rules (with a full body snapshot + sha256 + IP) before entering. Partners read their own rows; writes are service_role-only. Immutable.';

-- A partner may read their own signatures. No write policy → service_role only.
DROP POLICY IF EXISTS "affiliate reads own campaign rule acceptances"
  ON public.affiliate_campaign_rule_acceptances;
CREATE POLICY "affiliate reads own campaign rule acceptances"
  ON public.affiliate_campaign_rule_acceptances FOR SELECT
  USING (
    affiliate_id IN (
      SELECT id FROM public.affiliate_accounts WHERE user_id = auth.uid()
    )
  );

-- Immutability — same posture as affiliate_agreement_acceptances: DELETE never,
-- UPDATE only to sever an FK when the referenced row is purged.
CREATE OR REPLACE FUNCTION public.forbid_campaign_rule_acceptance_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id              IS DISTINCT FROM OLD.id
    OR NEW.signatory_email IS DISTINCT FROM OLD.signatory_email
    OR NEW.signatory_name  IS DISTINCT FROM OLD.signatory_name
    OR NEW.doc_slug        IS DISTINCT FROM OLD.doc_slug
    OR NEW.doc_version     IS DISTINCT FROM OLD.doc_version
    OR NEW.body_snapshot   IS DISTINCT FROM OLD.body_snapshot
    OR NEW.body_sha256     IS DISTINCT FROM OLD.body_sha256
    OR NEW.accepted_at     IS DISTINCT FROM OLD.accepted_at
    OR NEW.ip              IS DISTINCT FROM OLD.ip
    OR NEW.user_agent      IS DISTINCT FROM OLD.user_agent
    OR (NEW.campaign_id  IS DISTINCT FROM OLD.campaign_id  AND NEW.campaign_id  IS NOT NULL)
    OR (NEW.affiliate_id IS DISTINCT FROM OLD.affiliate_id AND NEW.affiliate_id IS NOT NULL)
    OR (NEW.user_id      IS DISTINCT FROM OLD.user_id      AND NEW.user_id      IS NOT NULL)
    THEN
      RAISE EXCEPTION
        'affiliate_campaign_rule_acceptances is immutable: entry record % (%s v%) cannot be altered.',
        OLD.id, OLD.doc_slug, OLD.doc_version
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'affiliate_campaign_rule_acceptances rows cannot be deleted (entry record % for % v%).',
    OLD.id, OLD.doc_slug, OLD.doc_version
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_campaign_rule_acceptances_immutable
  ON public.affiliate_campaign_rule_acceptances;
CREATE TRIGGER trg_campaign_rule_acceptances_immutable
  BEFORE UPDATE OR DELETE ON public.affiliate_campaign_rule_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.forbid_campaign_rule_acceptance_mutation();

COMMENT ON FUNCTION public.forbid_campaign_rule_acceptance_mutation IS
  'Enforces campaign rule-acceptance immutability: blocks DELETE always and UPDATE except the FK SET NULL that severs campaign/affiliate/user links on purge.';
