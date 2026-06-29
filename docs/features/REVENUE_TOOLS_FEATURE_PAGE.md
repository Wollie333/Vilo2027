# Revenue Tools Feature — Sales Page Specification

> **For:** Claude Design
> **Feature:** Revenue & Pricing Tools
> **URL:** `/features/revenue-tools`
> **Status:** Ready for implementation

---

## 1. Page Meta & SEO

```yaml
title: "Revenue Tools for Accommodation Hosts — Wielo"
meta_description: "Seasonal pricing, add-on upsells, coupon codes, and smart discounts. Maximize revenue on every booking. Built for SA accommodation hosts."
url_slug: /features/revenue-tools
keywords:
  - accommodation pricing software
  - guesthouse revenue management
  - seasonal pricing tool
  - hospitality upselling
  - B&B coupon codes
og_title: "Revenue Tools — Maximize Every Booking | Wielo"
og_description: "Seasonal pricing, add-on upsells, and coupon codes. Control your rates. Increase your revenue. No commission."
og_image: "/images/features/revenue-tools-og.jpg"
```

---

## 2. Hero Section

### Headline Options

```
Option A: "Earn more from every booking."
Option B: "Smart pricing. Strategic upsells. More revenue."
Option C: "Stop leaving money on the table."
```

**Recommended:** Option C — addresses the pain directly, creates urgency.

### Subheadline

```
"Wielo gives you the pricing tools that big hotels use — seasonal rates, weekend premiums, add-on upsells, and coupon codes. Set them once, and they work automatically on every booking. No manual calculations. No missed opportunities."
```

### Hero CTA

```
Primary: "Take the 2-minute Scorecard" → #scorecard
Secondary: "See pricing in action" → #how-it-works
```

### Hero Visual

```
Pricing dashboard mockup showing:
- Seasonal pricing calendar with peak season highlighted
- Add-ons card: "Breakfast R150/day · Airport Transfer R350"
- Coupon card: "SUMMER20 · 20% off · 47 redemptions"
- Revenue increase indicator: "+R8,400 from add-ons this month"

Checkout flow snippet showing:
- Nightly rate calculation
- Weekend premium applied
- Add-ons selected
- Coupon discount applied
- Final total

Floating elements:
- "Peak Season +50%" badge on calendar
- "Breakfast added" notification
- Revenue chart trending upward
```

---

## 3. Problem / Pain Points Section

### Section Header

```
Eyebrow: "The pricing problem"
Headline: "You're charging the same rate in December as you are in February."
```

### Pain Points

```
1. Pain: Your rates are the same year-round. You charge the same in peak season as you do in the quiet months.
   Emotion: Frustration, missed opportunity
   Cost: You're leaving money on the table in high-demand periods.

2. Pain: You can't easily upsell extras. Guests might pay for breakfast, but you don't have a way to offer it during booking.
   Emotion: Helplessness
   Cost: Revenue you could have earned with zero extra effort.

3. Pain: You want to run a promotion, but you have no way to create and track coupon codes.
   Emotion: Limitation
   Cost: Marketing campaigns without conversion tracking. Missed direct booking opportunities.

4. Pain: You calculate prices manually for different room types, guest counts, and stay lengths. Errors happen.
   Emotion: Anxiety
   Cost: Undercharging or overcharging. Awkward conversations with guests.

5. Pain: Weekends are your busiest nights, but you charge the same as Tuesday.
   Emotion: Inefficiency
   Cost: You're not capturing the premium guests are willing to pay.
```

### "Before Wielo" Scenario

```
"It's December. Your property is fully booked. You're thrilled — until you realize you're charging your February rates. Every guest this month could have paid 30% more, and they would have. You didn't have a way to set seasonal pricing. You lost thousands."
```

---

## 4. Solution Overview

### Section Header

```
Eyebrow: "The Wielo way"
Headline: "Pricing that works as hard as you do."
```

### Transformation Statement

