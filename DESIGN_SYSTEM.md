# Vilo Platform — Design System

**Version:** 1.0
**Last Updated:** May 2026
**Companion Docs:** `DEVSTACK.md`, `CONVENTIONS.md`

This document is the single source of truth for every visual decision in the Vilo platform. Claude Code reads this before writing any UI component or styling code.

---

## 1. Design Principles

**Modern and trustworthy.** Hosts are running a real business. The UI should feel polished enough that they're proud to share their profile link.

**Mobile-first.** Most hosts will manage bookings from their phone. Design every screen for mobile, then extend for desktop.

**No clutter.** Every element must earn its place. When in doubt, remove it. Whitespace is a design choice, not an accident.

**Functional over decorative.** No gradients, no heavy shadows, no decorative patterns. Clean flat surfaces. The product IS the design.

---

## 2. Brand Colours

### Primary Palette

```typescript
// tailwind.config.ts
colors: {
  brand: {
    primary:   '#1B4D3E',   // Vilo deep green — primary actions, headings, logo
    secondary: '#F4A836',   // Vilo amber — highlights, accent badges, CTAs on dark bg
    accent:    '#E8F5E9',   // light green tint — hover states, selected backgrounds
    dark:      '#0D2B21',   // very dark green — text on light backgrounds, hover
    light:     '#FAFDF9',   // near-white with green tint — page backgrounds
  },
}
```

### Status Colours

```typescript
status: {
  confirmed: '#22C55E',   // green — confirmed bookings, success states
  pending:   '#F59E0B',   // amber — pending, awaiting action
  cancelled: '#EF4444',   // red — cancelled, error, declined
  completed: '#6366F1',   // indigo — completed, past
  draft:     '#94A3B8',   // slate — draft, inactive, locked
}
```

### Usage Rules

- `brand.primary` — primary buttons, links, active nav items, logos
- `brand.secondary` — secondary badges, highlight tags, "Featured" label, price display
- `brand.accent` — hover backgrounds on cards, selected date backgrounds, active row highlights
- Status colours — booking status badges ONLY. Never use `confirmed` green for anything other than a confirmed booking state.
- Never use raw Tailwind colours (`blue-500`, `green-600`) for anything that isn't in this system. Always use brand or status tokens.

---

## 3. Typography

### Fonts

```typescript
fontFamily: {
  sans:    ['Inter', 'system-ui', 'sans-serif'],     // all UI text
  display: ['Plus Jakarta Sans', 'sans-serif'],       // headings, marketing copy
}
```

**Loading:** Both fonts are loaded via `next/font/google` in the root layout for zero layout shift and automatic self-hosting.

### Scale

| Token | Size | Weight | Font | Use |
|---|---|---|---|---|
| `text-xs` | 12px | 400 | Inter | Metadata, timestamps, helper text |
| `text-sm` | 14px | 400 | Inter | Secondary labels, table data |
| `text-base` | 16px | 400 | Inter | Body text, form inputs, descriptions |
| `text-lg` | 18px | 500 | Inter | Section subheadings, card titles |
| `text-xl` | 20px | 500 | Plus Jakarta Sans | Page subheadings |
| `text-2xl` | 24px | 600 | Plus Jakarta Sans | Page headings |
| `text-3xl` | 30px | 700 | Plus Jakarta Sans | Hero headings (marketing) |

### Rules

- Never use font size below 12px anywhere
- Never use font weight above 700
- All heading tags (`h1`–`h3`) use Plus Jakarta Sans via the `font-display` class
- All body/UI text uses Inter via the default `font-sans`
- Line height: `leading-relaxed` (1.625) for body text, `leading-tight` (1.25) for headings

---

## 4. Spacing

Use Tailwind's default spacing scale consistently. No custom spacing values.

### Key Spacing Values

| Token | Value | Use |
|---|---|---|
| `p-2` | 8px | Tight padding (badges, small chips) |
| `p-3` | 12px | Compact padding (table cells, small cards) |
| `p-4` | 16px | Standard padding (cards, form fields) |
| `p-6` | 24px | Section padding, modal content |
| `p-8` | 32px | Page-level padding (desktop) |
| `gap-2` | 8px | Tight gaps (inline icons + text) |
| `gap-4` | 16px | Standard gaps (form rows, grid cells) |
| `gap-6` | 24px | Section gaps |
| `gap-8` | 32px | Major section separation |

### Grid

