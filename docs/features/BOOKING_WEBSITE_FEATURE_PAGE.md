# Booking Website Feature — Sales Page Specification

> **For:** Claude Design
> **Feature:** Your Branded Booking Website
> **URL:** `/features/booking-website`
> **Status:** Ready for implementation

---

## 1. Page Meta & SEO

```yaml
title: "Your Own Booking Website — Vilo"
meta_description: "Get a professional booking website with instant book, photo gallery, and real-time availability. No developer needed. Keep 100% of every booking. Built for SA hosts."
url_slug: /features/booking-website
keywords:
  - accommodation booking website
  - guesthouse website south africa
  - direct booking website
  - lodge booking page
  - vacation rental website builder
og_title: "Your Own Booking Website — No Developer Needed | Vilo"
og_description: "Professional booking pages with instant book, photo galleries, and 0% commission. Get your custom URL and start taking direct bookings today."
og_image: "/images/features/booking-website-og.jpg"
```

---

## 2. Hero Section

### Headline Options

```
Option A: "Your property. Your website. Your bookings."
Option B: "A booking site that looks like you hired an agency."
Option C: "Stop renting space on someone else's platform."
```

**Recommended:** Option B — addresses the desire for professionalism without cost.

### Subheadline

```
"Vilo gives you a fully branded booking website with instant book, beautiful photo galleries, and real-time availability — no developer, no agency invoice, no commission on bookings. Just your custom URL and guests who pay you directly."
```

### Hero CTA

```
Primary: "Take the 2-minute Scorecard" → #scorecard
Secondary: "See a live example" → [link to demo property page]
```

### Hero Visual

```
Browser mockup showing a property detail page:
- URL bar: "viloplatform.com/featherstone-lodge"
- Hero photo gallery (full-width image + grid of 4)
- Property name, location badge, instant book badge
- Sticky reserve panel on right: "From R1,200 / night" + calendar + "Reserve" button
- Host card with avatar, verified badge, rating stars

Mobile phone mockup floating alongside:
- Same property on mobile view
- Bottom bar: "R1,200 / night · Reserve"

Floating elements:
- "Instant Book" badge
- 5-star rating badge
- "Verified Host" badge
```

---

## 3. Problem / Pain Points Section

### Section Header

```
Eyebrow: "The DIY dilemma"
Headline: "Building your own booking site costs a fortune. Not having one costs more."
```

### Pain Points

```
1. Pain: You want a website, but web developers quote R30,000+. You can't justify it when you're already paying OTA commissions.
   Emotion: Frustration, feeling stuck
   Cost: You stay dependent on platforms that take 15-20% of every booking.

2. Pain: You tried WordPress or Wix, but it doesn't handle bookings. You need another plugin, another subscription, another thing to manage.
   Emotion: Overwhelm
   Cost: A patchwork of tools that never quite work together.

3. Pain: Your website looks amateur compared to Airbnb. Guests don't trust it enough to pay upfront.
   Emotion: Embarrassment
   Cost: Guests book on the OTA instead — where they feel safe — and you pay commission.

4. Pain: Your availability isn't real-time. Guests enquire about dates you've already sold. You look unprofessional.
   Emotion: Embarrassment
   Cost: Frustrated guests. Lost bookings. Damaged reputation.

5. Pain: You can't accept payments online. Guests have to EFT and you chase proof-of-payment for days.
   Emotion: Anxiety
   Cost: Bookings fall through. Cash flow suffers.
```

### "Before Vilo" Scenario

```
"You send potential guests to your Instagram. They DM asking about availability. You check your calendar, reply hours later. By then, they've found somewhere else with an 'Instant Book' button. You'll never know how many bookings you've lost to friction."
```

---

## 4. Solution Overview

### Section Header

```
Eyebrow: "The Vilo way"
Headline: "A professional booking website — in 20 minutes, not 2 months."
```

### Transformation Statement

