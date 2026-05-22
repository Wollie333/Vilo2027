# Vilo — Current Task

> ⚠️ **Reset this file at the start of every Claude Code session.** This is your session contract — the agent will not work outside this scope without asking first.

**Date:** 2026-05-22
**Phase:** Phase 0 — Pre-build setup (slice 1 of cloud infra)
**Session Goal:** Initialize git, push to a private GitHub repo (`vilo`), create Supabase production + staging projects in `af-south-1`, link the CLI to production, and populate `.env.local` with real keys.

---

## What We Are Building

The very first slice of Phase 0: getting the project under version control and on cloud infrastructure so future sessions have somewhere to apply DB migrations and push code. No application code is written in this session — only config, scripts, and external service setup.

**Spec reference:** `PHASE_PLAN.md` → Phase 0 — Pre-Build Setup → Infrastructure
**Customer journey(s):** N/A — pre-build infra
**DB schema reference:** N/A — no migrations this session

---

## Acceptance Criteria

The session is **done** when every checkbox is ticked:

- [ ] Local `git` repository exists at the project root with a clean `.gitignore`.
- [ ] Private GitHub repo `vilo` exists, `main` branch pushed.
- [ ] Supabase production project (`vilo-production`) provisioned in `af-south-1`.
- [ ] Supabase staging project (`vilo-staging`) provisioned in `af-south-1`.
- [ ] `supabase init` run; `supabase/config.toml` committed.
- [ ] `supabase link` to production succeeds.
- [ ] `.env.local` populated with real production Supabase keys; confirmed NOT tracked by git.
- [ ] `.env.example` committed with placeholders only (no real secrets).
- [ ] `CHANGELOG.md` updated with a dated entry.
- [ ] Session notes (below) filled in.

> Build/lint checks intentionally omitted — there is no app to build yet.

---

## Exact Scope — Files to Touch

> If a file is not listed here, confirm before editing it.

**Web (`apps/web/`):**
```
[ ] (not in scope this session — scaffolded in a follow-up)
```

**Mobile (`apps/mobile/`):**
```
[ ] (not in scope this session)
```

**Edge Functions (`supabase/functions/`):**
```
[ ] (not in scope this session)
```

**Database (`supabase/migrations/`):**
```
[ ] (not in scope this session — migrations begin once supabase_database.md lands)
```

**Shared packages:**
```
[ ] (not in scope this session)
```

**Project root (new files):**
```
[ ] .gitignore
[ ] .env.example
[ ] .env.local              (never committed)
[ ] supabase/config.toml    (created by `supabase init`)
```

**Project root (modified files):**
```
[ ] CURRENT_TASK.md         (this file — session contract)
[ ] CHANGELOG.md            (session entry appended at the end)
```

---

## Out of Scope

> Explicitly list things that might seem related but must not be touched this session.

- Doppler / Vercel / EAS / Sentry / PostHog / Resend / Mapbox / Paystack / PayPal setup — separate sessions, only when needed.
- Monorepo scaffolding (`apps/web`, `apps/mobile`, `packages/`) — next session.
- DB migrations — blocked on `supabase_database.md` (not yet present in the repo).
- GitHub Actions workflows — separate session per `CI_CD.md`.
- Domain registration for `viloplatform.com` — handled outside this session.
- Any application code.

---

## Known Constraints & Gotchas

- Supabase region MUST be `af-south-1 (Cape Town)` — required by `SECURITY_CHECKLIST.md`.
- DB passwords stay with the user (their password manager). Never paste to chat.
- `service_role` key goes only in `.env.local` — never in git, never with `NEXT_PUBLIC_` prefix (`AGENT_RULES.md` §1.1).
- `.env.local` must match `.gitignore` BEFORE any keys are pasted into it.
- `supabase link` can only bind to one project at a time — we link production from this machine; staging is reached via CI in a later session (`CI_CD.md` §db-migrate).
- Three spec docs referenced by other docs are still missing: `vilo-platform-mvp.md`, `supabase_database.md`, `customer_journey.md`. Not blocking for this session but blocking for Phase 0 Database work.

---

## Pre-Session Checklist

- [x] `git --version` works
- [ ] `gh --version` works (installing via winget)
- [ ] `supabase --version` works (installing via winget)
- [ ] `gh auth login` complete (user action)
- [ ] Two Supabase projects provisioned + keys collected (user action)
- [ ] Supabase CLI access token generated (user action)

---

## Definition of Done

- [ ] All acceptance criteria above are checked
- [ ] No `.env.local` or other secret file tracked by git (`git ls-files` confirms)
- [ ] `supabase projects list` shows both projects
- [ ] `git remote -v` shows `origin` pointing to `github.com:<user>/vilo.git`
- [ ] At least three clean commits on `main` (docs / .env.example / supabase config + changelog)
- [ ] Pushed to `main` on GitHub
- [ ] CHANGELOG.md updated
- [ ] Session notes filled in below

---

## Session Notes

*Fill this in before closing the session. Decisions made, things discovered, blockers hit, what's left for next time.*

---

*When done: update `CHANGELOG.md`, commit, then reset this file for the next session.*
