# Vilo Platform — CI/CD

**Version:** 1.0
**Last Updated:** May 2026
**Companion Docs:** `DEVSTACK.md`, `ARCHITECTURE.md`, `ENV_VARS.md`, `SECURITY_CHECKLIST.md`

---

## 1. Overview

All CI/CD runs through GitHub Actions. Five workflow files live in `.github/workflows/` (`ci.yml`, `db-migrate.yml`, `deploy-functions.yml`, `mobile-preview.yml`, `docker-build.yml`). The web app deploys via Vercel's native GitHub integration, not a workflow. Secrets are managed via Doppler — no **app** secrets are stored directly in GitHub Secrets, only **CI-infrastructure** credentials (`DOPPLER_TOKEN`, `DOCKERHUB_*`, `VERCEL_*`, `SUPABASE_ACCESS_TOKEN`, `EXPO_TOKEN`).

**Doppler integration:**
- Workflows that need app secrets at build time use either `doppler run -- <command>` (full env injection) or `dopplerhq/secrets-fetch-action` (named outputs for build-args).
- `DOPPLER_TOKEN` is a read-only service token scoped to the `prd` config.
- See `ENV_VARS.md` for the full secret catalogue and Doppler config layout.

### Deployment order on push to `main`

```
db-migrate.yml       (1st — schema must be live before app)
    ↓
deploy-functions.yml  (2nd — Edge Functions deployed)

Vercel (parallel)     Web deploy via native GitHub integration —
                      Doppler→Vercel sync keeps prod env in lockstep.
```

Use `needs:` in each workflow to enforce ordering when chained.

---

## 2. Workflow Files

### `ci.yml` — Pull Request validation

**Trigger:** `pull_request` targeting `main` or `develop`
**Blocks merge:** Yes — all steps must pass

```yaml
name: CI

on:
  pull_request:
    branches: [main, develop]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Start local Supabase
        uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: supabase start
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

      - name: Apply migrations
        run: supabase db push

      - name: Type check
        run: cd apps/web && pnpm tsc --noEmit

      - name: Lint
        run: cd apps/web && pnpm lint

      - name: Unit tests
        run: cd apps/web && pnpm test
        env:
          NEXT_PUBLIC_SUPABASE_URL: http://localhost:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ env.LOCAL_ANON_KEY }}

      - name: E2E tests
        run: cd apps/web && pnpm test:e2e
        env:
          BASE_URL: http://localhost:3000
          NEXT_PUBLIC_SUPABASE_URL: http://localhost:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ env.LOCAL_ANON_KEY }}

      - name: Stop Supabase
        if: always()
        run: supabase stop
```

**What it validates:**
- TypeScript compiles with zero errors
- ESLint passes with zero warnings
- All Vitest unit and integration tests pass
- All Playwright E2E tests pass (auth, booking flow, listing creation)

---

### Vercel web deploys

The web app deploys via Vercel's native GitHub integration — no workflow file needed. Every push to `main` triggers a Vercel build automatically. Production env vars are kept in sync with Doppler `prd` via the Doppler→Vercel integration.

If you ever need CI-controlled deploys (e.g., to gate on tests or chain after `db-migrate`), reintroduce a workflow that uses `doppler run -- pnpm --filter web build` + `amondnet/vercel-action` and add `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` as GH secrets.

---

### `deploy-functions.yml` — Deploy Edge Functions to Supabase

**Trigger:** `push` to `main` (only when `supabase/functions/**` changed)
**Needs:** `db-migrate` must complete first