```
"From sending guests to your Instagram or a clunky WordPress site to a beautiful, bookable property page with real-time availability, instant payment, and your own custom URL — without writing a line of code."
```

### Key Differentiators

```
1. Ready in minutes, not months — Upload photos, set your rates, and you're live. No developer. No agency. No waiting.

2. Looks like a premium platform — Clean, fast, mobile-first design that rivals Airbnb. Your guests trust it enough to pay upfront.

3. Real-time availability — Your calendar updates instantly. No stale dates. No embarrassing double-enquiries.

4. Zero commission — Guests pay you directly via Paystack or PayPal. Vilo never touches your booking revenue.
```

---

## 5. Feature Deep-Dive Sections

### Sub-Feature 1: Your Custom URL

```yaml
icon: Globe
headline: "Your own booking address — professional and memorable"
description: "Get a clean URL like viloplatform.com/your-name or viloplatform.com/property/your-lodge. Share it everywhere — Instagram bio, business cards, email signatures. One link that takes guests straight to booking."
visual: "Browser address bar showing 'viloplatform.com/featherstone-lodge' with property page loading"
```

### Sub-Feature 2: Photo Gallery & Lightbox

```yaml
icon: Image
headline: "Showcase your property with a stunning gallery"
description: "Upload up to 20 photos per listing. Your hero image leads the page, with a grid of highlights below. Guests click to open a full-screen lightbox with keyboard navigation. Mobile-optimized with touch-friendly controls."
visual: "Photo gallery layout: hero image + 4-photo grid, 'Show all 18 photos' button, then lightbox overlay with arrows"
```

### Sub-Feature 3: Instant Book

```yaml
icon: Zap
headline: "Let guests book and pay immediately — no back-and-forth"
description: "Turn on Instant Book and guests confirm their stay with one click. No waiting for your approval. Payment processes, calendar blocks, confirmation sends — all automatic. You wake up to bookings, not enquiries."
visual: "Reserve panel with 'Instant Book' badge, guest clicking 'Reserve' button, confirmation toast appearing"
```

### Sub-Feature 4: Real-Time Availability Calendar

```yaml
icon: CalendarDays
headline: "Your availability — always accurate, always live"
description: "Guests see exactly which dates are available. Blocked dates from Vilo bookings, iCal imports, and manual holds all show instantly. No more 'let me check my calendar' — they check it themselves."
visual: "Two-month calendar with available dates in white, blocked dates crossed out, selected range highlighted in green"
```

### Sub-Feature 5: Room Selection (Multi-Room Properties)

```yaml
icon: BedDouble
headline: "Let guests choose their room — or book the whole place"
description: "Running a guesthouse with multiple rooms? Guests can browse and select specific rooms, each with their own photos, beds, and pricing. Or offer the whole property for exclusive use. Flexible booking modes for any setup."
visual: "Room picker showing 3 room cards: 'Garden Suite · R1,200/night', 'Ocean View · R1,500/night', 'Honeymoon Suite · R1,800/night' with photo and bed icons"
```

### Sub-Feature 6: Seasonal Pricing Display

```yaml
icon: Sun
headline: "Show your rates — including peak season adjustments"
description: "Display your pricing clearly with a rates table. Base prices, weekend rates, seasonal adjustments — all visible so guests know what to expect. No hidden surprises. Current season highlighted so they see exactly what they'll pay."
visual: "Rates table: columns for 'Standard', 'Peak Season', 'Festive'; row for room name + prices; 'You're booking in Peak Season' badge"
```

### Sub-Feature 7: Amenities & Property Details

```yaml
icon: CheckSquare
headline: "Highlight what makes your property special"
description: "Showcase your amenities with a clean, expandable grid. Pool, WiFi, braai, mountain views — each with its icon. Plus detailed property info: bedrooms, bathrooms, capacity, check-in times, house rules. Everything guests need to decide."
visual: "Amenities grid showing icons: WiFi, Pool, Parking, Kitchen, Mountain View, Fireplace — with 'Show all 24 amenities' expand button"
```

