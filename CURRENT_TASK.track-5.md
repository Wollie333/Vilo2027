# Wielo — Track 5 Current Task

> ⚠️ **Reset this file at the start of every Track 5 session.**
> Track 5 = Legal & Marketing Polish. See `PHASE_PLAN.md` §Parallel Execution Tracks → Track 5 for owned paths.

**Date:** 2026-05-23
**Track:** 5 — Legal & Marketing Polish
**Branch:** `track/5-legal-pages`
**Session Goal:** Ship `/privacy`, `/terms`, and `/cookies` page shells so the homepage footer no longer has dead `#` links pointing at non-existent legal pages. Pages use brand styling, mark content as `DRAFT — pending legal review`, and the homepage `SiteFooter` is updated to link to them.

---

## What We Are Building

Three static legal pages (Server Components, no data fetching) styled per the canonical design system, plus a one-line update to `apps/web/app/_components/home/SiteFooter.tsx` to swap `href="#"` for the real routes.

**Spec reference:**
- `PHASE_PLAN.md` §Phase 5 — Legal & Compliance
- `Wielo Design System.html` (canonical UX/UI source per `feedback_design_system_source` memory)

---

## Acceptance Criteria

- [ ] `/privacy` route renders with `SiteHeader` + `SiteFooter` chrome, branded typography, and clearly marked draft content sections (intro, what we collect, how we use it, sharing, security, your rights, contact). Each section is a placeholder paragraph + a `DRAFT — pending legal review` callout.
- [ ] `/terms` route renders with the same chrome. Sections: intro, acceptance, account, host/guest obligations, payments, cancellations, intellectual property, liability, governing law, contact.
- [ ] `/cookies` route renders with the same chrome. Sections: what cookies are, what we use, third parties, your choices.
- [ ] All three pages set sensible `metadata` (title + description).
- [ ] `apps/web/app/_components/home/SiteFooter.tsx` bottom-strip "Terms", "Privacy", "Cookies" links updated to point at the new routes (POPIA stays `href="#"` until that page is added).
- [ ] No other changes to `SiteFooter` — column links, social icons, copyright row left intact.
- [ ] `pnpm build` passes from `apps/web/` — zero errors.
- [ ] `pnpm lint` passes — zero warnings.
- [ ] `CHANGELOG.md` updated with a Track 5 entry.
- [ ] Commit on `track/5-legal-pages` branch; do not merge to `main` (user merges).

---

## Out of Scope

- Real legal content — those come from the legal team. We only ship the page structure + visual polish + draft placeholder so the routes resolve.
- POPIA data deletion request flow — separate Phase 5 acceptance criterion, larger scope.
- Cookie consent banner — separate Phase 5 acceptance criterion. The `/cookies` page is just the policy document.
- Any change to `apps/web/app/dashboard/`, `apps/web/app/(auth)/`, `middleware.ts`, or any Edge Function — those are Track 1 territory.
- Any change to `apps/web/app/booking-management/_components/` (those are Track 1's marketing variants).
- Mobile (`apps/mobile/`) — Track 6 owns mobile.

---

## Owned Paths (this session only writes within these)

- `apps/web/app/privacy/page.tsx` (new)
- `apps/web/app/terms/page.tsx` (new)
- `apps/web/app/cookies/page.tsx` (new)
- `apps/web/app/_components/legal/LegalPage.tsx` (new — shared hero / draft notice / section helpers for the three legal pages)
- `apps/web/app/_components/home/SiteFooter.tsx` (refinement — link hrefs only)
- `CHANGELOG.md` (append-only)
- `CURRENT_TASK.track-5.md` (this file)

---

## Session Notes — 2026-05-23

### What landed
- `/privacy`, `/terms`, `/cookies` Server Component pages rendering with `SiteHeader` + `SiteFooter` chrome.
- Shared `LegalPage` component at `apps/web/app/_components/legal/LegalPage.tsx` (added to track ownership) — three near-identical pages crossed the "rule of three" abstraction threshold so the hero, draft notice, and section helpers live once.
- Footer bottom-strip Terms/Privacy/Cookies links now point at the real routes. POPIA left as `#` (separate Phase 5 deletion-flow item).
- All three pages prerender as static (2.2 kB each in `pnpm build` output).

### Decisions
- Content is structural placeholder marked `DRAFT — pending legal review`. Real wording comes from counsel before public launch (Phase 5).
- Used Tailwind `amber-*` defaults for the DRAFT banner — clearly signals "in progress" without inventing a new design-system token for a transient state.

### Cross-track finding (for Track 1)
- `apps/web/app/dashboard/listings/` exists as an **untracked working-tree directory** that was never committed to `main`. `Editor.tsx` imports `./tabs/PoliciesTab` and `./tabs/SettingsTab` — both files exist on disk too, but the build fails to resolve them (likely casing / extension issue or actual missing imports — I did not investigate further since this is Track 1 territory). Also `apps/web/app/dashboard/page.tsx` has uncommitted edits adding an "Edit →" link to the not-yet-working editor. I temporarily stashed the listings tree during my build verification, then popped it back — nothing of Track 1's was modified or lost. **Track 1 needs to investigate and commit or remove this WIP before parallel work continues.**

### Out-of-scope items deferred
- POPIA data deletion request flow (Phase 5).
- Cookie consent banner (Phase 5).
- Real legal content (legal team).
