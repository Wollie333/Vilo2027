# Guest CRM Feature — Sales Page Specification

> **For:** Claude Design
> **Feature:** Guest CRM & Contacts
> **URL:** `/features/guest-crm`
> **Status:** Ready for implementation

---

## 1. Page Meta & SEO

```yaml
title: "Guest CRM for Accommodation Hosts — Wielo"
meta_description: "Build your guest database. Track booking history, lifetime value, and preferences. Tag VIPs. Send targeted emails. Your guests, yours forever. Built for SA hosts."
url_slug: /features/guest-crm
keywords:
  - guest CRM accommodation
  - hospitality contact management
  - guesthouse guest database
  - B&B customer tracking
  - lodge guest relationships
og_title: "Guest CRM — Own Your Guest Relationships | Wielo"
og_description: "Track every guest, their booking history, lifetime value, and preferences. Tag, segment, and communicate directly. Your list, forever."
og_image: "/images/features/guest-crm-og.jpg"
```

---

## 2. Hero Section

### Headline Options

```
Option A: "Every guest. Yours forever."
Option B: "The guest database you should have built years ago."
Option C: "Know your guests. Keep your guests."
```

**Recommended:** Option A — powerful ownership message, addresses OTA guest-hoarding.

### Subheadline

```
"Wielo builds your guest database automatically — from every booking, enquiry, and quote. Track lifetime value, tag VIPs, see who's returning, and communicate directly. No OTA can take this list from you."
```

### Hero CTA

```
Primary: "Take the 2-minute Scorecard" → #scorecard
Secondary: "See the guest directory" → #how-it-works
```

### Hero Visual

```
Guest directory view showing:
- Search bar + segment tabs: All | VIP | Returning | New
- Guest list with columns: Name, Email, Stays, Lifetime Value, Tags
- Sample guest row expanded: "Sarah Mitchell · 4 stays · R12,400 lifetime · VIP badge"
- KPI strip above: "847 Guests · 34% Returning · R142,300 Direct Revenue"

Floating elements:
- Guest record card showing: Avatar, "4 stays · R12,400 total · All direct"
- Tags: "VIP", "Wine lover"
- "Next stay: 15 Nov" badge
```

---

## 3. Problem / Pain Points Section

### Section Header

```
Eyebrow: "The guest you can't keep"
Headline: "The OTAs have your guests. You just rent access to them."
```

### Pain Points

```
1. Pain: A guest books through Airbnb. They love your place. Next year, Airbnb shows them three other properties before yours. You lost them before you could even try to keep them.
   Emotion: Helplessness, frustration
   Cost: Repeat bookings lost. Commission paid twice on the same guest.

2. Pain: You don't know which guests are worth fighting for. Is this someone's first stay or their fifth? Are they a R50k lifetime guest or a one-timer?
   Emotion: Blindness
   Cost: You treat all guests the same. VIPs feel ignored. One-timers get too much attention.

3. Pain: A returning guest messages you. You can't remember their last stay, what room they liked, or what special requests they had.
   Emotion: Embarrassment
   Cost: Impersonal service. They feel like a number, not a valued regular.

4. Pain: You want to email past guests about your December special, but their contact info is scattered across booking platforms you can't access.
   Emotion: Powerlessness
   Cost: Direct marketing impossible. You pay commission on guests you already earned.

5. Pain: You have no idea how much revenue came from repeat guests vs. first-timers. No data to make decisions.
   Emotion: Uncertainty
   Cost: You can't optimize what you can't measure.
```

### "Before Wielo" Scenario

```
"A guest stayed three years in a row. You remember their face, but not their name. They message asking about December availability. You have no record of their past stays, their preferences, or what they paid. You start from scratch — like a stranger. They feel it. They don't come back."
```

---

## 4. Solution Overview

### Section Header

```
Eyebrow: "The Wielo way"
Headline: "Your guests. Your data. Your relationship to keep."
```

### Transformation Statement

```
"From scattered booking records you can't access to a unified guest database with full history, lifetime value tracking, and direct communication — automatically built from every booking, enquiry, and quote."
```

### Key Differentiators

```
1. Automatic guest capture — Every booking, enquiry, and quote adds to your guest database. No manual entry. No import headaches. It just builds.

2. Full relationship history — See every stay, every message, every payment for each guest. Know who they are before you say hello.

3. Lifetime value at a glance — Know exactly how much each guest has spent with you. See which guests are worth the extra effort.

4. Your list, exportable — Export your full contact list anytime. vCard, CSV, whatever you need. This is YOUR data.
```

---

## 5. Feature Deep-Dive Sections

### Sub-Feature 1: Automatic Guest Capture

