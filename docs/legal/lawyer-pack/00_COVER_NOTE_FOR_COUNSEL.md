# Wielo — Legal Documents Pack (First Drafts for Attorney Review)

> **Prepared:** 2 August 2026 · **Status:** FIRST DRAFT — not legal advice, not
> yet reviewed by a qualified South African attorney. These drafts were written
> in-house to reflect **how the Wielo platform actually works today** (grounded in
> the live codebase and the founding/brand strategy), so that counsel spends time
> refining rather than starting from a blank page. **Do not publish any of these
> until a South African commercial/consumer attorney has reviewed and finalised
> them.**

## What's in this pack (the 8 documents you asked for)

| # | Document | File | Where it lives in the app |
|---|----------|------|----------------------------|
| 1 | Terms & Conditions (platform) | `01_TERMS_AND_CONDITIONS.md` | `/terms` (stamped onto every booking) |
| 2 | Affiliate Earnings Disclaimer | `02_AFFILIATE_EARNINGS_DISCLAIMER.md` | `/legal/earnings-disclaimer` + affiliate signup + marketing pages |
| 3 | Privacy Policy (POPIA) | `03_PRIVACY_POLICY.md` | `/privacy` (stamped onto every booking) |
| 4 | Cookie Policy | `04_COOKIE_POLICY.md` | `/cookies` + cookie banner |
| 5 | Affiliate Terms | `05_AFFILIATE_TERMS.md` | affiliate gate / partner signup (version-stamped acceptance) |
| 6 | Competition Terms & Rules | `06_COMPETITION_TERMS_AND_RULES.md` | `/legal/<competition-slug>` (retained 3 years per CPA) |
| 7 | Reviews Disclosure | `07_REVIEWS_DISCLOSURE.md` | `/legal/review-disclosure` + property pages |
| 8 | Looking-For Notice | `08_LOOKING_FOR_NOTICE.md` | `/legal/looking-for-notice` + the "Looking For" flow |
| 9 | Liability Disclaimer & Limitation of Liability | `09_LIABILITY_DISCLAIMER.md` | `/legal/liability` + linked from Terms/checkout |

> **Note on structure:** the app can publish each of these as its own document.
> A separate in-house consolidation (`docs/legal/TERMS_OF_SERVICE.md`,
> `PRIVACY_POLICY.md`, etc.) folds Cookies, Reviews and Looking-For **into**
> Privacy/Terms. This pack keeps them **standalone** (as you asked). Your attorney
> can decide the final structure — standalone or consolidated — and the content is
> the same either way.

## The governing South African legal framework

- **POPIA** — Protection of Personal Information Act 4 of 2013 → Privacy Policy, Cookie Policy, Looking-For Notice, Reviews Disclosure
- **CPA** — Consumer Protection Act 68 of 2008 → Terms, and **§36 + Regulation 11** for promotional competitions → Competition Terms
- **ECTA** — Electronic Communications and Transactions Act 25 of 2002 → Terms (e-commerce disclosures, §43 supplier info), Cookie Policy
- **PAIA** — Promotion of Access to Information Act 2 of 2000 → a PAIA Manual already exists at `docs/legal/PAIA_MANUAL.md` (not re-drafted here; include it in what you send counsel)
- Advertising honesty (**CPA + ASA/ARB code**) → Affiliate Earnings Disclaimer, Reviews Disclosure

---

## ⚠️ ENTITY DETAILS YOU MUST FILL IN (not found in the codebase)

Every document uses these. They appear as `[COUNSEL: …]` placeholders. Give these
to your attorney:

