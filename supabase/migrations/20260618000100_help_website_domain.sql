-- Migration: Help Centre article for connecting a custom domain (W13). Ships
-- with the feature per RULES.md §9. Idempotent on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'website-custom-domain',
  'Connecting a custom domain',
  'Use your own domain (like www.yourbusiness.com) for your website, with automatic SSL. Learn how to connect it and add the DNS records.',
  $html$
<p>Every website comes with a free Vilo address (<code>yourname.vilo.site</code>) that works straight away. If you own your own domain, you can connect it on the <strong>Domain</strong> tab so your site loads at, say, <code>www.yourbusiness.com</code> — secured automatically with SSL.</p>

<h3>Connecting your domain</h3>
<p>On the <strong>Domain</strong> tab, type your domain and choose <strong>Connect</strong>. We'll show the exact <strong>DNS records</strong> you need to add.</p>

<h3>Adding the DNS records</h3>
<p>Sign in to your domain registrar (where you bought the domain) and add the records shown:</p>
<ul>
<li>A root domain (<code>yourbusiness.com</code>) uses an <strong>A record</strong> pointing at the shown IP address.</li>
<li>A subdomain (<code>www.yourbusiness.com</code>) uses a <strong>CNAME record</strong> pointing at the shown target.</li>
<li>If a <strong>TXT record</strong> is listed, add it too — it proves you own the domain.</li>
</ul>

<h3>Verification &amp; SSL</h3>
<p>DNS changes can take anywhere from a few minutes to a few hours to take effect. We re-check automatically, and you can use <strong>Refresh status</strong> to check immediately. Once the records are detected, the status turns <strong>Active</strong> and an SSL certificate is issued for you — no extra steps.</p>

<h3>Removing a domain</h3>
<p>Choose <strong>Disconnect</strong> to stop using a custom domain. Your free Vilo address keeps working.</p>
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
