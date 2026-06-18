-- Migration: Help Centre article for the website contact form + Settings tab
-- (enterprise build-out Phase 5). Ships with the feature per RULES.md §9.
-- Idempotent on slug.

INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'website-contact-form',
  'Contact forms & website enquiries',
  'Add a contact form to your site, where submissions go, and how to get an email each time someone gets in touch.',
  $html$
<p>A <strong>contact form</strong> lets visitors message you straight from your website. Add it to any page from the section library, give it a heading, intro and button label, and choose whether to ask for a phone number.</p>

<h3>Where submissions go</h3>
<p>Every submission lands in your <strong>Inbox</strong> as a <strong>Website Enquiry</strong> — shown with a blue "Website" tag under the <em>Enquiries</em> filter, just like a quote request. The person who wrote in becomes a guest record automatically, so you can reply, tag and track them like any other guest.</p>

<h3>Get an email too</h3>
<p>If you'd like a copy emailed to you, open the website <strong>Settings</strong> tab, switch on <strong>Email me new website enquiries</strong> and enter the address to send them to. Submissions always appear in your inbox; the email is an extra heads-up.</p>

<h3>Good to know</h3>
<ul>
<li>The form only works on your <strong>published</strong> site — in the editor preview it's shown but inactive.</li>
<li>Spam is filtered with a hidden honeypot field, and repeated submissions from the same person are rate-limited.</li>
<li>Replies happen right in your inbox thread — the visitor can follow the conversation from their own Vilo inbox.</li>
</ul>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  COALESCE(
    (SELECT id FROM help_categories WHERE slug = 'account'),
    (SELECT id FROM help_categories ORDER BY sort_order LIMIT 1)
  ),
  'host', 'published', 2, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