- Mobile: single column, `px-4` page padding
- Tablet (`md:`): 2-column grid where relevant
- Desktop (`lg:`): 12-column grid, max content width `max-w-7xl` centred

---

## 5. Border Radius

```typescript
borderRadius: {
  DEFAULT: '10px',   // standard — most buttons, inputs, cards
  card:    '16px',   // listing cards, panels, modals
  pill:    '9999px', // status badges, tag chips, avatar
  sm:      '6px',    // small elements, table row highlights
}
```

### Rules
- Buttons: `rounded` (10px)
- Cards and panels: `rounded-card` (16px)
- Status badges and tags: `rounded-pill`
- Images in cards: `rounded-card` top corners only — use `rounded-t-card`
- Never mix radius values on the same element

---

## 6. Shadows

Vilo uses **minimal shadows**. The goal is clean flat surfaces, not depth tricks.

| Token | Use |
|---|---|
| `shadow-sm` | Cards on hover (subtle lift) |
| `shadow-md` | Modals, drawers, dropdowns |
| No shadow | Default card state, buttons, inputs |

Never use `shadow-lg`, `shadow-xl`, or custom box-shadows. If you need hierarchy, use background colour and border instead.

---

## 7. Components

### Buttons

| Variant | Classes | Use |
|---|---|---|
| Primary | `bg-brand-primary text-white rounded px-6 py-3 font-medium hover:bg-brand-dark` | Main CTA |
| Secondary | `border border-brand-primary text-brand-primary rounded px-6 py-3 font-medium hover:bg-brand-accent` | Secondary action |
| Destructive | `bg-red-600 text-white rounded px-6 py-3 font-medium hover:bg-red-700` | Delete, cancel, decline |
| Ghost | `text-brand-primary px-4 py-2 hover:bg-brand-accent rounded` | Inline actions |
| Disabled | Add `opacity-50 cursor-not-allowed` to any variant | — |

### Upgrade Prompt (feature gate)

When a free-tier host hits a locked feature, show this inline — never a blocking modal:

```tsx
// components/shared/UpgradePrompt.tsx
<div className="flex items-start gap-3 rounded-card border border-brand-secondary/30 bg-brand-accent p-4">
  <LockIcon className="mt-0.5 h-4 w-4 text-brand-secondary shrink-0" />
  <div>
    <p className="text-sm font-medium text-brand-dark">{featureName} is available on {requiredPlan} and above.</p>
    <p className="text-sm text-gray-600 mt-0.5">{planPrice}/month — no booking fees, ever.</p>
    <div className="mt-3 flex gap-2">
      <Button variant="primary" size="sm">Upgrade to {requiredPlan}</Button>
      <Button variant="ghost" size="sm">See all plans</Button>
    </div>
  </div>
</div>
```

### Status Badges

```tsx
// Always use these exact colour combinations — never mix and match
const statusStyles = {
  confirmed:   'bg-green-100  text-green-800',
  pending:     'bg-amber-100  text-amber-800',
  cancelled:   'bg-red-100    text-red-800',
  completed:   'bg-indigo-100 text-indigo-800',
  draft:       'bg-slate-100  text-slate-700',
  pending_eft: 'bg-amber-100  text-amber-800',
  declined:    'bg-red-100    text-red-800',
  checked_in:  'bg-blue-100   text-blue-800',
  expired:     'bg-slate-100  text-slate-700',
} as const;

// Usage
<span className={`rounded-pill px-2.5 py-0.5 text-xs font-medium ${statusStyles[booking.status]}`}>
  {statusLabel}
</span>
```

### Cards

```tsx
// Standard card — listing card, booking card, review card
<div className="rounded-card border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow p-4">
  {children}
</div>

// Dashboard panel — wider sections with heading
<div className="rounded-card border border-gray-200 bg-white p-6">
  <h2 className="font-display text-xl font-semibold text-brand-dark mb-4">{title}</h2>
  {children}
</div>
```

### Form Inputs (shadcn/ui base)

All inputs come from shadcn/ui. The following customisations apply on top:

```typescript
// tailwind.config.ts — extend ring colours
ringColor: {
  DEFAULT: '#1B4D3E', // brand.primary focus ring
}
```

- Focus ring: `ring-2 ring-brand-primary ring-offset-1`
- Error state: `border-red-500 focus:ring-red-500`
- Disabled: `bg-gray-50 text-gray-400 cursor-not-allowed`
- Label: `text-sm font-medium text-gray-700 mb-1`
- Helper text: `text-xs text-gray-500 mt-1`
- Error text: `text-xs text-red-600 mt-1`

