-- Help-centre accuracy pass: bring seeded help content in line with how the
-- code actually works now (audited 2026-08-01 against live code + DB).
--
-- Three drift classes were fixed:
--   1. Phantom features — articles/FAQs describing a payout/escrow model and a
--      "smart pricing" engine that were never built. Wielo is 0% commission;
--      guest money settles DIRECTLY to the host's own gateway (see
--      lib/payments/host-paystack.ts). These are soft-deleted / rewritten.
--   2. False plan gating — "available on the Pro plan" for features that are
--      open to everyone (two-way iCal, custom cancellation policy, team seats).
--   3. Stale labels/numbers — renamed tabs (Banking & business -> Payment
--      processors / Businesses; Listings -> Properties; Messages -> Inbox),
--      wrong defaults (quote validity, refund timing, iCal poll cadence,
--      affiliate cookie window), and a UI copy claim with no backing feature.
--
-- Website-builder articles are intentionally NOT touched here — that surface is
-- owned by a separate sub-branch (founder directive). Their duplicates are
-- documented for that branch, not edited.
--
-- Idempotent: replaces target exact stale strings scoped by slug/question, and
-- soft-deletes guard on deleted_at IS NULL. A verification block at the end
-- RAISES (aborting the migration) if any fix silently matched nothing.

BEGIN;

-- 1. DELETE phantom-feature articles (soft-delete + archive) ------------------
UPDATE help_articles
SET deleted_at = now(), status = 'archived', updated_at = now()
WHERE slug IN ('payout-schedule', 'payment-held-for-review', 'smart-pricing-rules')
  AND deleted_at IS NULL;

-- 2. FAQ rewrites ------------------------------------------------------------
UPDATE help_faqs
SET answer_html = '<p>Wielo charges a flat <strong>subscription</strong> for the platform and takes <strong>0% commission</strong> on your bookings. Guests pay through <strong>your own</strong> connected Paystack or PayPal account (or by EFT to your bank), so booking money settles <strong>directly to you</strong> &mdash; Wielo never holds it and deducts nothing from it. The only thing you pay Wielo is your plan.</p>',
    updated_at = now()
WHERE question LIKE 'What is Wielo%commission%';

UPDATE help_faqs
SET answer_html = '<p>Wielo doesn&rsquo;t hold your booking money, so there&rsquo;s no payout to wait for. When a guest pays by card, the money settles <strong>straight to your own Paystack or PayPal account</strong>; when they pay by EFT, it goes <strong>directly to your bank</strong>. How fast it reaches your bank is set by your payment provider, not by Wielo.</p>',
    updated_at = now()
WHERE question LIKE 'How long does Wielo take to pay out%';

UPDATE help_faqs
SET answer_html = '<p>Team access lets you invite a <strong>Co-host</strong>, <strong>Cleaner</strong> or <strong>Assistant</strong>, each with the right level of access &mdash; a cleaner sees the calendar and can update blocked dates, while a co-host can manage bookings. The number of seats depends on your plan (Basic includes 1, Pro 3 and Business 10). <em>Note: team invites are still being finalised and aren&rsquo;t switched on in the menu just yet.</em></p>',
    updated_at = now()
WHERE question LIKE 'How do I add a co-host%';

UPDATE help_faqs
SET answer_html = '<p>Yes. Open <strong>Channels &rarr; Add iCal feed</strong> and paste your Airbnb (or Booking.com, and most other) export URLs. Wielo re-checks each feed <strong>every few hours</strong> and blocks matching dates on your Wielo calendar. Two-way sync &mdash; importing other calendars <em>and</em> sharing your Wielo calendar back out &mdash; is available to <strong>all hosts</strong>.</p>',
    updated_at = now()
WHERE question LIKE 'Can I import bookings from Airbnb%';

UPDATE help_faqs
SET answer_html = replace(answer_html, '<strong>Report this review</strong>', '<strong>Flag</strong>'),
    updated_at = now()
WHERE question LIKE 'A guest left a review%';

-- 3. Video description fixes -------------------------------------------------
UPDATE help_videos
SET description = 'Two-way sync end-to-end, for every host.'
WHERE title LIKE 'Full Airbnb%sync walkthrough%';

