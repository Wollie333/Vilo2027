# Calendar Sync Feature — Sales Page Specification

> **For:** Claude Design
> **Feature:** Two-Way Calendar Sync
> **URL:** `/features/calendar-sync`
> **Status:** Ready for implementation

---

## 1. Page Meta & SEO

```yaml
title: "Calendar Sync for Accommodation Hosts — Wielo"
meta_description: "Two-way iCal sync with Airbnb, Booking.com, and VRBO. Import external bookings, export Wielo availability. End double-bookings for good. Built for SA hosts."
url_slug: /features/calendar-sync
keywords:
  - calendar sync accommodation
  - ical sync airbnb booking.com
  - prevent double bookings guesthouse
  - channel manager south africa
  - vacation rental calendar sync
og_title: "Two-Way Calendar Sync — End Double-Bookings | Wielo"
og_description: "Sync your Wielo calendar with Airbnb, Booking.com, and any iCal-compatible platform. Never double-book again."
og_image: "/images/features/calendar-sync-og.jpg"
```

---

## 2. Hero Section

### Headline Options

```
Option A: "End double-bookings. For good."
Option B: "One calendar. Every platform. Always in sync."
Option C: "Your OTA calendars and Wielo — finally talking to each other."
```

**Recommended:** Option A — addresses the core fear directly, powerful promise.

### Subheadline

```
"Wielo syncs your availability with Airbnb, Booking.com, VRBO, and any iCal-compatible platform — automatically, every 15 minutes. Import their bookings. Export yours. Never apologise for a double-booking again."
```

### Hero CTA

```
Primary: "Take the 2-minute Scorecard" → #scorecard
Secondary: "See how sync works" → #how-it-works
```

### Hero Visual

```
Central calendar view showing:
- A month grid with different colored blocks:
  - Green blocks: "Wielo Booking" (direct bookings)
  - Amber blocks: "Airbnb" (imported)
  - Blue blocks: "Booking.com" (imported)
  - Gray blocks: "Manually blocked"

Floating connection indicators:
- Airbnb logo with ✓ "Synced 3 min ago"
- Booking.com logo with ✓ "Synced 8 min ago"
- Arrow showing bidirectional sync

Small card overlay: "Last sync: 12:34pm · 47 dates blocked · No conflicts"
```

---

## 3. Problem / Pain Points Section

### Section Header

```
Eyebrow: "The double-booking nightmare"
Headline: "You can't be in two places. Neither can your guests."
```

### Pain Points

```
1. Pain: A guest books on Airbnb. You forget to update your other calendars. Someone else books the same dates on Booking.com.
   Emotion: Panic, dread
   Cost: Cancel on one guest, refund, apologise, damage your rating, lose future bookings.

2. Pain: You're running calendars on three platforms plus a spreadsheet. Keeping them all updated is a part-time job.
   Emotion: Exhaustion, overwhelm
   Cost: Hours every week spent on admin that doesn't grow your business.

3. Pain: You manually block dates on Airbnb after a direct booking, but you're at dinner — so it waits until tomorrow. By then, someone's already booked.
   Emotion: Frustration, helplessness
   Cost: Another double-booking. Another awkward conversation.

4. Pain: You don't trust the sync tools you've tried. They're complicated, expensive, or they've failed you before.
   Emotion: Distrust, anxiety
   Cost: You stay stuck in manual mode, losing time and risking errors.

5. Pain: You want to take more direct bookings, but you're afraid of conflicts with your OTA calendars.
   Emotion: Fear of change
   Cost: You stay dependent on commission-charging platforms because it feels "safer."
```

### "Before Wielo" Scenario

```
"It's 11pm. You just confirmed a direct booking over WhatsApp. You tell yourself you'll update Airbnb in the morning. At 7am, you wake up to a notification: someone booked those exact dates on Booking.com overnight. Now you have to choose who to disappoint — and your reviews will show it."
```

---