### Loading States

- Page-level loading: `loading.tsx` with `Suspense` boundary — use skeleton components
- Inline loading: skeleton matching the shape of the real content (NOT spinners for data loading)
- Action loading (button): replace button text with a spinner icon, disable the button
- Use `Skeleton` component from shadcn/ui

```tsx
// Listing card skeleton — matches real card dimensions
<div className="rounded-card border border-gray-200 animate-pulse">
  <Skeleton className="h-48 rounded-t-card w-full" />
  <div className="p-4 space-y-2">
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-3 w-1/2" />
    <Skeleton className="h-5 w-1/4 mt-2" />
  </div>
</div>
```

---

## 8. Icons

**Package:** `lucide-react`
**Size standard:**

| Context | Size | Class |
|---|---|---|
| Inline with text | 16px | `h-4 w-4` |
| Button icons | 18px | `h-4.5 w-4.5` |
| Navigation icons | 20px | `h-5 w-5` |
| Feature icons (cards) | 24px | `h-6 w-6` |
| Empty state illustrations | 48px | `h-12 w-12` |

**Key icons used consistently across the platform:**

| Feature | Icon |
|---|---|
| Bookings | `CalendarCheck` |
| Inbox | `MessageSquare` |
| Listings | `Home` |
| Reviews | `Star` |
| Payments | `CreditCard` |
| Refunds | `RotateCcw` |
| Settings | `Settings` |
| Subscription | `Crown` |
| Staff | `Users` |
| Calendar | `Calendar` |
| Lock (feature gate) | `Lock` |
| Instant booking | `Zap` |
| Check-in | `LogIn` |
| Check-out | `LogOut` |
| Guest | `User` |
| EFT | `Building2` |
| Verified | `BadgeCheck` |

---

## 9. Navigation

### Host Dashboard (Desktop)
Persistent left sidebar, 240px wide:
- Logo at top
- Nav items grouped: Overview, Listings, Bookings, Calendar, Inbox, Reviews, Payments, Settings
- Subscription badge at bottom (plan name + status)
- Collapse to icon-only at 1024px width

### Host Dashboard (Mobile)
Bottom tab bar with 5 tabs: Home, Bookings, Inbox, Listings, More (→ full menu)

### Guest Navigation
Top navbar: Logo left, Search centre, Login/Account right
Mobile: Top navbar with hamburger

---

## 10. Empty States

Every data view needs an empty state. Structure:

```tsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <IconName className="h-12 w-12 text-gray-300 mb-4" />
  <h3 className="font-display text-lg font-medium text-gray-700">{title}</h3>
  <p className="text-sm text-gray-500 mt-1 max-w-xs">{description}</p>
  {cta && <Button variant="primary" className="mt-4">{cta}</Button>}
</div>
```

Example empty states:
- No bookings: "No bookings yet" / "Bookings will appear here once guests start reserving your listing."
- No listings: "You haven't added a listing yet" / CTA: "Add your first listing"
- No reviews: "No reviews yet" / "Reviews appear here once guests complete their stay."
- No messages: "Your inbox is empty" / "Messages from guests will appear here."

---

## 11. Responsive Breakpoints

Follow Tailwind's default breakpoints — mobile-first:

| Prefix | Min-width | Context |
|---|---|---|
| (none) | 0px | Mobile — always the default |
| `sm:` | 640px | Large mobile / small tablet |
| `md:` | 768px | Tablet |
| `lg:` | 1024px | Desktop (sidebar shows) |
| `xl:` | 1280px | Wide desktop |

### Rules
- Write mobile styles first, then add breakpoint overrides
- Never write desktop-first styles with `max-w` breakpoints
- Dashboard sidebar collapses at `lg:` — below this, use mobile bottom nav

---

## 12. Dark Mode

Dark mode is supported via Tailwind's `class` strategy (toggled by user preference stored in `platform_settings` or browser).

```typescript
// tailwind.config.ts
darkMode: 'class',
```

All custom brand colours must have dark mode variants defined:

```typescript
// In tailwind.config.ts — full brand token set for both modes
colors: {
  brand: {
    primary:   '#1B4D3E',   // light mode: deep green
    secondary: '#F4A836',   // same in both modes
    accent:    '#E8F5E9',   // light mode: light green tint
    dark:      '#0D2B21',   // deepest green — hover states
    light:     '#FAFDF9',   // near-white — page background
  },
  status: {
    confirmed: '#22C55E',
    pending:   '#F59E0B',
    cancelled: '#EF4444',
    completed: '#6366F1',
    draft:     '#94A3B8',
  }
}
```

