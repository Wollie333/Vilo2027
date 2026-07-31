-- Wielo — seed STARTING-DRAFT content into each legal_documents field.
-- One-time helper: gives every document a real first draft to edit from (instead
-- of the placeholder). Clean HTML only — no "[COUNSEL]" notes — so the already-
-- published docs stay presentable; publish state is left unchanged. Dollar-quoted
-- ($h$…$h$) so apostrophes need no escaping. Safe to re-run.
--
-- After running, open Admin → Legal docs to edit each, and the version-history
-- rows are re-synced at the end.

-- 1) TERMS OF SERVICE ------------------------------------------------------
UPDATE public.legal_documents SET updated_at = now(), body_html = $h$
<h2>1. About these Terms</h2>
<p>These Terms of Service (“Terms”) govern your access to and use of the Wielo platform — our website, apps and related services (the “Platform”), operated by Wielo Platform (Pty) Ltd. By creating an account, listing a property or experience, making a booking, or otherwise using the Platform, you agree to these Terms and to our Privacy Policy. If you do not agree, do not use the Platform.</p>
<h2>2. What Wielo is — and is not</h2>
<p>Wielo is a management and direct-booking platform. We give hosts the tools to list, price, manage calendars and policies, take payment, and communicate with guests directly. <strong>Wielo is not a travel agent or tour operator, and is not a party to the agreement between a host and a guest</strong> — that contract is concluded directly between them. Wielo does not own, control or inspect any listing, and is not responsible for the condition, legality, safety or accuracy of any listing. Hosts pay a flat subscription fee; Wielo does not take a per-booking commission.</p>
<h2>3. Eligibility and your account</h2>
<p>You must be at least 18 years old and able to enter into a binding contract. You are responsible for the accuracy of your information, for keeping your login credentials secure, and for all activity under your account. Some features require a verified email address.</p>
<h2>4. Host obligations</h2>
<p>As a host you are responsible for the accuracy of your listings (photos, descriptions, pricing, availability, policies); for complying with all applicable laws, licensing, insurance and tax obligations (income tax, and VAT where applicable); for the safety, condition and legality of the property or experience; and for honouring every confirmed booking. Where you process a guest’s personal information you act as the Responsible Party and Wielo acts as your Operator under Schedule A.</p>
<h2>5. Guest obligations</h2>
<p>As a guest you agree to provide accurate booking information, pay in full and on time, comply with the listing’s house rules and cancellation policy, treat the property with care and be responsible for any damage you cause, and respect the host’s and neighbours’ rights to privacy and quiet enjoyment.</p>
<h2>6. Bookings and payments</h2>
<p>Wielo facilitates direct bookings between guests and hosts. Payments are processed by Paystack (card and subscriptions), PayPal (orders and subscriptions) or manual EFT, under those providers’ own terms. Amounts are displayed in South African Rand unless stated otherwise, and prices are calculated and confirmed by Wielo at the time of booking.</p>
<h2>7. Cancellations and refunds</h2>
<p>Each listing displays a cancellation policy chosen by the host, and the version you accept forms part of your agreement with the host. Refunds, where due, are calculated against that policy and processed via the original payment method. Nothing in a host’s policy limits your rights under the Consumer Protection Act. Disputes that cannot be resolved between guest and host may be escalated to Wielo for good-faith review.</p>
<h2>8. Subscriptions and billing (hosts)</h2>
<p>Host subscriptions auto-renew at the displayed price until cancelled. You may cancel at any time; cancellation takes effect at the end of the current billing period. A failed renewal enters a five-day grace period before paid features are restricted. We give reasonable prior notice of any price change, which takes effect at your next renewal.</p>
<h2>9. Founding Host offer</h2>
<p>Hosts who join under the Founding Host offer receive the benefits described at enrolment, which may include a lifetime price-lock. The full, binding terms are set out in the Founding Host Terms and apply in addition to this clause.</p>
<h2>10. Reviews and user content</h2>
<p>Reviews must be honest, first-hand and lawful; you must not post or induce false, incentivised or manipulated reviews. How Wielo collects, verifies and displays reviews is set out in our Review Disclosure. You retain rights in content you upload but grant Wielo a worldwide, non-exclusive, royalty-free licence to host and display it for the purpose of operating, promoting and improving the Platform.</p>
<h2>11. Acceptable use</h2>
<p>You may not use the Platform to publish unlawful, fraudulent, discriminatory or misleading content; to circumvent Wielo’s fee structure or take bookings off-platform to avoid subscription obligations; to scrape or harvest data; to introduce malware or breach security; to impersonate any person; or to harass other users or our staff.</p>
<h2>12. Suspension, disclaimers and liability</h2>
<p>We may suspend or terminate accounts that breach these Terms, that pose a safety, legal or fraud risk, or where required by law. The Platform is provided “as is”. To the maximum extent permitted by law, and subject to any liability that cannot lawfully be limited, Wielo’s total liability is limited to the fees you have paid to Wielo in the 12 months preceding the claim. Nothing here excludes rights that cannot lawfully be excluded, including under the Consumer Protection Act.</p>
<h2>13. Changes, governing law and contact</h2>
<p>We may update these Terms; material changes are communicated by email or in-app notice at least 14 days before they take effect, and the version you accept at booking is recorded against that booking. These Terms are governed by the laws of the Republic of South Africa; disputes will be resolved in the courts of Cape Town unless mandatory consumer-protection law provides otherwise. Questions: legal@wielo.co.za.</p>
<h2>Schedule A — Host Data-Processing (Operator) Terms (POPIA §20–21)</h2>
<p>Where a host collects a guest’s personal information through the Platform, the host is the Responsible Party and Wielo is the Operator, processing on the host’s documented instructions (which the Platform’s features constitute). Wielo processes guest data only to provide the Platform; keeps authorised persons under confidentiality; maintains reasonable security (POPIA §19) including encryption in transit and of sensitive fields; may engage sub-operators (such as our hosting, payment and email providers) under comparable obligations; processes data in Frankfurt on the §72 basis described in the Privacy Policy; notifies the host without undue delay of a security compromise (POPIA §22); assists with data-subject requests; and returns or deletes guest data on termination except where the law requires retention. The host must have a lawful basis to collect the data and must not instruct unlawful processing.</p>
$h$ WHERE slug = 'terms';