UPDATE help_videos
SET description = 'Weekends, seasons, and length-of-stay discounts. Set once, forget.'
WHERE title LIKE 'Build a smart pricing strategy%';

-- 4. property-channels: 2 channels -> 3 channels (full rewrite) --------------
UPDATE help_articles
SET body_html = '<p>Every property has a <strong>Channels</strong> tab in its editor. A <em>channel</em> is simply a place your property can be published, and there are <strong>three</strong>, each an independent switch &mdash; so a property can appear on any combination of them.</p>
<h3>Booking management</h3>
<p>Controls whether guests can <strong>book and pay instantly</strong> for this property. When it&rsquo;s on, your listing shows live availability and instant checkout. Turn it off and the listing invites guests to <strong>request a quote</strong> (and links out to your own website) instead of booking on the spot &mdash; handy while you&rsquo;re still setting a property up.</p>
<h3>Wielo Directory</h3>
<p>The <strong>Wielo Directory</strong> switch is the public Wielo listing at <code>/property/your-place</code> &mdash; discoverable on Wielo and bookable directly. Turning it on requires your setup to be complete: photos, at least one room, valid banking details and a refund policy. This is the same publish switch shown at the top of the editor.</p>
<h3>Your website</h3>
<p>The <strong>Your website</strong> switch shows the property on your business&rsquo;s own branded Wielo website. You&rsquo;ll only see this switch once the property is attached to a business (Basic info tab) and that business has a website. If it doesn&rsquo;t have one yet, you can create one from the Website area.</p>
<h3>They all share one booking flow</h3>
<p>Keeping the channels separate lets you, for example, feature a property on your own website while keeping it off the public directory. Whatever you choose, <strong>Booking management, the Wielo Directory and your website all send guests to the same booking flow</strong>, so your prices and availability always stay perfectly in sync. Nothing about a channel changes how a booking is priced or paid.</p>',
    updated_at = now()
WHERE slug = 'property-channels';

-- 5. view-and-accept-your-quotes: guest pays online, not "directly with host"
UPDATE help_articles
SET body_html = replace(
      replace(body_html,
        '<li><strong>Accepted</strong> &mdash; you&rsquo;ve accepted; the host will be in touch to arrange the booking.</li>',
        '<li><strong>Accepted</strong> &mdash; you&rsquo;ve accepted; for a stay you can pay securely online right away to confirm.</li>'),
      '<strong>Accepting holds your dates</strong> with the host &mdash; payment is arranged afterwards directly with them.',
      '<strong>Accepting turns the quote into a booking</strong> and holds your dates &mdash; then you pay securely online (deposit or full amount, by card or EFT) to confirm.'),
    updated_at = now()
WHERE slug = 'view-and-accept-your-quotes';

-- 6. Tab / label renames -----------------------------------------------------
UPDATE help_articles
SET body_html = replace(body_html, 'Settings &rarr; Banking &amp; business &rarr; Payment gateways', 'Settings &rarr; Payment processors'),
    updated_at = now()
WHERE slug = 'connect-payment-gateways';

UPDATE help_articles
SET body_html = replace(body_html, '(Settings &rarr; Banking &amp; payments)', '(Settings &rarr; Payment processors)'),
    updated_at = now()
WHERE slug = 'send-a-payment-link';

UPDATE help_articles
SET body_html = replace(body_html, 'Business &amp; banking', 'Businesses'),
    updated_at = now()
WHERE slug = 'branding-your-documents';

-- 7. refund-methods-and-credit-notes: refunds are host-sent; CN number format
UPDATE help_articles
SET body_html = replace(
      replace(
      replace(
      replace(
      replace(body_html,
        '<li><strong>Paystack (card)</strong> — refunded automatically to the card the guest paid with, via the provider.</li>',
        '<li><strong>Paystack (card)</strong> — you send the refund back to the card the guest paid with; Wielo records it and notifies the guest.</li>'),
        '<li><strong>PayPal</strong> — refunded automatically through PayPal.</li>',
        '<li><strong>PayPal</strong> — you send the refund back through PayPal; Wielo records it and notifies the guest.</li>'),
        'EFT and Manual are flagged as host-sent in the audit trail; Paystack and PayPal are provider transactions.',
        'Every refund is recorded as host-sent in the audit trail, and the guest is notified with the method you chose.'),
        '{handle}-CNYYYY-NNNN',
        'CN-NNNN'),
        'Provider (Paystack / PayPal) refund automation is finalised at launch; the chosen method is always recorded so the audit trail and the guest''s notification are correct.',
        'Every refund is currently host-sent; the chosen method is always recorded so the audit trail and the guest''s notification are correct.'),
    updated_at = now()
