-- Migration: refresh the website Domain help article for enterprise build-out
-- Phase 4 (editable subdomain, connection stepper, email-on-verified, canonical
-- host choice). Idempotent on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'website-domain',
  'Your web address & custom domain',
  'Rename your free Vilo address, connect your own domain, track the connection step by step, and choose your preferred (www or root) address.',
  $html$
<p>The <strong>Domain</strong> tab is where you set your website's address. Every site gets a free Vilo address, and you can connect your own domain when you're ready.</p>

<h3>Your free Vilo address</h3>
<p>Your site is always reachable at <code>your-name.vilo.site</code>. Click <strong>Edit address</strong> to change the <em>your-name</em> part — use lowercase letters, numbers and hyphens. It must be unique across Vilo.</p>

<h3>Connecting a custom domain</h3>
<p>Enter a domain you own and click Connect. We'll show the <strong>DNS records</strong> to add at your registrar. The <strong>connection status</strong> tracker walks you through each step — domain added, DNS detected, DNS verified, and SSL issued — so you always know where things stand. DNS can take a few minutes to a few hours; <strong>we'll email you the moment your domain is live and secured</strong>.</p>

<h3>Preferred address</h3>
<p>Choose whether the main version of your site is the root domain (<code>example.com</code>) or the www version (<code>www.example.com</code>). Visitors on the other version are redirected to your preferred one.</p>

<p><em>Note:</em> custom-domain connection is enabled once your plan includes it and the platform's domain integration is switched on.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  COALESCE(
    (SELECT id FROM help_categories WHERE slug = 'account'),
    (SELECT id FROM help_categories ORDER BY sort_order LIMIT 1)
  ),
  'host', 'published', 3, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