-- 2) PRIVACY POLICY (POPIA) ------------------------------------------------
UPDATE public.legal_documents SET updated_at = now(), body_html = $h$
<h2>1. Who we are</h2>
<p>Wielo Platform (Pty) Ltd (“Wielo”, “we”, “us”) is the Responsible Party for the personal information it processes. You can reach our Information Officer at privacy@wielo.co.za. Where a host collects a guest’s personal information to fulfil a booking, the host is the Responsible Party and Wielo acts as the host’s Operator (see Schedule A of the Terms of Service).</p>
<h2>2. Information we collect</h2>
<p>Information you give us (account details, listing content, banking and payout details, booking and enquiry details, messages, reviews, support requests); information we collect automatically (device and connection data, IP address, log and usage data, cookies); and information from third parties where you have authorised it (such as confirmations from payment providers). Please do not submit special personal information or children’s information.</p>
<h2>3. How we use it, and our lawful basis</h2>
<p>We use personal information to provide the Platform; process bookings, subscriptions and payments; enable host–guest communication; send transactional messages; prevent and investigate fraud and abuse; provide support and resolve disputes; comply with legal, tax and accounting obligations; and — with your consent — send product updates and enable optional analytics. Our POPIA bases include performance of a contract, compliance with a legal obligation, our legitimate interests balanced against your rights, and your consent where required.</p>
<h2>4. Reviews and Looking-For requests</h2>
<p>Reviews are associated with your account and the relevant booking so we can verify they are genuine (see our Review Disclosure). When you post a Looking-For request we process the details you share so hosts can respond, sharing only what is necessary (see our Looking-For Notice).</p>
<h2>5. Sharing and disclosure</h2>
<p>We share information between host and guest as needed to complete a booking; with our payment providers (Paystack, PayPal); with service providers who process on our behalf under contract (infrastructure and database hosting, email delivery); and with regulators or law enforcement where legally required. We may share information in a business transfer, subject to this policy. We do not sell personal information.</p>
<h2>6. International transfers</h2>
<p>Your personal information is stored outside South Africa. Our database and file storage are hosted in Frankfurt, Germany, and some service providers process personal information in other countries. POPIA §72 permits these transfers because the recipients are subject to laws or binding agreements that uphold principles substantially similar to POPIA, and our contracts require a comparable standard of protection.</p>
<h2>7. Security and retention</h2>
<p>We use reasonable, appropriate technical and organisational measures — encryption in transit, encrypted storage of sensitive fields such as banking details, strict role-based access controls and regular review. We keep personal information for as long as your account is active and for a reasonable period afterwards to satisfy legal, tax, accounting and dispute-resolution requirements, after which it is deleted or de-identified.</p>
<h2>8. Your rights</h2>
<p>You have the right to access, correct or delete your personal information; object to processing; withdraw consent; not be subject to unsolicited electronic marketing; and lodge a complaint with the Information Regulator. You can request data export or deletion from your account settings. Some information may be retained where the law requires it even after a deletion request.</p>
<h2>9. Children, changes and complaints</h2>
<p>The Platform is not intended for people under 18 and we do not knowingly collect their information. We may update this policy; material changes are communicated by email or in-app notice, and the version in force when you make a booking is recorded. For privacy questions or to exercise your rights, contact privacy@wielo.co.za. You may also lodge a complaint with the Information Regulator of South Africa.</p>
$h$ WHERE slug = 'privacy';