WHERE slug = 'refund-methods-and-credit-notes';

-- 8. partial-refund-without-cancelling: host-sent, real timing
UPDATE help_articles
SET body_html = replace(body_html,
      'Submit. Paystack settles within 5&ndash;10 business days.',
      'Submit and confirm you&rsquo;ve sent it. Refunds typically take 3&ndash;10 working days to reach the guest.'),
    updated_at = now()
WHERE slug = 'partial-refund-without-cancelling';

-- 9. connect-airbnb-ical: ~3h cadence, multi-provider, two-way (title + body)
UPDATE help_articles
SET title = 'Connect your Airbnb (and other) calendars with iCal',
    body_html = '<p>iCal sync is the simplest way to stop double-bookings. Paste an export URL from Airbnb &mdash; or Booking.com, VRBO, SafariNow, LekkeSlaap and most other calendars &mdash; under <strong>Channels &rarr; Add iCal feed</strong>, and Wielo blocks the matching dates on your calendar. It re-checks each feed <strong>every few hours</strong>. You can also share your Wielo calendar back out, so sync works in <strong>both directions</strong>.</p>',
    updated_at = now()
WHERE slug = 'connect-airbnb-ical';

-- 10. how-affiliate-program-works: cookie window 30 -> 90 days
UPDATE help_articles
SET body_html = replace(body_html, 'attributes them to you for <strong>30 days</strong>', 'attributes them to you for <strong>90 days</strong>'),
    updated_at = now()
WHERE slug = 'how-affiliate-program-works';

-- 11. cancellation-policies-explained: custom policy is not Pro-gated
UPDATE help_articles
SET body_html = '<p>Wielo ships with three named policies &mdash; <strong>Flexible</strong>, <strong>Moderate</strong> and <strong>Strict</strong> &mdash; and you can also define your <strong>own custom policy</strong>. Custom policies are available on every plan.</p>',
    updated_at = now()
WHERE slug = 'cancellation-policies-explained';