## 4. Solution Overview

### Section Header

```
Eyebrow: "The Wielo way"
Headline: "Your calendars sync automatically. You sleep soundly."
```

### Transformation Statement

```
"From juggling spreadsheets and manually blocking dates to one unified calendar that syncs with every platform — automatically, every 15 minutes, with zero effort from you."
```

### Key Differentiators

```
1. True two-way sync — Import bookings from OTAs into Wielo. Export Wielo bookings back to them. Both directions, automatic.

2. Works with what you already use — Airbnb, Booking.com, VRBO, Google Calendar, Apple Calendar — any platform that supports iCal feeds.

3. Syncs every 15 minutes — Your calendars stay current without you lifting a finger. Manual sync available anytime you need it.

4. Visual source tracking — See exactly which blocks came from which platform. Green for Wielo bookings, amber for Airbnb imports, blue for Booking.com. No guessing.
```

---

## 5. Feature Deep-Dive Sections

### Sub-Feature 1: iCal Import (Inbound Sync)

```yaml
icon: Download
headline: "Import bookings from every platform you list on"
description: "Paste your Airbnb, Booking.com, or VRBO calendar feed URL into Wielo. We fetch their bookings and block those dates on your Wielo calendar automatically. When they update, we update. No double-bookings."
visual: "Feed manager UI showing 3 connected feeds: Airbnb (✓ Active, 12 dates), Booking.com (✓ Active, 8 dates), VRBO (✓ Active, 4 dates) — with 'Add Feed' button"
```

### Sub-Feature 2: iCal Export (Outbound Sync)

```yaml
icon: Upload
headline: "Share your Wielo availability with every platform"
description: "Wielo generates a unique calendar feed URL for each listing. Add it to Airbnb, Booking.com, or any iCal-compatible platform. Your direct bookings show up as blocked dates on their calendars — automatically."
visual: "Export panel showing feed URL with copy button, last sync timestamp, and 'X bookings in feed' badge"
```

### Sub-Feature 3: Automatic 15-Minute Sync

```yaml
icon: RefreshCw
headline: "Syncs automatically, every 15 minutes"
description: "You don't need to remember to sync. Wielo checks your connected feeds every 15 minutes, imports new bookings, and keeps everything current. If something changes at 2am, it's reflected before your morning coffee."
visual: "Timeline showing sync events: '12:00 - Synced 3 feeds', '12:15 - Synced 3 feeds', '12:30 - Synced 3 feeds, 2 new dates imported'"
```

### Sub-Feature 4: Manual Sync On-Demand

```yaml
icon: Zap
headline: "Sync now when you need it now"
description: "Just took a booking on Airbnb? Don't wait 15 minutes. Hit 'Sync Now' and your Wielo calendar updates instantly. Perfect for busy days when bookings are coming in fast."
visual: "Sync button with 'Last synced: Just now' confirmation toast"
```

### Sub-Feature 5: Visual Source Tracking

```yaml
icon: Palette
headline: "See where every block came from"
description: "Your calendar colour-codes blocks by source. Green for Wielo bookings. Amber for Airbnb imports. Blue for Booking.com. Gray for manual blocks. At a glance, you know exactly what's where — and why."
visual: "Month calendar view with color-coded legend: Wielo (green), Airbnb (amber), Booking.com (blue), Manual (gray)"
```

### Sub-Feature 6: Conflict Prevention

```yaml
icon: ShieldCheck
headline: "Wielo bookings always take priority"
description: "If an external calendar tries to block dates where you already have a Wielo booking, the import is skipped. Your confirmed direct bookings are protected. No overwrites, no surprises."
visual: "Conflict alert card: 'External calendar conflict detected on 15-18 Nov. Your Wielo booking is protected.'"
```

### Sub-Feature 7: Multi-Property Support