-- 3) COOKIES POLICY --------------------------------------------------------
UPDATE public.legal_documents SET updated_at = now(), body_html = $h$
<h2>1. What cookies are</h2>
<p>Cookies are small text files a website places on your device to make it work efficiently and to understand how it is used. We also use similar technologies such as local storage.</p>
<h2>2. Cookies we use</h2>
<p><strong>Strictly necessary</strong> — these keep you signed in, maintain your session, remember your locale and currency, and protect against fraud and abuse. They cannot be switched off without breaking core functionality, and are set on the basis of our legitimate interest in operating a secure service.</p>
<p><strong>Analytics (opt-in)</strong> — when enabled, first-party analytics run with IP-address anonymisation to understand aggregate usage. No analytics cookies are set before you consent.</p>
<h2>3. Third parties</h2>
<p>Our payment providers (Paystack, PayPal) may set their own cookies on payment pages, governed by their own policies. Wielo does not use third-party advertising or behavioural-targeting cookies.</p>
<h2>4. Managing cookies</h2>
<p>You can manage non-essential cookies from the banner shown on your first visit, or later in your settings, and you can clear cookies in your browser at any time (which will sign you out and reset your preferences).</p>
<h2>5. Changes and contact</h2>
<p>We may update this policy when our cookie use changes; the “Last updated” date reflects the current version. Questions: privacy@wielo.co.za.</p>
$h$ WHERE slug = 'cookies';

-- 4) AFFILIATE PROGRAM TERMS ----------------------------------------------
UPDATE public.legal_documents SET updated_at = now(), body_html = $h$
<h2>1. Joining</h2>
<p>You must have a valid Wielo account, be 18 or older, and provide accurate payout and (where required) tax details. Wielo may approve or decline any application at its discretion, and may run the program on an invite-only or open basis.</p>
<h2>2. Promoting Wielo</h2>
<p>You may promote Wielo products using the unique referral link and approved marketing material provided to you. You may not misrepresent Wielo; bid on Wielo brand terms in paid search or run ads that appear to be Wielo’s own; spam or use deceptive promotion; self-refer or create referrals through connected accounts; or offer unauthorised incentives. You must clearly disclose that your links are affiliate links where required.</p>
<h2>3. Attribution</h2>
<p>A referred customer is attributed to you for 30 days from their click and remains attributed to you once they create an account within that window. Where attribution rules conflict, Wielo’s recorded attribution governs.</p>
<h2>4. Commission</h2>
<p>Commission is calculated on the net amount a referred customer actually pays Wielo for a product (excluding VAT and before payout fees), at the rate set on that product at the time of the sale. Some products pay commission once; others recurring, per the product’s configuration at the time of sale. Commission accrues when a referred payment succeeds and is held until the applicable refund window passes, after which it becomes cleared and payable.</p>
<h2>5. Refunds, clawback and payouts</h2>
<p>If a sale is refunded, reversed or charged back, the related commission is voided or clawed back, whether pending or cleared, and Wielo may offset clawed-back amounts against your balance. Payouts are made on request once your cleared balance meets the minimum threshold; the payout processor’s fee is deducted from your payout. You are responsible for your own tax on affiliate earnings.</p>
<h2>6. Campaigns, abuse and changes</h2>
<p>Wielo may run time-bound campaigns with leaderboards, ladders, conversion bonuses and prize pots; each such campaign is a promotional competition governed by its own Competition Rules, which you must accept to enter. Wielo may suspend or remove an affiliate for breach, fraud or abuse, which may void pending commission and forfeit campaign standing. Wielo may update these terms or the commission rates prospectively; continued participation is acceptance. These terms are governed by the laws of the Republic of South Africa.</p>
$h$ WHERE slug = 'affiliate-program-terms';

