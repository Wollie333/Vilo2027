# 🧭 SAVEPOINT — 2026-07-21 (read this FIRST in a new session)

> **Branch:** `feature/website-cms-10min-wizard` · **HEAD:** `a596966` · tree clean, all pushed.
> Vercel auto-deploys on push. Then read `WIZARD_TO_WEBSITE_PLAN.md` + `CHANGELOG.md` for detail.

---

## ▶▶ WHERE WE ARE (resume here)

**Actively testing the wizard end-to-end on the branch deploy** ("host perspective" run).
The founder is logging into the dashboard to run the 10-minute wizard → build → published site.

- Wizard URL (branch deploy, behind Wielo login + Vercel SSO):
  `…/en/dashboard/website/wizard`
- Two ways to run it: **founder drives** (I verify the result) OR **I drive** once they say "in"
  (I fill steps, hit generate/build; can't enter their password).
- **Just fixed** the theme picker (see below) — 5 themes now show. Founder was mid-test.

### Immediate next steps
1. **Run the wizard** (needs founder login). Walk: basics → theme → colours → story →
   payments → pages → review → **Build my site** → Done. Then open the live site and check
   it's the host's real content on the chosen theme, and do a **test booking**.
2. **Test AI generation quality.** The AI copy is grounded in the host's real data + reviews
   now (commit `af1e627`). `ANTHROPIC_API_KEY` **is set in Vercel** → AI works on the deploy.
   To test AI OUTPUT quality WITHOUT the wizard UI: paste the key into `apps/web/.env.local`
   (line is scaffolded, empty) and run a one-off generation against mana's real context.
3. **Readiness wall:** a site only publishes with a priced room + payment method + cancellation
   policy. mana has rooms; check payment/policy. Fresh business = add these first.

---

## 🔑 CRITICAL ENVIRONMENT STATE (new — this session)

- **`apps/web/.env.local` NOW EXISTS** with REAL Supabase creds (URL + anon + service-role;
  project ref `zlcivjgvtyeaszikqleu`). So **`pnpm dev` WORKS** locally + renders real site pages
  → fast local QA + console-error inspection, no 5-min deploy waits.
  - Local site page URL: `localhost:3000/en/site/<page>?site=mana&preview=1&theme=<slug>`
  - ⚠️ **The service-role key was shared in chat → the founder will ROTATE it at launch.** After
    rotation, update `.env.local` with the new key or dev breaks.
- **`ANTHROPIC_API_KEY=`** is scaffolded (empty) in `.env.local`. The real key **is in Vercel**
  (AI works on the deploy). Paste it into `.env.local` only if testing AI generation locally.
- **Dev server**: run `cd apps/web && pnpm dev` (localhost:3000). No Docker/local Supabase.
- **Tooling that works now:** the **in-app Browser** (`mcp__Claude_Browser`) CAN resize to real
  mobile widths AND reach `localhost` → real mobile-viewport QA is possible on localhost (the
  authenticated Claude-in-Chrome still can't resize + can't reach the SSO deploy's dashboard).
- Gate changes with `NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit` + `pnpm lint` +
  the Vercel build + live render (local `pnpm build` may OOM/disk-full — see the env memory).

---

## ✅ DONE THIS SESSION (18 commits, b21e283→a596966 — all pushed + mostly live-verified)

**Theme/site polish + bug fixes (all live-verified unless noted):**
- **Hydration bug SOLVED** (`583b6f2`) — the long-standing React #418/#423/#425 on every site
  page. Root cause: inline `<style>{…}` CHILDREN whose CSS has a `>` child combinator (React
  escapes `>`→`&gt;` server-side only). Fixed via `dangerouslySetInnerHTML` in **SiteSocialRail**
  (shared chrome → the home+about cause), **BookingSearchSection**, **RoomDockLayout**. Dev-verified
  0 console errors (were ~11/page) using the new local dev + service key.
- **Safari room-detail booking card** had NO CSS (`fe69550`) — added `.sfroom .bkcard` skin;
  verified all 5 themes' booking cards render.
- **Legible placeholders** on every theme (`44565d9`) — global `--site-mute` rule; fixed the dark
  theme's near-invisible placeholders (sabela 6.4:1, safari 5.3:1).
- **Sabela footer "Get in touch" CTA** (`9e29b7f`) — was 2:1 washed-out on gold → 7.8:1.
- **Guests select matches the date-picker card** on all themes + date card uses theme `surface`
  (`bedb77a`) — fixed the white-box-with-light-text date card on the dark theme.
- **Removed ALL "no booking fees" messaging** from tenant sites (`4c05103`, 48 files) — it's the
  host's own direct site; Wielo's own marketing (landing/signup/marketplace) left intact.
- **Safari home availability card overlaps the hero** (`1c36c40`+`3310605`) — was a flat band
  below; now floats over the hero's lower edge with ~56px clearance above (desktop) / 44px (mobile).
- **Phase 4 nearby data source proven** (`5ae13f6`) — real OSM data verified + a category-diversity
  fix (was restaurant-heavy). ⚠️ Still needs the founder to click **"Find nearby places"** in the
  editor (login-gated) to save data for mana.

**Wizard / account-reuse features:**
- **AI copy grounded in real account data + reviews** (`af1e627`) — `loadHostAiFacts` now feeds the
  copywriter: host bio, reputation, rooms (price+desc), add-ons, policies, highlights, and up to 8
  real **guest reviews**. Prompt mines reviews for authentic themes (never fabricates a quote).
  Verified it pulls mana's 3 real reviews + bio + add-ons. Activates when `ANTHROPIC_API_KEY` set.
- **Host bio → About auto-fill** (`6925d5b`) — `buildDerivedContent` fills the bespoke About
  host-bio body from `hosts.bio` (empty-slot only). Live-verified on Safari About.
- **Theme catalogue fixed** (`a596966`) — the wizard read a stale `site_themes`: **Royal was never
  added** + the **sabela→hotel rename** never hit the cloud. Applied both to the cloud DB (+ a
  migration `20260721120000`). Catalogue now: safari, hotel, oceansview, marmalade, royal (5, active).

**Theme differentiation:** confirmed ALREADY COMPLETE (5 distinct fonts + own component sets:
Bricolage/Archivo/Gloock/Cormorant/Fraunces — see `THEME_DIFFERENTIATION_PLAN.md`). No rework needed.

**Artifact:** a clickable [theme preview grid](https://claude.ai/code/artifact/9fcb2dd1-9cfa-4985-921a-08cc2e58689f)
(all 5 themes × 8 pages, branch/localhost toggle).

---

## ⏳ OPEN / NOT DONE

1. **Wizard end-to-end run** — the active task; needs founder login (see top).
2. **AI generation output not yet eyeballed** — grounding is built + data-verified, but the AI's
   actual copy hasn't been seen. Test via the wizard (deploy) or a local script (key in .env.local).
3. **Phase 4 nearby** — click "Find nearby places" on mana's editor Overview (login-gated) to save
   real OSM data → then it renders on the Experiences page.
4. **Structural account-pulls NOT built (no source):** `hosts.social_links` + `cover_photo_url` are
   **unpopulated columns with no editor** (host Settings only captures bio/languages/highlights/
   website/avatar; socials live only in the website builder). To pull them, capture them in host
   Settings/onboarding first (product decision). `languages_spoken` has data but no display slot.
   Room featured images + descriptions + prices, add-ons, policies→FAQ, ratings already flow.
5. **Branch is ~30+ migrations behind `main`** — merge `main` in before shipping (the 07-18→07-20
   billing/finance migrations landed on main). Our migrations are idempotent.
6. **Rotate the service-role key at launch** (was shared in chat).

---

## 🗺️ KEY FILES
- Wizard: `app/[locale]/dashboard/website/_wizard/` (`WebsiteWizard.tsx`, `steps/Step*.tsx`,
  `StepTheme.tsx` + `WizardThemePreview.tsx`, `aiActions.ts`), page `…/website/wizard/page.tsx`.
- AI grounding: `_wizard/aiActions.ts` (`loadHostAiFacts`) + `lib/website/aiPrompts.ts`
  (`SiteContext`, `contextBlock`, SYSTEM), AI client `lib/ai/client.ts`.
- Account-derived content: `lib/website/deriveContent.ts` (`buildDerivedContent`,
  `mergeDerivedProfile`), schema `lib/website/contentProfile.schema.ts`.
- Theme catalogue: `lib/site/themes.server.ts` (`loadActiveThemes` ← `site_themes` table),
  presets `lib/site/themes.ts` (`SITE_PRESETS`).
- Public render: `components/site/SitePageView.tsx`, `SiteRoomView.tsx`, `lib/site/loadSitePage.ts`.
- Seed/publish: `app/[locale]/dashboard/website/actions.ts`.

**Update + commit this savepoint (or a new one) before ending any session.**
