# Review Manager Feature Page Specification

> **Purpose:** Comprehensive brief for Claude Design to build a conversion-focused feature sales page for Wielo's Review Manager.
> **URL:** `/features/review-manager`

---

## 1. Page Meta & SEO

| Field | Content |
|-------|---------|
| **Page Title** | Review Manager for SA Accommodation Hosts | Wielo |
| **Meta Description** | Collect, manage, and showcase guest reviews that build trust and boost direct bookings. Automated requests, photo reviews, host responses, and moderation — all in one place. |
| **Target Keywords** | guest review system, accommodation reviews, review management software, collect guest reviews, review automation, South Africa accommodation |
| **URL Slug** | `/features/review-manager` |
| **OG Title** | Build Trust with Every Stay — Wielo Review Manager |
| **OG Description** | Automated review collection, photo-rich testimonials, and reputation management designed for SA accommodation hosts. |

---

## 2. Hero Section

### Primary Headline Options
1. "Turn Happy Guests into Powerful Social Proof"
2. "Reviews That Convert Browsers into Bookers"
3. "Collect, Curate, and Showcase Authentic Guest Reviews"

### Subheadline
"Automated review requests, photo-rich testimonials, and reputation management — designed specifically for South African accommodation hosts."

### Hero CTA
- **Primary:** "Take the 2-minute Scorecard" → `#scorecard`
- **Secondary:** "Claim your founding spot" → `/signup/host`

### Hero Visual Suggestion
Split-screen mockup:
- **Left:** Mobile view of guest receiving review request email with one-tap link
- **Right:** Dashboard showing 4.8-star aggregate rating, rating breakdown chart, and recent review cards with photos and host responses

---

## 3. Problem / Pain Points Section

### Section Header
"Sound Familiar?"

### Pain Points

| Pain Point | Emotional Hook | Before Wielo |
|------------|---------------|-------------|
| **Forgetting to ask for reviews** | "Checkout chaos means no follow-up" | Guests leave, life moves on, review opportunity lost forever |
| **Low review response rates** | "You asked once, they forgot twice" | Guests mean to review but never get around to it |
| **No photos in reviews** | "Words alone don't sell stays" | Text-only reviews that don't showcase your property |
| **Scattered reviews across platforms** | "Reviews everywhere except your site" | OTAs own your social proof, you can't display it |
| **No way to respond professionally** | "Negative feedback hangs unanswered" | Bad reviews sit there unchallenged, damaging trust |
| **Problem guests book again** | "No way to know they're trouble" | You re-book guests who damaged property or skipped payment |

### Emotional Summary
"Reviews are the currency of trust in accommodation. Without them, potential guests scroll past. With them, they book. The difference? A system that makes collecting reviews automatic — not optional."

---

## 4. Solution Overview

### Section Header
"Reviews on Autopilot"

### Transformation Narrative

| Before Wielo | After Wielo |
|-------------|-----------|
| Manually emailing guests days later | Automatic request 5 minutes after checkout |
| Guests need to create accounts | One-click submission, no login required |
| Text-only reviews | Up to 6 photos per review |
| Reviews scattered on OTAs | All reviews on your direct booking site |
| No response capability | Professional host replies in seconds |
| No guest reputation data | Cross-host guest ratings (private) |
| No idea who opened your request | Full delivery and open tracking |

### Key Differentiators
1. **Zero-Friction Guest Experience:** Token-based links, no account creation, submit in 30 seconds
2. **Photo-Rich Testimonials:** Guests can upload 6 photos that showcase your property authentically
3. **Host Reputation Network:** Rate guests privately; see ratings from other hosts before accepting bookings
4. **Professional Response System:** Reply to reviews publicly, building trust even from criticism

---

## 5. Feature Deep-Dive Sections

### Sub-Feature 1: Automatic Review Requests
| Aspect | Detail |
|--------|--------|
| **What it does** | Sends review request 5 minutes after checkout via email + in-app notification |
| **Why it matters** | Peak goodwill = peak response rate; no manual follow-up needed |
| **Visual suggestion** | Timeline showing: Checkout → 5 min → Guest receives request → Review submitted |
| **Lucide icon** | `Clock` |

### Sub-Feature 2: One-Tap Submission
| Aspect | Detail |
|--------|--------|
| **What it does** | Secure tokenized link lets guests review without creating an account |
| **Why it matters** | Removes the biggest friction point; more reviews, less abandonment |
| **Visual suggestion** | Mobile phone with review form open, star rating visible, "Submit" button prominent |
| **Lucide icon** | `MousePointerClick` |

