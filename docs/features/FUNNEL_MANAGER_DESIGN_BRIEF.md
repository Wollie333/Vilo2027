# Funnel Manager — UI Design Brief

**For:** Claude Design (UI design)
**Product:** Wielo — a direct-booking management platform for accommodation hosts
and experience operators in **South Africa**. Hosts manage listings, bookings,
calendars and payments; guests book directly (no marketplace commission).
**This project:** a lead-generation **funnel** (public landing pages) feeding a
**sales pipeline** (internal admin CRM board).

This brief is self-contained — you do not need the codebase. Design to the brand
system in §2. Everything is **mobile-first and fully responsive** (phone → tablet →
desktop), no exceptions.

---

## 1. What we're designing (two worlds)

Scope is **two audiences only: Hosts and Affiliates.** (Guests and Competition were
considered and cut — guest accounts are free so there's no sale to work, and
competition was a list-building tactic, not a revenue motion.)

**World A — Public marketing (high conversion):**
1. **Two** landing pages — Hosts and Affiliate Partners
2. A matching thank-you page (shared template) that delivers a brochure + video

**World B — Internal admin (staff-facing, dense, functional):**
3. A "Pipeline" kanban board (sales CRM)
4. A lead detail **full record page** (not a drawer)

World A is bold, warm, conversion-focused. World B is calm, information-dense,
dashboard-like. Both use the same brand palette but different density.

---

## 2. Brand system (use exactly)

**Colours (emerald/green brand):**
- `brand-primary` **#10B981** — primary CTAs, links, active states
- `brand-secondary` **#064E3B** — emphasis, headings on light
- `brand-accent` **#D1FAE5** — hover, badges, soft fills
- `brand-light` **#F0FDF4** — page background (light)
- `brand-dark` **#0A1510** — hero backgrounds, footer
- `brand-ink` **#052E1F** — body text
- `brand-mute` **#4A7C6A** — secondary/muted text
- `brand-line` **#DCEAE0** — borders/dividers
- Brand gradient exists but use it on **at most one** hero element / the logo —
  **never on buttons or page backgrounds.**

**Typography:**
- Display (h1–h3, hero, big KPI numbers): **Plus Jakarta Sans**
- UI / body: **Inter**
- Mono (reference codes, IDs): **JetBrains Mono**

**Shape & depth:**
- Radius: default 10px; cards 16px (`rounded-card`); pills fully rounded
- Shadows: soft, single-layer only (a card shadow, a lift on hover) — never stack
- Icons: **lucide-react** style, 1.5px stroke, line icons only

**Currency:** South African Rand, format `R1 234` (space thousands separator).

**Tone:** confident, warm, plain-spoken, benefit-led. South African audience —
avoid US idioms. "Keep 100% of your booking money" is the core host promise
(Wielo takes no commission).

---

## 3. Landing pages (World A) — shared anatomy

Both share one responsive template; only copy, imagery, resource and CTA change.
Design the **template** once, then show the two variants' hero + form copy.

**Above the fold (single screen on mobile):**
- Compact top bar: Wielo logo left; one subtle link right (no full nav — this is a
  focused funnel page, minimise exits).
- **Two-column on desktop, stacked on mobile:**
  - Left: headline (display font), 1-line subhead, 3 benefit bullets with small
    line-icons, a trust strip (e.g. "No commission • Direct bookings • Made in SA").
  - Right: the **lead capture card** (elevated, `rounded-card`, `shadow-lift`):
    - Fields: Full name, Email, Phone, Establishment address *(optional — label it
      optional; shown on the Host variant, hidden on the Affiliate variant)*.
    - A **marketing-consent checkbox** (not pre-ticked): "Yes, send me tips and
      offers from Wielo. Unsubscribe anytime." — small, clearly separate from the
      submit button.
    - Primary button (brand-primary, full-width): e.g. "Get the free host guide".
    - Micro-reassurance under the button: "No spam. POPIA-compliant. Unsubscribe
      anytime."
- Design **form states:** default, focused field, inline validation error (email
  required), loading/submitting (button spinner), success (brief before redirect).

**Below the fold (lightweight, scannable — this is a funnel, keep it short):**
- A "what you'll get" row (3–4 cards: the brochure, the video, + benefit).
- A social-proof band (logos / a short testimonial / a stat).
- A closing CTA that scrolls back to / re-focuses the form.
- Minimal footer (legal links: Privacy, Terms, Unsubscribe).

**The two variants — hero copy direction (design placeholder copy):**
| Variant | Audience & goal | Hero angle | Primary CTA |
|---|---|---|---|
| Hosts | Property/experience owners → nurture to become a paying host | "List once. Keep 100%. Book direct." | "Get the free Host Guide" |
| Affiliate | Partners → join **and start promoting** the Wielo app, earn recurring commission | "Refer Wielo. Earn recurring commission." | "Get the Partner Pack" |

Give each a distinct hero image mood but the **same layout** (Host = a welcoming
guesthouse; Affiliate = partnership/earnings). Keep the green brand consistent across
both.

---

## 4. Thank-you page (World A) — shared template

Reached after a successful submit. Warm confirmation + **immediate resource
delivery** (we also email it).
- Success header with a check mark: "You're in! Here's your [resource]."
- **Resource block, front and centre:**
  - An embedded **video player** (16:9, responsive). The video may be either a
    Wielo-hosted file or an embedded **YouTube** video — design one player frame
    that works for both (show a YouTube play affordance state too).
  - A prominent **"Download the brochure (PDF)"** button (the PDF lives in Wielo's
    media library).
  - "We've also emailed these to you" note.