```yaml
icon: UserPlus
headline: "Every guest added automatically — from bookings, quotes, and enquiries"
description: "When someone books, requests a quote, or enquires through your website, they're added to your guest database. Deduplicated by email. No manual entry. Your contact list grows with your business."
visual: "Flow diagram: Booking confirmed → Guest auto-added → Directory row appears"
```

### Sub-Feature 2: Guest Profile & History

```yaml
icon: User
headline: "Full guest record — every stay, every interaction"
description: "Click any guest to see their complete profile: contact details, booking history, message threads, payment records, and notes. Know their preferred room. Remember their anniversary. Deliver personal service at scale."
visual: "Guest record page: avatar, contact info, stats strip (4 stays · R12,400 total · All direct), tabs for Bookings/Messages/Payments/Notes"
```

### Sub-Feature 3: Lifetime Value Tracking

```yaml
icon: TrendingUp
headline: "Know exactly what each guest is worth"
description: "See lifetime value calculated automatically from all completed stays. Filter your directory by high-value guests. Know who deserves the upgrade, the handwritten note, the extra attention."
visual: "Guest card showing: 'R24,800 lifetime value · 6 stays · Est. R3,720 saved in OTA fees'"
```

### Sub-Feature 4: Returning Guest Detection

```yaml
icon: RefreshCw
headline: "Spot returning guests instantly"
description: "Returning guests are flagged automatically. See your repeat-guest rate in your KPIs. Filter to show only returners. Celebrate your best relationships and learn what makes guests come back."
visual: "KPI card: '34% Returning Guests · 123 guests have stayed 2+ times' with Returning segment tab selected"
```

### Sub-Feature 5: Tags & Segmentation

```yaml
icon: Tags
headline: "Tag guests for easy organization"
description: "Add custom tags like 'VIP', 'Corporate', 'Anniversary', or 'Wine lover'. Filter your directory by tag. Send targeted communications. Bulk-tag guests from selection. Organize your relationships your way."
visual: "Tag management: guest row with 'VIP' + 'Corporate' badges, tag filter dropdown, bulk tag action button"
```

### Sub-Feature 6: Guest Notes

```yaml
icon: StickyNote
headline: "Add private notes — remember what matters"
description: "Record context that helps you serve guests better. 'Prefers room 3.' 'Allergic to nuts.' 'Celebrating 25th anniversary.' Notes are host-only — guests never see them. Pin important notes to the top."
visual: "Notes tab with timeline: 'Celebrating 25th anniversary — owner approved 10% discount', 'Prefers quiet room away from pool'"
```

### Sub-Feature 7: Related Guests & Party Tracking

```yaml
icon: Users
headline: "Track who travels together"
description: "When guests book as a group, Wielo links their profiles. See who's travelled with whom. Know when a returning guest's partner has also stayed before. Relationships matter — Wielo remembers them."
visual: "Relationships tab: 'Travelled with: Sarah Mitchell (wife) on 3 bookings, John Mitchell Jr. (son) on 1 booking'"
```

### Sub-Feature 8: Guest Reliability Metrics

```yaml
icon: ShieldCheck
headline: "Know who you can count on"
description: "See reliability metrics for each guest: cancellation count, honour rate, average lead time. Spot patterns before they become problems. Reward reliable guests. Be cautious with risky ones."
visual: "Stats card: 'Reliability: 100% · 0 cancellations · Avg lead: 45 days'"
```

### Sub-Feature 9: Direct Communication

```yaml
icon: Mail
headline: "Email your guests directly — no OTA in the middle"
description: "Send targeted emails to segments: all guests, VIPs, returning guests, or custom tags. Announce your December special. Share your new breakfast menu. Communicate directly with people who already know you."
visual: "Broadcast composer: Audience dropdown (VIP), Subject field, Body editor, 'Send to 47 guests' button"
```

### Sub-Feature 10: Export Your List

```yaml
icon: Download
headline: "Your data. Export it anytime."
description: "Export your full guest list as CSV — or export individual contacts as vCard. Filter before export to get exactly the segment you need. This is your database. Take it anywhere."
visual: "Export dropdown: 'Export filtered (123 guests)' / 'Export selection (5 guests)' / 'Export all' — CSV download"
```

### Sub-Feature 11: Block Problem Guests

```yaml
icon: Ban
headline: "Block guests who cause problems"
description: "Had a bad experience? Block the guest. They're excluded from broadcasts and flagged in your directory. Add a reason so you remember why. Protect your business from repeat problems."
visual: "Block modal: 'Block Sarah Mitchell' with reason field, blocked guest row with red indicator"
```

### Sub-Feature 12: Directory Search & Filters