### Sub-Feature 3: Photo Reviews
| Aspect | Detail |
|--------|--------|
| **What it does** | Guests upload up to 6 photos (max 8 MB each) directly with their review |
| **Why it matters** | Real guest photos build trust faster than professional shots; shows authenticity |
| **Visual suggestion** | Review card with photo grid expanding into lightbox gallery |
| **Lucide icon** | `Image` |

### Sub-Feature 4: Per-Category Ratings
| Aspect | Detail |
|--------|--------|
| **What it does** | Guests rate 6 categories: Cleanliness, Communication, Check-in, Accuracy, Location, Value |
| **Why it matters** | Identifies what you excel at and where to improve; builds specific trust signals |
| **Visual suggestion** | Six-row category breakdown with star ratings and progress bars |
| **Lucide icon** | `BarChart3` |

### Sub-Feature 5: Trip Type Tagging
| Aspect | Detail |
|--------|--------|
| **What it does** | Guests select trip type: Couples, Family, Solo, Friends, Business |
| **Why it matters** | Potential guests filter reviews by their situation; see relevant experiences |
| **Visual suggestion** | Filter chips for trip types with review counts per type |
| **Lucide icon** | `Users` |

### Sub-Feature 6: Host Responses
| Aspect | Detail |
|--------|--------|
| **What it does** | Reply publicly to any review from your dashboard; edit or remove responses anytime |
| **Why it matters** | Shows you care; turns negative reviews into trust-building opportunities |
| **Visual suggestion** | Review card with "Reply" button expanding to text composer, published response beneath |
| **Lucide icon** | `MessageSquareReply` |

### Sub-Feature 7: Featured Reviews
| Aspect | Detail |
|--------|--------|
| **What it does** | Pin your best review to display prominently at the top of your listing |
| **Why it matters** | Lead with your strongest testimonial; guide first impressions |
| **Visual suggestion** | Featured review card with "pinned" badge and larger display format |
| **Lucide icon** | `Pin` |

### Sub-Feature 8: Review Moderation
| Aspect | Detail |
|--------|--------|
| **What it does** | Flag inappropriate reviews; admin moderation with uphold/reject decisions |
| **Why it matters** | Protect your reputation from fake, abusive, or policy-violating reviews |
| **Visual suggestion** | Flagged review with reason badge and "Report" modal |
| **Lucide icon** | `Flag` |

### Sub-Feature 9: Guest Reputation Network
| Aspect | Detail |
|--------|--------|
| **What it does** | Rate guests privately after each stay; see ratings from other hosts |
| **Why it matters** | Avoid problem guests before they book; shared reputation across hosts |
| **Visual suggestion** | Guest profile card with host-only rating summary (hidden from guest) |
| **Lucide icon** | `ShieldCheck` |

### Sub-Feature 10: Helpful Votes
| Aspect | Detail |
|--------|--------|
| **What it does** | Guests can vote reviews as "helpful"; count displayed on each review |
| **Why it matters** | Social proof for reviews themselves; surfaces most valuable feedback |
| **Visual suggestion** | Review with "Helpful (12)" button and thumbs-up icon |
| **Lucide icon** | `ThumbsUp` |

### Sub-Feature 11: Review Analytics
| Aspect | Detail |
|--------|--------|
| **What it does** | Dashboard shows overall rating, response rate, avg reply time, rating distribution |
| **Why it matters** | Track your reputation health; identify trends and improvement areas |
| **Visual suggestion** | Dashboard with KPI cards: 4.8 rating, 94% response rate, 2.3h avg reply time |
| **Lucide icon** | `TrendingUp` |

### Sub-Feature 12: Public Reviews Section
| Aspect | Detail |
|--------|--------|
| **What it does** | Beautiful reviews section on your booking website with search, filters, and photos |
| **Why it matters** | Convert browsers into bookers with authentic social proof on your direct site |
| **Visual suggestion** | Public listing page reviews section with filter dropdown, rating breakdown, review cards |
| **Lucide icon** | `Star` |

---

## 6. How It Works (Process Steps)

### Section Header
"From Checkout to Social Proof in 5 Minutes"

### Host Journey

