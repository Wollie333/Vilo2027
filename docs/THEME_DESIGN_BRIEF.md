# Wielo CMS — Theme Design Brief (paste into Claude)

> Copy everything inside the horizontal rules below into a Claude conversation,
> then paste/attach your existing theme design. Claude will return a COMPLETE
> theme package that drops into the Wielo Website CMS with minimal conversion work.

---

You are designing a **theme** for the **Wielo** website CMS — a direct-booking
website builder for accommodation hosts (guesthouses, lodges, B&Bs). I will give
you my existing design; your job is to **complete it** so it covers every page,
section, and state the CMS requires, and to deliver it in a format that maps
cleanly onto the CMS's building blocks.

Read this whole brief first, then produce the deliverables in the **Output**
section. If my existing design is missing any required page or section, design it
in the same visual language. Do not invent new page types or new "elements" — the
CMS has a fixed catalogue (below); every visual block must map to one of them.

## 1. How the CMS works (so your design fits it)

A Wielo theme has exactly **two layers**:

1. **A design "base"** — a palette (7 colours), a heading font + a body font, and
   a corner radius. Everything visual derives from these.
2. **A render of pre-built SECTION types** — the host builds pages by stacking
   curated *sections* (hero, gallery, rooms, reviews, etc.). A theme styles each
   section type in its own look. The SAME section types appear on every page and
   on every theme — only the styling changes.

So: **you design the LOOK of a fixed set of sections + pages.** You are NOT
building a bespoke one-off site. Think "a beautiful, opinionated styling of these
specific blocks," like a high-end Squarespace template.

**Content rules:**
- Some sections are **data-driven** — the CMS auto-fills them from the host's real
  data (rooms, photos, reviews, specials, prices, availability). For these, design
  with realistic *placeholder* content **and** design a graceful **empty state**
  (what shows when the host has none yet). Mark these clearly.
- The rest are **editable** — the host types the text / picks the image.

## 2. The design-token contract (drive ALL styling from these)

Define your theme's base and express **every** colour/font/radius in your CSS as a
CSS variable with a hard fallback, e.g. `color: var(--site-ink, #221a11)`. This is
what makes the theme themeable + consistent. The CMS injects these at runtime:

**Palette (you choose the 7 hex values):**
- `--site-bg` — page background
- `--site-surface` — cards / raised panels
- `--site-ink` — primary text
- `--site-mute` — secondary text
- `--site-line` — borders / dividers
- `--site-accent` — buttons, links, highlights (the brand colour)
- `--site-accent-ink` — text/icon ON TOP of the accent (for contrast)
- `--site-secondary` + `--site-secondary-ink` — optional secondary accent

**Typography:**
- `--site-font-heading`, `--site-font-body` — the two font families
- `--site-h1 … --site-h6` — heading sizes; `--site-text-base`, `--site-text-sm`,
  `--site-text-accent` — body/label sizes
- `--site-weight-heading`, `--site-weight-body`, `--site-leading-heading`,
  `--site-leading-body`, `--site-tracking-heading`, `--site-tracking-body`

**Shape + components:**
- `--site-radius` — global corner radius
- `--site-btn-primary-{bg,color,border,radius}` and
  `--site-btn-secondary-{bg,color,border,radius}` — button styling
- `--site-card-{border,radius,shadow,ratio}`, `--site-img-{border,radius,shadow}`
- `--site-icon-color`, `--site-social-{bg,fg,border,radius}`

Also state your base as a small spec block I can read directly:
```
palette: { bg, surface, ink, mute, line, accent, accentInk }   // 7 hex values
headingFont: "<family>"   bodyFont: "<family>"   (name the Google/system fonts)
radius: none | sm | md | lg | xl     // global corner style
```

## 3. Required PAGES (design a full mockup of EACH)

Two classes. **Marketing pages** appear in the nav and vary their content/order.
**System templates** are auto-driven and have a fixed structural spine (so the
booking engine binds to them) — style them, but keep the listed sections present.

