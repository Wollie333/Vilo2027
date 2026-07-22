# Wielo — General Rules & Best Practices

**Version:** 1.0
**Last Updated:** May 2026
**For:** Claude Code (terminal) + any AI-assisted development session

These are the standing rules for how we work on this project. They apply to every session, every task, every file. When in doubt, come back here.

---

## 1. Task Discipline — Stay Small, Ship Often

### Keep tasks small and focused
One session = one feature or one fix. Never bundle multiple features into a single session. If a task feels too big to finish in one sitting, split it before starting.

### Write the task down before you code
Fill in `CURRENT_TASK.md` before touching any code. A task that isn't written down doesn't have a definition of done — and you'll keep going past where you should have stopped.

### Stop at the boundary
When you finish what's in `CURRENT_TASK.md`, stop. Resist the urge to "just quickly add" something adjacent. Write it down for the next session instead.

### Save progress constantly
Commit working code often — even partial progress. A commit every 30–60 minutes is not too frequent. If something breaks, you want a recent checkpoint to return to. Use `wip:` prefix for incomplete work:
```bash
git commit -m "wip: booking calendar — drag selection incomplete"
```

### Never end a session with uncommitted work
Whatever state the code is in at the end of a session — commit it. A stale working tree is a trap for the next session.

---

## 2. Always Read the Schema Before Touching Data

### Read supabase_database.md before any DB-related work
Before writing a query, migration, Edge Function, or RLS policy — open `supabase_database.md` and read the relevant domain section. The schema is the source of truth. Don't guess column names, types, or relationships.

### Check for existing DB functions before writing logic
The database has many stored functions and triggers that already handle complex logic (price calculation, refund calculation, date blocking, permission checks). Always check what exists before writing equivalent logic in application code.

Common functions to be aware of:
- `calculate_booking_price()` — price breakdown for a date range
- `calculate_policy_refund_amount()` — refund amount based on policy
- `check_feature_permission()` — RPC for subscription feature gates
- `snapshot_booking_policies()` — captures policy state at booking time

### Check for existing triggers before writing logic
The following DB triggers already run automatically — never duplicate them:
- `trigger_booking_confirmed` — inserts `blocked_dates` rows
- `trigger_booking_cancelled` — removes `blocked_dates` rows
- `handle_new_user` — creates `user_profiles` row on signup
- `update_updated_at` — keeps `updated_at` current on all mutable tables

---

## 3. Use the Least Code Possible

### Single source of truth — one canonical home per concept
**Every distinct piece of logic lives in exactly ONE place, and everywhere else reuses it.** This is a standing platform principle, not a nice-to-have: the goal is less code, one place to manage each function, and no behaviour that can silently drift between two copies.

- **Before writing logic, search for it.** If a function, predicate, query, type, or constant already exists, import and reuse it — never paste a second copy or re-derive it inline. (The best code is no code.)
- **If it doesn't exist yet and will be used by more than one caller, give it ONE home** — a shared module (`lib/…`), a DB function/trigger, a shared package (`packages/…`), or a single component — and have every caller funnel through it.
- **When a shared thing is missing a case, EXTEND the canonical module** (add to it). Do **not** fork it, wrap it with a divergent copy, or compute the same result a different way somewhere else.
- **Money is the spine — never fork it.** All booking-money state flows through the ledger (`lib/payments/ledger.ts`); all "pay an existing booking" through `startBookingPayment` (`lib/payments/pay-booking.ts`); host card credentials through `getHostPaystack` (`lib/payments/host-paystack.ts`); host EFT validity through `hostHasValidEft` (`lib/payments/eft.ts`); pricing through `priceStay` (`lib/pricing`). See `AGENT_RULES.md` §4.7–§4.8. These are examples of the rule, not exceptions to it.
- **Consolidate when you touch duplication.** If you find the same logic in two places, unify it in the same commit and point both at the one home — leave the codebase with fewer copies than you found it.