-- 12. guest-access-and-local-tips: configurable unlock time + Local picks
UPDATE help_articles
SET body_html = replace(
      replace(body_html,
        'under <strong>Listings &rarr; edit &rarr; Guest access</strong>',
        'under <strong>Properties &rarr; edit &rarr; Guest access</strong>'),
        '<p>The sensitive bits &mdash; <strong>gate code, door code and Wi-Fi password</strong> &mdash; unlock for the guest <strong>1 hour before check-in</strong> (a physical-key courtesy), and only on a confirmed booking. Until then they see a &ldquo;unlocks 1 hour before check-in&rdquo; note. Access details are never shown on your public page.</p>',
        '<p>The sensitive bits &mdash; <strong>gate code, door code and Wi-Fi password</strong> &mdash; unlock for the guest shortly before arrival, and only on a confirmed booking. You choose <strong>how far ahead</strong> they appear &mdash; from 1 hour up to 3 days before check-in (the default is 1 hour). Until then they see an &ldquo;unlocks before check-in&rdquo; note. Access details are never shown on your public page.</p>
<h3>Local picks</h3>
<p>The same tab has a <strong>Local picks</strong> editor where you can add your favourite nearby spots &mdash; places to eat, things to do and travel tips &mdash; which appear to guests alongside their arrival details.</p>'),
    updated_at = now()
WHERE slug = 'guest-access-and-local-tips';

-- 13. find-your-way-around-the-dashboard: {brand} token + Listings -> Properties
UPDATE help_articles
SET body_html = replace(
      replace(body_html, 'New to {brand}?', 'New to Wielo?'),
      '<h3>Listings</h3>', '<h3>Properties</h3>'),
    updated_at = now()
WHERE slug = 'find-your-way-around-the-dashboard';

-- 14. change-your-email-and-password: mention current-password re-auth
UPDATE help_articles
SET body_html = replace(body_html,
      '<p>Your sign-in details live under <strong>Settings &rarr; Security</strong> in your portal.</p>',
      '<p>Your sign-in details live under <strong>Settings &rarr; Security</strong> in your portal. For your safety, you&rsquo;ll be asked for your <strong>current password</strong> to confirm it&rsquo;s really you before an email or password change goes through (accounts that sign in by email link can use that instead).</p>'),
    updated_at = now()
WHERE slug = 'change-your-email-and-password';

-- 15. sending-quotes: real send button + real default validity
UPDATE help_articles
SET body_html = replace(
      replace(body_html,
        '<strong>Save &amp; send</strong> to issue it.',
        '<strong>Send to the guest</strong> to issue it.'),
        'the quote expires (14 days by default)',
        'the quote expires (3 days by default &mdash; you can also choose 24 hours, 7 days, or until check-in)'),
    updated_at = now()
WHERE slug = 'sending-quotes';

-- 16. quote-tracking-and-notes: remove the non-existent "Send a reminder" button
UPDATE help_articles
SET body_html = replace(body_html,
      '<li>If they&rsquo;ve looked but not replied, a one-tap <strong>Send a reminder</strong> nudge is right there.</li>',
      '<li>If they&rsquo;ve looked but not replied, that&rsquo;s often the moment a friendly nudge closes it &mdash; message them from the quote.</li>'),
    updated_at = now()
WHERE slug = 'quote-tracking-and-notes';

-- 17. guests-crm: sidebar order, tab name, template reuse surfaces
UPDATE help_articles
SET body_html = replace(
      replace(
      replace(body_html,
        '(in the sidebar, right after Bookings)',
        '(in the sidebar, after Inbox)'),
        'Bookings, Messages (reply with reusable templates), Payments, and Notes',
        'Bookings, Finances, Messages (reply with reusable templates), and Notes'),
        'reuse them from the inbox, a guest&rsquo;s Messages tab, and broadcasts.',
        'reuse them from the inbox and a guest&rsquo;s Messages tab.'),
    updated_at = now()
WHERE slug = 'guests-crm';

-- 18. message-a-host: portal nav item is "Inbox"
UPDATE help_articles
SET body_html = replace(body_html, 'Open <strong>Messages</strong> in your portal', 'Open <strong>Inbox</strong> in your portal'),
    updated_at = now()
WHERE slug = 'message-a-host';

-- 19. accept-a-quote-and-pay: Inbox nav + real "View & accept" CTA
UPDATE help_articles
SET body_html = replace(
      replace(body_html,
        'a card in your <strong>Messages</strong> thread',
        'a card in your <strong>Inbox</strong> thread'),
        'Tap <strong>Accept</strong> on the quote.',
        'Tap <strong>View &amp; accept</strong> on the quote card, then confirm.'),
    updated_at = now()
WHERE slug = 'accept-a-quote-and-pay';

-- Verification: abort if any fix silently matched nothing --------------------
DO $$
DECLARE
  bad text := '';
BEGIN
  IF EXISTS (SELECT 1 FROM help_articles WHERE slug IN ('payout-schedule','payment-held-for-review','smart-pricing-rules') AND deleted_at IS NULL) THEN bad := bad || 'phantom-not-deleted; '; END IF;
  IF EXISTS (SELECT 1 FROM help_articles WHERE body_html LIKE '%{handle}-CNYYYY-NNNN%') THEN bad := bad || 'CN-format; '; END IF;
  -- Scoped to our article: build-your-website also has a {brand} token, but that
  -- is a website-builder article owned by the sub-branch and is left untouched.
  IF EXISTS (SELECT 1 FROM help_articles WHERE slug='find-your-way-around-the-dashboard' AND body_html LIKE '%{brand}%') THEN bad := bad || 'brand-token; '; END IF;
  IF EXISTS (SELECT 1 FROM help_articles WHERE slug='connect-airbnb-ical' AND body_html LIKE '%every 15 minutes%') THEN bad := bad || 'ical-15min; '; END IF;
  IF EXISTS (SELECT 1 FROM help_articles WHERE slug='how-affiliate-program-works' AND body_html LIKE '%30 days%') THEN bad := bad || 'cookie-30d; '; END IF;
  IF EXISTS (SELECT 1 FROM help_articles WHERE slug='cancellation-policies-explained' AND body_html LIKE '%on the Pro plan%') THEN bad := bad || 'cancel-pro-gate; '; END IF;
  IF EXISTS (SELECT 1 FROM help_articles WHERE slug='property-channels' AND (body_html LIKE '%two channels%' OR body_html LIKE '%Why two switches%')) THEN bad := bad || 'channels-two; '; END IF;
  IF EXISTS (SELECT 1 FROM help_articles WHERE slug='view-and-accept-your-quotes' AND body_html LIKE '%arranged afterwards directly%') THEN bad := bad || 'quote-direct-pay; '; END IF;
  IF EXISTS (SELECT 1 FROM help_articles WHERE slug='connect-payment-gateways' AND body_html LIKE '%Banking &amp; business%') THEN bad := bad || 'gw-tab; '; END IF;
  IF EXISTS (SELECT 1 FROM help_articles WHERE slug='send-a-payment-link' AND body_html LIKE '%Banking &amp; payments%') THEN bad := bad || 'paylink-tab; '; END IF;
  IF EXISTS (SELECT 1 FROM help_articles WHERE slug='branding-your-documents' AND body_html LIKE '%Business &amp; banking%') THEN bad := bad || 'brand-doc-tab; '; END IF;
  IF EXISTS (SELECT 1 FROM help_articles WHERE slug='partial-refund-without-cancelling' AND body_html LIKE '%Paystack settles within%') THEN bad := bad || 'partial-refund-timing; '; END IF;
  IF EXISTS (SELECT 1 FROM help_articles WHERE slug='find-your-way-around-the-dashboard' AND body_html LIKE '%<h3>Listings</h3>%') THEN bad := bad || 'dash-listings; '; END IF;
  IF EXISTS (SELECT 1 FROM help_articles WHERE slug='sending-quotes' AND body_html LIKE '%14 days by default%') THEN bad := bad || 'quote-14d; '; END IF;
  IF EXISTS (SELECT 1 FROM help_articles WHERE slug='quote-tracking-and-notes' AND body_html LIKE '%Send a reminder%') THEN bad := bad || 'reminder-button; '; END IF;
  IF EXISTS (SELECT 1 FROM help_articles WHERE slug='message-a-host' AND body_html LIKE '%Open <strong>Messages</strong> in your portal%') THEN bad := bad || 'msg-host-nav; '; END IF;
  IF EXISTS (SELECT 1 FROM help_articles WHERE slug='guests-crm' AND body_html LIKE '%right after Bookings%') THEN bad := bad || 'crm-order; '; END IF;
  IF EXISTS (SELECT 1 FROM help_faqs WHERE answer_html LIKE '%host fee%') THEN bad := bad || 'faq-commission; '; END IF;
  IF EXISTS (SELECT 1 FROM help_faqs WHERE answer_html LIKE '%Read-only%') THEN bad := bad || 'faq-cohost-role; '; END IF;
  IF EXISTS (SELECT 1 FROM help_faqs WHERE answer_html LIKE '%24 hours after%') THEN bad := bad || 'faq-payout; '; END IF;
  IF EXISTS (SELECT 1 FROM help_faqs WHERE answer_html LIKE '%Report this review%') THEN bad := bad || 'faq-review-flag; '; END IF;
  IF EXISTS (SELECT 1 FROM help_videos WHERE description LIKE '%PRO plan%') THEN bad := bad || 'video-pro-gate; '; END IF;
  IF EXISTS (SELECT 1 FROM help_videos WHERE description LIKE '%last-minute discount%') THEN bad := bad || 'video-lastminute; '; END IF;

  IF bad <> '' THEN
    RAISE EXCEPTION 'help accuracy pass: unmatched fixes -> %', bad;
  END IF;
END $$;

COMMIT;
