# Phase 0 — User Action Checklist

> Everything Claude could do autonomously is done. The items below need **your** browser, accounts, or wallet to complete Phase 0 and unlock Phase 1.
>
> Order roughly matches dependency — items higher up unblock items lower down.

---

## 1. Vercel — fix monorepo deploy (~2 min)

The first push to `main` triggered a Vercel build that compiled cleanly but reported `Error: No Output Directory named "public" found`. Fix:

1. Open the project at **vercel.com/dashboard**.
2. Settings → **General** → **Root Directory** → set to `apps/web`.
3. (Optional) Settings → **General** → **Framework Preset** → confirm "Next.js" is detected.
4. Redeploy from the **Deployments** tab (or just push any new commit).

After this, every push to `main` deploys the web app to your Vercel URL.

---

## 2. Supabase Storage buckets (~5 min)

All Storage **RLS policies** are already applied to the project. The **buckets themselves** still need to exist for those policies to gate anything. Create 6 buckets at **supabase.com/dashboard/project/zlcivjgvtyeaszikqleu/storage/buckets**:

| Bucket | Access | Max Size | Allowed MIME types |
|---|---|---|---|
| `listing-photos` | Public | 10 MB | `image/jpeg, image/png, image/webp` |
| `host-avatars` | Public | 5 MB | `image/jpeg, image/png, image/webp` |
| `host-covers` | Public | 10 MB | `image/jpeg, image/png, image/webp` |
| `eft-proofs` | Private | 10 MB | `image/jpeg, image/png, application/pdf` |
| `message-attachments` | Private | 20 MB | `image/*, application/pdf` |
| `refund-requests` | Private | 10 MB | `image/jpeg, image/png, application/pdf` |

For each: dashboard → Storage → "New bucket" → name + Public/Private toggle + size limit + MIME allowlist.

---

## 3. Doppler (secrets) (~10 min)

`ENV_VARS.md` + `CI_CD.md` both assume Doppler is the secret store. Without it, secrets only live in local `.env.local` files.

1. Sign up at **doppler.com** (free for individuals).
2. Create project `vilo`.
3. Add three configs: `dev`, `staging`, `production`.
4. Populate each config with the variables in `ENV_VARS.md` (Supabase URL/keys, Paystack, PayPal, Resend, Sentry, PostHog, etc.).
5. Doppler → Integrations:
   - **GitHub** — sync to repo secrets for the workflows.
   - **Vercel** — sync to Vercel env vars.

---

## 4. Resend + viloplatform.com domain (~30 min)

Email delivery is blocked on a verified domain.

1. **Register `viloplatform.com`** at any registrar (Namecheap, Cloudflare, etc.).
2. Sign up at **resend.com** (3,000 free emails/month).
3. Resend dashboard → Domains → **Add Domain** → `viloplatform.com`.
4. Add the SPF + DKIM + DMARC records Resend gives you to your DNS provider. Wait for verification (usually <10 min).
5. Generate an API key in Resend → API Keys.
6. Add `RESEND_API_KEY` to Doppler (production config).

---

## 5. Expo EAS — mobile build service (~5 min)

`apps/mobile` is scaffolded but needs an EAS project to do cloud builds.

1. Sign up at **expo.dev** (free tier is fine).
2. In `apps/mobile/`, run:
   ```powershell
   pnpm dlx eas-cli login
   pnpm dlx eas-cli init
   ```
3. Generate an Expo personal access token at **expo.dev/accounts/[username]/settings/access-tokens**.
4. Add `EXPO_TOKEN` to GitHub repo secrets (used by `.github/workflows/mobile-preview.yml`).

---

## 6. Sentry — error monitoring (~5 min)

1. Sign up at **sentry.io** (free tier: 5,000 errors/month).
2. Create two projects:
   - `vilo-web` (platform: Next.js)
   - `vilo-mobile` (platform: React Native)
3. Copy the **DSN** for each.
4. Add to Doppler (staging + production):
   - `NEXT_PUBLIC_SENTRY_DSN` (web DSN)
   - Mobile DSN goes in `apps/mobile/.env.local` as `EXPO_PUBLIC_SENTRY_DSN`.

---

## 7. PostHog — product analytics (~3 min)

1. Sign up at **posthog.com** (free tier: 1M events/month).
2. Region: **EU** (closer to South Africa; matches our data residency goal).
3. Settings → Project API Key.
4. Add to Doppler (staging + production):
   - `NEXT_PUBLIC_POSTHOG_KEY`
   - `NEXT_PUBLIC_POSTHOG_HOST = https://eu.posthog.com`

---

## 8. Supabase region — schedule the migration to `af-south-1`

`SECURITY_CHECKLIST.md` §10 requires `af-south-1` for POPIA. The current project is in Frankfurt because `af-south-1` wasn't offered at provisioning time. See `DECISIONS.md` ADR-015. **Do this before any real user data is added.**

Strategies (decide later, not blocking now):
- Wait until Supabase enables `af-south-1` on your plan, then `pg_dump` + restore to a new project.
- Use Supabase's project clone feature (in beta as of last check).

Add a calendar reminder for ~2 weeks before public launch.

---

## 9. Tighten Vercel monorepo config (optional, ~3 min)

After step 1, your deploys work but Vercel doesn't share install cache between web and mobile workspaces. Optionally add a `vercel.json` at repo root that gives Vercel hints:

```json
{
  "buildCommand": "pnpm --filter web build",
  "installCommand": "pnpm install --frozen-lockfile",
  "outputDirectory": "apps/web/.next"
}
```

Then push.

---

## When all of the above is done

Phase 0 is officially **100% complete**. Phase 1 can begin (`PHASE_PLAN.md` → Phase 1 — Foundation): auth flows, host onboarding wizard, listing editor.

You can verify Phase 0 completion against:
- `PHASE_PLAN.md` — all Phase 0 boxes ✅ or 👤-completed
- `pnpm --filter web build` — clean
- `https://github.com/Wollie333/Vilo2027/actions` — green
- Vercel deploy URL — homepage shows `Connection: OK — GoTrue v2.189.0`
- Supabase Studio — 46 tables visible, RLS enabled on all, 10 seed `platform_settings` keys, 76 `plan_features` rows (19 × 4 tiers)
