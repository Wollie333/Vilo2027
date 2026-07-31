-- Funnel Manager & Lead Pipeline — Phase 1: data model.
--
-- Plan: docs/features/FUNNEL_MANAGER_PLAN.md (§5, §6, §13.3). Public landing
-- pages (/go/*) capture leads into a sales CRM (kanban) with an email nurture
-- drip. This migration is the SCHEMA ONLY — no UI, no cron, no email templates
-- (those are Phases 2–4). It is safe to apply ahead of the app code: nothing
-- reads these tables until Phase 2 ships.
--
-- Conventions matched to the repo:
--   * text + CHECK, never Postgres enums (no CREATE TYPE anywhere in this repo).
--   * updated_at kept fresh by the shared public.update_updated_at() trigger.
--   * RLS ENABLED on every table; the only policy is a SELECT gated on
--     is_super_admin(). There are deliberately NO write policies — all writes go
--     through service-role (Server Actions / workers / the /go submit handler),
--     which bypasses RLS. Admin reads also use the service-role client, so
--     sales_team/support see rows through the app even though the direct-client
--     read policy is super-admin-only (defense in depth around lead PII).
--
-- A "lead" is NOT a new identity — it is a public.user_profiles row
-- (is_lead=true), minted by findOrCreateLeadIdentity. pipeline_leads only
-- REFERENCES that identity; it never duplicates it (ADR-021, Principle #1/#5).
--
-- ── DOWN (manual reversal, forward-only in prod) ──────────────────────
--   DROP TABLE IF EXISTS public.nurture_enrollments, public.pipeline_activities,
--     public.pipeline_leads, public.funnels, public.pipeline_stages,
--     public.nurture_steps, public.nurture_sequences CASCADE;

-- ─── 1. Nurture sequences (created first — funnels.sequence_id references it) ──
CREATE TABLE IF NOT EXISTS public.nurture_sequences (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience    text NOT NULL CHECK (audience IN ('host', 'affiliate')),
  name        text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.nurture_sequences IS
  'A named email drip per audience. Steps live in nurture_steps; leads enrol via nurture_enrollments.';

CREATE TABLE IF NOT EXISTS public.nurture_steps (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id      uuid NOT NULL REFERENCES public.nurture_sequences(id) ON DELETE CASCADE,
  step_order       int  NOT NULL,
  delay_hours      int  NOT NULL DEFAULT 0 CHECK (delay_hours >= 0),
  email_type       text NOT NULL,  -- EMAIL_REGISTRY key (recipient:'custom')
  subject_override text,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sequence_id, step_order)
);
COMMENT ON TABLE public.nurture_steps IS
  'One email in a nurture sequence. delay_hours is measured from the previous step (or enrolment for step 1). email_type is an EMAIL_REGISTRY key.';

-- ─── 2. Pipeline stages (kanban columns, per audience board) ──────────
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience    text NOT NULL CHECK (audience IN ('host', 'affiliate')),
  key         text NOT NULL,
  label       text NOT NULL,
  sort_order  int  NOT NULL DEFAULT 0,
  is_won      boolean NOT NULL DEFAULT false,
  is_lost     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (audience, key)
);
COMMENT ON TABLE public.pipeline_stages IS
  'Kanban columns for a per-audience board. Each board ends in exactly one is_won and one is_lost stage.';

-- ─── 3. Funnels (one row per public landing page) ─────────────────────
CREATE TABLE IF NOT EXISTS public.funnels (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience         text NOT NULL CHECK (audience IN ('host', 'affiliate')),
  slug             text NOT NULL UNIQUE,
  name             text NOT NULL,
  headline         text,
  subcopy          text,
  thankyou_config  jsonb NOT NULL DEFAULT '{}'::jsonb,
  sequence_id      uuid REFERENCES public.nurture_sequences(id) ON DELETE SET NULL,
  -- Resource delivery. brochure_path = object path in the public funnel-assets
  -- bucket; video_url = a YouTube/Vimeo URL rendered via videoEmbed.ts toEmbed().
  -- (No platform media library / hosted-video pipeline exists — plan §5.)
  brochure_path    text,
  brochure_name    text,
  video_url        text,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.funnels IS
  'A public /go/<slug> landing page: copy, resource (brochure + video) and the nurture sequence new leads enrol in.';

-- ─── 4. Pipeline leads (the CRM/kanban card — identity stays in user_profiles) ─
CREATE TABLE IF NOT EXISTS public.pipeline_leads (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  funnel_id                uuid REFERENCES public.funnels(id) ON DELETE SET NULL,  -- null for competition/direct leads
  audience                 text NOT NULL CHECK (audience IN ('host', 'affiliate')),
  stage_id                 uuid NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE RESTRICT,
  owner_staff_id           uuid REFERENCES public.platform_staff(user_id) ON DELETE SET NULL,
  status                   text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
  score                    int  NOT NULL DEFAULT 0,
  utm                      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ad_source                text,
  marketing_consent        boolean NOT NULL DEFAULT false,
  affiliate_ref            text,   -- denormalised affiliate slug/name for reporting
  source_kind              text NOT NULL DEFAULT 'direct'
                             CHECK (source_kind IN ('host_funnel', 'affiliate_funnel', 'affiliate_referral', 'competition', 'direct')),
  source_label             text,
  suppress_default_nurture boolean NOT NULL DEFAULT false,
  last_activity_at         timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, audience)  -- one card per lead per board
);
COMMENT ON TABLE public.pipeline_leads IS
  'The kanban card. References the user_profiles identity (is_lead); never duplicates it. UNIQUE(user_id,audience) = one card per lead per board.';

CREATE INDEX IF NOT EXISTS pipeline_leads_audience_stage_idx ON public.pipeline_leads (audience, stage_id);
CREATE INDEX IF NOT EXISTS pipeline_leads_owner_idx          ON public.pipeline_leads (owner_staff_id);
CREATE INDEX IF NOT EXISTS pipeline_leads_source_idx         ON public.pipeline_leads (source_kind);
CREATE INDEX IF NOT EXISTS pipeline_leads_created_idx        ON public.pipeline_leads (created_at);

-- ─── 5. Pipeline activities (append-only timeline) ────────────────────
CREATE TABLE IF NOT EXISTS public.pipeline_activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
  staff_id    uuid REFERENCES public.platform_staff(user_id) ON DELETE SET NULL,  -- null = system
  kind        text NOT NULL
                CHECK (kind IN ('created', 'email_sent', 'stage_moved', 'note', 'call_logged', 'consent_changed', 'converted')),
  body        text,
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.pipeline_activities IS
  'Append-only lead timeline (emails sent, stage moves, notes, calls, conversion). staff_id null = system action.';

CREATE INDEX IF NOT EXISTS pipeline_activities_lead_idx ON public.pipeline_activities (lead_id, created_at DESC);

-- ─── 6. Nurture enrolments (the drip queue — cloned from review_request_queue) ─
CREATE TABLE IF NOT EXISTS public.nurture_enrollments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       uuid NOT NULL REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
  sequence_id   uuid NOT NULL REFERENCES public.nurture_sequences(id) ON DELETE RESTRICT,
  current_step  int  NOT NULL DEFAULT 0,
  next_send_at  timestamptz,
  status        text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'completed', 'cancelled', 'converted', 'unsubscribed')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, sequence_id)
);
COMMENT ON TABLE public.nurture_enrollments IS
  'A lead''s progress through a nurture sequence. The per-minute drain-nurture worker (Phase 4) claims rows where status=active AND next_send_at <= now().';

-- The worker claim predicate — keep this index aligned with that WHERE clause.
CREATE INDEX IF NOT EXISTS nurture_enrollments_due_idx
  ON public.nurture_enrollments (next_send_at)
  WHERE status = 'active';

-- ─── 7. updated_at triggers (shared helper) ───────────────────────────
DROP TRIGGER IF EXISTS trg_nurture_sequences_updated  ON public.nurture_sequences;
CREATE TRIGGER trg_nurture_sequences_updated  BEFORE UPDATE ON public.nurture_sequences  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_nurture_steps_updated      ON public.nurture_steps;
CREATE TRIGGER trg_nurture_steps_updated      BEFORE UPDATE ON public.nurture_steps      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_pipeline_stages_updated    ON public.pipeline_stages;
CREATE TRIGGER trg_pipeline_stages_updated    BEFORE UPDATE ON public.pipeline_stages    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_funnels_updated            ON public.funnels;
CREATE TRIGGER trg_funnels_updated            BEFORE UPDATE ON public.funnels            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_pipeline_leads_updated     ON public.pipeline_leads;
CREATE TRIGGER trg_pipeline_leads_updated     BEFORE UPDATE ON public.pipeline_leads     FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_nurture_enrollments_updated ON public.nurture_enrollments;
CREATE TRIGGER trg_nurture_enrollments_updated BEFORE UPDATE ON public.nurture_enrollments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── 8. RLS: enable everywhere; super-admin SELECT only, writes via service-role ─
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'nurture_sequences','nurture_steps','pipeline_stages','funnels',
    'pipeline_leads','pipeline_activities','nurture_enrollments'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_su_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (public.is_super_admin());',
      t || '_su_select', t
    );
  END LOOP;
END$$;

-- ─── 9. Seed default stages (per audience; each board ends in Won + Lost) ──────
INSERT INTO public.pipeline_stages (audience, key, label, sort_order, is_won, is_lost) VALUES
  ('host', 'new',         'New',                0, false, false),
  ('host', 'contacted',   'Contacted',          1, false, false),
  ('host', 'qualified',   'Qualified',          2, false, false),
  ('host', 'demo_booked', 'Demo booked',        3, false, false),
  ('host', 'nurturing',   'Nurturing',          4, false, false),
  ('host', 'won',         'Won (became host)',  5, true,  false),
  ('host', 'lost',        'Lost',               6, false, true),
  ('affiliate', 'new',         'New',                        0, false, false),
  ('affiliate', 'contacted',   'Contacted',                  1, false, false),
  ('affiliate', 'joined',      'Joined program',             2, false, false),
  ('affiliate', 'nurturing',   'Nurturing',                  3, false, false),
  ('affiliate', 'won',         'Won (actively promoting)',   4, true,  false),
  ('affiliate', 'lost',        'Lost',                       5, false, true)
ON CONFLICT (audience, key) DO NOTHING;

-- ─── 10. Seed one nurture sequence per audience (steps + worker land in Phase 4) ─
-- Seeded is_active=false: with no steps and no worker yet, enrolment must be a
-- no-op until Phase 4 wires the templates + drain-nurture cron. Phase 2's submit
-- handler only enrols when the funnel's sequence is active AND has active steps.
INSERT INTO public.nurture_sequences (audience, name, is_active) VALUES
  ('host',      'Host nurture (default)',      false),
  ('affiliate', 'Affiliate nurture (default)', false)
ON CONFLICT DO NOTHING;