```yaml
name: Deploy Edge Functions

on:
  push:
    branches: [main]
    paths:
      - 'supabase/functions/**'

jobs:
  deploy-functions:
    runs-on: ubuntu-latest
    needs: [db-migrate]
    steps:
      - uses: actions/checkout@v4

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Deploy all Edge Functions
        run: supabase functions deploy --all --project-ref ${{ secrets.SUPABASE_PROJECT_ID }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

**GitHub Secrets required:**
- `SUPABASE_ACCESS_TOKEN` — Supabase personal access token (from supabase.com/dashboard/account/tokens)
- `SUPABASE_PROJECT_ID` — project ref (from Supabase project settings)

**Note:** Edge Function env vars (API keys, webhook secrets) are set in Supabase dashboard under Edge Functions → Secrets — not in this workflow.

---

### `db-migrate.yml` — Run database migrations

**Trigger:** `push` to `main` (only when `supabase/migrations/**` changed)
**Runs first** — all other deploy jobs depend on this

```yaml
name: Database Migrations

on:
  push:
    branches: [main]
    paths:
      - 'supabase/migrations/**'

jobs:
  db-migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Run migrations
        run: supabase db push --db-url ${{ secrets.SUPABASE_DB_URL }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

      - name: Regenerate TypeScript types
        run: |
          supabase gen types typescript \
            --project-id ${{ secrets.SUPABASE_PROJECT_ID }} \
            > packages/types/database.types.ts
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

      - name: Commit updated types
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'chore: regenerate database types [skip ci]'
          file_pattern: 'packages/types/database.types.ts'
```

**GitHub Secrets required:**
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_URL` — direct PostgreSQL connection string (from Supabase project settings → Database → Connection String)

---

### `mobile-preview.yml` — OTA mobile update

**Trigger:** `push` to `develop`
**Purpose:** Sends a JS-only OTA update to devices running the internal preview build

```yaml
name: Mobile Preview

on:
  push:
    branches: [develop]

jobs:
  ota-update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install EAS CLI
        run: npm install -g eas-cli

      - name: EAS Update (OTA)
        run: eas update --branch preview --message "${{ github.event.head_commit.message }}"
        working-directory: apps/mobile
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```

**GitHub Secrets required:**
- `EXPO_TOKEN` — Expo personal access token (from expo.dev/accounts/[username]/settings/access-tokens)

**Note:** OTA updates only ship JS changes. If native code changed (`app.json`, `eas.json`, native modules), a full `eas build` is required — run that manually via CLI.

---

## 3. GitHub Secrets Reference

All secrets are set in GitHub → Repo Settings → Secrets and variables → Actions.

| Secret | Used in | Where to get it |
|---|---|---|
| `DOPPLER_TOKEN` | docker-build (and any workflow needing app secrets) | Doppler Dashboard → vilo2027 → `prd` config → Access → Service Tokens |
| `GITHUB_TOKEN` | docker-build | Auto-provided by GitHub Actions — used to push images to ghcr.io. No setup needed. |
| `SUPABASE_ACCESS_TOKEN` | db-migrate, deploy-functions, ci | supabase.com → Account → Access Tokens |
| `SUPABASE_PROJECT_ID` | db-migrate, deploy-functions | Supabase Dashboard → Project Settings → General |
| `SUPABASE_DB_URL` | db-migrate | Supabase Dashboard → Settings → Database → Connection String (Transaction mode) |
| `EXPO_TOKEN` | mobile-preview | expo.dev → Account Settings → Access Tokens |

**App secrets (NEXT_PUBLIC_SUPABASE_*, PAYSTACK_*, PAYPAL_*, RESEND_API_KEY, etc.)** are *not* stored as GitHub secrets — they live in Doppler `prd` and are pulled into workflows via `DOPPLER_TOKEN`.

---

## 4. Branch Strategy

| Branch | Purpose | CI runs | Auto-deploys to |
|---|---|---|---|
| `main` | Production | Full CI suite | Vercel production + Supabase production |
| `develop` | Staging integration | Full CI suite | Vercel preview + EAS OTA (mobile) |
| `feature/*` | Feature development | Full CI suite | Vercel preview URL per PR |
| `fix/*` | Bug fixes | Full CI suite | Vercel preview URL per PR |
| `migration/*` | DB schema work | Full CI suite | No auto-deploy — merge to develop first |

### Rules
- Never push directly to `main` — always via PR
- PRs targeting `main` require the CI suite to pass before merge
- DB migrations (`migration/*` branches) merge to `develop` first, validate on staging DB, then merge to `main`
- Hotfixes branch from `main`, get a PR with passing CI, then merge back

---

## 5. Local Pre-commit Hooks

Husky + Commitlint + lint-staged enforce conventions before every commit locally:

```
# Commit message must follow Conventional Commits
feat: add iCal import UI
fix: correct refund calculation
migration: add ical_feeds table
chore: update dependencies
docs: update PHASE_PLAN.md
```

```json
// package.json (root)
{
  "lint-staged": {
    "apps/web/**/*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "packages/**/*.{ts,tsx}": ["prettier --write"]
  }
}
```

```js
// commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'chore', 'migration', 'docs', 'refactor', 'wip', 'test'
    ]],
  },
};
```

---

## 6. Preview Deployments

Every PR to `main` or `develop` automatically gets a Vercel preview URL. The URL is posted as a comment on the PR by the Vercel GitHub integration.

Preview deployments use staging Supabase credentials (separate project from production). Configure in Vercel → Project → Environment Variables → Preview.

---

## 7. Rollback Procedure

### Web app
Instant rollback via Vercel dashboard → Deployments → select previous deployment → Promote to Production. Takes ~30 seconds.

### Edge Functions
```bash
# Roll back to a previous function version
supabase functions deploy <function-name> --version <previous-sha>
```

### Database migrations
Migrations are forward-only in production. Every migration file must include a `-- DOWN:` comment block documenting how to reverse it manually if needed. Never run rollbacks automatically.

---

## 8. Monitoring CI Health

- Failed CI sends a Slack/email notification to the team (configure in GitHub → Repo Settings → Notifications)
- Sentry receives source maps on every production deploy via `deploy-web.yml` (`@sentry/nextjs` handles this automatically)
- Vercel deployment status is visible on the PR and in Vercel dashboard
