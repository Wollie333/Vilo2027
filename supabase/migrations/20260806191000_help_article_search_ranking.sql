-- Public help article: "How search ranking works" — the transparency promise
-- behind the fair, earned-only directory ranking (see migration 20260806170000
-- + the search_directory RPC). Lives in the "Listings & photos" category since
-- it is about optimising a listing to rank. Published, host-facing.
--
-- Idempotent: upsert by slug so re-running or editing later is safe.
INSERT INTO public.help_articles (
  slug, title, excerpt, body_html, category_id, audience, status,
  read_time_minutes, published_at, seo_title, meta_description
)
SELECT
  'how-search-ranking-works',
  'How search ranking works',
  'Exactly what decides where your listing appears in Wielo search — and how to climb. Rank is earned, never bought.',
  $html$
<p>When a guest searches the Wielo directory, listings are ordered by a simple, fair idea: the stays that <strong>best match what the guest asked for</strong> and are <strong>best run</strong> come first. Every signal we use is one you earn or control &mdash; and your subscription plan is <strong>not</strong> one of them.</p>

<h3>Ranking is earned, not bought</h3>
<p>Your plan has <strong>no effect</strong> on your position in search. A well-optimised listing on the free plan will outrank an under-optimised one on any paid plan. Paid plans give you better tools &mdash; they never buy you a higher spot.</p>

<h3>When a guest types keywords</h3>
<p>For a keyword search (like &ldquo;beachfront lodge in Durban&rdquo;), we score how well your listing matches the words. Where the match appears matters:</p>
<ul>
  <li><strong>Your listing name</strong> counts the most &mdash; it is your headline promise.</li>
  <li><strong>Your town, city and province</strong> come next, so location searches find you.</li>
  <li><strong>Your accommodation type</strong> (lodge, B&amp;B, guest house&hellip;).</li>
  <li><strong>Your description</strong> adds detail, at a lighter weight.</li>
</ul>
<p>Because location is matched against your <em>structured</em> town and city &mdash; not just words in your description &mdash; you cannot rank for a place you are not in by mentioning it. Write naturally: repeating keywords does not help.</p>

<h3>What makes up your quality score</h3>
<p>Alongside relevance, we reward listings that are genuinely well run. Every part is earned:</p>
<ul>
  <li><strong>Guest rating</strong> &mdash; from real reviews after real stays.</li>
  <li><strong>Review volume</strong> &mdash; more reviews build trust (counted so a large host never buries a great newcomer).</li>
  <li><strong>Listing optimisation</strong> &mdash; the part you fully control: a real description, your town set, at least 5 photos, your check-in time, and 3 or more amenities.</li>
  <li><strong>Responsiveness</strong> &mdash; how quickly you reply to guest enquiries.</li>
</ul>

<h3>Dates and availability</h3>
<p>When a guest searches with check-in and check-out dates, stays that are fully booked for those nights are hidden, so guests only see places they can actually book.</p>

<h3>How to climb</h3>
<p>Open any listing and look at its <strong>Listing strength</strong> page (the gauge icon on the listing card). It shows your live score, what drives it, and a short list of quick wins &mdash; each linking straight to the setting that improves it. Complete those, keep your calendar current, and reply to guests promptly. That is the whole game: there is no shortcut to buy.</p>
$html$,
  (SELECT id FROM public.help_categories WHERE slug = 'listings'),
  'host',
  'published',
  4,
  now(),
  'How Wielo search ranking works',
  'How Wielo orders directory search results — relevance plus earned quality. Your plan never buys ranking. Learn how to climb.'
ON CONFLICT (slug) DO UPDATE SET
  title            = EXCLUDED.title,
  excerpt          = EXCLUDED.excerpt,
  body_html        = EXCLUDED.body_html,
  category_id      = EXCLUDED.category_id,
  audience         = EXCLUDED.audience,
  status           = EXCLUDED.status,
  read_time_minutes = EXCLUDED.read_time_minutes,
  published_at     = COALESCE(public.help_articles.published_at, EXCLUDED.published_at),
  seo_title        = EXCLUDED.seo_title,
  meta_description = EXCLUDED.meta_description,
  updated_at       = now();
