# Vilo Platform — Design System

**Status:** Canonical source moved to `Wielo Design System.html` (repo root).
**Last Updated:** 2026-05-23

---

## Canonical reference

**The only source of truth for Wielo's visual system is `Wielo Design System.html` at the repo root.**

Open it locally:

```
C:\Users\Wollie\Desktop\Wielo 2027\Wielo Design System.html
```

Or on the live web deploy:

```
https://vilo2027.vercel.app/DESIGN_SYSTEM.HTML
```

(Served as a static asset from `apps/web/public/DESIGN_SYSTEM.HTML`.)

The HTML is interactive, includes live component examples, and stays in sync with the Tailwind tokens shipped to production. If anything in this Markdown file conflicts with the HTML, **the HTML wins** — update this file, don't ignore the HTML.

---

## How it maps to the code

The design tokens are mirrored in three places. When the HTML changes, these must change with it:

| Layer | File | Owns |
|---|---|---|
| Tailwind theme | `apps/web/tailwind.config.ts` | brand colors, font families, radii, shadows, gradients, easing |
| Base styles | `apps/web/app/globals.css` | CSS custom properties (HSL), dark mode variables, `bg-brand-gradient` / `bg-dot-grid` utilities, reduced-motion rule |
| Font wiring | `apps/web/app/layout.tsx` | `next/font/google` for Inter, Plus Jakarta Sans, JetBrains Mono → exposes `--font-inter`, `--font-jakarta`, `--font-jetbrains-mono` |

The shadcn/ui components in `apps/web/components/ui/` consume the CSS custom properties (`--primary`, `--accent`, `--border`, etc.) directly. Do not edit `components/ui/` files — extend via wrapper components per ADR-006.

---

## Quick token cheatsheet

For a full reference, open the HTML. This is just enough to write code without context-switching.

**Brand colors** (Tailwind utilities):
- `bg-brand-primary` `#10B981` — primary CTAs, links, active nav
- `bg-brand-secondary` `#064E3B` — featured / promo / price emphasis
- `bg-brand-accent` `#D1FAE5` — hover surfaces, badge backgrounds
- `bg-brand-light` `#F0FDF4` — page background
- `bg-brand-dark` `#0A1510` — hero / footer surfaces
- `text-brand-ink` `#052E1F` — body text
- `text-brand-mute` `#4A7C6A` — muted text
- `border-brand-line` `#DCEAE0` — borders, dividers

**Status colors** (booking states only — never repurpose):
- `status-confirmed` `#10B981`
- `status-pending` `#F59E0B`
- `status-cancelled` `#EF4444`
- `status-completed` `#6366F1`
- `status-draft` `#94A3B8`

**Typography:**
- `font-sans` Inter — default UI
- `font-display` Plus Jakarta Sans — h1, h2, h3, hero, KPI numbers
- `font-mono` JetBrains Mono — booking refs, codes, IDs

**Radius:**
- `rounded-sm` 6px · `rounded` 10px (default, buttons/inputs) · `rounded-card` 16px · `rounded-pill` 9999px

**Shadows:**
- `shadow-card` resting card · `shadow-lift` hover/popover/modal · `shadow-ring` focus · `shadow-glow` brand gradient surfaces

**Gradient:**
- `bg-brand-gradient` light surface · `bg-brand-gradient-dark` dark surface
- **Only on the logo, app icon, and ONE hero element per screen.** Never on buttons or page backgrounds.

**Motion:**
- Durations: 150ms hovers · 200ms cards/dropdowns · 300ms drawers/modals
- Easing: `ease-out` entering, `ease-in` leaving, custom `transitionTimingFunction.out: cubic-bezier(0.2, 0.8, 0.2, 1)`
- All transitions respect `prefers-reduced-motion`.

---

## Hard rules

These are enforced by code review — the HTML has the full "Do & Don't" section.

- ❌ No raw Tailwind brand colors (`bg-blue-500`, `bg-green-600`) — use `brand-*` tokens.
- ❌ No gradients on page backgrounds or buttons.
- ❌ No font weights above 700 or sizes below 12px in production UI.
- ❌ No stacked shadows. Pick one of `shadow-card`, `shadow-lift`, `shadow-ring`, `shadow-glow`.
- ❌ No technical error strings in toasts — show user-facing copy, log technical detail.
- ❌ No blocking modals to gate free-tier features — use inline upgrade prompts instead.
- ❌ No raw shadcn `Dialog`/`AlertDialog`, no `window.confirm`/`window.alert`, no bespoke popup cards. Every popup, alert, confirm and error dialog uses the **Notification modals** shell.
- ✅ Notifications/alerts/confirms/errors → `<Modal>` or the imperative `modal.success|info|warning|error|confirm|destructive(...)` helpers (`components/ui/modal.tsx`, `modal-host.tsx`).
- ✅ Popups that contain a form (e.g. "Add seasonal price", "Edit room") → `<FormModal>` (`components/ui/form-modal.tsx`) — same shell, header + scroll body + pinned footer.
- ✅ Currency formatted via shared `formatCurrency()` helper as `R 2 400`.
- ✅ Booking references formatted `VILO-YYYY-XXNNNN` in `font-mono`.
- ✅ All forms use React Hook Form + Zod.
- ✅ Icons: `lucide-react` only, 1.5px stroke.

---

## Updating the design system

1. Edit `Wielo Design System.html` at the repo root.
2. Mirror any token changes into `apps/web/tailwind.config.ts` and `apps/web/app/globals.css`.
3. The published copy at `apps/web/public/DESIGN_SYSTEM.HTML` is a static mirror — `cp "Wielo Design System.html" "apps/web/public/DESIGN_SYSTEM.HTML"` keeps it in sync.
4. Update this cheatsheet only if a token name or rule changes.
5. Commit all changes in one commit so the source, the Tailwind theme, the live styles, and the published HTML stay in lockstep.
