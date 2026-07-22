# Agent Guardrails Brief — hand this to any Claude Code session

**Purpose:** a single, self-contained safety + guidance document for an agent working on a
**sub-branch** of this repo. It is a condensation of `RULES.md`, `AGENT_RULES.md`,
`CLAUDE.md` and `BUSINESS_PRINCIPLES.md` plus the traps that have actually cost this
project real time. Where this brief and those files disagree, **the source files win** —
but everything here was taken from them.

**Read this before your first edit.** Then read `CURRENT_TASK.md` for your scope.

---

## 0. The four rules that matter most

Every expensive mistake in this repo's history is a violation of one of these.

### 0.1 Establish ground truth before you assert or code  (`RULES.md` §2)

> **Never assert anything before you have checked the real code and the real database
> state.** Not "I recall", not "the doc says", not "a search result says", not "it looks
> like". Read the actual file, query the actual database, call the actual endpoint —
> THEN speak.

- **Code:** open the **whole function**, not the line your grep pointed at. Guards
  usually sit *above* the interesting line.
- **Database:** `supabase db query --linked`. Rehearse destructive work inside
  `BEGIN; … ROLLBACK;`.
- **Behaviour:** call the endpoint. **A 2xx is not proof of success and a 4xx is not
  proof of a block — read the BODY.**
- **External services:** make one real authenticated call. Search results about
  third-party APIs are frequently wrong or stale.
- **Docs and memory:** leads, never evidence. `docs/SCHEMA.md` is generated from the live
  DB; `node scripts/audit-wiring.mjs` answers "what calls this?". Prefer both over any
  prose — **including this file**.

> ✅ *"I believe X but have not verified it"* is **always** acceptable.
> ❌ Presenting a guess as a finding is not.

The cost is asymmetric: a wrong assertion gets written into commit messages, code
comments and docs, where it long outlives the conversation.

### 0.2 The silent no-op — the dominant bug class here  (`RULES.md` §8.1)

`audit-wiring.mjs` answers *"does anything call this?"*. The harder failure is the one
where **something does call it, and it quietly does nothing.** Four such features were
found in a single day — all built green, linted green, "done" for weeks.

Treat these as smells and **prove** each one:

