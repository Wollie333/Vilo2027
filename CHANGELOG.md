# Vilo Platform — Changelog

**Format:** One entry per completed session. Add entries at the top (newest first).
**Updated by:** Claude Code at the end of every session (see `RULES.md` → Definition of Done).

---

## How to Add an Entry

Copy this template and fill it in at the end of every session:

```
## [DATE] — [Phase X] — [Short description of what was built]

### Built
- [Feature or fix 1]
- [Feature or fix 2]

### Changed
- [Any existing behaviour that changed]

### Migrations
- [Migration filename if DB was touched]

### Notes
- [Decisions made, gotchas, anything next session needs to know]

### Commit
- `feat: description` — [short git hash]
```

---

## 2026-05-22 — Phase 0 — Bootstrap: git, GitHub, Supabase project link

### Built
- Local `git` repository initialized on `main` with a Node/Next/Expo/Supabase `.gitignore`.
- Private GitHub repo `Wollie333/Vilo2027` created (manually by user); `main` pushed.
- `.env.example` created from the `ENV_VARS.md` §9 template (keys only — no secrets).
- Supabase project `Vilo2027` (ref `ddexrmfuqtvmumgvzqxz`) provisioned by user.
- `supabase init` run; `supabase/config.toml` generated (local project_id: `Vilo_2027`).
- `.env.local` populated with Supabase project URL + new-format API keys (`sb_publishable_…`, `sb_secret_…`). Confirmed untracked by git.
- `CURRENT_TASK.md` populated as the session contract.
- `gh` CLI 2.92.0 installed via winget; `supabase` CLI 2.101.0 installed via direct binary release (winget package does not exist).

### Changed
- Local-only git identity set for this repo: `user.email=wollie333@gmail.com`, `user.name=Wollie333`. No global config touched.

### Migrations
- None this session — application code and DB schema work begin in a follow-up.

### Notes
- Supabase keys are the newer `sb_publishable_` / `sb_secret_` format (replacements for legacy `anon`/`service_role` JWTs). They work transparently with `@supabase/supabase-js` 2.43.x. If the SDK is later bumped, no env changes required.
- Only **one** Supabase project exists. The plan originally called for production + staging in `af-south-1`; the user provisioned a single project named `Vilo2027`. Staging deferred to a future session.
- `viloplatform.com` domain ownership and Resend/Doppler/Vercel/EAS/Sentry/PostHog/Mapbox/Paystack/PayPal accounts are NOT set up yet — those are still placeholders in `.env.local`. Set them up before the relevant Phase 0 task in `PHASE_PLAN.md` is started.
- `supabase_database.md`, `vilo-platform-mvp.md`, and `customer_journey.md` are still missing from the repo. The Phase 0 Database section cannot start until at least `supabase_database.md` lands.
- `supabase link` step is the last open item this session — depends on the user pasting a CLI access token.

### Commits
- `chore: initial commit with project documentation` — 2ec4dd9
- `chore: add .env.example from ENV_VARS.md template` — 62b37aa
- (further commits pending: supabase config + this changelog entry)

<!-- New entries go above this line -->
