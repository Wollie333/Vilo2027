# Wielo — Current Task

> Reset at the start of every session. This is the session contract.

## 🟢 SAVE POINT (2026-08-07) — **LAUNCH-READINESS SWEEP — 7 FIXES SHIPPED TO PRODUCTION** ⬅ START HERE

**`main` == `origin/main` == `63c3bd65`** (fast-forwarded, pushed, **Vercel READY on wielo.co.za**).
`pnpm build` + `tsc` + `lint` all GREEN. Fixes were built on branch `test/launch-readiness-sweep`
(also pushed), rebased cleanly onto the previous save point's VAT/wizard work (`f9aadc43`), then
fast-forwarded into `main`. Full evidence report: **`docs/testing/LAUNCH_READINESS_SWEEP.md`**.
Memory: [[project-savepoint-aug7-launch-sweep]].

### ✅ Done this session — swept the 4 core features, each verified in-browser AND against the DB
Signup · booking engine (+ every sub-feature) · affiliate · pipeline — all PASS. **7 bugs fixed:**
1. `fix(seed)` — seed falls back to an active membership when `beta` is gone.
2. **`fix(signup)`** — no free host tier; plan REQUIRED; a product with a trial starts a TRIALING
   sub (no card, instant dashboard). `signup/host/{Wizard,actions,schemas}`. + Step-3 copy fix.
3. `fix(seed)` — reset password for existing starter accounts (they weren't on `WieloStarter123!`).
4. **`fix(rls)`** — `get_my_host_id()` excludes soft-deleted hosts (soft-delete now revokes RLS;
   was hiding a host's own bookings). Mig `20260807120000` — applied DIRECTLY to live DB (idempotent).
5. **`fix(dashboard)`** — 13 inline host resolvers now filter `deleted_at` (false onboarding gate).
6. **`fix(calendar-sync)`** — surfaced the iCal export URL (was a dead link + token unreachable);
   valid feed, VEVENT on confirm, no PII. New `ExportUrlList.tsx`.

### 🧹 Cleanup done (founder: keep config, remove accounts+bookings)
Removed the 4 `sweep.*@wielotest.com` accounts + test bookings (`purge_test_booking` RPC). KEPT on
host1: coupon `SWEEP20`, special `sweep-winter-special`, add-on `Airport Shuttle` (counters 0). Seed
world intact (host1/host2/guest@wielostarter.com / `WieloStarter123!`, 2 published props).

### ⚠️ Known / traps (this session)
- **NO Paystack keys anywhere** in `.env.local` → only EFT at booking checkout; card path untestable
  by the agent. Founder to connect test keys on host1 `/dashboard/settings/banking` + test the card.
- **Finding F2**: unfiltered `hosts…maybeSingle()` is **37 sites** — fixed 13 dashboard; ~24 remain
  incl. **5 in money-path `lib/billing/product-checkout.ts`** + admin/GDPR. Do a SHARED-helper sweep
  (route through `lib/host/current.ts`), NOT piecemeal. Latent (fresh host = 1 row), not a blocker.
- Browser automation: submit-clicks flaky → `requestSubmit()`; Radix modals need real clicks; booking
  payment form is inline (Payments tab → Record a payment → Full → Save). iCal feed cached 300s
  (cache-bust). `genlink.mjs` mangles the `/next` arg in Git Bash. `db push` unusable (behind remote
  migration history) → apply DDL directly via single-quoted heredoc.

### ▶️ Likely next
Founder: LIVE Paystack card test. Then: **F2 shared-helper refactor** (~24 resolvers), pipeline
nice-to-haves (drag / delete-deny / task add), host review reply, full `/r`→commission E2E.
