-- Migration: Help Centre (RULES.md §9) for the redesigned host inbox.
-- The host inbox is now the same two-pane chat as the guest message centre:
-- a conversation list on the left, a WhatsApp-style thread on the right. The
-- old Gmail-style folder rail + deal pipeline have been retired in favour of
-- simple All / Unread / Enquiries / Archived filters. This:
--   1) adds a new host article describing the new inbox, and
--   2) re-seeds the now-stale `enquiry-pipeline-inbox` article so it no longer
--      references the removed pipeline rail / drag-to-stage controls.
-- Both are idempotent upserts on slug.

-- 1) The redesigned inbox ------------------------------------------------------
INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'using-your-inbox',
  'Using your inbox',
  'One simple chat screen: conversations on the left, the thread on the right. Reply with quick replies, see the booking behind any chat, and archive what is done.',
  $html$
<p>Your <strong>Inbox</strong> is a single chat screen — the same message centre your guests use. Conversations sit in a list on the left; tap one to open the thread on the right and reply.</p>

<h3>Finding a conversation</h3>
<p>Use the <strong>search</strong> box to find a guest, listing or reference, and the filter chips to narrow the list:</p>
<ul>
  <li><strong>All</strong> — every live conversation, newest first. Pinned chats stay at the top.</li>
  <li><strong>Unread</strong> — only threads waiting on your reply.</li>
  <li><strong>Enquiries</strong> — quote requests and questions that aren't a booking yet.</li>
  <li><strong>Archived</strong> — chats you've put away.</li>
</ul>
<p>If you have more than one listing, the <strong>listing menu</strong> lets you show only that property's conversations.</p>

<h3>Replying</h3>
<p>Type in the box at the bottom and press <strong>Enter</strong> to send (<strong>Shift+Enter</strong> for a new line). Saved <strong>quick replies</strong> appear above the box — tap one to drop it in, and edit before sending. Manage your saved replies from <em>Manage</em> next to them.</p>

<h3>The booking behind the chat</h3>
<p>Tap <strong>Booking</strong> (or <strong>Details</strong>) at the top of a thread to slide out the stay: the listing, check-in and check-out, guest count, total and reference, with a link straight to the full booking. The guest's contact details — including a one-tap WhatsApp link — are there too.</p>

<h3>Pin &amp; archive</h3>
<p>Use the <strong>star</strong> to pin an important chat to the top of your list, and <strong>archive</strong> to tidy away one you're done with. Archived chats stay searchable under the Archived filter, and you can un-archive any time.</p>

<h3>Quotes in the thread</h3>
<p>When a guest requests a quote it appears right inside the conversation as a card you can open, complete and send — see <em>“Turn enquiries into bookings”</em> for the full flow.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'bookings'),
  'host',
  'published',
  3,
  now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      excerpt = EXCLUDED.excerpt,
      body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id,
      audience = EXCLUDED.audience,
      status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes,
      updated_at = now();

-- 2) Correct the stale pipeline article (no more rail / drag-to-stage) ---------
INSERT INTO help_articles (
  slug, title, excerpt, body_html, body_json,
  category_id, audience, status, read_time_minutes, published_at
)
SELECT
  'enquiry-pipeline-inbox',
  'Turn enquiries into bookings',
  'Guests request a quote from your listing; it lands in your inbox as a draft quote you complete and send — right inside the conversation.',
  $html$
<p>Every listing has a <strong>Request a quote</strong> button. When a visitor sends a request, Vilo does three things automatically:</p>
<ul>
  <li>Creates (or reuses) a lightweight <strong>guest contact</strong> from their name, email and phone — no account required on their side.</li>
  <li>Opens a thread in your <strong>Inbox</strong> under the <strong>Enquiries</strong> filter, with the guest's message.</li>
  <li>Drafts a <strong>quote</strong> from their dates and party, auto-priced as a starting point — you stay in full control of pricing.</li>
</ul>

<h3>Completing &amp; sending the quote</h3>
<p>Open the thread and use the <strong>draft quote card</strong> in the conversation to open the quote. Adjust the host-only fields — price, cleaning fee, add-ons, discount, deposit terms and policy — then <strong>send</strong>. The guest gets a link to view and accept it; visitors can never change your prices or policies.</p>

<h3>What happens next</h3>
<p>Each step appears in the thread as its own card, so the whole negotiation reads like a chat:</p>
<ul>
  <li>You send the quote — the guest sees it and can accept online.</li>
  <li>Revisions show as new cards; the latest one is always the live offer.</li>
  <li>When the guest <strong>accepts</strong>, the quote converts into a booking automatically and the chat shows the confirmed booking.</li>
</ul>
<p>Use the <strong>Enquiries</strong> filter to keep an eye on requests that haven't become bookings yet, and <strong>archive</strong> the ones that don't go ahead.</p>
$html$,
  '{"type":"doc","content":[]}'::jsonb,
  (SELECT id FROM help_categories WHERE slug = 'bookings'),
  'host', 'published', 3, now()
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body_html = EXCLUDED.body_html,
      category_id = EXCLUDED.category_id, status = EXCLUDED.status,
      read_time_minutes = EXCLUDED.read_time_minutes, updated_at = now();
