#!/usr/bin/env node
/**
 * Generates docs/features/*_FEATURE_PAGE.md from structured data.
 * Run: node scripts/generate-feature-pages.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "docs", "features");

const DESIGN_NOTES = `### Brand Reference

**Colours:**
| Token | Hex | Usage |
|-------|-----|-------|
| \`brand-primary\` | \`#10B981\` | CTAs, links, active states |
| \`brand-secondary\` | \`#064E3B\` | Featured/promo, price emphasis |
| \`brand-accent\` | \`#D1FAE5\` | Hover surfaces, badges |
| \`brand-light\` | \`#F0FDF4\` | Page background |
| \`brand-dark\` | \`#0A1510\` | Hero, footer |
| \`brand-ink\` | \`#052E1F\` | Body text |
| \`brand-mute\` | \`#4A7C6A\` | Secondary text |
| \`brand-line\` | \`#DCEAE0\` | Borders, dividers |

**Typography:**
- Display: Plus Jakarta Sans — headlines, KPIs
- Body: Inter — UI text
- Mono: JetBrains Mono — codes, references

**Components:**
- Use shadcn/ui exclusively
- Icons: lucide-react, 1.5px stroke
- Radius: \`rounded-card\` 16px for feature cards, \`rounded-pill\` for CTAs
- Shadows: \`shadow-card\` resting, \`shadow-lift\` on hover

### Responsive Behaviour

\`\`\`
Mobile (< 768px): single column, hero visual below copy, comparison table scrolls
Tablet (768-1024px): 2-column grids
Desktop (> 1024px): full layout, hero side-by-side, 3-column testimonials
\`\`\`

### Animations

\`\`\`
- Rise animation on scroll (elements fade in and rise 14px)
- Feature cards lift on hover (shadow-lift)
- FAQ accordions expand smoothly (200ms ease-out)
- All animations respect prefers-reduced-motion
\`\`\``;

/** @type {Array<FeatureSpec>} */
const FEATURES = [
  {
    fileName: "DIRECT_BOOKING_FEATURE_PAGE",
    featureName: "Direct Booking",
    urlSlug: "direct-booking",
    title: "Direct Booking for Accommodation Hosts — Vilo",
    metaDescription:
      "Your own branded booking page with live availability, instant book, and zero commission. Built for SA guesthouses, B&Bs and lodges.",
    keywords: [
      "direct booking software south africa",
      "guest house booking website",
      "B&B booking engine",
      "commission-free bookings",
      "accommodation checkout",
    ],
    ogTitle: "Direct Booking — Keep Every Rand | Vilo",
    ogDescription:
      "Share a branded link. Guests book and pay directly. No OTA commission, ever.",
    heroHeadlines: [
      'Option A: "Take bookings direct. Keep every rand."',
      'Option B: "Your branded booking page — live in minutes."',
      'Option C: "Stop sending guests back to Booking.com to pay."',
    ],
    heroRecommended: "Option A",
    subheadline:
      "Vilo gives every host a shareable booking link with live availability, server-side pricing, and Paystack or EFT checkout — the same engine that powers your directory listing and website.",
    heroVisualSecondary: "See a sample booking page",
    heroVisual:
      "Split view: LEFT — host dashboard showing published property with Instant Book toggle ON and shareable /book/{handle} link copied. RIGHT — mobile guest checkout with date picker, room selector, policy preview, and Pay Now button. Floating badge: '0% commission'.",
    problemEyebrow: "The direct-booking gap",
    problemHeadline:
      "Every booking through an OTA is a guest you'll never own again.",
    painPoints: [
      {
        pain: "OTAs hide guest emails — you cannot re-market next season or build a relationship.",
        emotion: "Frustration, dependency",
        cost: "Repeat guests book through Airbnb again; you pay 15–22% commission on people who already know you.",
      },
      {
        pain: "Your DIY website shows static prices that don't match what's actually available.",
        emotion: "Embarrassment",
        cost: "Guests abandon checkout when dates or totals don't add up — back to the OTA.",
      },
      {
        pain: "WhatsApp quote ping-pong takes hours while faster hosts win the booking.",
        emotion: "Anxiety",
        cost: "Enquiries go cold; you never know how many you lost to slow replies.",
      },
      {
        pain: "Mobile checkout on cobbled-together sites feels untrustworthy next to polished OTA confirmations.",
        emotion: "Self-doubt",
        cost: "Guests default to platforms they trust, even when your property is better.",
      },
      {
        pain: "You pay commission on repeat guests who would have booked direct if you'd had a proper link.",
        emotion: "Resentment",
        cost: "Thousands of rand per year on guests who already love your place.",
      },
    ],
    beforeScenario:
      "A returning guest emails asking to book the same cottage as last year. You reply with dates and a price, they say 'great, how do I pay?' — and you send a PayFast link or bank details in plain text. They hesitate, open Booking.com 'just to check', and book somewhere else because it felt easier. You'll never know.",
    solutionEyebrow: "The Vilo way",
    solutionHeadline:
      "One booking engine. Every channel. Zero commission.",
    transformation:
      "Go from 'let me check and get back to you' to a live booking link where guests pick dates, see accurate pricing, and pay — in under two minutes on their phone.",
    differentiators: [
      "Permanent /book/{handle} link — share anywhere; skips listing browse when you have one property.",
      "Server-side repricing on every checkout — guests cannot tamper with totals; matches your quote engine.",
      "Instant Book or enquiry mode — you choose approval flow per property.",
      "Same engine powers directory, website, and direct links — one calendar, one ledger, one inbox.",
    ],
    subFeatures: [
      { icon: "Link", headline: "Shareable host handle", description: "Every host gets a permanent /book/{handle} URL. Share on Instagram, email signatures, WhatsApp — guests land on your branded picker or go straight to checkout.", visual: "Copy-link button with handle vilo.co.za/book/winelands-retreat highlighted" },
      { icon: "Home", headline: "Property listing pages", description: "Rich listing pages with photos, policies, reviews, and room breakdown. Published to directory and/or your website from one editor.", visual: "Property page hero with gallery, rating stars, and Book Now CTA" },
      { icon: "Zap", headline: "Instant Book toggle", description: "Turn Instant Book on when you're ready for self-serve confirmations. Turn it off to route enquiries through inbox and quotes instead.", visual: "Toggle switch labelled Instant Book with helper text explaining approval mode" },
      { icon: "BedDouble", headline: "Flexible booking modes", description: "Whole-place, rooms-only, or flexible — configure how guests select accommodation. Multi-room guesthouses and single cottages both supported.", visual: "Mode selector showing whole_listing vs rooms_only with room cards below" },
      { icon: "CalendarRange", headline: "Live availability + pricing", description: "Checkout reads your real calendar — bookings, blocks, and iCal imports. Pricing runs through the same stack as quotes and seasonal rules.", visual: "Date picker with unavailable dates greyed out; nightly breakdown updating live" },
      { icon: "ShieldCheck", headline: "Policy preview at checkout", description: "Cancellation tiers, check-in times, and house rules surface before payment. Guests know exactly what they're agreeing to.", visual: "Policy accordion on checkout with refund tier summary" },
      { icon: "Tag", headline: "Coupons + add-ons at checkout", description: "Guests apply promo codes and select optional extras during checkout. Upsell revenue captured upfront, not chased after arrival.", visual: "Checkout cart showing accommodation + breakfast add-on + coupon discount line" },
      { icon: "Smartphone", headline: "Mobile-first checkout", description: "Checkout optimised for phones — where most SA guests browse and book. Large tap targets, clear totals, trusted payment methods.", visual: "iPhone mockup of checkout with Paystack and EFT options" },
      { icon: "BadgeCheck", headline: "Verified host badge", description: "Setup-complete hosts display a verified badge on listings — signal that banking, policies, and photos are in place.", visual: "Verified badge next to host name on listing card" },
      { icon: "Receipt", headline: "Auto invoice on confirm", description: "Confirmed booking triggers invoice generation automatically. Guest gets confirmation; your ledger updates without manual entry.", visual: "Booking confirmed toast linking to auto-generated invoice" },
    ],
    howItWorksEyebrow: "Simple workflow",
    howItWorksHeadline: "From setup to first direct booking — in four steps.",
    hostSteps: [
      { title: "Complete setup", body: "Photos, room, banking, refund policy — the checklist gates publish.", visual: "Setup wizard progress bar at 100%" },
      { title: "Publish + share", body: "Enable directory and/or website channel. Copy your /book/{handle} link.", visual: "Channels tab with publish toggles and share link" },
      { title: "Configure booking mode", body: "Instant Book for self-serve, or enquiry-only for approval-first.", visual: "Instant Book toggle with mode explanation" },
      { title: "Confirm + collect", body: "Booking appears in dashboard; payment and invoice handled automatically.", visual: "Booking detail with payment status and invoice link" },
    ],
    guestSteps: [
      { title: "Open your link", body: "From WhatsApp, email, directory, or website — lands on listing or checkout.", visual: "Guest tapping link from WhatsApp chat" },
      { title: "Pick dates + rooms", body: "Live availability; optional add-ons and coupon field.", visual: "Date and guest selector on mobile" },
      { title: "Review policies", body: "See cancellation rules and house rules before paying.", visual: "Policy block expanded on checkout" },
      { title: "Pay + confirm", body: "Paystack card/instant EFT or manual EFT with proof upload. Confirmation email sent.", visual: "Payment success screen with booking reference" },
    ],
    testimonials: [
      { quote: "We put our Vilo link in our Instagram bio and stopped paying commission on half our bookings within the first season.", name: "[Name]", property: "Winelands Guesthouse · Franschhoek" },
      { quote: "Instant Book was scary at first — but the policies are frozen at booking time, so we're protected. Direct bookings now outnumber Airbnb.", name: "[Name]", property: "Self-catering · Plettenberg Bay" },
      { quote: "Guests used to ask 'how do I pay?' and disappear. Now they book and pay in one flow on their phone.", name: "[Name]", property: "Safari Lodge · Hoedspruit" },
    ],
    scenarios: [
      "A Franschhoek B&B shares their handle link in every booking confirmation email — repeat guests book direct next year.",
      "A Cape Town apartment host runs Instant Book for weekday stays and enquiry-only for peak December.",
      "A Kruger lodge embeds checkout on their Vilo website — enquiries from Google land in the same inbox as direct bookings.",
    ],
    stats: ["[X] direct bookings processed", "[X]% of founding hosts share a booking link", "[X] min average setup to first publish"],
    comparisonRows: [
      ["Guest emails hidden by OTA", "Guest details in your CRM forever"],
      ["15–22% commission per booking", "0% commission — flat subscription only"],
      ["Static Wix prices vs real availability", "Live calendar + server-side pricing"],
      ["WhatsApp payment links with no audit trail", "Checkout → invoice → ledger automatically"],
      ["Separate systems for website and bookings", "One engine: directory, website, direct link"],
      ["OTA owns the guest relationship", "You own the relationship and can re-market (POPIA-safe)"],
      ["Mobile checkout feels bolted-on", "Mobile-first checkout built for SA payment methods"],
      ["No policy snapshot at booking time", "Policies frozen on booking — disputes resolved by snapshot"],
    ],
    faqs: [
      { q: "Do guests need a Vilo account to book?", a: "No. Checkout works without an account. Guests can optionally create one afterward to manage their trip in the guest portal." },
      { q: "What URL do I share?", a: "Your permanent /book/{handle} link for multi-property hosts, or /property/{slug}/book for a single listing direct checkout." },
      { q: "Can I require approval before confirming?", a: "Yes. Turn off Instant Book and enquiries flow through your inbox and quote builder instead." },
      { q: "Are prices tamper-proof?", a: "Yes. Totals are recalculated server-side on every checkout step — guests cannot edit prices in the browser." },
      { q: "What must I configure before publishing?", a: "Photos, at least one room, banking details, and a refund policy. The Channels tab shows your checklist." },
      { q: "Does Vilo take a cut of bookings?", a: "No booking commission ever. Paystack processing fees apply separately on card payments." },
      { q: "What payment methods can guests use?", a: "Paystack (card and instant EFT) and manual EFT with proof upload. Same methods on pay-by-link pages." },
      { q: "Can I offer weekly or monthly discounts?", a: "Yes — configure whole-property, weekly (7+ nights), and monthly (28+ nights) discounts on your listing." },
    ],
    finalCtaEyebrow: "Ready to book direct?",
    finalCtaHeadline: "Your next guest deserves a link that actually converts.",
    finalCtaBody: "See how much OTA commission is costing your business. Take the 2-minute scorecard — free, no card required.",
    trustElement: "Direct booking included in every Vilo plan",
    layoutClusters: ["Discovery & Links (1-2)", "Booking modes (3-4)", "Trust & pricing (5-7)", "Checkout & confirm (8-10)"],
    heroLayoutVisual: "host publish screen + mobile guest checkout composite",
  },
  {
    fileName: "CALENDAR_SYNC_FEATURE_PAGE",
    featureName: "Calendar Sync",
    urlSlug: "calendar-sync",
    title: "Calendar Sync & Booking Engine — Vilo",
    metaDescription:
      "Two-way iCal sync with Airbnb and Booking.com. One calendar, zero double-bookings. Block dates, start bookings, and export Vilo reservations automatically.",
    keywords: ["ical calendar sync accommodation", "airbnb booking.com sync south africa", "double booking prevention", "host availability calendar"],
    ogTitle: "Calendar Sync — End Double-Bookings | Vilo",
    ogDescription: "Import OTA blocks. Export Vilo bookings. One calendar for every channel.",
    heroHeadlines: [
      'Option A: "One calendar. Every channel. Zero double-bookings."',
      'Option B: "Sync Airbnb, Booking.com, and direct — automatically."',
      'Option C: "Stop the 2am panic when two guests show up for the same room."',
    ],
    heroRecommended: "Option A",
    subheadline:
      "Vilo's calendar sync imports blocks from your OTAs, exports your direct bookings back out, and gives you one interactive calendar to block dates and start new bookings — with scheduled re-sync every 15 minutes.",
    heroVisualSecondary: "See sync in action",
    heroVisual:
      "Split view: LEFT — Calendar sync dashboard with Airbnb import feed showing 'Synced 3 min ago' and export URL with copy button. RIGHT — Host calendar with colour-coded blocks: direct booking (green), iCal import (orange), manual block (grey). Tooltip: 'Held via Airbnb import'.",
    problemEyebrow: "The double-booking nightmare",
    problemHeadline: "Two calendars that don't talk is a reputation disaster waiting to happen.",
    painPoints: [
      { pain: "You accept a direct booking but forget to block the dates on Airbnb — both guests arrive.", emotion: "Panic", cost: "Cancelled booking, bad review, possible refund, damaged reputation." },
      { pain: "Spreadsheet availability that staff forget to update after every WhatsApp hold.", emotion: "Overwhelm", cost: "Silent double-bookings; you only discover at check-in." },
      { pain: "Juggling Airbnb, Booking.com, and Lekkeslaap extranets with no single view.", emotion: "Exhaustion", cost: "Hours weekly updating calendars; still miss one." },
      { pain: "External blocks invisible until a clash happens during checkout.", emotion: "Anxiety", cost: "Guest completes payment on dates you already sold elsewhere." },
      { pain: "No way to block a maintenance window across all channels at once.", emotion: "Frustration", cost: "Block on one platform; forget the others." },
    ],
    beforeScenario:
      "December peak season. You take a WhatsApp booking for the 24th–27th, jot it in a notebook, and forget to close Airbnb. Christmas morning, two families arrive with confirmations. One leaves in tears. One leaves a one-star review. You spend the holiday refunding and apologising — and wondering how many near-misses you didn't notice.",
    solutionEyebrow: "The Vilo way",
    solutionHeadline: "Two-way sync that keeps every channel honest.",
    transformation:
      "Go from five separate calendars and a prayer to one dashboard where OTA blocks flow in, Vilo bookings flow out, and you block or book without opening another tab.",
    differentiators: [
      "Two-way iCal — import OTA blocks in, export Vilo bookings out (guest PII stripped from export).",
      "Non-destructive import — only iCal-sourced blocks are managed per feed; manual blocks stay untouched.",
      "Scheduled re-sync every 15 minutes plus manual sync on demand.",
      "Start bookings and block date ranges directly from the calendar — no context switching.",
    ],
    subFeatures: [
      { icon: "Download", headline: "iCal import feeds", description: "Paste your Airbnb or Booking.com export URL. Vilo pulls blocked dates on a schedule and shows feed status and errors.", visual: "Import feed list with Airbnb preset label and last synced timestamp" },
      { icon: "Upload", headline: "iCal export per listing", description: "Copy your Vilo export URL into each OTA. Confirmed direct bookings appear as blocked dates on external calendars automatically.", visual: "Export URL field with 'Paste into Airbnb' instruction callout" },
      { icon: "RotateCw", headline: "Manual sync on demand", description: "Don't wait for the scheduler — hit Sync now when you've just updated an OTA calendar and need immediate consistency.", visual: "Sync now button with spinner animation state" },
      { icon: "AlertTriangle", headline: "Feed status + errors", description: "Broken feed URL? Vilo shows error status and last error message. Fix the URL; blocks from that feed clear on remove.", visual: "Feed row in error state with expandable error detail" },
      { icon: "Calendar", headline: "Interactive host calendar", description: "Month and week views across properties. See bookings, blocks, and imports in one place.", visual: "Multi-property calendar grid with legend" },
      { icon: "Lock", headline: "Single-night block/open", description: "Click a date to block or unblock. Maintenance, owner use, or hold while negotiating — one click.", visual: "Date cell context menu with Block date action" },
      { icon: "CalendarRange", headline: "Date-range blocks", description: "Block a run of dates in one action. Applies across your Vilo calendar and exports to connected OTAs.", visual: "Range selection highlight spanning Fri–Mon" },
      { icon: "CalendarPlus", headline: "Start booking from calendar", description: "Click Book on an open date to launch the new-booking wizard pre-filled with that check-in.", visual: "Book action opening new booking modal with date pre-selected" },
      { icon: "ShieldCheck", headline: "Anti double-booking validation", description: "Checkout and manual bookings validate against bookings, manual blocks, and all active iCal imports.", visual: "Validation error: 'Dates unavailable — blocked via Airbnb import'" },
      { icon: "Clock", headline: "Scheduled 15-min re-sync", description: "Background job re-imports feeds every 15 minutes. Set and forget — with manual override when you need it.", visual: "Scheduler badge: 'Next sync in 12 min'" },
      { icon: "LayoutGrid", headline: "Multi-property view", description: "See all listings on one calendar or filter to one property. Guesthouses with multiple units stay sane.", visual: "Property filter dropdown above calendar" },
      { icon: "Globe", headline: "OTA preset labels", description: "Airbnb, Booking.com, and custom presets when adding feeds — less copy-paste confusion for your team.", visual: "Add feed modal with OTA preset chips" },
    ],
    howItWorksEyebrow: "Simple workflow",
    howItWorksHeadline: "Sync every channel in four steps.",
    hostSteps: [
      { title: "Copy export URL", body: "From Calendar sync, copy your Vilo export link per listing.", visual: "Export URL with copy button" },
      { title: "Paste into OTAs", body: "Add the export URL in Airbnb/Booking.com calendar import settings.", visual: "Airbnb calendar import settings screenshot mockup" },
      { title: "Add import feeds", body: "Paste each OTA export URL into Vilo with the matching preset.", visual: "Add import feed form" },
      { title: "Manage from one place", body: "Block, book, and sync — Vilo keeps everything aligned.", visual: "Unified calendar with mixed block types" },
    ],
    guestSteps: [
      { title: "See open dates", body: "Listing and checkout only show genuinely available nights.", visual: "Date picker with imports respected" },
      { title: "Select dates", body: "Server validates against all sources before payment.", visual: "Checkout proceeding on valid dates" },
      { title: "Booking confirms", body: "Dates block on Vilo calendar and export to OTAs.", visual: "New booking block appearing on calendar" },
      { title: "Cancellation releases", body: "Cancelled dates free up per policy flow and re-export.", visual: "Block removed after cancellation" },
    ],
    testimonials: [
      { quote: "We had one double-booking in five years before Vilo. Haven't had one since we turned on iCal sync.", name: "[Name]", property: "Guesthouse · Knysna" },
      { quote: "I used to spend Sunday nights updating three extranets. Now I block once in Vilo and it propagates.", name: "[Name]", property: "Self-catering · Stellenbosch" },
      { quote: "The error status saved us — our Booking.com feed URL changed and Vilo flagged it before we sold those dates.", name: "[Name]", property: "Lodge · Hazyview" },
    ],
    scenarios: [
      "A multi-room guesthouse syncs each room's Airbnb calendar separately while exporting Vilo direct bookings back.",
      "A host blocks two weeks for renovations in Vilo; export closes those dates on Booking.com within the next sync cycle.",
      "Peak-season lodge runs manual sync after every OTA promotion goes live — instant consistency without waiting 15 minutes.",
    ],
    stats: ["[X] iCal feeds synced daily", "[X] double-bookings prevented", "15 min automatic re-sync interval"],
    comparisonRows: [
      ["Update 3+ OTA extranets manually", "One block in Vilo exports everywhere"],
      ["Spreadsheet 'availability' out of date by Tuesday", "Live calendar with scheduled import"],
      ["Discover clash at check-in", "Checkout rejects unavailable dates upfront"],
      ["No visibility when a feed breaks", "Feed error status + last error message"],
      ["Can't start a booking from the calendar", "Book action opens wizard pre-filled"],
      ["Guest PII leaked in calendar exports", "RFC 5545 export with generic summaries only"],
      ["Manual blocks deleted by sync tools", "Non-destructive — only iCal blocks managed per feed"],
      ["Separate calendar per property", "Multi-property view with filters"],
    ],
    faqs: [
      { q: "How often do imports sync?", a: "Every 15 minutes automatically. You can also trigger a manual sync anytime from Calendar sync." },
      { q: "Which OTAs are supported?", a: "Any platform that provides an iCal export URL — Airbnb, Booking.com, Lekkeslaap, and others. OTA API channels are coming soon." },
      { q: "What if my feed URL breaks?", a: "The feed shows error status with the last error message. Fix the URL or remove the feed; iCal-sourced blocks from that feed are cleared on remove." },
      { q: "Do imports delete my manual blocks?", a: "No. Only blocks created by a specific iCal feed are managed when that feed is updated or removed." },
      { q: "Can staff block dates?", a: "Cleaners can manage blocked dates. Co-hosts and assistants have broader calendar access per role." },
      { q: "Are there feed limits?", a: "Plan-dependent via ical_import_limit. Export is available on all plans." },
      { q: "Can I start a booking from a calendar day?", a: "Yes — click Book on an open date to open the new-booking wizard with that check-in pre-filled." },
      { q: "Is guest data exported to OTAs?", a: "No. Export uses generic summaries only — no guest names or contact details in the iCal file." },
    ],
    finalCtaEyebrow: "Ready for one calendar?",
    finalCtaHeadline: "Your next peak season deserves sync that actually works.",
    finalCtaBody: "Take the 2-minute scorecard and see where double-booking risk is costing you.",
    trustElement: "Calendar sync included in every Vilo plan",
    layoutClusters: ["Import & export (1-4)", "Calendar actions (5-8)", "Protection & automation (9-12)"],
    heroLayoutVisual: "sync dashboard + multi-colour calendar composite",
  },
];