```yaml
icon: Building2
headline: "Sync every property, every room — separately"
description: "Running multiple listings? Each property gets its own import feeds and export URL. Room-level blocking shows room names in exported events. Your OTAs see exactly which room is booked."
visual: "Property selector dropdown showing 3 properties, each with their own feed count and sync status"
```

### Sub-Feature 8: Secure Token-Based Export

```yaml
icon: Lock
headline: "Your calendar feed is private and secure"
description: "Each export URL includes a unique security token. No one can access your calendar without it. You can rotate tokens anytime if you need to revoke access. No guest names or payment details ever appear in the feed."
visual: "Feed URL with token portion highlighted, 'Regenerate Token' button with confirmation modal"
```

### Sub-Feature 9: Error Monitoring & Alerts

```yaml
icon: AlertCircle
headline: "Know immediately when something's wrong"
description: "If a feed sync fails — broken URL, platform down, format changed — Wielo flags it instantly. Dashboard banner shows the issue. After an hour, you get a push notification. No silent failures."
visual: "Feed row showing error state: '⚠️ Sync failed · Invalid feed format · Last success: 2 hours ago · [Retry]'"
```

### Sub-Feature 10: Feed Management

```yaml
icon: Settings
headline: "Add, remove, and manage feeds in seconds"
description: "Connect a new platform in two clicks: paste the URL, pick a label, done. Remove a feed when you stop listing somewhere — Wielo clears only those imported blocks, leaving everything else untouched."
visual: "Add feed form with URL input, source dropdown (Airbnb, Booking.com, VRBO, Google, Other), and 'Connect' button"
```

---

## 6. How It Works

### Section Header

```
Eyebrow: "Simple setup"
Headline: "Connected in five minutes. Protected forever."
```

### Setup Journey (Import)

```
Step 1: Copy your external calendar URL — Find the iCal export link in your Airbnb, Booking.com, or VRBO settings
  Visual: Screenshot showing where to find iCal URL in Airbnb settings

Step 2: Paste it into Wielo — Add the URL and label it (e.g., "Airbnb - Beach House")
  Visual: Wielo feed manager with URL input field

Step 3: Wielo syncs immediately — External bookings appear as blocked dates within seconds
  Visual: Calendar showing new amber blocks appearing with "Synced from Airbnb" tooltip

Step 4: Automatic from here — Every 15 minutes, Wielo checks for updates. You do nothing.
  Visual: "Set and forget" badge with clock icon
```

### Setup Journey (Export)

```
Step 1: Copy your Wielo feed URL — One click from your calendar sync dashboard
  Visual: Export URL with copy button, "Copied!" confirmation

Step 2: Add it to your external platform — Paste into Airbnb, Booking.com, or any iCal-compatible calendar
  Visual: Screenshot showing where to add external calendar in Airbnb

Step 3: Your direct bookings sync out — Wielo bookings appear as blocked dates on the OTA
  Visual: Airbnb calendar showing Wielo bookings as blocked dates

Step 4: No more manual blocking — Book direct on Wielo, and every platform knows instantly
  Visual: Flow diagram: "Wielo booking → 15 min → Airbnb blocked"
```

### Visual Treatment

```
Two parallel tracks (Import / Export) shown side by side on desktop
Stacked vertically on mobile
Connected by a central "Two-Way Sync" badge
Numbered steps with progress indicators
```

---

## 7. Social Proof Section

### Section Header

```
Eyebrow: "From real hosts"
Headline: "No more double-booking disasters"
```

### Testimonial Placeholders

```
Testimonial 1:
  Quote: "I had three double-bookings last year. Each one was a nightmare — refunds, apologies, bad reviews. Since switching to Wielo, I've had zero. The sync just works."
  Name: "[Name]"
  Property: "Self-catering · Plettenberg Bay"

Testimonial 2:
  Quote: "I list on four platforms. Before Wielo, I spent an hour every day updating calendars. Now it's automatic. I just check my dashboard once a week to make sure everything's green."
  Name: "[Name]"
  Property: "Guesthouse · Stellenbosch"

Testimonial 3:
  Quote: "I was scared to take direct bookings because I didn't trust my calendar to stay in sync. Wielo fixed that. Now half my bookings are commission-free."
  Name: "[Name]"
  Property: "Lodge · Hoedspruit"
```