```
"From flat rates and manual calculations to dynamic pricing that adjusts by season, weekend, guest count, and stay length — with add-on upsells and coupon codes built in. Every booking is optimized automatically."
```

### Key Differentiators

```
1. Seasonal pricing with one setup — Set your peak, mid, and low-season rates once. They apply automatically to every booking in those date ranges.

2. Add-on upsells at checkout — Offer breakfast, transfers, early check-in, and more. Guests select and pay during booking. You earn more with zero extra work.

3. Coupon codes with tracking — Create discount codes for marketing campaigns. Track redemptions. Set caps. Run promotions that actually convert.

4. Smart occupancy pricing — Charge per room, per person, or per-room-plus-extras. The calculation happens automatically — no manual math.
```

---

## 5. Feature Deep-Dive Sections

### Sub-Feature 1: Seasonal Pricing Rules

```yaml
icon: Sun
headline: "Charge more when demand is high — automatically"
description: "Create seasonal pricing rules for peak periods, festivals, or quiet seasons. Set a percentage increase or a fixed rate. Rules apply automatically to any booking in those dates. No manual updates needed."
visual: "Seasonal pricing form: 'Festive Peak' · 15-31 Dec · +50% · Priority 10 — with calendar showing highlighted dates"
```

### Sub-Feature 2: Weekend Pricing

```yaml
icon: Calendar
headline: "Premium rates for high-demand nights"
description: "Set a different rate for Friday and Saturday nights. When weekends are your busiest, capture the premium guests are willing to pay. Applied automatically — no per-booking adjustment."
visual: "Room card showing: 'Base: R1,200/night · Weekend: R1,500/night' with Fri/Sat highlighted on calendar"
```

### Sub-Feature 3: Add-On Upsells

```yaml
icon: Plus
headline: "Upsell extras at checkout — breakfast, transfers, experiences"
description: "Create add-ons with flexible pricing: per stay, per night, per guest, or per couple. Guests see them during checkout and add what they want. Revenue increases without any extra effort from you."
visual: "Checkout add-ons section: 'Breakfast R150/person/day · Airport Transfer R350 · Early Check-in R200'"
```

### Sub-Feature 4: Add-On Pricing Models

```yaml
icon: DollarSign
headline: "Five pricing models for any extra"
description: "Price add-ons the way that makes sense: flat per stay, per night, per guest, per guest per night, or per couple. A 3-night stay for 4 guests calculates differently for a per-stay breakfast vs. a per-guest activity. Wielo handles it."
visual: "Add-on editor showing pricing model dropdown: per_stay, per_night, per_guest, per_guest_per_night, per_couple"
```

### Sub-Feature 5: Coupon Codes

```yaml
icon: Tag
headline: "Create discount codes for marketing campaigns"
description: "Generate coupon codes with percentage or fixed discounts. Target specific listings, rooms, or add-ons. Set minimum nights, minimum spend, and redemption caps. Track exactly how many guests used each code."
visual: "Coupon form: Code 'SUMMER20' · 20% off · Accommodation only · Max 50 redemptions · Active 1-31 Dec"
```

### Sub-Feature 6: Coupon Tracking & Caps

```yaml
icon: BarChart3
headline: "Know exactly which promotions work"
description: "Every coupon shows redemption count and revenue impact. Set per-guest limits so one person can't use a code repeatedly. Set total caps so you don't over-discount. Data-driven marketing."
visual: "Coupon dashboard: 'SUMMER20 · 47/50 redemptions · R14,200 discounted · Ends in 3 days'"
```

### Sub-Feature 7: Length-of-Stay Discounts

```yaml
icon: Clock
headline: "Reward longer stays automatically"
description: "Set weekly and monthly discount percentages. Book 7+ nights, get 5% off. Book 28+ nights, get 15% off. Applied automatically to the accommodation subtotal — never to cleaning or add-ons."
visual: "Discount settings: 'Weekly (7+ nights): 5% · Monthly (28+ nights): 15%' — with checkout showing discount applied"
```