-- 5) FOUNDING HOST TERMS ---------------------------------------------------
UPDATE public.legal_documents SET updated_at = now(), body_html = $h$
<h2>1. The offer</h2>
<p>The Founding Host offer is a limited early-adopter programme. A host who enrols during the offer period and meets the eligibility conditions receives the benefits stated at enrolment, which may include a lifetime price-lock on their subscription tier and any additional founding benefits Wielo describes at the time.</p>
<h2>2. The lifetime price-lock</h2>
<p>Where the price-lock applies, the recurring subscription price for the host’s then-current tier will not increase for as long as the host maintains a continuous, active, paid subscription on that tier. The price-lock is personal to the host account, is not transferable, and applies only to the tier held at enrolment; moving to a higher tier, or adding paid features, is charged at the then-current price for those.</p>
<h2>3. What preserves or forfeits the price-lock</h2>
<p>The price-lock is preserved by keeping the subscription continuously active. It lapses if the host cancels, allows the subscription to lapse beyond the grace period, downgrades away from the locked tier, or materially breaches the Terms of Service. Once lapsed it does not revive, and re-subscribing is at the then-current price.</p>
<h2>4. Eligibility and changes</h2>
<p>Eligibility conditions are as stated at enrolment. Wielo may end the offer to new hosts at any time; ending the offer does not affect a price-lock already granted to an enrolled host. Wielo may amend these terms prospectively where required by law or to correct an error, and will give reasonable notice of any change that materially affects an enrolled host.</p>
$h$ WHERE slug = 'founding-host-terms';

-- 6) REVIEW DISCLOSURE -----------------------------------------------------
UPDATE public.legal_documents SET updated_at = now(), body_html = $h$
<h2>1. Who can review</h2>
<p>Reviews may be left by guests and hosts in connection with a real, completed booking on the Platform. Each review is linked to that booking and to the reviewer’s account so we can verify it is genuine.</p>
<h2>2. Verification</h2>
<p>Because every review is tied to a completed booking, Wielo does not publish anonymous or unverifiable reviews. We do not edit the substance of a review. We may withhold or remove a review that is fraudulent, unlawful, off-topic, or that breaches the Terms of Service (for example personal attacks, private information, or discriminatory content).</p>
<h2>3. No incentivised or fake reviews</h2>
<p>Reviews must be honest and first-hand. We do not sell, buy, incentivise or manipulate reviews, and hosts and guests must not do so either. We do not selectively suppress genuine negative reviews.</p>
<h2>4. Display</h2>
<p>Published reviews show the reviewer’s display name and may be publicly visible on listings and profiles. Where both parties may review a stay, reviews are revealed on a fair, symmetric basis so that neither party’s review is influenced by the other.</p>
<h2>5. Corrections and contact</h2>
<p>If you believe a review breaches these rules, contact hello@wielo.co.za. How we process review-related personal information is described in our Privacy Policy.</p>
$h$ WHERE slug = 'review-disclosure';

-- 7) LOOKING-FOR NOTICE ----------------------------------------------------
UPDATE public.legal_documents SET updated_at = now(), body_html = $h$
<h2>1. What this is</h2>
<p>“Looking-For” lets you post a request for accommodation or an experience so that hosts can offer to fulfil it. This notice explains how Wielo processes the personal information you share when you post a request, in addition to our Privacy Policy.</p>
<h2>2. What we process, and why</h2>
<p>We process the details you provide — such as destination, dates, party size, budget, requirements and your contact preference — so that relevant hosts can see your request and respond. We process this on the basis of your request (steps taken at your request to enter into a transaction) and your consent to be contacted by hosts.</p>
<h2>3. What hosts see</h2>
<p>Only the information necessary to respond is shared with hosts who may be able to fulfil your request. Please do not include sensitive personal information in a request.</p>
<h2>4. Retention, withdrawal and rights</h2>
<p>We keep a request while it is active and for a reasonable period afterwards, then delete or de-identify it. You can withdraw or delete a request at any time from your account, and you can exercise your POPIA rights as described in our Privacy Policy. Questions: privacy@wielo.co.za.</p>
$h$ WHERE slug = 'looking-for-notice';

