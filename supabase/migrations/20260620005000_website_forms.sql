-- Website CMS — Form Builder (Phase 4) data foundation.
--
-- Additive, fully decoupled from bookings/payments. Two tables:
--   • website_forms            — host-defined forms (curated field types in jsonb)
--   • website_form_submissions — one row per public submission (full field data)
--
-- Routing (app layer): email-bearing submissions still flow through the existing
-- enquiry pipeline (lib/website/createWebsiteEnquiry → host inbox + Guests CRM);
-- every submission is ALSO persisted here so the host has a structured, exportable
-- record. `conversation_id` links a submission to the inbox thread it opened
-- (SET NULL if that conversation is later removed). Newsletter-type forms upsert
-- into host_contacts (tag) instead of opening a conversation — no extra table.
--
-- RLS mirrors the rest of the Website CMS: owner (host) + super-admin manage;
-- the PUBLIC site inserts via the service-role route (admin client), so there is
-- deliberately no anon policy here.

-- ============================================================
-- 1. website_forms — form definitions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.website_forms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id  uuid NOT NULL REFERENCES public.host_websites(id) ON DELETE CASCADE,
  name        text NOT NULL,
  type        text NOT NULL DEFAULT 'contact'
                CHECK (type IN ('contact','custom','newsletter')),
  fields      jsonb NOT NULL DEFAULT '[]',  -- [{id,type,label,required,placeholder,options?}]
  settings    jsonb NOT NULL DEFAULT '{}',  -- {submitLabel,successMessage,notifyInbox,...}
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

COMMENT ON TABLE public.website_forms IS
  'Host-defined forms for the Website CMS (Phase 4). fields[] is a curated field-type list edited in the dashboard; the public site renders them and posts to the service-role submission route.';

CREATE INDEX IF NOT EXISTS idx_website_forms_website ON public.website_forms(website_id);

CREATE TRIGGER set_updated_at_website_forms BEFORE UPDATE ON public.website_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.website_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY website_forms_owner_all ON public.website_forms
  FOR ALL TO authenticated
  USING (website_id IN (SELECT id FROM public.host_websites WHERE host_id = get_my_host_id()))
  WITH CHECK (website_id IN (SELECT id FROM public.host_websites WHERE host_id = get_my_host_id()));
CREATE POLICY website_forms_admin_all ON public.website_forms
  FOR ALL USING (is_super_admin());

-- ============================================================
-- 2. website_form_submissions — one row per public submission
-- ============================================================
CREATE TABLE IF NOT EXISTS public.website_form_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id         uuid NOT NULL REFERENCES public.website_forms(id) ON DELETE CASCADE,
  website_id      uuid NOT NULL REFERENCES public.host_websites(id) ON DELETE CASCADE, -- denormalised for fast RLS
  data            jsonb NOT NULL DEFAULT '{}',  -- {fieldId: value}
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new','read','archived','spam')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.website_form_submissions IS
  'One row per public form submission (Phase 4). Inserted by the service-role submission route; the host reads/updates status here. conversation_id links to the inbox thread the submission opened, if any.';

CREATE INDEX IF NOT EXISTS idx_website_form_subs_website ON public.website_form_submissions(website_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_form_subs_form    ON public.website_form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_website_form_subs_status  ON public.website_form_submissions(website_id, status);

ALTER TABLE public.website_form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY website_form_subs_owner_all ON public.website_form_submissions
  FOR ALL TO authenticated
  USING (website_id IN (SELECT id FROM public.host_websites WHERE host_id = get_my_host_id()))
  WITH CHECK (website_id IN (SELECT id FROM public.host_websites WHERE host_id = get_my_host_id()));
CREATE POLICY website_form_subs_admin_all ON public.website_form_submissions
  FOR ALL USING (is_super_admin());