**Dark mode specific overrides** — add these to the `dark:` variant or CSS variables:

```css
/* In globals.css */
:root {
  --brand-surface:        #FAFDF9;   /* page background */
  --brand-surface-raised: #FFFFFF;   /* card background */
  --brand-text:           #0D2B21;   /* primary text */
  --brand-text-muted:     #4B6358;   /* secondary text */
  --brand-border:         #D1E4DC;   /* default border */
}

.dark {
  --brand-surface:        #0D1F18;   /* dark page background */
  --brand-surface-raised: #132B22;   /* dark card background */
  --brand-text:           #E8F5E9;   /* light text on dark */
  --brand-text-muted:     #7DAF97;   /* muted text on dark */
  --brand-border:         #1E3D31;   /* subtle border on dark */
}
```

**Dark mode Tailwind usage pattern:**

```tsx
// ✅ Correct — use CSS variables for brand surfaces
<div className="bg-[var(--brand-surface)] text-[var(--brand-text)]">

// ✅ Correct — use Tailwind dark: variant for brand colour overrides
<div className="bg-brand-light dark:bg-[#0D1F18] text-brand-dark dark:text-brand-accent">

// ❌ Wrong — hardcoded colour without dark mode consideration
<div className="bg-[#FAFDF9]">
```

For shadcn/ui components, dark mode is handled automatically by the CSS variable system — no manual overrides needed. For custom brand components, always provide the `dark:` variant.

---

## 13. Vilo-Specific Patterns

### Listing Card (Directory)
- Image: `aspect-video` (16:9), `rounded-t-card`, Supabase Storage with transform (400×225, WebP)
- Price: `from R 1,200/night` — always formatted with `formatCurrency()` util
- Rating: filled stars + numeric (e.g. `4.7 (23)`) — only show if at least 1 review
- Verified badge: green `BadgeCheck` icon inline with host name
- Featured badge: `brand.secondary` background, "Featured" text in white
- Instant Book: `Zap` icon + "Instant Book" label in `brand.accent` background

### Booking Reference
Always displayed in monospace: `font-mono text-sm text-gray-600`
Format: `VILO-2026-AB1234`

### Booking Timeline (guest booking detail)
Horizontal step indicator: Pending → Confirmed → Checked In → Completed
Use status colours for active/completed steps.

### Policy Display (cancellation rules)
Render as a vertical timeline with day thresholds:
```
● 5+ days before check-in → Full refund
● 1–4 days before → 50% refund
● Less than 24 hours → No refund
```

### Currency Formatting
Always use `formatCurrency()` from `packages/utils/formatCurrency.ts`:
- ZAR: `R 1 200,00` (space as thousands separator, comma as decimal)
- Never raw numbers: `1200` or `R1200`

---

## 14. shadcn/ui Components in Use

These are the shadcn/ui components installed and customised for Vilo. Never rebuild what shadcn already provides.

| Component | Used for |
|---|---|
| `Button` | All buttons |
| `Input` | Text inputs |
| `Textarea` | Multi-line inputs |
| `Select` | Dropdowns |
| `Checkbox` | Boolean fields, policy acknowledgement |
| `RadioGroup` | Payment method selection |
| `Switch` | Toggle features (instant booking, payment methods) |
| `Dialog` | Modals (confirmation, booking details) |
| `Sheet` | Mobile drawers (filters, booking detail) |
| `Popover` | Date picker trigger, tooltips |
| `DropdownMenu` | Action menus (booking actions, listing actions) |
| `Tooltip` | Feature gate explanations, icon labels |
| `Badge` | Status badges, plan badges |
| `Card` | Layout wrapper |
| `Separator` | Visual dividers |
| `Avatar` | Host + guest profile pictures |
| `Skeleton` | Loading states |
| `Toast` | Via Sonner — all user notifications |
| `Table` | Booking lists, admin tables |
| `Tabs` | Dashboard sections, listing editor |
| `Accordion` | Booking terms, policy details, FAQ |
| `Progress` | Onboarding completion, upload progress |
| `Calendar` | Date picker (booking flow) |
| `Command` | Search dropdown, amenity picker |
| `ScrollArea` | Long lists in fixed-height containers |

---

*When a UI decision isn't covered here, ask — then add the answer to this document.*