| Step | Action | Detail |
|------|--------|--------|
| 1 | Guest checks out | Booking status changes to "checked out" |
| 2 | Automatic request | System waits 5 minutes, then sends review request |
| 3 | Multi-channel delivery | Email + in-app notification + chat system card |
| 4 | Review arrives | Host notified instantly; review appears in dashboard |
| 5 | Respond (optional) | Write public response to build trust |
| 6 | Feature (optional) | Pin best reviews to listing page |
| 7 | Rate guest (private) | Add to cross-host reputation network |

### Guest Journey

| Step | Action | Detail |
|------|--------|--------|
| 1 | Receive request | Email arrives 5 minutes after checkout |
| 2 | Click link | Secure tokenized URL, no login required |
| 3 | Rate stay | Overall stars + optional category ratings |
| 4 | Write review | Optional text (max 2,000 characters) |
| 5 | Add photos | Upload up to 6 photos |
| 6 | Submit | One-tap submission, immediate confirmation |

### Visual Suggestion
Horizontal timeline with icons:
`Checkout` → `5 min` → `Request Sent` → `Guest Opens` → `Review Submitted` → `Host Notified` → `Published`

---

## 7. Social Proof Section

### Section Header
"Hosts Who Let Reviews Work for Them"

### Testimonial Placeholders

**Safari Lodge (Greater Kruger):**
> "We went from 3 reviews to 47 in three months. The automatic requests catch guests at exactly the right moment — still buzzing from their safari experience. Our direct bookings doubled."
> — *Lodge Manager, Greater Kruger*

**Coastal Guesthouse (Garden Route):**
> "The photo reviews are game-changing. Guests share their sunset photos, their breakfast spreads, their room views. It's marketing I couldn't pay for."
> — *Owner, Garden Route B&B*

**Self-Catering (Cape Town):**
> "I can finally respond to reviews professionally. A guest complained about street noise, I acknowledged it, offered a quieter room for next time. They came back. The response matters."
> — *Self-Catering Host, Cape Town*

### Trust Indicators
- "Average 73% review response rate for Wielo hosts"
- "Reviews collected within 24 hours of checkout"
- "Photo reviews convert 2.4× better than text-only"

---

## 8. Comparison Section

### Section Header
"Why Hosts Switch to Wielo Reviews"

| Without Wielo | With Wielo |
|--------------|-----------|
| Remember to email guests manually | Automatic request 5 minutes after checkout |
| Guests need to create accounts | One-tap review, no login required |
| Text-only reviews | Up to 6 photos per review |
| Reviews live only on OTAs | Your reviews on your direct booking site |
| Negative reviews sit unanswered | Professional host responses in seconds |
| No idea if request was seen | Full delivery and engagement tracking |
| Rebook problem guests blindly | Private host-to-guest ratings |
| Manually calculate your rating | Real-time aggregate + category breakdowns |

---

## 9. FAQ Section

### Q: When does the review request go out?
**A:** Automatically 5 minutes after checkout. This catches guests at peak satisfaction while the experience is fresh. You can also send manual requests anytime from your dashboard.

### Q: Do guests need to create an account to review?
**A:** No. Guests receive a secure tokenized link that lets them submit their review instantly — no login, no password, no friction.

### Q: Can guests add photos?
**A:** Yes! Guests can upload up to 6 photos (max 8 MB each) with their review. These display in a professional lightbox gallery on your listing page.

### Q: What if I get a negative review?
**A:** You can respond publicly from your dashboard. Professional responses to criticism often build more trust than the original negative review damages. You can also flag reviews that violate policies for moderation.

### Q: Can I choose which reviews to display?
**A:** All published reviews display on your listing. You can pin one "featured review" to appear prominently. Reviews can only be hidden through the flagging/moderation process for policy violations.

### Q: What is the guest reputation network?
**A:** After each stay, you rate guests privately on payment reliability, communication, cleanliness, and house rules. Other hosts can see these ratings before accepting bookings — but guests never see them.

### Q: Are reviews tied to verified stays?
**A:** Yes. Reviews can only be submitted for completed, paid bookings. The tokenized link is cryptographically tied to a specific booking.

### Q: What review categories do guests rate?
**A:** Six categories: Cleanliness, Communication, Check-in, Accuracy, Location, and Value. Category ratings are optional, but the overall star rating is required.

---

## 10. Final CTA Section

### Section Header
"Start Collecting Reviews on Autopilot"

### Primary CTA
"Take the 2-minute Scorecard" → `#scorecard`

### Secondary CTA
"Claim your founding spot" → `/signup/host`

