# Enabling Supabase Branching (per-git-branch databases)

> **Why:** you have one Supabase project (`zlcivjgvtyeaszikqleu` = production).
> A git branch isolates *code*, not the *database* — so running migrations from
> a sub-branch against `--linked` reshapes the same DB `main` and other agents
> use. Supabase **Branching** gives every git branch its own isolated Postgres,
> so SQL on the `legal` branch (or any branch) never touches production, and
> merges to production only when the PR merges.

This is mostly a dashboard + GitHub setup — the repo side is already in place
(timestamped migrations in `supabase/migrations/`, a committed
`supabase/config.toml`). The steps below are the parts only you can do.

## What Branching does

- On every **pull request** (or per branch, depending on config), Supabase spins
  up an **ephemeral preview database** for that branch.
- It **auto-runs `supabase/migrations/**`** against that preview DB — so pushing a
  migration file *is* running the SQL, on the branch's own database.
- Preview branches get their own API URL + keys, surfaced to Vercel preview
  deployments via the Supabase–Vercel integration.
- Merging the PR to the production branch applies the same migrations to
  production.

## One-time setup (dashboard)

1. **Plan check.** Branching requires a paid plan (Pro or above). Confirm the
   project's plan. `[FOUNDER: verify]`
2. **Connect GitHub.** Supabase Dashboard → your project → **Integrations →
   GitHub** → install the Supabase GitHub app and connect the
   `Wollie333/Vilo2027` repository. Set the **production branch** to `main` and
   the **migrations directory** to `supabase/migrations`.
3. **Enable Branching.** Dashboard → **Branches** → enable. Choose whether a
   preview branch is created per pull request (recommended) or per pushed git
   branch.
4. **Seeding (optional).** If preview branches should start with data, point
   Branching at `supabase/seed.sql`. (Pre-MVP there's no production data to
   copy, so an empty or seed-file start is fine.)

## One-time setup (repo — I can do these)

- `supabase/config.toml` → add the `[branching]` block Supabase expects and set
  the migrations path, if not already present. (I'll wire this on request once
  the plan/GitHub connection is confirmed, so the committed config matches what
  the dashboard enables.)
- Keep `supabase/.temp/` gitignored (it holds the per-clone link ref, not
  something to commit).

## How work then flows on a sub-branch (e.g. `legal`)

1. I add/commit a migration under `supabase/migrations/` and push the branch.
2. Supabase creates/updates the branch's preview DB and **runs the migration
   there automatically** — no `db push` against production.
3. I regenerate types against the branch DB and run build/lint (the SessionStart
   hook has the CLI + deps ready).
4. Live-verify on the branch's preview deployment.
5. When the PR merges to `main`, the same migrations apply to production.

## If you ever need a manual push instead of Branching

With the SessionStart hook + the two secrets set (`SUPABASE_ACCESS_TOKEN`,
`SUPABASE_DB_PASSWORD`), a linked session can still run, deliberately:

```bash
supabase db push --linked --password "$SUPABASE_DB_PASSWORD"
supabase migration list --linked        # → "Remote database is up to date."
supabase gen types typescript --linked > packages/types/database.types.ts
```

⚠️ Without Branching, that pushes to **production**. Only do it one migration at a
time, and never from a sub-branch while other agents are mid-change — that's the
collision this whole setup exists to avoid.

## Network policy — what this environment actually allows (measured)

Tested in a live session via the agent proxy:

- ✅ **npm registry reachable** — `pnpm install` works (25s), so build/lint/gen
  types all work once deps are installed by the SessionStart hook.
- ❌ **GitHub blocked (HTTP 403)** — the Supabase **CLI download** from GitHub
  releases fails, so the CLI can't self-install in-session under the current
  network policy.

**Why this is fine for Branching:** with Branching enabled, the SQL runs
**server-side** when you push the branch (Supabase's GitHub app applies the
migrations to the branch DB) — the in-session CLI is *not* required for that. The
CLI is only needed for `gen types` / `db diff` / a manual `db push`. To enable
the in-session CLI too, widen the environment's **network policy to allow GitHub**
(`github.com`, `api.github.com`, `objects.githubusercontent.com`) — then the hook
installs it automatically on the next session.

## What still needs YOU (can't be done from the repo)

- [ ] Confirm the Supabase plan supports Branching.
- [ ] Connect the GitHub repo in the Supabase dashboard + enable Branching.
- [ ] Add `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` as **environment
      secrets** for Claude Code on the web (so the hook can link).
- [ ] Confirm the environment's **network policy allows egress to Supabase**
      (`api.supabase.com`, `*.supabase.co`, the pooler host). If it's locked
      down, the CLI can't reach the DB even with valid secrets.