| Field | Current placeholder | You must confirm |
|-------|---------------------|------------------|
| Registered company name | **Wielo Platform (Pty) Ltd** | Is this the exact registered name? |
| CIPC registration number | `[TO SUPPLY]` | e.g. 20XX/XXXXXX/07 |
| Registered physical + postal address | `[TO SUPPLY]` (only "Cape Town, SA" is in config) | Required by ECTA §43 and PAIA |
| Registered phone number | `[TO SUPPLY]` | Required by ECTA §43 |
| Information Officer (name) | `[TO SUPPLY]` | **POPIA requires one, registered with the Information Regulator** |
| VAT registration status | Strategy docs say **NOT VAT-registered** | Confirm — it changes pricing/commission wording (see conflict #4 below) |

Contact addresses **found in the code** and used throughout (confirm they're live):
`hello@wielo.co.za` (general), `privacy@wielo.co.za` (Information Officer inbox),
`legal@wielo.co.za` (legal/disputes), `support@wielo.co.za` (in-app support).
Website: `https://wielo.co.za`.

---

## ⚠️ FACTUAL CONFLICTS COUNSEL MUST RESOLVE

These are real inconsistencies found between the strategy documents and the live
code/config. Each is flagged inline in the relevant document too.

1. **Data is hosted in Frankfurt, Germany — not South Africa.** The production
   database currently sits in the EU (Supabase, Frankfurt). Your security
   checklist requires migrating to `af-south-1` (Cape Town) before launch, but
   that migration is outstanding. Until it happens, the Privacy Policy must rely
   on the **POPIA §72 cross-border transfer** basis (drafted in). **Confirm the
   §72 basis and each processor contract (Supabase, Paystack, PayPal, Resend,
   Meta, Google, Cloudflare, Expo, Vercel) before publishing any "hosted in SA"
   claim.**

2. **The Meta Pixel / Conversions API vs "no advertising cookies."** The old
   cookie copy said Wielo uses "no third-party advertising or behavioural cookies."
   The code **does** contain a Meta (Facebook) Pixel + Conversions API capability
   (sends hashed email/phone/name + `fbp`/`fbc` cookies to Meta for ad
   measurement), currently **config-gated / off unless enabled**, and hosts can
   add **their own** pixel to their sites. This pack tells the truth: it discloses
   the Meta technology as an **optional, consent-gated** advertising/measurement
   tool. Confirm consent mechanics before enabling it.

3. **Affiliate attribution & commission — the old draft is stale.** The current
   `AFFILIATE_PROGRAM_TERMS.md` says "30-day attribution" and "clawback." The
   **live engine** is: **90-day referral cookie**, **25% lifetime** standard
   commission (**60% lifetime** on the Founding Race), rate **snapshotted at the
   moment of click**, **no clawback** on a referred host lapsing/cancelling/
   downgrading (only a refunded payment reverses commission), payout **33 days**
   after a payment clears, minimum payout **R1,000**, paid by **EFT**. This pack
   uses the **live** figures. Confirm them against final ops config.

4. **Payout threshold R1,000 (strategy) vs R250 (code default).** The founding
   programme states R1,000; the database default is currently R250 with no
   migration raising it. Drafts use **R1,000** as the intended figure — confirm
   the live setting and align.

5. **Tier bonus ladder.** The code has an admin-editable bonus on top of standard
   commission (Silver +10% at R5,000 lifetime cleared, Gold +25% at R20,000) that
   applies to **standard** referrals only and does **not** stack on Founding Race
   (60%) referrals. It isn't mentioned in the founding-programme strategy. Decide
   whether to disclose it — this pack discloses it (flagged) so nothing is hidden.

6. **VAT.** If Wielo is not VAT-registered, prices and commissions carry **no VAT**
   and no VAT may be charged/shown. Drafts state this with a `[COUNSEL]` flag —
   update everywhere if/when Wielo registers (mandatory above R1m turnover).

7. **Competition eligibility vs international partners.** The Founding Race allows
   international partners (PayPal settlement), but a standard SA promotional
   competition template restricts entry to SA residents and excludes staff/family.
   Counsel must reconcile who may enter, and confirm whether an **affiliate/trade
   competition** is a "promotional competition" under CPA §36 at all, or a
   business-incentive arrangement governed differently.

8. **Host → Guest conduct ratings.** Hosts can privately rate guests, and those
   ratings are shared across all hosts (a reputation network) while the guest never
   sees them. This carries POPIA + defamation exposure and is currently
   **undisclosed to guests**. Flagged in the Reviews Disclosure and Privacy Policy
   for counsel to address (transparency + a lawful basis are needed).

---

## Open items for counsel (whole pack)

1. Register an **Information Officer** with the Information Regulator (POPIA).
2. Confirm **PAIA manual** lodging/exemption position (see `PAIA_MANUAL.md`).
3. Confirm the **POPIA §72** cross-border basis + processor contracts (conflict #1).
4. Confirm the **operator (Responsible Party ↔ Operator) agreement** between hosts
   and Wielo is adequate as drafted (Schedule A of the Terms) or needs a separately
   signed agreement — POPIA §20–21.
5. Confirm **CPA §36 / Reg 11** compliance for the Founding Race and future
   campaigns, including prize tax treatment and the 3-year rules-retention duty.
6. Confirm **CPA §14** cancellation rights against the annual founding plan (the
   strategy flags a possible issue with a full-year forfeit for sole proprietors).
7. Confirm **VAT** status and wording (conflict #4/#6).
8. Confirm enforceability of the **liability cap** and **founding price-lock**.