```yaml
icon: Search
headline: "Find any guest in seconds"
description: "Search by name, email, or phone. Filter by segment, listing, channel (direct vs OTA), or rating. Sort by lifetime value, recent activity, or stays. Your directory scales with your business."
visual: "Search bar with filter chips: 'VIP · Beach House · R5,000+ lifetime · Sorted by value'"
```

---

## 6. How It Works

### Section Header

```
Eyebrow: "Zero effort CRM"
Headline: "Your guest database builds itself."
```

### Automatic Flow

```
Step 1: Guest books (or enquires, or requests a quote) — Contact auto-created
  Visual: "New booking from sarah@email.com" → Guest row appears in directory

Step 2: Booking completes — Stats update automatically
  Visual: Guest record: stays +1, lifetime value +R3,200

Step 3: Guest returns — Returning flag activates
  Visual: "Returning" badge appears, repeat-guest KPI updates

Step 4: You communicate directly — No OTA middleman
  Visual: Broadcast sent: "December Special" to 123 returning guests
```

### Manual Actions

```
Add manual contact — Guest you met at a market? Add them directly.
Add tags — Organize with labels like "Corporate" or "Wine tour".
Add notes — "Prefers early check-in" or "VIP — always upgrade."
Export anytime — Download CSV or vCard for your records.
```

---

## 7. Social Proof Section

### Section Header

```
Eyebrow: "From real hosts"
Headline: "Finally, guests that belong to you"
```

### Testimonial Placeholders

```
Testimonial 1:
  Quote: "I didn't realize how many returning guests I had until I saw it in Wielo. 38% of my bookings are repeats — and I wasn't doing anything special for them. Now I do."
  Name: "[Name]"
  Property: "Guesthouse · Stellenbosch"

Testimonial 2:
  Quote: "The lifetime value tracking changed how I think about guests. Some first-timers become R50k relationships. Now I know who to invest in."
  Name: "[Name]"
  Property: "Lodge · Hoedspruit"

Testimonial 3:
  Quote: "I exported my guest list after six months on Wielo. 400+ contacts. That's 400 people I can email directly about my December special — no commission."
  Name: "[Name]"
  Property: "Self-catering · Knysna"
```

### Use Case Scenarios

```
Scenario 1: A Winelands guesthouse tags corporate guests and sends them quarterly event invitations. Corporate bookings up 40% year-over-year.

Scenario 2: A Kruger lodge filters by "stayed in Honeymoon Suite" and sends anniversary emails. Direct re-bookings increase.

Scenario 3: A Cape Town host exports their guest list and imports it to Mailchimp for a seasonal newsletter. Wielo data, used anywhere.
```

### Stats (placeholder)

```
Stat 1: [X] guest contacts captured by founding hosts
Stat 2: [X]% average repeat-guest rate
Stat 3: R[X] total lifetime value tracked across all hosts
```

---

## 8. Comparison Section

### Section Header

```
Eyebrow: "Side by side"
Headline: "OTA guest access vs. Wielo Guest CRM"
```

### Comparison Table

| OTAs | With Wielo |
|------|-----------|
| Guest data locked in their platform | Your data, exportable anytime |
| Can't email past guests directly | Direct communication built in |
| No lifetime value tracking | See exactly what each guest is worth |
| Can't tell returning guests from new | Automatic returning-guest detection |
| No notes or context | Private notes per guest |
| No tagging or segmentation | Custom tags and smart segments |
| Guests shown competitor listings | Guests book direct with you |
| Commission on every repeat booking | Repeat bookings are commission-free |

---

## 9. FAQ Section

### Questions & Answers

```
Q: How do guests get added to my CRM?
A: Automatically. Every booking, quote request, and website enquiry creates or updates a contact. Deduplicated by email, so returning guests are matched to their existing record.

Q: Can I add guests manually?
A: Yes. Add contacts from business cards, referrals, or anywhere else. Manual contacts require email consent for marketing.

Q: What is "lifetime value"?
A: The total revenue from all completed stays for that guest. It's calculated automatically from your booking data.

Q: Can guests see my notes about them?
A: No. Notes are host-only. Guests never see your internal context.

Q: How does email marketing work?
A: You can send targeted emails to segments (e.g., all VIPs, all returning guests). Guests can unsubscribe with one click. You're limited to one broadcast per month to prevent spam.

Q: Can I export my guest list?
A: Yes. Export as CSV (for spreadsheets or other tools) or vCard (for individual contacts). Filter before export to get exactly the segment you need.

Q: What happens if I block a guest?
A: Blocked guests are excluded from broadcasts and flagged in your directory. Blocking doesn't prevent them from booking — it's a visibility/communication block.

Q: Does this replace a full CRM like HubSpot?
A: For most hosts, yes. Wielo covers contact management, history tracking, notes, tags, and email communication. If you need advanced marketing automation, you can export to other tools.
```