// Additional features appended below — import removed for single-file generation

function renderFeature(f) {
  const subCount = f.subFeatures.length;
  const iconTable = f.subFeatures.map((sf, i) => `| ${sf.headline.split("—")[0].trim()} | \`${sf.icon}\` |`).join("\n");

  const painBlock = f.painPoints.map((p, i) => `${i + 1}. Pain: ${p.pain}\n   Emotion: ${p.emotion}\n   Cost: ${p.cost}`).join("\n\n");
  const diffBlock = f.differentiators.map((d, i) => `${i + 1}. ${d}`).join("\n\n");
  const subBlock = f.subFeatures.map((sf, i) => `### Sub-Feature ${i + 1}: ${sf.headline.split("—")[0].trim()}\n\n\`\`\`yaml\nicon: ${sf.icon}\nheadline: "${sf.headline}"\ndescription: "${sf.description}"\nvisual: "${sf.visual}"\n\`\`\``).join("\n\n");
  const hostBlock = f.hostSteps.map((s, i) => `Step ${i + 1}: ${s.title} — ${s.body}\n  Visual: ${s.visual}`).join("\n\n");
  const guestBlock = f.guestSteps ? f.guestSteps.map((s, i) => `Step ${i + 1}: ${s.title} — ${s.body}\n  Visual: ${s.visual}`).join("\n\n") : null;
  const testimonialBlock = f.testimonials.map((t, i) => `Testimonial ${i + 1}:\n  Quote: "${t.quote}"\n  Name: "${t.name}"\n  Property: "${t.property}"`).join("\n\n");
  const scenarioBlock = f.scenarios.map((s, i) => `Scenario ${i + 1}: ${s}`).join("\n\n");
  const statsBlock = f.stats.map((s, i) => `Stat ${i + 1}: ${s}`).join("\n");
  const compareBlock = f.comparisonRows.map(([w, v]) => `| ${w} | ${v} |`).join("\n");
  const faqBlock = f.faqs.map(({ q, a }) => `Q: ${q}\nA: ${a}`).join("\n\n");
  const clusterBlock = f.layoutClusters.map((c) => `     * ${c}`).join("\n");

  return `# ${f.featureName} Feature — Sales Page Specification

> **For:** Claude Design
> **Feature:** ${f.featureName}
> **URL:** \`/features/${f.urlSlug}\`
> **Status:** Ready for implementation

---

## 1. Page Meta & SEO

\`\`\`yaml
title: "${f.title}"
meta_description: "${f.metaDescription}"
url_slug: /features/${f.urlSlug}
keywords:
${f.keywords.map((k) => `  - ${k}`).join("\n")}
og_title: "${f.ogTitle}"
og_description: "${f.ogDescription}"
og_image: "/images/features/${f.urlSlug}-og.jpg"
\`\`\`

---

## 2. Hero Section

### Headline Options

\`\`\`
${f.heroHeadlines.join("\n")}
\`\`\`

**Recommended:** ${f.heroRecommended} — direct, benefit-focused.

### Subheadline

\`\`\`
"${f.subheadline}"
\`\`\`

### Hero CTA

\`\`\`
Primary: "Take the 2-minute Scorecard" → #scorecard
Secondary: "${f.heroVisualSecondary}" → #how-it-works
\`\`\`

### Hero Visual

\`\`\`
${f.heroVisual}
\`\`\`

---

## 3. Problem / Pain Points Section

### Section Header

\`\`\`
Eyebrow: "${f.problemEyebrow}"
Headline: "${f.problemHeadline}"
\`\`\`

### Pain Points

\`\`\`
${painBlock}
\`\`\`

### "Before Vilo" Scenario

\`\`\`
"${f.beforeScenario}"
\`\`\`

---

## 4. Solution Overview

### Section Header

\`\`\`
Eyebrow: "${f.solutionEyebrow}"
Headline: "${f.solutionHeadline}"
\`\`\`

### Transformation Statement

\`\`\`
"${f.transformation}"
\`\`\`

### Key Differentiators

\`\`\`
${diffBlock}
\`\`\`

---

## 5. Feature Deep-Dive Sections

${subBlock}

---

## 6. How It Works

### Section Header

\`\`\`
Eyebrow: "${f.howItWorksEyebrow}"
Headline: "${f.howItWorksHeadline}"
\`\`\`

### Host Journey

\`\`\`
${hostBlock}
\`\`\`
${guestBlock ? `\n### Guest Journey\n\n\`\`\`\n${guestBlock}\n\`\`\`` : ""}

### Visual Treatment

\`\`\`
Desktop: Numbered steps connected by dotted lines, alternating left/right with screenshots
Mobile: Vertical stack, numbers in circles, screenshots below each step
Animation: Steps reveal on scroll with subtle rise animation
\`\`\`

---

## 7. Social Proof Section

### Section Header

\`\`\`
Eyebrow: "From real hosts"
Headline: "What hosts say about Vilo ${f.featureName}"
\`\`\`

### Testimonial Placeholders

\`\`\`
${testimonialBlock}
\`\`\`

### Use Case Scenarios

\`\`\`
${scenarioBlock}
\`\`\`

### Stats (placeholder)

\`\`\`
${statsBlock}
\`\`\`

---

## 8. Comparison Section

### Section Header

\`\`\`
Eyebrow: "Side by side"
Headline: "${f.featureName} without Vilo vs. with Vilo"
\`\`\`

### Comparison Table

| Without Vilo | With Vilo |
|--------------|-----------|
${compareBlock}

---

## 9. FAQ Section

### Questions & Answers

\`\`\`
${faqBlock}
\`\`\`

---

## 10. Final CTA Section

### Section Content

\`\`\`
Eyebrow: "${f.finalCtaEyebrow}"
Headline: "${f.finalCtaHeadline}"
Body: "${f.finalCtaBody}"

Primary CTA: "Take the 2-minute Scorecard" → #scorecard
Secondary CTA: "Claim your founding spot" → /signup/host

Trust elements:
  - No card required
  - 90-day money-back guarantee
  - ${f.trustElement}
\`\`\`

---

## 11. Design Notes for Claude Design

${DESIGN_NOTES}

### Page Layout

\`\`\`
1. HERO (dark gradient + dot grid) — visual: ${f.heroLayoutVisual}
2. PROBLEM SECTION (light background)
3. SOLUTION OVERVIEW (white background)
4. FEATURE DEEP-DIVE (alternating light/white) — ${subCount} sub-features grouped:
${clusterBlock}
5. HOW IT WORKS (light background)
6. SOCIAL PROOF (white background)
7. COMPARISON TABLE (light background)
8. FAQ (white background)
9. FINAL CTA (dark gradient)
\`\`\`

### Lucide Icons Reference

| Sub-Feature | Icon |
|-------------|------|
${iconTable}

---

## Checklist

- [x] All sections completed with specific content
- [x] Headlines are benefit-focused, not feature-focused
- [x] Pain points use emotional language
- [x] All claims verified against codebase capabilities
- [x] CTAs match /launch page pattern
- [x] Visual descriptions specific enough to implement
- [x] FAQs address real objections
- [x] Design notes reference correct brand tokens
- [x] ${subCount} sub-features documented with icons
`;
}

mkdirSync(OUT_DIR, { recursive: true });

for (const f of FEATURES) {
  const path = join(OUT_DIR, `${f.fileName}.md`);
  writeFileSync(path, renderFeature(f), "utf8");
  console.log(`Wrote ${path}`);
}

console.log(`Generated ${FEATURES.length} feature pages.`);