### Sub-Feature 8: Host Profile & Trust Badges

```yaml
icon: UserCheck
headline: "Build trust with a professional host profile"
description: "Your profile appears on every listing. Avatar, bio, verification badges, response time, languages spoken. Guests see you're a real, responsive, verified host — not a faceless listing. Trust converts browsers into bookers."
visual: "Host card: avatar photo, 'Sarah M. · Verified Host · Responds in 2 hours · English, Afrikaans'"
```

### Sub-Feature 9: Guest Reviews & Ratings

```yaml
icon: Star
headline: "Show off your reputation with verified reviews"
description: "Reviews from past guests display prominently with six-category ratings: cleanliness, communication, check-in, accuracy, location, value. Your average score and review count build social proof. Great reviews = more bookings."
visual: "Review section: 4.9 stars, 47 reviews, 6-category breakdown bars, sample review card with guest name + date + comment"
```

### Sub-Feature 10: Request a Quote Button

```yaml
icon: MessageSquare
headline: "Capture enquiries without losing the booking flow"
description: "Some guests want to negotiate or ask questions first. The 'Request a Quote' button opens a modal right on your listing page. They send details, you respond with a custom quote — all without them leaving your site."
visual: "Property page with 'Request a Quote' button below Reserve, modal overlay showing quote request form"
```

### Sub-Feature 11: Mobile-First Design

```yaml
icon: Smartphone
headline: "Beautiful on every device — because most guests browse on phones"
description: "Your booking pages are mobile-first. Large touch targets, easy navigation, sticky 'Reserve' bar at the bottom. Guests complete bookings from their phones as easily as from a laptop. No pinching, no zooming, no frustration."
visual: "Three phone mockups showing: property hero, room selection, payment form — all clean and tappable"
```

### Sub-Feature 12: Add-Ons at Checkout

```yaml
icon: Plus
headline: "Upsell breakfast, transfers, and extras during booking"
description: "Offer add-ons that guests can select during checkout. Airport transfer, breakfast package, early check-in — each with clear pricing. Guests add what they want, you increase your revenue per booking."
visual: "Checkout step 2: Add-ons section with checkboxes — 'Breakfast (R150/person/day)', 'Airport Transfer (R350)', 'Early Check-in (R200)'"
```

---

## 6. How It Works

### Section Header

```
Eyebrow: "Simple setup"
Headline: "From sign-up to bookable — in under 20 minutes."
```

### Host Setup Journey

```
Step 1: Create your listing — Add photos, description, amenities, and house rules
  Visual: Listing builder form with photo upload grid

Step 2: Set your rates — Configure base price, weekend price, seasonal rules, and cleaning fee
  Visual: Pricing form with nightly rate inputs

Step 3: Connect payments — Link Paystack or PayPal (or enable manual EFT)
  Visual: Payment setup with Paystack logo + "Connected" badge

Step 4: Go live — Toggle 'Published' and share your URL anywhere
  Visual: "Your listing is live!" success message with shareable URL + social icons
```

### Guest Booking Journey

```
Step 1: Find your page — Guest clicks link from Instagram, email, or Google
  Visual: Browser loading property page

Step 2: Check availability — Guest picks dates on your calendar
  Visual: Calendar with date range selected

Step 3: Select & customize — Choose room, add guests, pick add-ons
  Visual: Booking form step 2 with room + add-ons

Step 4: Pay & confirm — Complete payment, instant confirmation
  Visual: Success page with booking reference + "You're all set!"
```

---

## 7. Social Proof Section

### Section Header

```
Eyebrow: "From real hosts"
Headline: "Finally, a website that works as hard as you do"
```

### Testimonial Placeholders