### Sub-Feature 8: Per-Person Pricing

```yaml
icon: Users
headline: "Charge by guest count when it makes sense"
description: "Some rooms scale by headcount. Wielo supports per-person pricing, per-room-plus-extra-guests, and flat per-room rates. The occupancy model you choose drives automatic calculation at checkout."
visual: "Room pricing: 'R500/person/night' or 'R1,500/night + R300/extra guest' — with guest count slider"
```

### Sub-Feature 9: Cleaning Fees

```yaml
icon: Sparkles
headline: "Charge once for turnover — not per night"
description: "Set a flat cleaning fee per room or per booking. Charged once regardless of stay length. Never discounted by length-of-stay offers. Protects your margin while keeping nightly rates competitive."
visual: "Room card: 'Nightly: R1,200 · Cleaning (once): R250' — with checkout breakdown showing both"
```

### Sub-Feature 10: Whole-Property Discounts

```yaml
icon: Home
headline: "Incentivize guests to book the whole place"
description: "Offer a percentage discount when guests book all rooms together. Encourages larger bookings, fills the property faster. Applied automatically when the booking includes all units."
visual: "Discount badge: 'Book all 3 rooms · Save 10%' — with checkout showing whole-combo discount line"
```

### Sub-Feature 11: Deals & Specials

```yaml
icon: Gift
headline: "Package stays with fixed or flexible pricing"
description: "Create special offers with fixed dates or flexible windows. Set a flat total or per-night rate. Bundle required add-ons. Limit quantity for exclusivity. Perfect for holiday packages, last-minute deals, or anniversary specials."
visual: "Special card: 'Romantic Escape · 2 nights · R3,500 flat · Includes breakfast + wine · 5 remaining'"
```

### Sub-Feature 12: Real-Time Price Preview

```yaml
icon: Eye
headline: "See exactly what guests will pay — before they do"
description: "As you configure pricing, see a live preview of how bookings will calculate. Change a seasonal rule, watch the price update. No surprises for you or your guests."
visual: "Split view: Pricing settings on left, live preview on right showing 'Dec 20-23: R1,800/night (Peak Season +50%)'"
```

---

## 6. How It Works

### Section Header

```
Eyebrow: "Set once, work forever"
Headline: "Configure your pricing. Let Wielo do the math."
```

### Setup Journey

```
Step 1: Set your base rates — Nightly price per room, plus optional weekend rate
  Visual: Room pricing form with base + weekend fields

Step 2: Add seasonal rules — Mark peak periods, quiet seasons, special events
  Visual: Calendar with seasonal rule overlay showing +50% for Festive

Step 3: Create add-ons — Breakfast, transfers, activities with pricing model
  Visual: Add-on list: Breakfast (per_guest_per_night), Transfer (per_stay)

Step 4: Set discounts & coupons — Length-of-stay, whole-property, promo codes
  Visual: Discount panel with weekly/monthly sliders + coupon code input
```

### Guest Checkout Flow

```
Step 1: Guest selects dates — Seasonal/weekend rates apply automatically
  Visual: Calendar with price per night shown

Step 2: Guest selects rooms/guests — Occupancy pricing calculates
  Visual: Guest count picker with running total updating

Step 3: Guest adds extras — Add-ons selected and priced
  Visual: Checkbox list of add-ons with subtotals

Step 4: Guest applies coupon — Discount verified and applied
  Visual: Coupon field with "SUMMER20 applied · -R420" confirmation
```

---

## 7. Social Proof Section

### Section Header

```
Eyebrow: "From real hosts"
Headline: "Revenue they didn't know they were missing"
```

### Testimonial Placeholders

