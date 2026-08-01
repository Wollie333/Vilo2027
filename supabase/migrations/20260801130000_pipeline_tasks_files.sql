-- Funnel Manager — lead-record Tasks + Files.
--
-- Two new tables backing the lead-record "Tasks" and "Files" tabs, plus a PRIVATE
-- pipeline-files storage bucket (lead attachments are internal, so no public read;
-- downloads use short-lived signed URLs minted by the service-role). Mirrors the
-- existing pipeline table conventions: text+CHECK (no enums), update_updated_at
-- trigger, RLS enabled with a super-admin SELECT policy and all writes via the
-- service-role client (which bypasses RLS) from the audited Server Actions.
--
-- ── DOWN ──────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS public.pipeline_files;
--   DROP TABLE IF EXISTS public.pipeline_tasks;
--   DELETE FROM storage.buckets WHERE id = 'pipeline-files';

-- ─── 1. pipeline_tasks ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pipeline_tasks (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id            uuid NOT NULL REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
  title              text NOT NULL,
  due_at             timestamptz,
  status             text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  assignee_staff_id  uuid REFERENCES public.platform_staff(user_id) ON DELETE SET NULL,
  created_by         uuid REFERENCES public.platform_staff(user_id) ON DELETE SET NULL,
  completed_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.pipeline_tasks IS
  'Follow-up tasks a sales rep sets on a lead (call back, send proposal). status open|done.';
CREATE INDEX IF NOT EXISTS pipeline_tasks_lead_idx ON public.pipeline_tasks (lead_id, status, due_at);

-- ─── 2. pipeline_files ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pipeline_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       uuid NOT NULL REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
  name          text NOT NULL,                 -- original filename (display)
  path          text NOT NULL,                 -- object path in the pipeline-files bucket
  size_bytes    bigint,
  mime          text,
  uploaded_by   uuid REFERENCES public.platform_staff(user_id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.pipeline_files IS
  'Files attached to a lead (proposals, contracts, ID docs). Objects live in the private pipeline-files bucket; downloads via signed URLs.';
CREATE INDEX IF NOT EXISTS pipeline_files_lead_idx ON public.pipeline_files (lead_id, created_at DESC);

-- ─── 3. updated_at trigger (tasks only; files are immutable metadata) ──
DROP TRIGGER IF EXISTS trg_pipeline_tasks_updated ON public.pipeline_tasks;
CREATE TRIGGER trg_pipeline_tasks_updated BEFORE UPDATE ON public.pipeline_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── 4. RLS: enable; super-admin SELECT only, writes via service-role ──
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pipeline_tasks','pipeline_files'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_su_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (public.is_super_admin());',
      t || '_su_select', t
    );
  END LOOP;
END$$;

-- ─── 5. Private pipeline-files bucket ─────────────────────────────────
-- Private: no public read policy. Admin uploads + signed-URL downloads both run
-- through the service-role client, which bypasses storage RLS. 25 MB cap; mime
-- unconstrained (admins attach proposals, contracts, IDs, images).
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('pipeline-files', 'pipeline-files', false, 26214400)  -- 25 MB
ON CONFLICT (id) DO NOTHING;