```
Testimonial 1:
  Quote: "I spent R25,000 on a website three years ago. It never worked properly and I still couldn't take bookings. Vilo gave me something better in an afternoon — for a fraction of the cost."
  Name: "[Name]"
  Property: "Guesthouse · Franschhoek"

Testimonial 2:
  Quote: "The instant book feature changed everything. I used to lose half my enquiries because I couldn't respond fast enough. Now guests book while I'm asleep."
  Name: "[Name]"
  Property: "Self-catering · Hermanus"

Testimonial 3:
  Quote: "My guests actually comment on how professional the booking page looks. That trust is everything when you're asking someone to pay upfront."
  Name: "[Name]"
  Property: "Lodge · Mpumalanga"
```

### Use Case Scenarios

```
Scenario 1: A Stellenbosch wine estate puts their Vilo link in their Instagram bio. 40% of bookings now come direct from social media — zero commission.

Scenario 2: A Drakensberg lodge uses room selection to let guests choose between Mountain View and Garden Suites. Average booking value increased 15% from room upgrades.

Scenario 3: A Cape Town apartment owner enables Instant Book. Response time dropped from 4 hours to zero. Booking conversion doubled.
```

### Stats (placeholder)

```
Stat 1: [X] properties live on Vilo
Stat 2: [X]% average booking conversion for instant-book properties
Stat 3: R[X] average commission saved per founding host this year
```

---

## 8. Comparison Section

### Section Header

```
Eyebrow: "Side by side"
Headline: "DIY websites vs. Vilo booking pages"
```

### Comparison Table

| Without Vilo | With Vilo |
|--------------|-----------|
| R30,000+ for a custom website | Professional booking page included |
| Weeks of back-and-forth with developers | Live in 20 minutes |
| Separate booking plugins and payment gateways | Everything built in |
| Manual availability — always out of date | Real-time calendar from your bookings |
| Guests don't trust it enough to pay online | Polished design that builds trust |
| No instant book — endless enquiry ping-pong | One-click booking and payment |
| Mobile experience is an afterthought | Mobile-first design |
| You maintain it yourself (or pay more) | Always updated, always working |

---

## 9. FAQ Section

### Questions & Answers

```
Q: Do I need technical skills to set this up?
A: None. If you can fill in a form and upload photos, you can launch your booking page. Most hosts are live in under 20 minutes.

Q: Can I use my own domain name?
A: Your Vilo pages live at viloplatform.com/your-handle. Custom domain support (yourname.com) is on the roadmap.

Q: How do guests pay?
A: Via Paystack (cards + instant EFT) or PayPal. You can also enable manual bank transfer with proof-of-payment upload. Guests pay you directly — Vilo never holds your money.

Q: What if I have multiple rooms or properties?
A: Add as many rooms and properties as you need. Each room can have its own photos, beds, and pricing. Guests can book individual rooms or the whole property.

Q: Can I control which dates are available?
A: Yes. Your Vilo calendar syncs with your bookings automatically. You can also manually block dates and import blocks from external calendars (Airbnb, Booking.com) via iCal.

Q: What's the difference between Instant Book and Request to Book?
A: Instant Book lets guests confirm and pay immediately. Request to Book sends you an enquiry first — you review and approve before they pay. You control which mode to use.

Q: Are reviews real?
A: Yes. Only guests who completed a stay can leave reviews. Reviews show six category ratings (cleanliness, communication, etc.) and are published to your public page.

Q: Will my page show up on Google?
A: Yes. Your property pages are optimized for search engines with proper meta tags, structured data, and fast load times. The more content and reviews you have, the better you'll rank.
```

---

## 10. Final CTA Section

### Section Content

```
Eyebrow: "Ready for your own booking website?"
Headline: "Your guests are looking for you. Give them somewhere to book."
Body: "See how much a professional booking site could save you — in commission, in time, and in lost bookings. Take the 2-minute scorecard."

Primary CTA: "Take the 2-minute Scorecard" → #scorecard
Secondary CTA: "Claim your founding spot" → /signup/host

Trust elements:
  - No card required
  - 90-day money-back guarantee
  - Booking website included in every plan
  - No commission on bookings — ever
```

