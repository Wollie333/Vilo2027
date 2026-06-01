# Vilo — General Rules & Best Practices

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

Run through this checklist every time:

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
- **Categorise correctly** — set `category_id` to the right `help_categories`
  slug (e.g. `listings` for pricing/promotions, `payments` for payouts/refunds,
  `bookings`, `channels`, `trust-safety`) and the right `audience`
  (`host` / `guest` / `both`).

### Why
- Preview === checkout === **docs**: the same single-source-of-truth discipline
  we apply to pricing applies to explanation. A feature the user can't
  understand is a support ticket waiting to happen.
- Worked examples in articles should mirror the engine's test journeys so the
  numbers a host reads are the numbers they'll be charged.

> The article is part of "done". If the feature shipped and the article didn't,
> the task isn't finished.

---

*Good code is not just code that works — it's code that the next person (or the next session) can understand, extend, and trust.*