-- 8) FOUNDING RACE — COMPETITION RULES -------------------------------------
UPDATE public.legal_documents SET updated_at = now(), body_html = $h$
<p><em>This is a working draft of the Founding Race rules. The competition-specific details (entry mechanic, exact scoring, prizes and their Rand value, and the opening and closing dates) are confirmed and published here before the competition opens, and these rules remain available at this address for at least three years.</em></p>
<h2>1. The promoter</h2>
<p>The Founding Race is run by Wielo Platform (Pty) Ltd (contact legal@wielo.co.za).</p>
<h2>2. How to enter</h2>
<p>Entry is free. You enter by taking part in the Founding programme as described on the competition page; no purchase is a condition of entry beyond any ordinary product price you choose to pay in the normal course.</p>
<h2>3. Who may enter</h2>
<p>The competition is open to natural persons who are 18 or older and resident in South Africa. Directors, members, employees, agents and consultants of the promoter, and their immediate families, may not enter or win.</p>
<h2>4. Competition period</h2>
<p>The competition opens and closes on the dates published on the competition page (South African time). Activity after the closing time does not count.</p>
<h2>5. How winners are determined</h2>
<p>Standing is determined by the score recorded on the leaderboard for qualifying activity during the competition period, as recorded by the Platform, which is determinative.</p>
<h2>6. Prizes</h2>
<p>The prizes and their Rand value are described on the competition page. Prizes are not transferable or exchangeable for cash unless the promoter states otherwise.</p>
<h2>7. Notification, publication and tax</h2>
<p>Winners are notified through the Platform and must claim within the period stated; unclaimed prizes may be forfeited and re-awarded. Winners consent to reasonable announcement of the results. Any tax on a prize is dealt with as stated on the competition page.</p>
<h2>8. General</h2>
<p>The promoter may disqualify any entrant who breaches these rules, the Affiliate Program Terms or the Terms of Service. To the extent permitted by law the promoter is not liable for loss arising from participation or a prize. These rules are available free of charge at this address and on request from legal@wielo.co.za. The competition is governed by the laws of the Republic of South Africa, and the promoter’s decisions on its conduct are final.</p>
$h$ WHERE slug = 'founding-race-rules';

-- 9) PAIA MANUAL (new document — appears in Legal docs, unpublished) --------
INSERT INTO public.legal_documents (slug, title, body_html, is_published, published_at)
VALUES ('paia-manual', 'PAIA Manual', $h$
<p><em>Manual in terms of Section 51 of the Promotion of Access to Information Act, 2000. This is a working draft; confirm the entity details, the Information Officer, the fee schedule and the exemption position before publishing.</em></p>
<h2>1. The private body</h2>
<p>Wielo Platform (Pty) Ltd operates a direct-booking management platform for accommodation hosts and experience operators in South Africa.</p>
<h2>2. Information Officer</h2>
<p>PAIA requests should be directed to our Information Officer at privacy@wielo.co.za, or to our registered postal and physical address.</p>
<h2>3. Guide of the Information Regulator</h2>
<p>A Guide on how to use PAIA is available from the Information Regulator (South Africa) in each official language, for a person who needs help to exercise rights under PAIA and POPIA.</p>
<h2>4. Records available</h2>
<p>Records are also accessible under other legislation, including (as applicable) the Companies Act, the Income Tax Act and VAT Act, labour legislation, the Consumer Protection Act, POPIA and ECTA. The Terms of Service, Privacy Policy, this Manual, public listings and published Competition Rules are available on our website without a formal request. Other records — company, financial, customer, operational, employment and IT and security records — may be requested, subject to the grounds for refusal in Chapter 4 of PAIA.</p>
<h2>5. How to request access, fees and remedies</h2>
<p>Complete the prescribed PAIA request form and send it to the Information Officer with enough detail to identify the record and the form of access, and pay the prescribed request and access fees. We respond within the periods PAIA prescribes (ordinarily 30 days, extendable as PAIA allows). If a request is refused, the requester may complain to the Information Regulator and/or apply to court as PAIA provides.</p>
$h$, false, NULL)
ON CONFLICT (slug) DO UPDATE SET body_html = EXCLUDED.body_html, updated_at = now();

-- 10) Keep version history in step with the current text of every document.
INSERT INTO public.legal_document_versions (slug, version, title, body_html, published_at)
SELECT slug, version, title, body_html, published_at FROM public.legal_documents
ON CONFLICT (slug, version) DO UPDATE
  SET title = EXCLUDED.title,
      body_html = EXCLUDED.body_html,
      published_at = EXCLUDED.published_at;