> **The one guardrail (don't over-correct):** reuse what genuinely *is* the same concept — don't force unrelated code to share a function just because it looks similar, and don't pre-abstract a pattern you've only seen once (see *Prefer composition over abstraction* below). Consolidate real duplication and canonical domain logic; resist speculative abstraction.

### Solve the problem with the minimum viable code
Before writing a new function, ask: does this already exist in the codebase, in a shared package, or as a DB function? The best code is no code.

### Prefer composition over abstraction
Don't over-engineer. Build the thing that works for the current use case. Abstract only when you see the same pattern appear three or more times.

### Delete unused code
If you're touching a file and spot unused imports, dead functions, or commented-out blocks — remove them in the same commit. Leave the codebase cleaner than you found it.

### Don't add packages for things you can do natively
Before installing a new dependency, ask: can this be done with what's already in the stack? A 200-line utility library that does what 5 lines of native code can do is not worth the dependency.

### Prefer DB-level logic for data integrity
If something needs to always be true about the data (e.g. blocking dates on booking confirmation), make it a trigger or a DB function — not application code. DB-level logic can't be accidentally bypassed.

---

## 4. Modern Design Standards — Always

### Use shadcn/ui as the base
All UI components start from shadcn/ui. Extend via wrapper components. Never build a custom button, input, modal, or card from scratch unless shadcn has no equivalent.

### Mobile-first, always
Design every web UI for mobile first, then add desktop breakpoints. Use Tailwind's `sm:`, `md:`, `lg:` in that order. If a page looks good on mobile, it's easier to make it look good on desktop — not the other way around.

### No visual clutter
Every element on screen should earn its place. Prefer whitespace over cramming information in. When in doubt, remove the element — you can always add it back.

### Consistent spacing system
Use Tailwind's spacing scale consistently. Don't invent custom spacing values. If the spacing token doesn't exist in the scale, you're probably solving the wrong problem.

### Accessible by default
- All interactive elements must be keyboard-accessible
- All images need `alt` text
- Form inputs must have associated labels
- Colour contrast must meet WCAG AA minimum (4.5:1 for normal text)
- Use semantic HTML elements (`<button>`, `<nav>`, `<main>`, `<header>`, `<section>`)

### Loading and empty states are not optional
Every component that fetches data must have three states designed: loading (skeleton), empty, and populated. A spinner is not a loading state — use skeleton components that match the shape of the real content.

### Every action gives immediate feedback (app-wide rule)
**No click may ever feel dead.** The instant a user triggers a navigation or a
mutation, the UI must show that something is happening — the user should never
wonder whether their click registered. Feedback is **tiered** by how long the
action takes; pick the lightest tier that fits, never nothing:

1. **Navigations (any link / `router.push`)** — covered automatically by the
   global top progress bar (`<NextTopLoader>` in the root layout). You get this
   for free; don't add anything extra for ordinary links.
2. **Heavy-route navigations** (the page builder + the full-screen editors) —
   the destination MUST have a `loading.tsx` skeleton (so the new screen paints
   instantly), and the trigger should use **`<PendingLink>`**
   (`components/ui/pending-link.tsx`) to show the labeled *"Opening the editor —
   loading your page…"* overlay during the latency.
3. **Mutations that take more than a moment** (publish, delete, upload, apply
   theme, bulk actions) — wrap the call in **`busy.during({ title, message }, fn)`**
   (`components/ui/busy-host.tsx`) so the labeled "what's happening" modal shows
   for its whole duration. Also keep the button in its pending state
   (`disabled` + inline `<Loader2 className="animate-spin">`).
4. **Quick, in-place mutations** (toggles, inline saves) — a button spinner +
   pending state, then a `toast` (sonner) on the result. No modal needed.

Always finish with a result signal: a `toast.success`/`toast.error`, an updated
row, or a `router.refresh()`. The labeled copy must say what is happening in the
host's words ("Publishing your site", not "Loading"). Primitives:
`NextTopLoader` (global bar), `<PendingLink>` (heavy-nav overlay), `busy` +
`<BusyHost>` (labeled mutation overlay), `BusyOverlay` (inline transition
overlay), `modal` (confirm/alert), `Toaster` (results). Don't hand-roll new
loading modals — reuse these.

### Error states must be helpful
Error messages tell the user what happened and what to do next. "Something went wrong" is a last resort. "Booking could not be confirmed — please try again or contact support" is correct.

---

## 5. Security is Non-Negotiable

### Never trust the client
Validate everything server-side. The client can send anything. Treat all client input as potentially malicious until validated by Zod and processed server-side.

### Least privilege everywhere
- Client components get the `anon` key — RLS enforces what they can see
- Edge Functions get `service_role` only when they need to bypass RLS, and only for the specific operation that requires it
- Never give a process more access than it needs for the task at hand

### Secrets never touch client code
Any variable the client can read is public. Never put secrets in `NEXT_PUBLIC_` variables. Never log secrets. Never store secrets in plaintext in the database.

### Sensitive data gets extra care
- Auth tokens: Expo SecureStore (mobile), httpOnly cookies (web)
- Banking details: encrypted at application layer before DB storage
- Passwords: handled entirely by Supabase Auth — never implement your own password hashing
- PII: only stored in columns that are protected by RLS policies scoped to the owner

### Input sanitisation
All user input that gets stored or displayed must be sanitised. Zod handles validation — but also ensure no raw HTML from user input is rendered without sanitisation. Use React's default JSX escaping and never use `dangerouslySetInnerHTML` with user content.

### Audit sensitive actions
Any admin action, impersonation session, payment decision, or manual override gets logged to `admin_audit_log` before it happens — not after.

---

## 6. Follow Best Practices for Each Layer

### TypeScript
- Strict mode on. No `any`. No type assertions (`as X`) without a comment explaining why.
- Prefer `type` over `interface` for object shapes. Use `interface` only when extending.
- Explicit return types on all Server Actions and Edge Function handlers.
- Use Zod inference for form types: `type FormValues = z.infer<typeof schema>`

### React / Next.js
- Server Components by default. `'use client'` only when you need hooks or browser APIs.
- Co-locate component logic: keep the file small, extract to hooks when logic grows.
- Don't put business logic in components. Components render — logic lives in hooks, server actions, or utilities.
- `useEffect` is a last resort. Reach for server-side data fetching first.

### Supabase / PostgreSQL
- Read the existing schema before writing a new query.
- Use `select()` with explicit column lists — never `select('*')` in production code.
- Always handle the `error` from Supabase queries. Never ignore it.
- Use RPC functions for complex reads — don't reconstruct DB logic in application code.

### Edge Functions
- Validate input with Zod before any DB operation.
- Return early on errors — don't nest `if` blocks, use guard clauses.
- One function = one responsibility. If it's doing three things, split it.

### CSS / Tailwind
- Utility classes only. No `style={{}}` props.
- Custom brand values go in `tailwind.config.ts` — not hardcoded class names.
- Don't fight the design system — if you're writing hacky CSS to make something fit, rethink the layout.

---

## 7. Communication Between Sessions

### Update CURRENT_TASK.md with session notes before closing
The "Session Notes" section is for anything the next session needs to know — decisions made, things discovered, blockers hit, things deliberately left for later.

### Keep a CHANGELOG.md
When a session completes, move the task summary to `CHANGELOG.md` with the date. This is your progress log and keeps the project history visible.

### Document decisions, not just code
If you made a non-obvious decision (why a feature is behind a permission check, why a trigger does X instead of the Edge Function), add a comment in the code and a note in the relevant `.md` file. Future sessions shouldn't have to re-derive why a decision was made.

### If something in the docs is wrong, fix it immediately
If you notice `ARCHITECTURE.md` has a wrong folder name, or `supabase_database.md` doesn't reflect a migration you just applied — fix the doc in the same commit. Stale documentation is worse than no documentation.

---

## 8. Before Calling Any Task Done

> **THE RULE (founder directive, non-negotiable — see BUSINESS_PRINCIPLES.md
> Principle #9): you are NEVER done until the change is SEEN working in BOTH the
> builder canvas AND the live/published render.** Green build/lint/tests are
> necessary but NOT sufficient. "It should work", "the logic is correct", or "I
> couldn't reach live" are NOT done. Verify both surfaces with real evidence
> (screenshot / DOM inspect / computed style) because a component can diverge
> between a builder's bespoke preview and the shared live render path. If you
> genuinely can't reach one surface, that's a blocker to resolve (build a harness
> / ask for a test URL up front) — never report "done"; mark it NOT verified and
> say so loudly.

### 8.1 The silent no-op — the dominant bug class in this codebase

`audit-wiring.mjs` answers *"does anything call this?"*. The harder failure is the
one where **something does call it, and it quietly does nothing**. On 2026-07-22
four separate features were found in that state. All four built green, linted
green, and had been "done" for weeks:

| What was wrong | Why nobody noticed |
|---|---|
| `isAuthorized()` ended in `return true` | The check ran. It could never fail. |
| A trigger's `UPDATE` was blocked by RLS | Matched **0 rows** — Postgres does not consider that an error. |
| Cipher keys set on Vercel, absent on Supabase | Two runtimes; each dashboard looked correct on its own. |
| A cron read `current_setting('app.…')`, which hosted Supabase forbids | Its own guard hit `RAISE NOTICE … RETURN` — a skip that looks exactly like a quiet, healthy tick. |

**The common thread is a silent fallback.** Every one of them turned a failure
into a no-op. So while coding, treat these as smells and prove each one:

- `return true` / `?? false` / `catch {}` / `|| ''` on an **auth or validation**
  path → **prove the DENY path**, not just the allow path.
- A write that can match zero rows (RLS, a wrong id, a different runtime's view of
  the world) → **re-read the row afterwards**. `UPDATE … WHERE` affecting nothing
  is not an error, and **PostgREST answers 200/204 for "0 rows affected"**.
- A value read in a **different place from where it is set** (Vercel vs Supabase
  vs Vault vs a DB GUC) → prove BOTH sides hold the same value, not that each is
  "set". A wrong-but-present secret fails identically to a missing one.
- A guard that returns early "if unconfigured" → make it **log loudly or fail**,
  never skip silently. A quiet skip is indistinguishable from success forever.

**The question to ask before calling it done:** *if this were broken right now,
what would I see?* If the honest answer is "nothing", it is not finished — it is
untested, and it will fail silently in production.

Run through this checklist every time:

- [ ] **If this feature were broken, something would visibly differ** — name it (§8.1)
- [ ] **The DENY / failure path was exercised**, not just the happy path (§8.1)
- [ ] **SEEN working in the builder canvas** (real evidence, not assumption)
- [ ] **SEEN working on the live/published render** — canvas ≠ live must be proven
- [ ] Does it match the acceptance criteria in `CURRENT_TASK.md`?
- [ ] `pnpm build` passes — zero errors
- [ ] `pnpm lint` passes — zero warnings
- [ ] No `console.log` in committed code (`grep -r "console.log" apps/`)
- [ ] No hardcoded IDs, prices, plan names, or magic strings
- [ ] No `any` introduced in TypeScript
- [ ] All error states handled (loading, empty, error)
- [ ] Mobile responsive (if web UI was built)
- [ ] Types regenerated if schema changed
- [ ] Committed with a descriptive conventional commit message
- [ ] `CURRENT_TASK.md` session notes updated
- [ ] `CHANGELOG.md` updated with what was built
- [ ] **Help Centre article created or updated** for the feature touched (see §9)
- [ ] **All user-facing strings wired through i18n** — no hardcoded English in new/changed UI (see §10)

---

## 9. Keep the Help Centre in Sync with Features

**Whenever you add a feature or change its logic, create or update the matching
Help Centre article in the same session.** The help docs are how hosts and
guests learn to use what we build — if the code moves and the docs don't, the
feature effectively doesn't exist for the people using it. This is a required
step, not a nice-to-have.

### What to do
- **New feature** → write a new `help_articles` row (via a seed migration, e.g.
  `supabase/migrations/*_help_*.sql`, using `INSERT … ON CONFLICT (slug) DO
  UPDATE` so it's idempotent) explaining what it does and how to use it, with
  worked examples.
- **Changed behaviour** (new rule, new option, pricing change) → update the
  existing article's `body_html` so it reflects the newest detail. Keep the same
  `slug`; the `ON CONFLICT` upsert refreshes it in place.
- **No article exists yet** → **create one.** This applies even when you're only
  *editing* an existing feature: if you touch a feature that has no Help Centre
  article, write its dedicated article in the same session. This is how the
  back-catalogue of older features (built before this rule) gradually gets full
  help coverage — every edit is an opportunity to fill a gap, not skip it.
- **Categorise correctly — one feature, one category.** Each product feature has
  its own `help_categories` row (e.g. `seasonal-pricing`, `coupons`,
  `listing-extras`, `rooms`, `add-ons`, `policies`). File the article under its
  feature category and set the right `audience` (`host` / `guest` / `both`). If
  the feature has no category yet, **create one** in the same migration (pick a
  valid icon from `apps/web/lib/help/icon-map.ts`, adding one if needed). The
  Help & Docs landing hides empty categories, so a new feature category only
  appears once its article is published — which keeps the page reflecting real
  activity automatically.

### Why
- Preview === checkout === **docs**: the same single-source-of-truth discipline
  we apply to pricing applies to explanation. A feature the user can't
  understand is a support ticket waiting to happen.
- Worked examples in articles should mirror the engine's test journeys so the
  numbers a host reads are the numbers they'll be charged.

> The article is part of "done". If the feature shipped and the article didn't,
> the task isn't finished.

---

## 10. Every User-Facing String Goes Through i18n

**Whenever you add or change a feature, design, or UI element, wire its text
through the translation system in the same session — never hardcode user-facing
strings.** The app is multilingual (next-intl; English is the source). A
hardcoded string can't be translated, so it silently breaks the experience for
every non-English user AND never appears in the admin Translations portal for a
native speaker to translate. This is a required step, not a nice-to-have — the
counterpart to §9 for language.

### What to do
- **Extract, don't hardcode.** Any visible text — labels, headings, buttons,
  placeholders, empty/error/toast messages, `aria-label`s, option labels — goes
  in a `messages/en.json` namespace and renders via translation:
  - Client components → `const t = useTranslations("namespace")` then `t("key")`.
  - Server components → `const t = await getTranslations("namespace")`.
- **Namespace by surface** (`nav`, `footer`, `listing`, `booking`, `dashboard`,
  `admin`, `email`, …). Add keys to the existing namespace for that surface;
  create a new namespace only for a genuinely new surface.
- **Dynamic values via ICU**, never string concatenation:
  `t("greeting", { name })` with `"Hi {name}"`. Feed the brand in as a value
  (`{brand}`) — never hardcode "Wielo" (see the dynamic-brand rule).
- **English is the source of truth.** Only `en.json` must be complete; other
  locales fall back to English and are filled later through the admin
  Translations portal (export keys → AI-translate the JSON → import → native
  speaker reviews). Don't hand-translate every surface yourself.
- **NOT money / IDs / dates.** Don't route amounts, identifiers, or dates
  through i18n — format money via `formatMoney` / the currency layer.

### Why
- The admin Translations portal expands **automatically** from the keys in
  `en.json`: every string you extract becomes translatable; every string you
  hardcode is invisible to it. Wiring i18n as you build is how the portal stays
  a complete, single source of truth for copy — the same discipline §3 applies
  to logic and §9 to docs.

> i18n wiring is part of "done". If the feature shipped with hardcoded English,
> the task isn't finished.

---

*Good code is not just code that works — it's code that the next person (or the next session) can understand, extend, and trust.*