### Marketing pages (all required except Blog)
| Page | Sections it should contain (in your visual order) |
| --- | --- |
| **Home** | hero · (optional inline booking-search) · intro · highlights · rooms_preview · specials_preview · gallery · reviews/trust · location · cta |
| **About** | hero · intro · host_bio · highlights · gallery |
| **Rooms / Suites** | intro · rooms_preview · amenities · rate_table (or pricing) · cta |
| **Specials** | intro · specials_preview (full grid) · cta |
| **Experiences** | hero/intro · highlights · gallery · cta |
| **Gallery** | intro · gallery (full / masonry) · cta |
| **Contact** | intro · form · location · faq |
| **Blog / Journal** *(optional)* | intro · blog_preview, plus a single **blog post** article layout (cover, title, standfirst, body prose, author) |

### System templates (required — fixed spine, your styling)
| Template | Spine to style |
| --- | --- |
| **Search results** | a search form (dates + guests) ABOVE a results list of available rooms/properties (card: name, price, "from N nights", Book button) + an empty/"no availability" state |
| **Room detail** | room_gallery (photo mosaic + lightbox) · room_overview (name, facts, price) · room_amenities · room_rate (Book CTA) · room_policies · a cross-sell rooms_preview |
| **Checkout** | a booking form: date range · room/guest selectors · **add-ons list (cards: image, name, description, price, quantity)** · guest details · **"who else is coming" extra-guest rows** · coupon field · payment-method choice · a sticky price **summary** panel |
| **Thank-you** | confirmation hero · booking summary · next-steps |

## 4. Required SECTION TYPES (style every one your theme uses)

Each block on your pages must be one of these. Style each at least once. **(D)** =
data-driven (placeholder + empty state). Variants in brackets — support them or
pick your strongest.

**Structure / opening**
- `hero` — full-bleed banner: headline, subheadline, 1–2 CTAs, optional stat
  strip, optional eyebrow. [fullscreen · split-left · split-right · compact]
- `intro` — a lead paragraph block, often with an eyebrow + side image/badge.
  [centered · split · lead]
- `cta` — conversion banner: heading, body, button. [banner · card · split]

**Marketing / proof**
- `highlights` — 3–4 feature/experience cards (icon, title, body). [grid · list]
- `stats` — a number band (value + label) ×3–4. [band · cards · plain]
- `host_bio` — the host/owner intro (photo, name, story, bullet points).
- `values` — brand values/promises. [border · cards · numbered]
- `amenities` — amenities grid (icon + label).
- `reviews` **(D)** — guest review cards (rating, quote, name, date) + aggregate score.
- `trust` **(D)** — trust badges + an optional live "★ 4.9 · 128 reviews" score.
- `logos` — partner/award logo row. `faq` — accordion Q&A. `pricing` — a simple
  price table. `rich_text` — a styled prose block. `video` — an embedded video.

**Accommodation + booking (D)**
- `rooms_preview` **(D)** — room cards (photo, name, guests, price, "View/Book"). The
  core of the site.
- `gallery` **(D)** — property photo gallery (grid / masonry / carousel) + lightbox.
- `location` **(D)** — address + map embed + nearby points of interest.
- `specials_preview` **(D)** — special-offer cards (image, title, badge, was/now price,
  "save X%", "N left", Book).
- `addons_preview` **(D)** — extras/add-on cards (image, name, description, price + unit
  like "per night"/"per guest").
- `booking_search` **(D)** — a date + guest search widget → availability + price.
- `availability_calendar` **(D)** — a month calendar with booked dates greyed out.
- `rate_table` / `room_rates` / `seasonal_pricing` **(D)** — nightly + seasonal rate tables.
- `blog_preview` **(D)** — blog post cards (cover, title, excerpt, date).

**Room-detail (D, render a single room)**
- `room_gallery`, `room_overview`, `room_amenities`, `room_rate`, `room_policies`.