### Use Case Scenarios

```
Scenario 1: A Cape Town apartment owner lists on Airbnb, Booking.com, and VRBO. Wielo imports all three calendars, preventing conflicts, while exporting direct bookings back to each platform.

Scenario 2: A Drakensberg lodge takes 60% of bookings direct. Their Wielo export feed keeps Airbnb and Lekkeslaap calendars current — no manual blocking required.

Scenario 3: A Karoo farm stay connects Google Calendar (for personal blocks) alongside Airbnb. Wielo treats both as equal import sources, blocking dates from either.
```

### Stats (placeholder)

```
Stat 1: [X] calendar feeds connected by founding hosts
Stat 2: [X] sync operations per day across the platform
Stat 3: 0 — double-bookings reported by hosts using two-way sync
```

---

## 8. Comparison Section

### Section Header

```
Eyebrow: "Side by side"
Headline: "Manual calendar updates vs. Wielo sync"
```

### Comparison Table

| Without Wielo | With Wielo |
|--------------|-----------|
| Log into each platform separately to block dates | One calendar shows everything |
| Forget to update one platform → double-booking | Automatic sync every 15 minutes |
| No idea which platform a block came from | Color-coded by source |
| Manually check if calendars are in sync | Dashboard shows sync status at a glance |
| Fear of conflicts stops you taking direct bookings | Direct bookings sync out automatically |
| Expensive channel managers with complex setup | Simple iCal feeds, works with what you have |
| Silent failures — you find out when it's too late | Instant alerts when sync fails |
| One calendar error cascades to double-bookings | Wielo bookings always protected |

---

## 9. FAQ Section

### Questions & Answers

```
Q: Which platforms does Wielo sync with?
A: Any platform that supports iCal feeds — Airbnb, Booking.com, VRBO, Expedia, Google Calendar, Apple Calendar, and more. If it has an iCal export URL, Wielo can import it.

Q: How often does it sync?
A: Automatically every 15 minutes. You can also hit "Sync Now" anytime for an instant update.

Q: Will syncing overwrite my Wielo bookings?
A: Never. Wielo bookings always take priority. If an external calendar tries to block dates where you have a confirmed Wielo booking, the import is skipped and you're notified.

Q: What happens if I remove a feed?
A: Only the dates imported from that specific feed are unblocked. Your Wielo bookings, manual blocks, and imports from other feeds stay exactly as they are.

Q: Is my calendar feed secure?
A: Yes. Each export URL includes a unique security token. No guest names, emails, or payment details appear in the feed — just blocked dates.

Q: How many feeds can I connect?
A: Depends on your plan. Basic: 1 feed. Pro: 5 feeds. Business: unlimited. Export is free on all plans.

Q: What if a sync fails?
A: Wielo shows a dashboard alert immediately. If the error persists for an hour, you get a push notification. Failed feeds are flagged until you manually retry — no silent failures.

Q: Can I sync individual rooms separately?
A: Yes. Room-level blocks are tracked and exported with room names in the event summary. External platforms see exactly which room is booked.
```

---

## 10. Final CTA Section

### Section Content

```
Eyebrow: "Ready to end double-bookings?"
Headline: "Connect your calendars. Sleep soundly."
Body: "See exactly what the OTA juggling act is costing you — in time, stress, and close calls. Take the 2-minute scorecard and find out how Wielo can protect your calendar."

Primary CTA: "Take the 2-minute Scorecard" → #scorecard
Secondary CTA: "Claim your founding spot" → /signup/host

Trust elements:
  - No card required
  - 90-day money-back guarantee
  - Calendar sync included in every plan
  - Works with platforms you already use
```

