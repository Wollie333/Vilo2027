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

## 2026-05-22 — Phase 0 — Bootstrap: git, GitHub, Supabase link

### Built
- Local `git` repository initialized on `main` with a Node/Next/Expo/Supabase `.gitignore`.
- Private GitHub repo `Wollie333/Vilo2027` (created in dashboard by user); `main` pushed.
- `.env.example` created from the `ENV_VARS.md` §9 template (keys only — no secrets).
- Supabase project `Vilo2027` provisioned (ref `zlcivjgvtyeaszikqleu`, region `Central EU (Frankfurt)`).
- `supabase init` + `supabase login` (CLI access token) + `supabase link --project-ref zlcivjgvtyeaszikqleu` completed and verified.
- `.env.local` populated with Supabase project URL + new-format API keys (`sb_publishable_…`, `sb_secret_…`); confirmed untracked.
- `CURRENT_TASK.md` populated as the session contract.
- `gh` CLI 2.92.0 installed via winget; `supabase` CLI 2.101.0 installed via direct binary release (no winget package exists).

### Changed
- Local-only git identity set for this repo: `user.email=wollie333@gmail.com`, `user.name=Wollie333`. No global config touched.
- `PHASE_PLAN.md` Phase 5 line "Supabase region confirmed: af-south-1" annotated with the current Frankfurt provisioning + migration requirement.

### Decisions
- **ADR-015** added: Supabase deployed to Central EU (Frankfurt) rather than `af-south-1` (Cape Town). `af-south-1` was unavailable in the Supabase dashboard for this account at provisioning time. The region MUST be migrated before public launch for POPIA compliance.

### Migrations
- None this session — DB schema work begins once `supabase_database.md` lands.

### Notes
- Supabase keys are the newer `sb_publishable_` / `sb_secret_` format (replacements for legacy `anon`/`service_role` JWTs). They work transparently with `@supabase/supabase-js` ≥2.43.x — no SDK bump required.
- Only **one** Supabase project exists. The plan originally called for production + staging; staging deferred to a future session.
- An earlier Vilo2027 project (ref `ddexrmfuqtvmumgvzqxz`, West EU / Ireland) was created and deleted by the user when neither it nor a re-attempt offered `af-south-1`. Both attempts confirmed `af-south-1` is not currently available for this Supabase account.
- `viloplatform.com` domain ownership and Resend / Doppler / Vercel / EAS / Sentry / PostHog / Mapbox / Paystack / PayPal accounts are NOT set up yet — placeholders remain in `.env.local`.
- `supabase_database.md`, `vilo-platform-mvp.md`, and `customer_journey.md` are still missing from the repo. The Phase 0 Database section is blocked until at least `supabase_database.md` is added.

### Commits
- `chore: initial commit with project documentation` — 2ec4dd9
- `chore: add .env.example from ENV_VARS.md template` — 62b37aa
- `chore: bootstrap supabase config, session contract, and changelog` — 969ea79
- (final commit appended after this update is staged.)

<!-- New entries go above this line -->