```
Testimonial 1:
  Quote: "I added seasonal pricing for December and my revenue jumped 35% compared to last year. Same bookings, same work — just smarter rates."
  Name: "[Name]"
  Property: "Self-catering · Plettenberg Bay"

Testimonial 2:
  Quote: "The add-on feature alone pays for Wielo. Airport transfers, breakfast, late checkout — guests add them without me asking. R6,000 extra revenue last month."
  Name: "[Name]"
  Property: "Guesthouse · Cape Town"

Testimonial 3:
  Quote: "I ran a coupon campaign for returning guests — 15% off direct bookings. 23 redemptions in the first month. That's 23 bookings without OTA commission."
  Name: "[Name]"
  Property: "Lodge · Mpumalanga"
```

### Use Case Scenarios

```
Scenario 1: A Franschhoek wine estate sets +40% for harvest festival weeks. Every booking in that period earns more — automatically.

Scenario 2: A Cape Town apartment offers airport transfers at checkout. 60% of guests add it. R350 × 20 bookings/month = R7,000 extra revenue.

Scenario 3: A Drakensberg lodge creates a "Winter Escape" special — 3 nights, flat R4,500, includes breakfast. Sells out in 2 weeks.
```

### Stats (placeholder)

```
Stat 1: [X]% average revenue increase with seasonal pricing
Stat 2: R[X] add-on revenue generated by founding hosts
Stat 3: [X] coupon codes redeemed to date
```

---

## 8. Comparison Section

### Section Header

```
Eyebrow: "Side by side"
Headline: "Flat pricing vs. Wielo Revenue Tools"
```

### Comparison Table

| Without Wielo | With Wielo |
|--------------|-----------|
| Same rate year-round | Seasonal pricing adjusts automatically |
| No way to upsell extras | Add-ons at checkout increase revenue |
| Manual price calculations | Automatic occupancy + discount math |
| No coupon codes | Tracked promotions with redemption caps |
| Weekends priced like weekdays | Weekend premium rates capture demand |
| Complex discounts done manually | Length-of-stay discounts apply automatically |
| No visibility into what's working | Revenue tracking shows impact |
| Leaving money on the table | Every booking optimized |

---

## 9. FAQ Section

### Questions & Answers

```
Q: How does seasonal pricing work with weekend rates?
A: Seasonal rules replace weekend rates — they don't stack. If December has a +50% seasonal rule, that applies to Friday and Saturday too. This keeps pricing predictable.

Q: Can I price add-ons differently for different properties?
A: Yes. You create add-ons in your catalog, then attach them to specific listings with optional price overrides per listing.

Q: How do I track coupon performance?
A: Each coupon shows redemption count and total discount given. You can see which codes are working and which aren't.

Q: What happens if a coupon reaches its redemption cap?
A: It automatically stops accepting new redemptions. Guests see "code expired" if they try to use it.

Q: Are cleaning fees ever discounted?
A: No. Cleaning fees are charged once per booking and are never reduced by length-of-stay or coupon discounts.

Q: Can I offer discounts for longer stays?
A: Yes. Set weekly (7+ nights) and monthly (28+ nights) percentage discounts. They apply automatically to the accommodation subtotal.

Q: How does per-person pricing work with seasonal rules?
A: Percentage seasonal rules scale correctly with per-person pricing. Absolute (fixed price) seasonal rules become flat — so use percentages for per-person rooms.

Q: Can I create limited-quantity specials?
A: Yes. Deals & Specials have quantity caps. When they sell out, they're no longer bookable. Perfect for exclusive packages.
```

---

## 10. Final CTA Section

### Section Content

```
Eyebrow: "Ready to earn more from every booking?"
Headline: "Your rates should work as hard as you do."
Body: "See how much revenue you might be missing with flat pricing and no upsells. Take the 2-minute scorecard and find out."

Primary CTA: "Take the 2-minute Scorecard" → #scorecard
Secondary CTA: "Claim your founding spot" → /signup/host

Trust elements:
  - No card required
  - 90-day money-back guarantee
  - Revenue tools included in every plan
  - No commission — keep every rand
```

---

## 11. Design Notes for Claude Design

### Brand Reference

