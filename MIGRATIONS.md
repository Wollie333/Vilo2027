# Database Migrations — how they reach production

**Companion to:** `CI_CD.md` (the `db-migrate.yml` workflow), `DEVSTACK.md`.

---

## ✅ Standing rule (2026-05-31): no Docker — apply migrations directly to Supabase

**Docker / the local Supabase stack are removed from this project's workflow.**
Do **not** run `supabase start`, `supabase status`, or `supabase db reset`
(those need Docker). Apply every migration straight to the **linked** cloud
project instead:

```bash
supabase db push --linked            # applies all pending migrations, in order
supabase migration list --linked     # verify → "Remote database is up to date."
supabase gen types typescript --linked > packages/types/database.types.ts
```

> ⚠️ **Never use `2>&1` (or `| tee`) when generating types.** The CLI prints
> `Initialising login role...` and an "A new version is available" footer to
> **stderr** — merging stderr into the file writes those log lines *into*
> `database.types.ts` as line 1 / trailing lines, which is invalid TypeScript
> and has shipped to `main` before. Keep stderr separate: redirect only stdout
> (`> file`), or `… > file 2>gen_err.log` if you want to capture the log. After
> generating, sanity-check that line 1 is `export type Json =`.

The repo is already linked (`supabase/.temp/project-ref` → `zlcivjgvtyeaszikqleu`).
`supabase db push --linked` is non-destructive: it runs only the timestamped
files not yet recorded in the remote `supabase_migrations.schema_migrations`
table, in filename order. You'll be prompted for the DB password (paste it; or
pass `--password "<pw>"` to run non-interactively).

---

## ⚠️ Current status (2026-05-31): CI auto-apply is OFF

The GitHub Actions **`db-migrate`** job fails on every push that touches
`supabase/migrations/**`, because the three Supabase secrets it needs are **not
set** in the repo (only `DOPPLER_TOKEN` is). Confirm any time with:

```bash
gh secret list      # if you only see DOPPLER_TOKEN, the migrate secrets are missing
```

Until those secrets are added, **migrations do NOT apply automatically** — they
must be pushed to the cloud DB by hand (see "Manual step" below). Symptoms of a
forgotten manual push: `column ... does not exist` / "unable to save" runtime
errors on a newly-deployed feature even though the build is green.

---

## Manual step (current process — do this after every migration on `main`)

The repo is already **linked** to the production Supabase project
(`supabase/.temp/project-ref` → `zlcivjgvtyeaszikqleu`). After merging migration
changes, from the repo root:

```bash
# Applies every pending migration to the linked production DB.
supabase db push --linked

# Confirm local + remote are in sync (every row should appear in both columns).
supabase migration list --linked        # → "Remote database is up to date."
```

Docker is **not** required for this (it connects to the remote project, not the
local stack). You'll be prompted for the DB password the first time.

> Tip: do the `supabase db push --linked` **before** the Vercel web deploy goes
> live, so the schema is there when the new app code runs. In practice: push the
> commit, run the migration, then hard-refresh once Vercel finishes.

---

## Permanent fix — set the 3 GitHub Actions secrets

Once these exist, `db-migrate.yml` applies migrations + regenerates types on
every push to `main`, and the manual step goes away.

| Secret | Value | Where to get it |
|---|---|---|
| `SUPABASE_PROJECT_ID` | `zlcivjgvtyeaszikqleu` | Supabase → Project Settings → General (the project ref) |
| `SUPABASE_ACCESS_TOKEN` | a personal access token | https://supabase.com/dashboard/account/tokens |
| `SUPABASE_DB_URL` | the Postgres connection **URI** (includes the password) | Supabase → Project Settings → Database → Connection string → **URI** |

**Set them** either in the GitHub UI (repo → **Settings → Secrets and variables
→ Actions → New repository secret**) or with the CLI:

```bash
gh secret set SUPABASE_PROJECT_ID   --body "zlcivjgvtyeaszikqleu"
gh secret set SUPABASE_ACCESS_TOKEN --body "<your-access-token>"
gh secret set SUPABASE_DB_URL       --body "<postgres-connection-uri>"
```

Then re-run the latest failed **Database Migrations** run (Actions tab →
the red run → **Re-run jobs**), or push any migration change to trigger it.

---

## Rules (unchanged from CI_CD.md)

- Never edit an existing migration file — always add a new timestamped one.
- After a schema change, regenerate types: `supabase gen types typescript
  --linked > packages/types/database.types.ts` (CI does this automatically once
  the secrets are set). **Do not pipe stderr into the file — see the `2>&1`
  warning above.**
- Migrations are forward-only in production; document a `-- DOWN:` block in each
  file for manual reversal if ever needed.
