# Website help-article issues — for the website sub-branch

> **Why this file exists.** During the 2026-08-01 help-centre accuracy pass, the
> website-builder help articles were reviewed for duplication and staleness. Per
> the founder directive, the website-builder / host-site surface is owned by a
> **separate sub-branch** and must not be edited from `main` — so these issues
> are **documented here, not fixed**. The whole set needs verification against
> the sub-branch's current UI (tab/feature names) before any deletion or merge.
>
> Method: conclusions drawn by comparing the article texts to each other (pulled
> live from `help_articles` on 2026-08-01). No website code was read from `main`.
> All 14 articles share `updated_at = 2026-08-01`, so timestamps can't tell old
> from new — content is the only signal.

## 1. Brand / Theme — a superseded v1 combined article (retire/merge)

- **Keep** `website-brand` ("Your logo, favicon & brand details") — richest brand
  coverage (favicon, logo style Wordmark/Logo+name/Icon-only, Choose from library,
  footer contact & social links).
- **Keep** `website-theme` ("Choosing your website theme") — current theme coverage:
  **6 presets incl. Nightfall**, **5 fonts**, reset-to-preset.
- **Retire or merge** `website-brand-and-theme` ("Brand & style your website") —
  superseded combined v1. It is factually stale: lists only **5 presets (no
  Nightfall)** and **3 fonts** vs the dedicated article's 6 and 5, and its brand
  half omits favicon / logo styles / social links. It duplicates both dedicated
  articles with nothing unique.

## 2. Pages — overlapping, one has a stale flag

- `website-pages` ("Pages & navigation") — page-level: add pages, nav menu,
  per-page SEO, duplicate/delete, protected Home. No stale markers.
- `website-building-pages` ("Build your website pages") — section-level editing
  within a page (add/reorder/show-hide sections, the auto-filling "Live" sections).
  Genuinely distinct content, **but** it ends with "…aren't live to visitors until
  you publish the site **(coming soon)**." — publishing has shipped (see
  `website-publishing`), so that line is stale.
- **Action:** either keep both and delete the "(coming soon)" clause from
  `website-building-pages`, or merge its section-editing content into
  `website-pages` and retire the slug.

## 3. Domain — near-duplicate (retire/merge)

- **Keep** `website-domain` ("Your web address & custom domain") — broader/newer:
  rename the free subdomain, preferred www-vs-root address, connection status
  tracker (added → DNS detected → verified → SSL), plan-gating note.
- **Retire or merge** `website-custom-domain` ("Connecting a custom domain") —
  mostly duplicated by `website-domain`. Before retiring, fold in its two unique
  bits: the explicit **A / CNAME / TXT record** breakdown, and the
  **Disconnect / remove a domain** step.

## 4. Content defects to fix (regardless of the dedup decisions)

- `build-your-website` — body contains an **unrendered `{brand}` merge token**
  ("…you already manage on `{brand}`"). Should render "Wielo". (The identical token
  in the non-website article `find-your-way-around-the-dashboard` was fixed on main
  in migration `20260801230000`; this one was left because it's a website article.)
- `website-building-pages` — the stale "(coming soon)" publishing line (see §2).

## Articles with no duplicate (keep as-is)

`build-your-website` (intro), `website-overview`, `website-blog`,
`website-contact-form`, `website-rooms`, `website-seo`, `website-publishing`.

## Net recommendation for the sub-branch

Retire/merge **2 articles** (`website-brand-and-theme`, `website-custom-domain`),
fix **2 content defects** (`{brand}` token, "(coming soon)" line) — all after
confirming current tab/feature names in the sub-branch.