| Smell | The proof required |
|---|---|
| `return true` / `?? false` / `catch {}` / `\|\| ''` on an auth or validation path | Exercise the **DENY** path, not just the allow path |
| A write that can match **zero rows** (RLS, wrong id, another runtime's view) | **Re-read the row afterwards.** `UPDATE … WHERE` matching nothing is not an error, and **PostgREST answers 200/204 for "0 rows affected"** |
| A value read somewhere other than where it is set (Vercel vs Supabase vs Vault vs a DB GUC) | Prove **both** sides hold the **same** value, not that each is "set". A wrong-but-present secret fails identically to a missing one |
| A guard that returns early "if unconfigured" | Make it **log loudly or fail** — a quiet skip is indistinguishable from success forever |
| An `.insert()` / `.update()` whose `{ error }` is discarded | Check it, or you have built a silent drop |

**The question before calling anything done:** *if this were broken right now, what would
I see?* If the honest answer is "nothing", it is not finished — it is untested.

### 0.3 Delete dead code — but PROVE it is dead  (`RULES.md` §3)

Dead code gets deleted, **always** — but be *doubly* sure, and keep a fast way back.

1. **Prove it. One grep is NOT proof.**
   - Search the symbol's **own name**, not what it calls.
   - Search the **whole repo** — `emails/`, `supabase/`, `scripts/`, `packages/`, docs.
   - Edge Function → is it **deployed** (`supabase functions list`)? DB object → check
     `cron.job`, triggers, and **RLS policies** (a function used by an RLS policy has no
     code call site at all).
   - ⚠️ **Three ways a naive grep lies in this repo:** `.next/` webpack cache is **binary
     and contains every symbol name** (use `grep -I`, exclude `/.next/`) · two git
     worktrees live **inside** the repo so every symbol looks defined twice · word
     boundaries (`toggleProductActive` "matches" `toggleProductActiveAction`).
2. **Delete in its OWN commit**, with the restore path in the message
   (`git revert <sha>` / `git checkout <sha>^ -- path/to/file.ts`).
3. **Verify nothing broke** on the live/deployed app. A green build only proves nothing
   *imported* it.
4. **Remove every trace** — including docs, README lines and error codes describing it.

> 🔑 **A symbol having no caller says NOTHING about whether the CAPABILITY is missing.**
> Look for a **richer replacement** first. (A no-show action with no caller was nearly
> wired up — the capability already existed in a fuller form, and wiring the orphan would
> have created **two divergent money paths**.)
>
> If you cannot prove it is dead: **say so and leave it.** An unproven deletion is a worse
> bug than the dead code.

### 0.4 You are never done until you have SEEN it work  (`RULES.md` §8)

> **Never "done" until the change is SEEN working in BOTH the builder canvas AND the
> live/published render.** Founder directive, non-negotiable.

Green build/lint/tests are **necessary but not sufficient**. "It should work", "the logic
is correct", "I couldn't reach live" are **not done**. Verify with real evidence
(screenshot / DOM inspect / computed style) — a component can diverge between a builder's
bespoke preview and the shared live render path. Can't reach a surface? That's a blocker
to resolve (build a harness, ask for a test URL up front) — **never report "done"; mark it
NOT verified and say so loudly.**

---

## 1. Anti-wipe safety — you are NOT alone in this workspace  (`AGENT_RULES.md` §8)

More than one agent works this repo at a time: other Claude Code sessions, autonomous
loops, the founder's own edits, and worktree branches all share the tree. **Feature work
has been silently wiped at least twice** (~30+ files, hours of effort, gone in one sweep).

### 1.1 Never wipe files you did not create
Stop and **ask the user** before touching: untracked files not in `CURRENT_TASK.md` ·
modified files whose change isn't yours · branches/stashes/worktrees/commits you didn't
create · routes, components, migrations or tables you don't recognise.

### 1.2 Never run sweeping git operations unprompted
Banned unless the user explicitly asked **in the current session**, with scope stated:

```
git reset --hard          git checkout . / -- . / git restore .
git clean -fd / -xfd      git stash drop / clear
git branch -D <branch you didn't create>
git worktree remove --force
git push --force (any variant) to a shared branch
```

If you believe one is genuinely required, **ask first and itemise what will be lost**.

### 1.3 Stage by name — never `git add -A` or `git add .`
Stage **only** the files your task produced; `git add -A`, `git add .` and
`git commit -am` may sweep another agent's WIP into your commit. Run `git status --short`
before staging and verify every line.

### 1.4 Commit early, commit often
Going >30 min of feature work without a checkpoint is the biggest source of loss here.
Use `wip:` commits. **Uncommitted changes are not safe** — another agent's checkout,
reset or worktree prune erases them in one keystroke. Committed work survives in reflog.

### 1.5 Shared-infra files are contested
`AdminSidebar.tsx` · dashboard `Sidebar.tsx` · `lib/admin/requirePermission.ts` (the
`PermissionKey` union) · `lib/admin/withAdminAudit.ts` (the `AuditTargetType` union) ·
`packages/types/database.types.ts` · `app/sitemap.ts` · the `supabase/migrations/`
timestamp sequence · `CURRENT_TASK.md`, `CHANGELOG.md`.

**Re-read these immediately before editing** — never rely on a Read from earlier in the
session. After committing, verify with `git diff HEAD~1 -- <file>` that your additions
survived.

### 1.6 If your work has been wiped — stop and tell the user
Do **not** silently re-create it. Try recovery first: `git reflog` · `git stash list` ·
`git fsck --lost-found` · `git worktree list` · `git log --all --oneline -- <file>`.
Recovery is usually faster than rebuilding.

---

## 2. Security — non-negotiable  (`RULES.md` §5, `AGENT_RULES.md` §1)

- **NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` to the client — Edge Functions and Server
  Actions only. Never `NEXT_PUBLIC_` a secret. Never log a secret.
- **NEVER trust client-supplied prices** — always recalculate server-side.
- **ALWAYS verify webhook signatures** before any DB write (Paystack HMAC SHA-512 /
  PayPal Verification API).
- **NEVER bypass RLS in client-side code.**
- **Fail closed.** Every guard's default must be deny. **Prove the DENY path.**
- **Ownership auth:** a SECURITY DEFINER function taking an owner id (`p_host_id`) bypasses
  RLS — it **must** verify ownership internally, or a signed-in user can forge the id over
  PostgREST and read another host's data (IDOR).
  ⚠️ Guard helpers must `COALESCE(…, false)` — three-valued logic (`false OR NULL` = NULL,
  `NOT NULL` = NULL) once made **every** `IF NOT can_read(...)` check **fail OPEN**.
- **`CREATE FUNCTION` grants EXECUTE to PUBLIC** → every `REVOKE … FROM anon` is a
  **no-op**. Revoke from **PUBLIC**.
- **Sensitive data:** banking details encrypted at the application layer before storage ·
  tokens in httpOnly cookies (web) / SecureStore (mobile) · no PII or secrets in logs.
- **Audit:** every admin action, impersonation, payment decision or manual override is
  logged to `admin_audit_log`.
- **Never leak internals in an error** — raw Postgres errors have exposed table and
  constraint names, and turned a public endpoint into an **existence oracle** (a real id
  behaved differently from an unknown one). Make responses **byte-identical** across the
  "exists" and "doesn't exist" cases.
- **Injection:** user input into PostgREST filter-STRING methods (`.or()`, `.filter()`,
  `.not()`, `.match()`) → `sanitizeSearch`. Rich HTML → `sanitiseListingHtml` /
  `sanitizeHelpHtml`. Host CSS values → `sanitizeCssValue`. **One sanitiser per vector —
  use it, never hand-roll.**

---

## 3. Database rules  (`CLAUDE.md`, `AGENT_RULES.md` §2)

- **Read `docs/SCHEMA.md` before any DB work** — it is **generated from the live database**
  (`node scripts/generate-schema-doc.mjs`). Prose docs go stale; this project has been
  burned repeatedly. Regenerate after any migration.
- **NEVER edit an existing migration file** — always create a new one.
- **NEVER hard-delete** `user_profiles`, `hosts`, `listings`, `bookings` — soft delete
  (`deleted_at`) only.
- **Append-only tables** (INSERT only, no UPDATE/DELETE): `admin_audit_log`,
  `subscription_history`, `policy_snapshots`.
- **Regenerate types after every schema change:**
  `supabase gen types typescript --linked > packages/types/database.types.ts`
  ⚠️ **Never pipe stderr into that file** (no `2>&1`, no `| tee`) — the CLI writes notices
  to stderr and merging them corrupts the file.
- **Always handle the `error`** from a Supabase query. Never ignore it. (See §0.2.)
- **Prefer DB-level logic for data integrity** — a trigger or DB function can't be
  accidentally bypassed. Check what already exists (`calculate_booking_price`,
  `calculate_policy_refund_amount`, `check_feature_permission`, `snapshot_booking_policies`)
  before writing equivalent app logic.
- 🔑 **A rename silently orphans `pg_cron`** — `cron.job.command` is TEXT. One table rename
  killed a cron for ~30 days. After ANY rename:
  `SELECT * FROM cron.job WHERE command ILIKE '%<old_name>%';`

### Pre-MVP data policy (active until first public launch)
No real users yet — treat every table as empty. **No backwards-compat shims**: no
backfills, no dual-write windows, no rename-and-alias columns. If a migration needs to drop
a column or reshape a table, just do it. **This policy expires at MVP launch.**

---

## 4. Code quality  (`RULES.md` §3, §6)

- **Single source of truth — one canonical home per concept.** Before writing logic,
  **search for it**. If it exists, import and reuse — never paste a second copy or
  re-derive it inline. When a shared module is missing a case, **EXTEND it**; do not fork
  it or compute the same result a different way somewhere else.
- **Money is the spine — never fork it.** Booking money → the ledger
  (`lib/payments/ledger.ts`) · paying an existing booking → `startBookingPayment` · host
  card credentials → `getHostPaystack` · host EFT validity → `hostHasValidEft` · pricing →
  `priceStay`.
- **Use the least code that correctly solves the problem.** The best code is no code.
- **Prefer composition over abstraction** — abstract only at the third repetition. Don't
  pre-abstract a pattern you've seen once.
- **NO `any`** in TypeScript — `unknown` + narrow, or the generated DB types. No `as X`
  without a comment explaining why. Explicit return types on Server Actions and Edge
  Function handlers.
- **All forms** use React Hook Form + Zod. **All mutations** go through Server Actions or
  Edge Functions — never a direct `.insert/update/delete()` from a client component.
- **All Realtime subscriptions** cleaned up on unmount.
- **Server Components by default**; `'use client'` only for hooks/browser APIs.
- **shadcn/ui for all UI** — never build from scratch what shadcn provides.
- **Mobile-first, always.** ~95% of bookings happen on mobile; the booking flow is the
  sharpest edge.
- **No `console.log` in committed code.**

---

## 5. Definition of done — the checklist

- [ ] **If this feature were broken, something would visibly differ** — name it (§0.2)
- [ ] **The DENY / failure path was exercised**, not just the happy path (§0.2)
- [ ] **SEEN working in the builder canvas** (real evidence, not assumption)
- [ ] **SEEN working on the live/published render** — canvas ≠ live must be proven
- [ ] Matches the acceptance criteria in `CURRENT_TASK.md`
- [ ] `pnpm build` passes — zero errors
- [ ] `pnpm lint` passes — zero warnings
- [ ] No `console.log`, no hardcoded IDs/prices/plan names/magic strings, no new `any`
- [ ] All error states handled (loading, empty, error); mobile responsive
- [ ] Types regenerated if the schema changed
- [ ] **Help Centre article created or updated** for the feature touched (`RULES.md` §9)
- [ ] **All user-facing strings wired through i18n** — no hardcoded English (`RULES.md` §10)
- [ ] Committed with a conventional commit message (**subject must be lowercase** —
      commitlint enforces it)
- [ ] `CURRENT_TASK.md` session notes + `CHANGELOG.md` updated

---

## 6. When to STOP and ASK  (`AGENT_RULES.md` §9)

- A schema change that wasn't explicitly requested
- About to write an Edge Function touching **payments or bookings**
- The task involves **deleting data**
- The file to touch is **not in `CURRENT_TASK.md`**
- You see **unfamiliar files, branches, or untracked work** in the area you're about to
  touch (§1.1)
- About to run a **sweeping git command** (§1.2)
- Installing a **new package**, or creating a new **table/column**
- Something conflicts with a rule in `AGENT_RULES.md`

> Asking takes 30 seconds. Reverting a bad decision takes hours.

---

## 7. Environment traps specific to this repo

- **No Docker / no local Supabase.** Do **not** run `supabase start` / `status` /
  `db reset`. Apply migrations to the linked cloud project: `supabase db push --linked`.
- **pnpm only** — no npm, no yarn.
- **`pnpm build` dying with `0xC0000409`** = stale `.next` or heap. ⚠️ Bash `rm -rf .next`
  **silently fails on Windows** — use PowerShell `Remove-Item -Recurse -Force`. If `tsc`
  and `lint` pass standalone, try `NODE_OPTIONS=--max-old-space-size=8192`.
- **Building while a dev server is running corrupts `.next`.** Keep at most 2 dev servers;
  `preview_stop` does **not** kill the process tree (`Stop-Process -Name node -Force`).
- **Doppler is the single source of truth for secrets.** 🚨 **A branch config CANNOT
  override an inherited secret** — `secrets get -c <branch>` returns the *inherited* value,
  so verify-before-delete is an illusion and a root→branch move **destroys** the key.
  **Decision: don't move them.**
- **A GREEN Vercel deploy may never have built** (a turbo cache hit went READY in 1.16s
  while broken). `vercel env pull` writes EMPTY for encrypted vars.
- `emails/` lives **outside** `apps/web` — include it in repo-wide searches.
- `/privacy` and `/terms` render a **DB document**, not the `.tsx` you may be reading.
- In Grep, `[locale]` is a **path** fragment, not a glob.

---

## 8. What NOT to touch on a sub-branch

Unless your `CURRENT_TASK.md` explicitly says so:

- 🔒 **The website-builder symbols** — an active sub-branch owns them.
- 🔒 **The external-reviews fetch/reply layer** — incomplete on purpose, blocked on
  third-party approval. It must be **completed**, not deleted.
- 🔒 **Go-live flips are deferred deliberately** (mailboxes · legal text · Paystack→live ·
  PayPal→live). **Test keys stay active until launch day and that is intended.** See
  `docs/SMOKE_TESTS.md` §0.5.
- 🔒 **Signup's product-less `plan=free` subscription IS the guest tier** — never prune
  NULL-product subscriptions.

> **Deletion is a last resort.** Don't waste time recoding what we already built.

---

*Good code is not just code that works — it's code the next session can understand,
extend, and trust.*
