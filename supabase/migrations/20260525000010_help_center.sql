-- Migration: Help & Docs centre (articles, videos, FAQs, status, settings)
--
-- Powers /dashboard/help (host-facing), /help/* (public SEO mirror), and
-- /admin/help/* (CMS surface — articles, videos, FAQs, system-status,
-- featured curation, trending-search pills). All content is admin-managed
-- through Server Actions wrapped with withAdminAudit. Public/host reads go
-- through RLS that scopes to status='published' AND deleted_at IS NULL.
--
-- Adds one new permission key: help.manage. Extends admin_audit_log.target_type
-- to recognise help_* targets. No changes to existing tables.

CREATE TABLE public.help_categories (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text        NOT NULL UNIQUE,
  name         text        NOT NULL,
  description  text,
  icon         text        NOT NULL DEFAULT 'book-open',
  audience     text        NOT NULL DEFAULT 'both'
                           CHECK (audience IN ('host', 'guest', 'both')),
  sort_order   integer     NOT NULL DEFAULT 100,
  is_published boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);
CREATE INDEX idx_help_categories_audience ON help_categories(audience) WHERE deleted_at IS NULL;
CREATE INDEX idx_help_categories_sort     ON help_categories(sort_order, name) WHERE deleted_at IS NULL;
ALTER TABLE help_categories ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_help_categories_updated_at
  BEFORE UPDATE ON help_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE public.help_articles (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               text        NOT NULL UNIQUE,
  title              text        NOT NULL,
  excerpt            text        NOT NULL DEFAULT '',
  body_html          text        NOT NULL DEFAULT '',
  body_json          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  category_id        uuid        REFERENCES help_categories(id) ON DELETE SET NULL,
  audience           text        NOT NULL DEFAULT 'both'
                                 CHECK (audience IN ('host', 'guest', 'both')),
  status             text        NOT NULL DEFAULT 'draft'
                                 CHECK (status IN ('draft', 'published', 'archived')),
  featured_rank      smallint,
  read_time_minutes  smallint    NOT NULL DEFAULT 4,
  view_count         integer     NOT NULL DEFAULT 0,
  helpful_count      integer     NOT NULL DEFAULT 0,
  not_helpful_count  integer     NOT NULL DEFAULT 0,
  saved_count        integer     NOT NULL DEFAULT 0,
  has_video          boolean     NOT NULL DEFAULT false,
  published_at       timestamptz,
  author_id          uuid        REFERENCES user_profiles(id) ON DELETE SET NULL,
  last_editor_id     uuid        REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz,
  search_tsv         tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title,   '')), 'A') ||
    setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(regexp_replace(body_html, '<[^>]+>', ' ', 'g'), '')), 'C')
  ) STORED
);
CREATE INDEX idx_help_articles_status    ON help_articles(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_help_articles_category  ON help_articles(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_help_articles_audience  ON help_articles(audience) WHERE deleted_at IS NULL;
CREATE INDEX idx_help_articles_featured  ON help_articles(featured_rank) WHERE featured_rank IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_help_articles_published ON help_articles(published_at DESC) WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX idx_help_articles_updated   ON help_articles(updated_at DESC) WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX idx_help_articles_search    ON help_articles USING GIN(search_tsv);
ALTER TABLE help_articles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_help_articles_updated_at
  BEFORE UPDATE ON help_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE public.help_videos (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text        NOT NULL,
  description      text        NOT NULL DEFAULT '',
  category_id      uuid        REFERENCES help_categories(id) ON DELETE SET NULL,
  audience         text        NOT NULL DEFAULT 'both'
                               CHECK (audience IN ('host', 'guest', 'both')),
  embed_provider   text        NOT NULL DEFAULT 'youtube'
                               CHECK (embed_provider IN ('youtube', 'vimeo')),
  embed_id         text        NOT NULL,
  embed_url        text        NOT NULL,
  thumbnail_url    text,
  duration_seconds integer     NOT NULL DEFAULT 0,
  status           text        NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft', 'published', 'archived')),
  featured_rank    smallint,
  sort_order       integer     NOT NULL DEFAULT 100,
  is_new           boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);
CREATE INDEX idx_help_videos_status   ON help_videos(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_help_videos_audience ON help_videos(audience) WHERE deleted_at IS NULL;
CREATE INDEX idx_help_videos_sort     ON help_videos(featured_rank NULLS LAST, sort_order, title) WHERE deleted_at IS NULL;
ALTER TABLE help_videos ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_help_videos_updated_at
  BEFORE UPDATE ON help_videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE public.help_faqs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  question     text        NOT NULL,
  answer_html  text        NOT NULL,
  category_id  uuid        REFERENCES help_categories(id) ON DELETE SET NULL,
  audience     text        NOT NULL DEFAULT 'both'
                           CHECK (audience IN ('host', 'guest', 'both')),
  is_featured  boolean     NOT NULL DEFAULT false,
  sort_order   integer     NOT NULL DEFAULT 100,
  is_published boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);
CREATE INDEX idx_help_faqs_audience ON help_faqs(audience) WHERE deleted_at IS NULL;
CREATE INDEX idx_help_faqs_featured ON help_faqs(is_featured, sort_order) WHERE is_featured = true AND deleted_at IS NULL;
CREATE INDEX idx_help_faqs_sort     ON help_faqs(sort_order, question) WHERE deleted_at IS NULL;
ALTER TABLE help_faqs ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_help_faqs_updated_at
  BEFORE UPDATE ON help_faqs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE public.help_article_feedback (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id  uuid        NOT NULL REFERENCES help_articles(id) ON DELETE CASCADE,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  vote        text        NOT NULL CHECK (vote IN ('up', 'down')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_vote_per_user UNIQUE (article_id, user_id)
);
CREATE INDEX idx_help_article_feedback_article ON help_article_feedback(article_id);
ALTER TABLE help_article_feedback ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION sync_help_article_feedback_counters()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vote = 'up' THEN
      UPDATE help_articles SET helpful_count = helpful_count + 1 WHERE id = NEW.article_id;
    ELSE
      UPDATE help_articles SET not_helpful_count = not_helpful_count + 1 WHERE id = NEW.article_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.vote IS DISTINCT FROM NEW.vote THEN
    IF OLD.vote = 'up' THEN
      UPDATE help_articles SET helpful_count = GREATEST(0, helpful_count - 1) WHERE id = NEW.article_id;
    ELSE
      UPDATE help_articles SET not_helpful_count = GREATEST(0, not_helpful_count - 1) WHERE id = NEW.article_id;
    END IF;
    IF NEW.vote = 'up' THEN
      UPDATE help_articles SET helpful_count = helpful_count + 1 WHERE id = NEW.article_id;
    ELSE
      UPDATE help_articles SET not_helpful_count = not_helpful_count + 1 WHERE id = NEW.article_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.vote = 'up' THEN
      UPDATE help_articles SET helpful_count = GREATEST(0, helpful_count - 1) WHERE id = OLD.article_id;
    ELSE
      UPDATE help_articles SET not_helpful_count = GREATEST(0, not_helpful_count - 1) WHERE id = OLD.article_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER tr_help_article_feedback_counters
  AFTER INSERT OR UPDATE OR DELETE ON help_article_feedback
  FOR EACH ROW EXECUTE FUNCTION sync_help_article_feedback_counters();

CREATE TABLE public.help_status_components (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  icon         text        NOT NULL DEFAULT 'activity',
  uptime_pct   numeric(5,2) NOT NULL DEFAULT 100.00 CHECK (uptime_pct >= 0 AND uptime_pct <= 100),
  status       text        NOT NULL DEFAULT 'normal'
                           CHECK (status IN ('normal', 'degraded', 'incident', 'maintenance')),
  note         text,
  spark_values jsonb       NOT NULL DEFAULT '[80,90,85,95,90,100,95]'::jsonb,
  sort_order   integer     NOT NULL DEFAULT 100,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_help_status_components_sort ON help_status_components(sort_order, name);
ALTER TABLE help_status_components ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_help_status_components_updated_at
  BEFORE UPDATE ON help_status_components
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE public.help_settings (
  key        text        PRIMARY KEY,
  value      jsonb       NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE help_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_help_settings_updated_at
  BEFORE UPDATE ON help_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE public.help_article_suggestions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  email       text,
  message     text        NOT NULL,
  status      text        NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'planned', 'shipped', 'dismissed')),
  resolved_at timestamptz,
  resolved_by uuid        REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_help_article_suggestions_status ON help_article_suggestions(status, created_at DESC);
ALTER TABLE help_article_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS policies ---------------------------------------------------------------

CREATE POLICY "public_read_help_categories" ON help_categories FOR SELECT
  USING (is_published = true AND deleted_at IS NULL);
CREATE POLICY "admin_full_help_categories" ON help_categories FOR ALL
  USING (is_super_admin() OR has_admin_permission('help.manage'));

CREATE POLICY "public_read_help_articles" ON help_articles FOR SELECT
  USING (status = 'published' AND deleted_at IS NULL);
CREATE POLICY "admin_full_help_articles" ON help_articles FOR ALL
  USING (is_super_admin() OR has_admin_permission('help.manage'));

CREATE POLICY "public_read_help_videos" ON help_videos FOR SELECT
  USING (status = 'published' AND deleted_at IS NULL);
CREATE POLICY "admin_full_help_videos" ON help_videos FOR ALL
  USING (is_super_admin() OR has_admin_permission('help.manage'));

CREATE POLICY "public_read_help_faqs" ON help_faqs FOR SELECT
  USING (is_published = true AND deleted_at IS NULL);
CREATE POLICY "admin_full_help_faqs" ON help_faqs FOR ALL
  USING (is_super_admin() OR has_admin_permission('help.manage'));

CREATE POLICY "public_read_help_status" ON help_status_components FOR SELECT USING (true);
CREATE POLICY "admin_full_help_status" ON help_status_components FOR ALL
  USING (is_super_admin() OR has_admin_permission('help.manage'));

CREATE POLICY "public_read_help_settings" ON help_settings FOR SELECT USING (true);
CREATE POLICY "admin_full_help_settings" ON help_settings FOR ALL
  USING (is_super_admin() OR has_admin_permission('help.manage'));

CREATE POLICY "user_own_help_feedback_read" ON help_article_feedback FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "user_own_help_feedback_write" ON help_article_feedback FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_own_help_feedback_update" ON help_article_feedback FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin_full_help_feedback" ON help_article_feedback FOR ALL
  USING (is_super_admin() OR has_admin_permission('help.manage'));

CREATE POLICY "authed_insert_help_suggestions" ON help_article_suggestions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin_full_help_suggestions" ON help_article_suggestions FOR ALL
  USING (is_super_admin() OR has_admin_permission('help.manage'));

-- RPCs -----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION increment_help_article_view(p_article_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE help_articles
     SET view_count = view_count + 1
   WHERE id = p_article_id
     AND status = 'published'
     AND deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION vote_help_article(p_article_id uuid, p_vote text)
RETURNS TABLE(helpful_count integer, not_helpful_count integer)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to vote on articles.' USING ERRCODE = '28000';
  END IF;
  IF p_vote NOT IN ('up', 'down') THEN
    RAISE EXCEPTION 'Invalid vote. Use up or down.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO help_article_feedback (article_id, user_id, vote)
  VALUES (p_article_id, v_uid, p_vote)
  ON CONFLICT (article_id, user_id) DO UPDATE
    SET vote = EXCLUDED.vote,
        created_at = now();
  RETURN QUERY
    SELECT ha.helpful_count, ha.not_helpful_count
      FROM help_articles ha
     WHERE ha.id = p_article_id;
END;
$$;

-- Extend admin_audit_log.target_type ---------------------------------------

ALTER TABLE admin_audit_log DROP CONSTRAINT admin_audit_log_target_type_check;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_target_type_check
  CHECK (target_type IN (
    'host','guest','user','booking','listing','review','subscription',
    'feature_override','platform_setting','platform_staff','staff_member',
    'impersonation','permission_denied',
    'help_article','help_video','help_faq','help_category',
    'help_status','help_settings','help_article_suggestion'
  ));

-- Permission key + role grants ---------------------------------------------

INSERT INTO admin_permissions (key, domain, description) VALUES
  ('help.manage', 'help', 'Create, edit, publish, archive help articles, videos, FAQs, status components and settings.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO admin_role_permissions (role_id, permission_key) VALUES
  ('super_admin',   'help.manage'),
  ('content_mod',   'help.manage'),
  ('support_agent', 'help.manage')
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Seeds --------------------------------------------------------------------

INSERT INTO help_categories (slug, name, description, icon, audience, sort_order) VALUES
  ('bookings',     'Bookings & reservations', 'Approving, modifying and cancelling stays.',     'calendar-check', 'both', 10),
  ('payments',     'Payments & payouts',      'Payout schedules, EFT, Paystack & tax.',         'banknote',       'host', 20),
  ('listings',     'Listings & photos',       'Publishing, pricing rules, photography tips.',   'home',           'host', 30),
  ('channels',     'Channels & sync',         'iCal feeds, Airbnb, Booking.com integrations.',  'cable',          'host', 40),
  ('account',      'Account & settings',      'Login, 2FA, notifications, workspace.',          'user-cog',       'both', 50),
  ('trust-safety', 'Trust & safety',          'ID verification, AirCover, house rules.',        'shield-check',   'both', 60),
  ('reviews',      'Reviews & ratings',       'Responding, disputes, Superhost criteria.',      'star',           'both', 70),
  ('api',          'API & developers',        'Webhooks, REST endpoints, SDKs.',                'code-2',         'host', 80);

INSERT INTO help_articles (slug, title, excerpt, body_html, body_json, category_id, audience, status, featured_rank, read_time_minutes, helpful_count, published_at)
SELECT v.slug, v.title, v.excerpt, v.body_html, v.body_json::jsonb, c.id, v.audience, 'published', v.featured_rank, v.read_time_minutes, v.helpful_count, now()
FROM (VALUES
  ('partial-refund-without-cancelling', 'How to issue a partial refund without cancelling a booking',
   'Goodwill refunds keep the reservation intact and the calendar blocked. Here is when and how to issue one.',
   '<p>Issuing a partial refund is the right tool when a guest had a minor problem but still completed the stay. The booking stays confirmed, the calendar stays blocked, and the guest gets money back without a full cancellation.</p><h3>Step by step</h3><ol><li>Open the booking from <strong>Bookings &rarr; All</strong>.</li><li>Click <strong>Issue refund</strong> in the right rail.</li><li>Choose an amount (max = paid total).</li><li>Add a short reason. Guests see this.</li><li>Submit. Paystack settles within 5&ndash;10 business days.</li></ol>',
   '{"type":"doc","content":[]}', 'payments', 'both', 1, 4, 192),
  ('connect-airbnb-ical',              'Connect your Airbnb calendar with a one-way iCal feed',
   'Block Vilo dates the moment Airbnb confirms a stay. Setup is two URL pastes, 5 minutes.',
   '<p>One-way iCal sync is the simplest way to stop double-bookings while you trial Vilo. Vilo polls Airbnb every 15 minutes and writes a matching block on your calendar.</p>',
   '{"type":"doc","content":[]}', 'channels', 'host', 2, 6, 156),
  ('smart-pricing-rules',              'Setting smart pricing rules for weekends & school holidays',
   'Bake a R 250 weekend uplift and a 1.5x SA school-holiday multiplier in once, forever.',
   '<p>Smart pricing rules layer on top of your base nightly rate. They evaluate in this order: <em>seasonal &rarr; weekly &rarr; minimum-stay &rarr; last-minute discount</em>.</p>',
   '{"type":"doc","content":[]}', 'listings', 'host', 3, 7, 142),
  ('payout-schedule',                  'When does Vilo pay me out? Schedules & bank holidays',
   'Payouts release 24 hours after check-in. Same-day on Pro via Paystack instant.',
   '<p>Vilo holds funds until <strong>24 hours after the guest checks in</strong> &mdash; long enough that the guest cannot dispute on arrival but short enough that you have weekend cash flow.</p>',
   '{"type":"doc","content":[]}', 'payments', 'host', 4, 3, 412),
  ('cancellation-policies-explained',  'Cancellation policies explained: Flexible, Moderate, Strict',
   'Pick the policy that matches your property type. Beach houses lean strict, city apartments lean flexible.',
   '<p>Vilo ships with three named policies. You can also define a custom policy on the Pro plan.</p>',
   '{"type":"doc","content":[]}', 'trust-safety', 'both', 5, 8, 98),
  ('payment-held-for-review',          'What to do if a guest payment is held for review',
   'Paystack flags ~0.4% of card payments for manual review. Most clear in under 30 minutes.',
   '<p>You will see a <em>Pending review</em> pill on the booking. The guest has paid; the funds are not in your subaccount yet.</p>',
   '{"type":"doc","content":[]}', 'trust-safety', 'host', 6, 5, 71)
) AS v(slug, title, excerpt, body_html, body_json, category_slug, audience, featured_rank, read_time_minutes, helpful_count)
JOIN help_categories c ON c.slug = v.category_slug;

INSERT INTO help_videos (title, description, category_id, audience, embed_provider, embed_id, embed_url, thumbnail_url, duration_seconds, status, featured_rank, sort_order, is_new)
SELECT v.title, v.description, c.id, v.audience, 'youtube', v.embed_id, v.embed_url, v.thumb, v.duration, 'published', v.featured_rank, v.sort_order, v.is_new
FROM (VALUES
  ('Take photos that earn 30% more bookings', 'Lighting, angles, staging - the three levers that move conversion most.', 'listings', 'host', 'dQw4w9WgXcQ',
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
   'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=480&q=70&auto=format&fit=crop', 204, 1, 10, false),
  ('Build a smart pricing strategy in 5 minutes', 'Weekends, holidays, and a last-minute discount. Set once, forget.', 'listings', 'host', 'jNQXAC9IVRw',
   'https://www.youtube.com/watch?v=jNQXAC9IVRw',
   'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=480&q=70&auto=format&fit=crop', 311, 2, 20, false),
  ('Saved replies & auto-responses', 'Save 20 minutes a day of typing the same answer over and over.', 'account', 'both', 'V-_O7nl0Ii0',
   'https://www.youtube.com/watch?v=V-_O7nl0Ii0',
   'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=480&q=70&auto=format&fit=crop', 168, 3, 30, false),
  ('Full Airbnb & Booking.com sync walkthrough', 'Two-way sync end-to-end. PRO plan.', 'channels', 'host', 'YQHsXMglC9A',
   'https://www.youtube.com/watch?v=YQHsXMglC9A', NULL, 422, 4, 40, true)
) AS v(title, description, category_slug, audience, embed_id, embed_url, thumb, duration, featured_rank, sort_order, is_new)
JOIN help_categories c ON c.slug = v.category_slug;

INSERT INTO help_faqs (question, answer_html, category_id, audience, is_featured, sort_order)
SELECT v.question, v.answer_html, c.id, v.audience, v.is_featured, v.sort_order
FROM (VALUES
  ('How long does Vilo take to pay out after a guest checks in?',
   '<p>Payouts release <strong>24 hours after the guest&rsquo;s check-in</strong>. EFT typically lands in your South African bank account within 1&ndash;2 business days; Paystack instant payouts are available on the Pro plan and arrive same-day. Bank holidays may add a day.</p>',
   'payments', 'host', true, 10),
  ('A guest wants to cancel - what do I do?',
   '<p>Guests can cancel from their reservation page; the refund follows the cancellation policy you set on the listing. You don&rsquo;t have to do anything &mdash; but if you want to be flexible, you can <em>issue a goodwill refund</em> from the booking detail page.</p>',
   'bookings', 'host', true, 20),
  ('Can I import bookings from Airbnb so my calendar stays in sync?',
   '<p>Yes. Open <strong>Channels &rarr; Add iCal feed</strong> and paste your Airbnb export URL. Vilo polls the feed every 15 minutes and blocks matching dates on your Vilo calendar. Two-way sync is available on the Pro plan.</p>',
   'channels', 'host', true, 30),
  ('What is Vilo&rsquo;s commission, and when am I charged?',
   '<p>Vilo takes a flat <strong>3% host fee</strong> on confirmed payouts &mdash; no listing fees, no monthly minimums on the Free plan. The fee is deducted from each payout automatically; your statement shows it as a separate line.</p>',
   'payments', 'host', true, 40),
  ('How do I add a co-host or cleaner to my workspace?',
   '<p>In <strong>Staff &rarr; Invite</strong>, choose a role (Co-host, Cleaner, or Read-only) and enter their email. Co-hosts can manage bookings; cleaners only see check-out schedules. Up to 5 teammates on the Pro plan.</p>',
   'account', 'host', false, 50),
  ('A guest left a review I think is unfair. Can I dispute it?',
   '<p>You can request a review for removal within 14 days if it breaks our content policy (harassment, irrelevant info, retaliatory). Open the review and tap <strong>Report this review</strong>. A team member responds within 48 hours.</p>',
   'reviews', 'host', false, 60)
) AS v(question, answer_html, category_slug, audience, is_featured, sort_order)
JOIN help_categories c ON c.slug = v.category_slug;

INSERT INTO help_status_components (name, icon, uptime_pct, status, note, spark_values, sort_order) VALUES
  ('Channel sync',       'cable',          99.98, 'normal',   '99.98% · 30d',          '[60,80,70,100,90,75,85]'::jsonb, 10),
  ('Payments & payouts', 'credit-card',    99.99, 'normal',   '99.99% · 30d',          '[85,95,90,80,100,90,95]'::jsonb, 20),
  ('Messaging',          'message-square', 99.60, 'degraded', '99.6% · degraded 14 Nov','[80,90,35,75,90,85,100]'::jsonb, 30),
  ('Search & discovery', 'search',         100.00, 'normal',  '100% · 30d',            '[95,100,90,100,95,100,90]'::jsonb, 40);

INSERT INTO help_settings (key, value) VALUES
  ('trending', '["Cancellation policy","Payout schedule","Connect Airbnb iCal","Verify ID"]'::jsonb),
  ('contact', '{
    "live_chat_online": true,
    "callback_enabled": true,
    "support_email": "hello@viloplatform.com",
    "median_response_minutes": 4,
    "community_member_count": 2480
  }'::jsonb),
  ('community', '[
    {"title":"How do you handle late check-in requests politely?","author":"Nomvula N.","replies":14,"ago":"2h","initials":"NN","accent":"secondary"},
    {"title":"Karoo & Garden Route - December pricing playbook","author":"Jacobus V.","replies":28,"ago":"8h","initials":"JV","accent":"primary"},
    {"title":"Best fluffy towels under R 200 - recommendations?","author":"Ayanda R.","replies":41,"ago":"Yesterday","initials":"AR","accent":"mute"}
  ]'::jsonb);
