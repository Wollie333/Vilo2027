# Wielo — Cookie Policy

> **FIRST DRAFT — pending attorney review. Not legal advice.** Drafted to reflect
> the cookies and similar technologies Wielo's code actually uses. `[COUNSEL: …]`
> marks points needing a lawyer's judgement. See `00_COVER_NOTE_FOR_COUNSEL.md`,
> especially conflict #2 (the Meta Pixel vs "no advertising cookies").

**Published by:** Wielo Platform (Pty) Ltd (“**Wielo**”)
`[COUNSEL: insert registration number and registered address]`
**Website:** https://wielo.co.za
**Effective date / last updated:** _[date on publish]_

This Cookie Policy explains how Wielo uses cookies and similar technologies on our
website, host websites we power, and apps (the “**Platform**”). It supports our
[Privacy Policy](/privacy) and should be read with it. Consent to non-essential
cookies is handled under **POPIA** and **ECTA**.

## 1. What cookies are

Cookies are small text files a website stores on your device. "Similar
technologies" include local storage, pixels/tags, and device identifiers. They let
a site keep you signed in, remember preferences, keep the Platform secure, and —
where you consent — measure usage and advertising.

## 2. How we categorise them

We group cookies and similar technologies into three categories. **Strictly
necessary** technologies are always active because the Platform cannot work without
them. **Functional**, **analytics**, and **advertising/measurement** technologies
are used **only where the law allows or you consent**.

### 2.1 Strictly necessary (always on)

| Name / type | Purpose | Set by | Duration |
|-------------|---------|--------|----------|
| Supabase auth/session cookies | Keep you securely signed in; maintain your session | Wielo (Supabase) | Session / token lifetime |
| Locale & currency preference | Remember your language and currency | Wielo | Persistent (preference) |
| Cloudflare Turnstile token | Verify you are not a bot when submitting forms | Cloudflare | Short-lived / single use |
| CSRF & security tokens | Protect against cross-site request forgery and abuse | Wielo | Session |

These cannot be switched off without breaking core functionality.

### 2.2 Functional

| Name / type | Purpose | Set by | Duration |
|-------------|---------|--------|----------|
| `vilo_ref` | Affiliate referral attribution — records which Partner referred you (Partner ID, referral/click ID, campaign ID, rate) so commission is credited correctly | Wielo | **90 days** from first click `[COUNSEL/CONFIG: confirm 90 days — code default; see cover note conflict #3]` |

The `vilo_ref` cookie is `httpOnly` and `secure`, is used only for affiliate
attribution, and does not track you across unrelated third-party sites.

### 2.3 Analytics (only if enabled and consented)

| Name / type | Purpose | Set by | Duration |
|-------------|---------|--------|----------|
| First-party analytics | Understand aggregate usage to improve the Platform | Wielo | As configured |

Where analytics is enabled it is **first-party and opt-in**, and **no analytics
cookies are set before you consent**. `[COUNSEL/CONFIG: confirm whether any
analytics is live at launch and its exact cookies.]`

### 2.4 Advertising / measurement (optional, consent-gated)

| Name / type | Purpose | Set by | Duration |
|-------------|---------|--------|----------|
| Meta Pixel `_fbp` / `_fbc` | Measure the performance of Wielo's advertising and attribute sign-ups/bookings; identifiers are **hashed** before being shared with Meta via the Conversions API | Meta (Facebook) | Up to ~90 days (Meta-set) |

The Meta Pixel / Conversions API is **off unless enabled and consented to**. When
active, it shares hashed identifiers (email, phone, name) and the `_fbp`/`_fbc`
cookies with Meta for **advertising measurement**. **Hosts may also add their own
advertising or analytics tags** to their Wielo-powered sites; for those, the Host is
responsible as the Responsible Party and their own cookie notice applies.
`[COUNSEL: confirm the consent mechanism (opt-in banner) governs these before any
pixel fires, and reconcile with any "no advertising cookies" statements — cover
note conflict #2.]`

## 3. Third-party payment pages

When you pay, you are taken to **Paystack** or **PayPal** secure pages. Those
providers set their **own** cookies under their **own** cookie/privacy policies,
which Wielo does not control.

## 4. Managing your choices

- On your first visit you are shown a **cookie/consent banner** where you can accept
  or decline non-essential cookies. `[COUNSEL/CONFIG: confirm the live banner
  matches this policy's categories and records consent.]`
- You can change your choice later in your **settings**.
- You can delete or block cookies in your **browser** — but doing so will sign you
  out and reset your preferences, and some features may stop working.
- You can opt out of **marketing** separately in your account (marketing is off by
  default).

## 5. Changes

We may update this Cookie Policy as the Platform changes. The “Last updated” date
reflects the current version.

## 6. Contact

Questions about cookies or your choices: **privacy@wielo.co.za**.