---

## 10. Final CTA Section

### Section Content

```
Eyebrow: "Ready to own your guest relationships?"
Headline: "Your guests. Your list. Your future bookings."
Body: "See how much revenue is locked in guests you can't reach. Take the 2-minute scorecard and discover what a real guest database could mean for your business."

Primary CTA: "Take the 2-minute Scorecard" → #scorecard
Secondary CTA: "Claim your founding spot" → /signup/host

Trust elements:
  - No card required
  - 90-day money-back guarantee
  - Guest CRM included in every plan
  - Export your data anytime
```

---

## 11. Design Notes for Claude Design

### Brand Reference

**Colours:**
| Token | Hex | Usage |
|-------|-----|-------|
| `brand-primary` | `#10B981` | CTAs, positive metrics |
| `brand-secondary` | `#064E3B` | Headers |
| `brand-accent` | `#D1FAE5` | Hover, highlights |
| `brand-light` | `#F0FDF4` | Page background |
| `brand-dark` | `#0A1510` | Hero, footer |
| `status-pending` | `#F59E0B` | VIP tag (amber/gold) |
| `status-completed` | `#6366F1` | Returning badge (indigo) |

**CRM-Specific Colors:**
- VIP tag: `#F59E0B` (amber/gold)
- Returning badge: `#6366F1` (indigo)
- New badge: `#94A3B8` (slate)
- Blocked indicator: `#EF4444` (red)
- Lifetime value: `#10B981` (green)

**Typography:**
- Display: Plus Jakarta Sans (headlines, KPIs)
- Body: Inter (descriptions)
- Mono: JetBrains Mono (email addresses, guest counts)

### Page Layout

```
1. HERO (dark gradient + dot grid)
   - Two-column: copy left, directory mockup right
   - Directory shows search, segments, guest rows

2. PROBLEM SECTION (light background)
   - Pain points as numbered cards
   - "Before Wielo" scenario as callout

3. SOLUTION OVERVIEW (white background)
   - Transformation statement
   - 4 differentiators as icon cards

4. FEATURE DEEP-DIVE (alternating light/white)
   - 12 sub-features grouped:
     * Capture (1-2): Auto-add, Profile
     * Analysis (3-5): Lifetime value, Returning, Tags
     * Context (6-8): Notes, Relationships, Reliability
     * Action (9-12): Email, Export, Block, Search

5. HOW IT WORKS (light background)
   - Automatic flow (4 steps)
   - Manual actions sidebar

6. SOCIAL PROOF (white background)
   - Testimonial cards
   - Stats bar

7. COMPARISON TABLE (light background)
   - OTAs vs Wielo format

8. FAQ (white background)
   - Accordion style

9. FINAL CTA (dark gradient)
   - Scorecard card
```

### Visual Mockups Needed

```
1. Guest directory with segment tabs + search
2. Guest record page with stats strip + tabs
3. Lifetime value KPI cards
4. Tag management UI
5. Notes timeline
6. Broadcast composer modal
7. Export dropdown
```

### Responsive Behaviour

```
Mobile (< 768px):
  - Single column directory
  - Segment tabs scroll horizontally
  - Guest records stack vertically

Tablet (768-1024px):
  - 2-column KPIs
  - Full directory table

Desktop (> 1024px):
  - Full layout with sidebar filters
  - Multi-column directory
```

### Animations

```
- KPI numbers count up on first view
- Guest rows animate in on scroll
- Tags pulse briefly when added
- "Returning" badge slides in on detection
```

### Lucide Icons Reference

| Sub-Feature | Icon |
|-------------|------|
| Auto Capture | `UserPlus` |
| Guest Profile | `User` |
| Lifetime Value | `TrendingUp` |
| Returning | `RefreshCw` |
| Tags | `Tags` |
| Notes | `StickyNote` |
| Relationships | `Users` |
| Reliability | `ShieldCheck` |
| Email | `Mail` |
| Export | `Download` |
| Block | `Ban` |
| Search | `Search` |

---

## Checklist

- [x] All sections completed with specific content
- [x] Headlines are benefit-focused
- [x] Pain points address OTA guest-locking
- [x] All claims verified against codebase (auto-capture, LTV, tags, export, etc.)
- [x] CTAs match /launch page pattern
- [x] Visual descriptions specific to CRM UI
- [x] FAQs address real concerns
- [x] Design notes include CRM-specific colors
- [x] 12 sub-features documented with icons