**Forms**
- `form` / `contact_form` — a styled form (text/email/phone/textarea/select/
  checkbox/date fields, submit button, success state).

**Utility building blocks** (style minimally — these are layout primitives)
- `el_heading`, `el_text`, `el_image`, `el_button`, `el_spacer`, `el_divider`,
  `columns` (1–4 column row), `flex` (flex row of the above).

## 5. The CHROME — header, navigation, footer

Design these to honour the host's configurable options (the CMS exposes controls
for all of them; your styling must visually support each):

**Header / nav**
- Logo as wordmark OR image mark, with positions: classic (logo left, menu
  centre/right), centered, split, minimal.
- A primary menu with **dropdown sub-menus**, hover/active states, and a **mobile
  collapse** (hamburger → drawer).
- A **"Book now" CTA** button in the header (own colour).
- **Sticky** header option, and a **transparent-over-hero** option that switches to
  a solid background on scroll — so design **TWO header states**: (a) transparent
  over a dark hero (light text), (b) solid/scrolled (dark text on surface).
- An optional thin **announcement/top bar** above the header.

**Footer**
- Light AND dark variant. Brand blurb + logo. 2–4 **link columns**. Optional
  **newsletter** signup. Social icons. A legal/copyright row.

## 6. Output — what to deliver

Deliver a single theme package. **Static HTML + CSS** (no build step, no
frameworks). I convert it to the CMS's render layer; you do NOT need React.

1. **One HTML file per page** from §3 (home, about, rooms, specials, experiences,
   gallery, contact, blog + blog-post, search-results, room-detail, checkout,
   thank-you). Full, realistic placeholder content in every section.
2. **One CSS file** (`theme.css`) with **every selector scoped under a single root
   class** `.wielo-theme` (e.g. `.wielo-theme .hero { … }`). Drive all
   colours/fonts/radius from the `--site-*` variables (§2) with hard fallbacks.
   Put your chosen palette/fonts in a `.wielo-theme { --site-bg: …; … }` block at
   the top so the theme renders standalone.
3. **header.html + footer.html** (or a clearly-marked section in each page) showing
   BOTH header states + the footer.
4. **A short `base.md`** stating the palette (7 hex), the two font families (name
   them so I can load them), and the radius choice.

**Conventions (important for clean conversion):**
- **Annotate every section block** with the CMS type:
  `<section data-section="hero"> … </section>`. Use the exact type names from §4.
- Mark data-driven blocks: `data-section="rooms_preview" data-live="true"`, and
  include a commented empty-state markup right after, e.g.
  `<!-- empty: "Your rooms will appear here" -->`.
- **No external JavaScript.** If a block needs interaction (lightbox, calendar,
  sticky header, mobile drawer, dropdowns), just describe it in an HTML comment —
  I implement the behaviour. Static markup + CSS only.
- **Responsive:** design desktop, tablet, and mobile; use CSS `@media` queries (no
  JS layout). Mobile must be excellent — most guests book on phones.
- Realistic copy in the host's *voice* for the theme (e.g. a safari lodge sounds
  different from a city B&B) — I keep it as the stock content until the host edits.
- Accessible: semantic tags, alt text, sufficient contrast, focus states.

## 7. Completeness checklist (verify before sending back)

- [ ] All 12 page mockups present (home/about/rooms/specials/experiences/gallery/
      contact/blog+post/search-results/room-detail/checkout/thank-you).
- [ ] Every section type my pages use is styled; data-driven ones have an empty state.
- [ ] Header in BOTH states (transparent-over-hero + solid) + mobile drawer; footer
      in light + dark.
- [ ] All colour/font/radius values come from `--site-*` vars with fallbacks.
- [ ] Every section block annotated with `data-section="<type>"`.
- [ ] `theme.css` fully scoped under `.wielo-theme`. `base.md` lists palette + fonts
      + radius. No external JS.
- [ ] Looks great on mobile.

Now: here is my existing design — please complete it to this brief and return the
full package.

---
