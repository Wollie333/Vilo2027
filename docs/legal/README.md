# Wielo — Legal Documents (Consolidated Draft Package)

> **STATUS: DRAFT for attorney review.** Everything in this folder was drafted
> in-house to reflect how Wielo actually works today. It is **not legal advice**
> and has **not** been reviewed by a qualified South African attorney. Send this
> package to counsel to confirm, correct, and finalise before public launch.
> Wherever a real legal judgement is needed, the text carries an inline
> **`[COUNSEL: …]`** note.

> **Architecture:** how these documents become one admin-managed source of truth
> (with a lawyer login, publish-updates-everywhere, and per-competition/affiliate
> assignment) is specified in **`LEGAL_DOCS_UNIFICATION_PLAN.md`** in this folder.

Wielo is a direct-booking management platform for accommodation hosts and
experience operators in South Africa. The governing legal framework is:

- **POPIA** — Protection of Personal Information Act, 2013 (data protection)
- **CPA** — Consumer Protection Act, 2008 (consumer rights, promotional competitions)
- **ECTA** — Electronic Communications and Transactions Act, 2002 (e-commerce disclosure)
- **PAIA** — Promotion of Access to Information Act, 2000 (access-to-information manual)

---

## The consolidated set — 5 documents (down from ~14)

| # | Document | File | Lives at | How it's edited |
|---|----------|------|----------|-----------------|
| 1 | **Terms of Service** | `TERMS_OF_SERVICE.md` | `/terms` | Static fallback in code **or** Admin → Platform settings → Legal |
| 2 | **Privacy Policy (POPIA)** | `PRIVACY_POLICY.md` | `/privacy` | Static fallback in code **or** Admin → Platform settings → Legal |
| 3 | **PAIA Manual** | `PAIA_MANUAL.md` | `/legal/paia-manual` | Admin → Platform settings → Legal documents |
| 4 | **Affiliate Program Terms** | `AFFILIATE_PROGRAM_TERMS.md` | `/portal/affiliates` (gated) | Admin → Affiliates → Terms |
| 5 | **Competition Rules** | `COMPETITION_RULES.md` | `/legal/<slug>` per competition | Admin → Affiliates → Campaigns → Rules |

### What each document absorbed

- **Terms of Service** now also contains: Acceptable Use, Subscription & Billing
  terms, Cancellation & Refund disclosure, the Founding Host offer, and — as
  **Schedule A** — the Host Data-Processing (Operator) terms required by POPIA
  §20–21.
- **Privacy Policy** now also contains: the Cookies Policy, the Looking-For
  privacy notice, and the data-handling side of the Review Disclosure.

### Why these five cannot collapse further

- **PAIA Manual** is a statutory manual with a prescribed structure — it must
  stand alone.
- **Competition Rules** must each sit at their own fixed, retained URL under CPA
  §36, and the platform stamps a **separate versioned acceptance** onto every
  entrant — merging them into Terms would break that record.
- **Affiliate Terms** are accepted by a different audience at a different moment
  (partner signup), behind their own gate.
- **Privacy** must stay distinct from **Terms** under POPIA.
- **Terms and Privacy themselves stay two documents** because checkout stamps
  **two independent versions** onto every booking (`accepted_terms_version` and
  `accepted_privacy_version`). That split is wired into the payment path.

---

## Entity & contact placeholders

These come from the app config (`lib/brand.ts`, `lib/contact.ts`). Confirm each
with counsel before publishing.

| Token | Current value | Notes |
|-------|---------------|-------|
| Legal entity | **Wielo Platform (Pty) Ltd** | `[COUNSEL: confirm registered name + CIPC registration number]` |
| Brand | **Wielo** | |
| Registered address | Cape Town, South Africa | `[COUNSEL: full physical + postal address needed for ECTA §43 and PAIA]` |
| Website | https://wielo.co.za | |
| General enquiries | hello@wielo.co.za | |
| Privacy / POPIA | privacy@wielo.co.za | Information Officer inbox |
| Legal / disputes | legal@wielo.co.za | |
| Data hosting | Frankfurt, Germany (Supabase) | Drives the POPIA §72 cross-border clause |
| Payment processors | Paystack, PayPal, manual EFT | |
| Email processor | Resend | |

---

## Open items for counsel (whole-package)

1. **Information Officer** — POPIA requires a registered Information Officer.
   Confirm who this is and register them with the Information Regulator.
2. **PAIA exemption** — small private bodies may be exempt from lodging a manual
   until a stated date; confirm Wielo's position and whether the manual must be
   lodged or merely published. `[COUNSEL: confirm current exemption status]`
3. **Cross-border transfer** — data is hosted in **Frankfurt**, not South
   Africa. Confirm the POPIA §72 basis and that processor contracts (Supabase,
   Paystack, PayPal, Resend) carry the required protections.
4. **Operator agreements** — the host is a Responsible Party for their guests'
   personal information and Wielo is the Operator. Schedule A of the Terms is
   the written operator agreement POPIA §20–21 requires; confirm it is
   sufficient or whether a standalone signed agreement is preferred.
5. **Prize tax & competition compliance** — confirm CPA §36 / Regulation 11
   compliance for the Founding Race and affiliate campaigns, including prize tax
   treatment and the 3-year rules-retention obligation.
6. **VAT** — confirm VAT registration status and how VAT is expressed on
   subscription pricing and affiliate commission.

---

## How the finalised copy goes live

Once counsel returns final wording, it does **not** need a code change:

- **Terms / Privacy** — paste into **Admin → Platform settings → Legal**. The
  DB copy overrides the static fallback and is version-stamped onto new bookings.
- **PAIA Manual / Competition Rules** — paste into **Admin → Platform settings →
  Legal documents** (or the Campaign Rules editor) to publish at `/legal/<slug>`.
- **Affiliate Terms** — paste into **Admin → Affiliates → Terms**.

The static drafts in code (`/terms`, `/privacy`) are the launch fallback so the
pages are never empty; the admin-published version supersedes them the moment
it's saved.