### Trust Elements
- "No credit card required"
- "90-day satisfaction guarantee"
- "Set up in under 10 minutes"

### Closing Statement
"Your happy guests are your best marketing team. Let Wielo make sure their voices are heard — automatically."

---

## 11. Design Notes for Claude Design

### Brand Colours (from DESIGN_SYSTEM.md)

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#10B981` | CTAs, links, active states, star ratings |
| Secondary | `#064E3B` | Featured review emphasis, section headers |
| Accent | `#D1FAE5` | Hover surfaces, rating badges, trip type chips |
| Light | `#F0FDF4` | Page background, review cards |
| Dark | `#0A1510` | Hero section, footer, modals |
| Ink | `#052E1F` | Body text, review content |
| Mute | `#4A7C6A` | Secondary text, timestamps, category labels |
| Line | `#DCEAE0` | Borders, dividers, rating bars |

### Typography

| Element | Font |
|---------|------|
| Display/Headlines | Plus Jakarta Sans |
| Body/UI Text | Inter |
| Review Timestamps | JetBrains Mono |

### Component Guidelines
- Use shadcn/ui components exclusively
- Icons: lucide-react only, 1.5px stroke
- Star ratings: Use filled `Star` icons with Primary color
- Card radius: `rounded-card` (16px)
- CTA radius: `rounded-pill`
- Shadows: `shadow-card` resting, `shadow-lift` hover

### Lucide Icons for Review Sub-Features

| Sub-Feature | Icon |
|-------------|------|
| Automatic Requests | `Clock` |
| One-Tap Submission | `MousePointerClick` |
| Photo Reviews | `Image` |
| Category Ratings | `BarChart3` |
| Trip Type Tagging | `Users` |
| Host Responses | `MessageSquareReply` |
| Featured Reviews | `Pin` |
| Review Moderation | `Flag` |
| Guest Reputation | `ShieldCheck` |
| Helpful Votes | `ThumbsUp` |
| Review Analytics | `TrendingUp` |
| Public Section | `Star` |

### Layout Pattern (match /launch page)
- Dark gradient hero with dot grid overlay
- Alternating light/white sections
- Sticky nav with scorecard CTA
- Mobile-first responsive
- Rise animations (150-300ms, ease-out)

### Section-Specific Design Notes

**Hero:**
- Large star rating visual element (4.8 stars)
- Subtle confetti/sparkle animation on load
- Floating review card snippets in background

**Pain Points:**
- Icon-led list with muted backgrounds
- Subtle red/coral accent for "Before" states
- Transition to green/primary for solutions

**Feature Deep-Dives:**
- Alternating image/text layout (zigzag pattern)
- Screenshot mockups with device frames
- Subtle hover animations on feature cards

**Reviews Display Mockup:**
- Show actual review card component design
- Include star ratings, photos, host response
- Match the real dashboard/listing page UI

**Comparison Table:**
- Two-column table with clear visual hierarchy
- "Without" column: muted/gray styling
- "With" column: primary color accents, checkmarks

**FAQ:**
- Accordion style with smooth expand animation
- Lucide `ChevronDown` for toggle indicator
- One FAQ open by default

### Animation Suggestions
- Star rating: sequential fill animation (left to right)
- Review cards: staggered fade-in from bottom
- Photo gallery: smooth lightbox transitions
- Host response: slide-down reveal
- Stats counters: animated count-up on scroll

### Responsive Breakpoints
- Mobile: Stack all content, full-width cards
- Tablet: 2-column feature grid
- Desktop: 3-column feature grid, side-by-side comparisons

---

## 12. Cross-Links to Other Feature Pages

Link to related features within the page:
- "See how reviews display on your **[Booking Website](/features/booking-website)**"
- "Manage review conversations in the **[Unified Inbox](/features/unified-inbox)**"
- "Track review impact on revenue in **[Reporting](/features/reporting)**"

---

## 13. Content Guidelines

### Voice & Tone
- Professional but warm
- Empathetic to host challenges
- Confident in solution claims (backed by real features)
- Never condescending about current manual processes

### Proof Points (from codebase)
- 5-minute automatic request timing (verified in migrations)
- 6 photos maximum (verified in schema)
- 6 category ratings (verified in reviews table)
- Cryptographic token security (HMAC-SHA256)
- Cross-host reputation sharing (guest_ratings table)

### Avoid
- Naming competitors directly
- Making claims not supported by actual features
- Overusing superlatives
- Technical jargon without explanation