---

## 11. Design Notes for Claude Design

### Brand Reference

**Colours:**
| Token | Hex | Usage |
|-------|-----|-------|
| `brand-primary` | `#10B981` | CTAs, Wielo bookings on calendar |
| `brand-secondary` | `#064E3B` | Featured emphasis |
| `brand-accent` | `#D1FAE5` | Hover surfaces |
| `brand-light` | `#F0FDF4` | Page background |
| `brand-dark` | `#0A1510` | Hero, footer |
| `status-pending` | `#F59E0B` | Airbnb imports (amber) |
| `status-completed` | `#6366F1` | Booking.com imports (indigo/blue) |
| `status-draft` | `#94A3B8` | Manual blocks (gray) |

**Calendar Color Legend:**
- Wielo Booking: `#10B981` (brand-primary)
- Airbnb Import: `#F59E0B` (amber)
- Booking.com Import: `#3B82F6` (blue)
- Manual Block: `#94A3B8` (slate)
- Conflict: `#EF4444` (red warning)

**Typography:**
- Display: Plus Jakarta Sans
- Body: Inter
- Mono: JetBrains Mono (feed URLs, tokens)

### Page Layout

```
1. HERO (dark gradient + dot grid)
   - Two-column: copy left, calendar visual right
   - Calendar shows multi-source blocks with platform logos

2. PROBLEM SECTION (light background)
   - Pain points as numbered list with icons
   - "Before Wielo" scenario as highlighted callout box

3. SOLUTION OVERVIEW (white background)
   - Transformation statement prominent
   - Differentiators as icon + text cards (2x2 grid)

4. FEATURE DEEP-DIVE (alternating light/white)
   - 10 sub-features grouped:
     * Core Sync (1-2): Import + Export
     * Automation (3-4): Auto + Manual sync
     * Visibility (5-6): Source tracking + Conflict prevention
     * Management (7-10): Multi-property, Security, Errors, Feed management

5. HOW IT WORKS (light background)
   - Two parallel tracks: Import setup / Export setup
   - Step-by-step with screenshots

6. SOCIAL PROOF (white background)
   - Testimonial cards (3-column)
   - Stats bar

7. COMPARISON TABLE (light background)
   - Full-width table
   - Checkmarks and X icons

8. FAQ (white background)
   - Accordion style

9. FINAL CTA (dark gradient)
   - Scorecard card matching /launch page
```

### Responsive Behaviour

```
Mobile (< 768px):
  - Single column
  - Calendar visual simplified (fewer days visible)
  - How It Works tracks stack vertically

Tablet (768-1024px):
  - 2-column grids
  - Full calendar month visible

Desktop (> 1024px):
  - Full layout
  - Side-by-side Import/Export tracks
```

### Animations

```
- Calendar blocks animate in on scroll (staggered reveal)
- Sync status indicators pulse gently
- Connection lines animate (dashed line flowing)
- Platform logos fade in with slight delay
```

### Lucide Icons Reference

| Sub-Feature | Icon |
|-------------|------|
| iCal Import | `Download` |
| iCal Export | `Upload` |
| Auto Sync | `RefreshCw` |
| Manual Sync | `Zap` |
| Source Tracking | `Palette` |
| Conflict Prevention | `ShieldCheck` |
| Multi-Property | `Building2` |
| Security | `Lock` |
| Error Monitoring | `AlertCircle` |
| Feed Management | `Settings` |

---

## Checklist

- [x] All sections completed with specific content
- [x] Headlines are benefit-focused
- [x] Pain points use emotional language
- [x] All claims verified against codebase (iCal import/export, 15-min sync, SSRF protection, etc.)
- [x] CTAs match /launch page pattern
- [x] Visual descriptions specific to calendar UI
- [x] FAQs address real sync concerns
- [x] Design notes include calendar color coding
- [x] 10 sub-features documented with icons