---

## 11. Design Notes for Claude Design

### Brand Reference

**Colours:**
| Token | Hex | Usage |
|-------|-----|-------|
| `brand-primary` | `#10B981` | CTAs, Reserve buttons, badges |
| `brand-secondary` | `#064E3B` | Headers, hover states |
| `brand-accent` | `#D1FAE5` | Hover surfaces, highlights |
| `brand-light` | `#F0FDF4` | Page background |
| `brand-dark` | `#0A1510` | Hero, footer |
| `status-confirmed` | `#10B981` | Instant Book badge |

**Property Page Colors:**
- Reserve panel: White with border, `shadow-card`
- Selected dates: `#10B981` (brand-primary)
- Blocked dates: `#94A3B8` (slate) with strikethrough
- Price display: `brand-secondary` for emphasis

**Typography:**
- Display: Plus Jakarta Sans (property names, headlines)
- Body: Inter (descriptions, details)
- Mono: JetBrains Mono (booking references)

### Page Layout

```
1. HERO (dark gradient + dot grid)
   - Two-column: copy left, browser mockup right
   - Browser shows property page with gallery visible

2. PROBLEM SECTION (light background)
   - Pain points as numbered cards
   - "Before Vilo" scenario as callout

3. SOLUTION OVERVIEW (white background)
   - Transformation statement
   - 4 differentiators as icon cards

4. FEATURE DEEP-DIVE (alternating light/white)
   - 12 sub-features grouped:
     * Your Presence (1-2): URL, Gallery
     * Booking Flow (3-5): Instant Book, Calendar, Rooms
     * Display (6-9): Pricing, Amenities, Host Profile, Reviews
     * Conversion (10-12): Quote button, Mobile, Add-ons

5. HOW IT WORKS (light background)
   - Host setup (4 steps)
   - Guest journey (4 steps)
   - Side-by-side with arrows

6. SOCIAL PROOF (white background)
   - Testimonial cards (3-column)
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
1. Browser mockup of property detail page (hero + gallery + reserve panel)
2. Mobile mockup of same property
3. Photo lightbox in full-screen mode
4. Calendar component with date selection
5. Room picker for multi-room properties
6. Checkout flow (3 steps simplified)
7. Host profile card with badges
8. Review section with rating breakdown
```

### Responsive Behaviour

```
Mobile (< 768px):
  - Single column
  - Photo gallery shows hero only + count badge
  - Reserve panel becomes bottom sticky bar

Tablet (768-1024px):
  - 2-column grids
  - Gallery shows more photos

Desktop (> 1024px):
  - Full layout with sticky reserve panel
  - 3-column amenity grids
```

### Animations

```
- Photo lightbox: fade in, slide between photos
- Calendar dates: subtle highlight on hover
- Reserve panel: sticky with shadow on scroll
- "Instant Book" badge: subtle pulse on first view
```

### Lucide Icons Reference

| Sub-Feature | Icon |
|-------------|------|
| Custom URL | `Globe` |
| Photo Gallery | `Image` |
| Instant Book | `Zap` |
| Availability | `CalendarDays` |
| Room Selection | `BedDouble` |
| Seasonal Pricing | `Sun` |
| Amenities | `CheckSquare` |
| Host Profile | `UserCheck` |
| Reviews | `Star` |
| Request Quote | `MessageSquare` |
| Mobile Design | `Smartphone` |
| Add-Ons | `Plus` |

---

## Checklist

- [x] All sections completed with specific content
- [x] Headlines are benefit-focused
- [x] Pain points use emotional language
- [x] All claims verified against codebase (instant book, gallery, rooms, etc.)
- [x] CTAs match /launch page pattern
- [x] Visual descriptions specific to property pages
- [x] FAQs address real concerns (domain, payments, rooms)
- [x] Design notes include property page specifics
- [x] 12 sub-features documented with icons
