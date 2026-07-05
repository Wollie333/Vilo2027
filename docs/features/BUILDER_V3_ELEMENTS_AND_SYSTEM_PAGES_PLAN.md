# Builder V3 — true elements/sections, system-page /book + thank-you, CMS UI polish

> **Founder brief captured 2026-07-05 (save point — NOT yet started).** This is the
> verbatim issue log + plan from the founder's message, grouped for a fresh session.
> Everything here is TODO. Reference model throughout: **Elementor**, and how it
> handles WooCommerce blocks (dynamic data + skinned default + user styling override)
> and its element/section/column drag model.

---

## Group 1 — System pages must BE the real live pages (/book + thank-you)

**The problem (founder, with screenshots):**

- The Page Manager "System templates" table lists a page called **`/checkout`**, but
  the REAL website checkout runs on **`/book`** (e.g. the live link the founder gave:
  `https://vilotest.wielo.co.za/book?property=0b222222-2222-4222-8222-222222222221&special=0b5ec000-0000-4000-8000-0000000000a2`).
- `/book` is what actually serves the booking/checkout (the `SiteCheckoutForm`), yet
  it does **NOT exist** in the Page Manager table → the host can't edit it.
- Same for **Thank you**: the thank-you row in the Page Manager is NOT the live page
  users see / that serves the dynamic content.

**What to build:**

1. **Remove the `/checkout` system page; seed the real system page as `/book`** so the
   Page Manager row maps to the ACTUAL live checkout route. Editing that row edits the
   real page. (Live route today: `app/[locale]/site/book/page.tsx` +
   `SiteCheckoutForm.tsx`.)
2. **A "Booking form" builder ELEMENT** that lives inside the `/book` page and handles
   the booking. The functional component ALREADY EXISTS (`SiteCheckoutForm`). Wrap it
   as a styleable builder element:
   - Dynamic data is pulled from the system (rooms/price/add-ons/availability) — the
     host does NOT edit data, only STYLING.
   - Default styling is skinned by the ACTIVE THEME; the host can OVERRIDE the skin.
   - Styleable pieces (per Elementor/WooCommerce-block model): **field borders, add-on
     cards, title, price colour, summary box**, buttons, section spacing, etc. — each
     sub-part gets its own `--el-*`-style override.
   - The host can move/re-order and customise this page like any other builder page.
3. **A "Thank you" builder element** — same principle: dynamic booking-confirmation
   data from the system, theme-skinned default, host edits STYLING only. Make the
   Page Manager "Thank you" row edit the REAL live thank-you page.

**Key insight the founder stressed:** these elements ALREADY EXIST functionally — the
work is exposing them as builder elements with styling controls (the `--el-*` engine +
the unified controls already exist), and making the system-page rows point at the real
live routes so they're editable.

---

## Group 2 — Elements vs Sections: the core builder refactor (Elementor-style)

**The problem:** dragging a BASIC element (Button, Video, Heading, etc.) into the
builder currently creates a full **SECTION** with big padding + white space — not a
standalone element. Screenshots: a "Button · Book a room" drags in as a whole Section
band; the video element behaves like a video SECTION with huge margins.

**What to build:**

1. **Basic elements become TRUE standalone elements**, not sections. Dragging a lone
   Button (or Video, Heading, …) to the bottom of the page should create that ELEMENT
   **inside a section** — the system auto-wraps it in a section, but the thing the host
   added is the element, editable as an element (no giant band padding).
2. **Refine Section + Inner Section (Layout category)** so THEY own padding/margins and
   alignment: column + flex settings (direction / justify / align / gap / wrap) — like
   Elementor's section/column/flex containers. Sections are the layout containers;
   elements live inside them.
3. **Video element specifically:** default to **NO padding / NO margin**; give the host
   a control for the **video SIZE** within the element. Today it renders as a video
   *section* (hence the excess spacing) — make it a standalone element.
4. Goal (founder's words): "a more refined, more robust designer with element and
   sections working together" — elements-inside-sections, sections own spacing/layout.

**Where this lives:** `lib/website/pageDoc.schema.ts` (section→column→widget model),
`lib/website/widgets/registry.ts` (widget defs + which are elements vs sections),
`components/site/sections/Elements.tsx` + `_shared.tsx` (element render + `--el-*`),
`app/[locale]/builder/BuilderShell.tsx` (drag/drop → node creation, palette).
NOTE: earlier work reframed Wielo blocks "bare" (section owns band/padding) — build on
that; the gap is the BASIC elements + the drag-creates-a-section behaviour.

---

## Group 3 — CMS control-panel UI polish (Page Manager + ALL tabs)

**3a. Row actions menu disappears.** On the Pages tab, the row `⋯` actions dropdown
(Edit / Delete / **Duplicate page**) is cut off / disappears, so the host can't edit or
delete a page. (Screenshot: the "Duplicate page" menu is clipped under the row.) Fix the
dropdown so it renders above/escapes the row clip (portal + z-index, or fix the
overflow clip on the table/card).

**3b. White background between/behind tabs + tables.** There's a WHITE background behind
and between the tabs and the tables that should be the SAME uniform light-grey as the
rest of the panel (the "A" area is the correct light grey). The white patches (arrows in
the screenshots) look wrong — should be transparent/uniform grey. **This applies to ALL
tabs** (Pages, Media, Blog, Navigation, Forms, Domain, SEO, Settings), not just Pages.
Find the stray `background: #fff` on the tab/table wrappers and make it uniform.

Location: `app/[locale]/dashboard/website/[websiteId]/...` tab pages + their shared
layout/CSS.

---

## Group 4 — Builder UX

**4a. Collapsible widget categories.** In the builder's Widgets panel, let the host
COLLAPSE the widget groups under their headings (LAYOUT, BASICS, Wielo Elements, …) so
the palette is tidy. (`BuilderShell.tsx` widget palette.)

**4b. Delete → Widgets panel.** When the host DELETES an element or section, the sidebar
must go to the **Widgets** panel, not Settings. (Deselect-returns-to-Widgets was already
fixed via `selectNode(null) → setMode("widgets")` in commit `8bd394e7`; the DELETE path
still needs the same — after deleting the selected node, call the same reset.)

---

## Suggested execution order (fresh session)

1. **Group 3** (CMS UI: actions menu + uniform grey) — quick, high-visibility, low-risk.
2. **Group 4** (collapsible palette + delete→widgets) — quick builder UX.
3. **Group 2** (elements vs sections refactor) — the big one; do it before Group 1 so the
   booking-form element has the true-element model to sit in.
4. **Group 1** (/book + thank-you system pages + booking-form/thank-you elements) —
   depends on the element model + `--el-*` styling being solid.

Each group ends green (tsc + lint + 229 vitest) and is committed + pushed. Verify in the
builder canvas AND live per BUSINESS_PRINCIPLES.md Principle #9 (dev harnesses at
`/dev/rooms`, `/dev/search`, `/dev/chrome` help; add one for `/book` styling).