- A single **next-step CTA** tailored per audience (Host → "Start your free host
  account"; Affiliate → "Join the partner program & get your link").
- Optional: a lightweight "while you're here" strip (3 links).
- Same minimal footer.

Design the success/loading/empty states of the video + download block.

---

## 5. Pipeline board (World B) — admin kanban

Internal sales tool inside the Wielo admin. Calm, dense, dashboard-grade. Sits in an
existing admin shell with a left sidebar (design **only the main content area**;
assume a ~240px sidebar + top header exist).

**Header row of the page:**
- Title "Pipeline" + a short subtitle.
- **Audience tab switcher** (segmented control): Hosts · Affiliates. Each tab is its
  own board with its own stages.
- Right side: filters (owner, **source** — including a "Competition" segment for an
  at-a-glance overview of competition-sourced leads — UTM, date, search) + a small
  KPI cluster (New today · In progress · Won this month · Conversion %).

**The board:**
- Horizontal scroll of **stage columns**. Host stages: `New → Contacted → Qualified
  → Demo booked → Nurturing → Won → Lost`. Affiliate stages: `New → Contacted →
  Joined → Nurturing → Won (actively promoting) → Lost`. Column header shows stage
  name + lead count + (optional) total value.
- **Lead cards** (draggable between columns — design the drag/hover/placeholder
  states):
  - Line 1: lead name (display font) + a small source chip.
  - Line 2: email · phone (muted).
  - A row of tiny meta: owner avatar/initials, a **lead-score pill** (Hot/Warm/Cold
    via colour), days-in-stage, an **SLA warning badge** if untouched too long.
  - **Source badges (important — design these distinctly):**
    - Affiliate-referred lead → a subtle **"via [affiliate name]"** tag.
    - **Competition lead → a distinct, eye-catching **"🏆 [Competition name]"**
      badge** (different colour family from the affiliate tag) so staff instantly
      see it came from a competition.
  - **"Auto off" indicator** — a small muted pill (e.g. a struck-through envelope)
    on cards whose automated drip is **suppressed** (competition leads already get
    their own emails elsewhere). It must read clearly as "we are NOT auto-emailing
    this person."
  - Subtle nurture indicator for *enrolled* leads (e.g. an envelope with "3/5" =
    drip step) — mutually exclusive with the "auto off" pill.
- Design **empty column**, **loading (skeleton cards)**, and **drag-in-progress**
  states. Also design a card in all three source flavours: plain funnel lead,
  affiliate-referred, and competition (with the 🏆 badge + "auto off" pill).

Colour discipline: the board is mostly neutral/`brand-light`; use `brand-primary`
sparingly for active tab, primary actions, and the Won column accent. Score pills:
Hot = warm red/amber, Warm = amber, Cold = grey — keep readable, not garish.

---

## 6. Lead detail — full record page (World B)

**Not a drawer or modal — a full record page** (its own route, e.g.
`/admin/pipeline/[leadId]`) that a card click navigates to. It lives inside the same
admin shell (sidebar + top header); design the main content area as a full-width
record, with a back-to-board link and breadcrumb at the top. Two-column content on
desktop, single column stacked on mobile.

- **Page header (full width):** lead name (display font), audience chip, current
  stage with an inline stage-move control, assigned owner (assignable), and a
  right-aligned quick-action cluster (Move stage · Assign · Mark Won/Lost · Send
  email). Below it a compact status strip: lead score, days in pipeline, source
  (with the competition badge where relevant), UTM, consent + unsubscribe status, and
  **affiliate attribution with a small "commission owed to [affiliate]" note** — a
  reminder that our sales/automation work never changes what the affiliate is owed.
- **Main column (left, ~2/3):**
  - Contact block: email, phone, establishment address (each with a copy/click
    affordance).
  - **Activity timeline** (vertical, newest first): emails sent (with which drip
    step), stage moves, notes, logged calls, "converted" — each with icon, actor,
    timestamp.
  - A note composer + "Log a call" action + "Send a one-off email".
- **Side column (right, ~1/3):**
  - Nurture status card (which sequence, step X/Y, next send time, or
    "unsubscribed"), key facts, and any SLA / needs-attention flags.

Design: the full-page layout at desktop and mobile (stacked, timeline below
contact), timeline item variants (email / stage / note / call / system), and the
note composer states. No drawer/sheet treatment.

---

## 7. Responsive & states checklist (apply to every screen)

- Verify layouts at **~375px (phone), ~768px (tablet), ~1280px (desktop).**
- Landing/thank-you: single column on phone, form card moves below the hero copy;
  tap targets ≥44px; images `object-fit` cover, never overflow.
- Board: on phone, columns become horizontally swipeable OR collapse to a single
  filtered list with a stage selector (propose the better mobile pattern).
- Every interactive screen needs: **default, hover/focus, loading (skeleton),
  empty, error, success** states.
- Light theme is primary. (A dark variant is nice-to-have, not required.)

---

## 8. Deliverables requested from Claude Design

1. Landing page **template** + the two hero/form variants — Hosts and Affiliate
   (desktop + mobile).
2. Thank-you page template (desktop + mobile) with the resource block states.
3. Pipeline board (desktop + mobile), including card + column + drag states.
4. Lead detail **full record page** (desktop + mobile, stacked) with timeline item
   variants.
5. A small **component sheet**: buttons, form fields (+states), checkboxes, chips/
   pills (audience, score, source), badges (SLA, nurture), avatars, the segmented
   audience switcher, skeletons.

Keep everything on the brand system in §2 so it drops straight into the existing
Wielo UI (Tailwind `brand-*` tokens, Plus Jakarta Sans / Inter, lucide icons,
`rounded-card`, soft single-layer shadows).