**Colours:**
| Token | Hex | Usage |
|-------|-----|-------|
| `brand-primary` | `#10B981` | CTAs, positive metrics |
| `brand-secondary` | `#064E3B` | Headers |
| `brand-accent` | `#D1FAE5` | Highlights |
| `brand-light` | `#F0FDF4` | Page background |
| `brand-dark` | `#0A1510` | Hero, footer |
| `status-pending` | `#F59E0B` | Peak season highlight |
| `status-confirmed` | `#10B981` | Revenue positive |

**Revenue-Specific Colors:**
- Peak season: `#F59E0B` (amber)
- Low season: `#3B82F6` (blue)
- Discount applied: `#10B981` (green)
- Coupon badge: `#8B5CF6` (purple)
- Add-on selected: `#D1FAE5` (brand-accent)

**Typography:**
- Display: Plus Jakarta Sans (headlines, KPIs)
- Body: Inter (descriptions)
- Mono: JetBrains Mono (prices, percentages)

### Page Layout

```
1. HERO (dark gradient + dot grid)
   - Two-column: copy left, pricing dashboard right
   - Dashboard shows seasonal calendar + add-ons + revenue chart

2. PROBLEM SECTION (light background)
   - Pain points as numbered cards
   - "Before Wielo" scenario as callout

3. SOLUTION OVERVIEW (white background)
   - Transformation statement
   - 4 differentiators as icon cards

4. FEATURE DEEP-DIVE (alternating light/white)
   - 12 sub-features grouped:
     * Dynamic Pricing (1-3): Seasonal, Weekend, Add-ons
     * Configuration (4-6): Pricing models, Coupons, Tracking
     * Discounts (7-10): Length-of-stay, Per-person, Cleaning, Whole-property
     * Packages (11-12): Specials, Preview

5. HOW IT WORKS (light background)
   - Setup journey (4 steps)
   - Guest checkout flow (4 steps)

6. SOCIAL PROOF (white background)
   - Testimonial cards
   - Stats bar

7. COMPARISON TABLE (light background)
   - Without vs With format

8. FAQ (white background)
   - Accordion style

9. FINAL CTA (dark gradient)
   - Scorecard card
```

### Visual Mockups Needed

```
1. Seasonal pricing calendar with peak overlay
2. Add-on selection at checkout
3. Coupon tracking dashboard
4. Price breakdown (nightly + seasonal + discount + add-ons)
5. Length-of-stay discount configuration
6. Special/deal card with countdown
```

### Responsive Behaviour

```
Mobile (< 768px):
  - Single column
  - Price calculator simplified
  - Coupon list scrolls horizontally

Tablet (768-1024px):
  - 2-column feature grids

Desktop (> 1024px):
  - Full dashboard layouts
  - Side-by-side configuration + preview
```

### Animations

```
- Price totals animate on change
- Seasonal calendar highlights fade in
- Add-on selections have checkbox pop
- Revenue chart counts up
```

### Lucide Icons Reference

| Sub-Feature | Icon |
|-------------|------|
| Seasonal Pricing | `Sun` |
| Weekend Pricing | `Calendar` |
| Add-Ons | `Plus` |
| Pricing Models | `DollarSign` |
| Coupons | `Tag` |
| Coupon Tracking | `BarChart3` |
| Length-of-Stay | `Clock` |
| Per-Person | `Users` |
| Cleaning Fees | `Sparkles` |
| Whole-Property | `Home` |
| Specials | `Gift` |
| Price Preview | `Eye` |

---

## Checklist

- [x] All sections completed with specific content
- [x] Headlines are benefit-focused
- [x] Pain points address revenue leakage
- [x] All claims verified against codebase (5-stage pricing stack, add-on models, coupons, etc.)
- [x] CTAs match /launch page pattern
- [x] Visual descriptions specific to pricing UI
- [x] FAQs address real configuration questions
- [x] Design notes include revenue-specific colors
- [x] 12 sub-features documented with icons
