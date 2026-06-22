# Quote Feature — Sales Page Specification

> **For:** Claude Design
> **Feature:** Professional Quotes
> **URL:** `/features/quotes`
> **Status:** Ready for implementation

---

## 1. Page Meta & SEO

```yaml
title: "Professional Quotes for Accommodation Hosts — Vilo"
meta_description: "Send branded quotes in seconds. Auto-pricing from your live rates, calendar protection while you negotiate, and one-click conversion to booking. Built for SA hosts."
url_slug: /features/quotes
keywords:
  - accommodation quote software
  - guest house quoting system
  - lodge booking quotes south africa
  - B&B quote generator
  - hospitality proposal software
og_title: "Professional Quotes — Win More Bookings | Vilo"
og_description: "Send branded, accurate quotes in seconds. Track when guests open them. Convert to bookings with one click."
og_image: "/images/features/quotes-og.jpg"
```

---

## 2. Hero Section

### Headline Options

```
Option A: "Send a quote that wins the booking."
Option B: "From enquiry to booking — in one professional quote."
Option C: "Stop losing guests to slow, messy quotes."
```

**Recommended:** Option A — direct, benefit-focused, implies competitive advantage.

### Subheadline

```
"Vilo's quote builder pulls your live rates, protects your calendar, and gives guests a professional PDF they can accept in one tap — no login required."
```

### Hero CTA

```
Primary: "Take the 2-minute Scorecard" → #scorecard
Secondary: "See a sample quote" → [link to demo quote PDF or modal]
```

### Hero Visual

```
Split view showing:
LEFT: Host's quote builder interface with:
  - Guest details filled in (Sarah Mitchell, sarah@email.com)
  - Dates selected (15-18 Nov, 3 nights)
  - Auto-calculated pricing visible (Base: R3,600 + Cleaning: R150 = R3,750)
  - "Send Quote" button highlighted in brand-primary

RIGHT: The resulting PDF quote preview showing:
  - Host branding (logo, business name)
  - Professional layout with itemised pricing
  - "Accept Quote" button prominent
  - Status badge showing "Awaiting Response"

Floating elements:
  - Small card showing "Quote sent" notification
  - Badge showing "Calendar dates held"
```

---

## 3. Problem / Pain Points Section

### Section Header

```
Eyebrow: "The quoting problem"
Headline: "Every hour without a quote is a booking walking out the door."
```

### Pain Points

```
1. Pain: You get an enquiry, but you're busy — so you reply hours later with a rushed price.
   Emotion: Anxiety, guilt
   Cost: The guest already booked somewhere else. You'll never know how many you've lost this way.

2. Pain: You send a Word doc or WhatsApp message with prices — it looks amateur next to the polished OTA confirmations guests are used to.
   Emotion: Embarrassment, self-doubt
   Cost: Guests trust professional-looking quotes more. Yours gets ignored.

3. Pain: You quote someone, but forget to block the dates — then someone else books the same nights.
   Emotion: Panic, frustration
   Cost: Double-booking. You have to cancel on someone, damage your reputation, maybe refund.

4. Pain: Guest asks for a tweak — different dates, extra person, breakfast added. You recalculate manually, make a mistake, lose track of versions.
   Emotion: Overwhelm
   Cost: Errors in pricing, confusion about what was agreed, disputes later.

5. Pain: You send quotes into the void. No idea if they opened it, if they're considering it, or if it landed in spam.
   Emotion: Uncertainty
   Cost: You don't know when to follow up — or if you even should.
```

### "Before Vilo" Scenario

```
"You get a WhatsApp enquiry at 9pm. You're exhausted, so you jot down a price on your phone — no breakdown, no terms, no branding. The guest says 'thanks, I'll think about it' and disappears. A week later, you see them post photos from a competitor's property. You'll never know if a proper quote would have won it."
```

---

## 4. Solution Overview

### Section Header

```
Eyebrow: "The Vilo way"
Headline: "Professional quotes that convert — built into your booking system."
```

### Transformation Statement

```
"Go from 'let me check my spreadsheet and get back to you' to 'here's your quote, priced from my live availability, with a one-tap accept button' — in under 60 seconds."
```

### Key Differentiators

```
1. Auto-priced from your live rates — Vilo pulls your nightly prices, seasonal adjustments, cleaning fees, and occupancy rules automatically. No calculator. No spreadsheet. No mistakes.

2. Calendar protection built in — The moment you send a quote, those dates are soft-held on your calendar. No more double-bookings while you wait for a response.

3. One-click accept to booking — When the guest accepts, the booking is created automatically. No re-entering details. No copy-paste errors. Payment terms ready to go.

4. Professional PDFs with your branding — Your logo, your business details, your banking info, your cancellation policy. Looks like you hired a designer. Takes 30 seconds.
```

---

## 5. Feature Deep-Dive Sections

### Sub-Feature 1: Auto-Pricing Engine

```yaml
icon: Calculator
headline: "Accurate prices, every time — calculated automatically"
description: "Vilo pulls your nightly rates, seasonal pricing rules, weekend premiums, occupancy discounts, and cleaning fees the moment you select dates. You verify and send. No manual calculations. No forgetting the cleaning fee. No quoting last year's prices by mistake."
visual: "Animation showing date selection → price fields auto-populating with breakdown (Base: R1,200 × 3 nights, Weekend premium: R200, Cleaning: R150, Total: R3,950)"
```

### Sub-Feature 2: Itemised vs Single-Total Mode

```yaml
icon: List
headline: "Show the breakdown — or keep it simple"
description: "Some guests want to see every line item. Others just want a bottom line. Choose itemised mode for full transparency, or single-total mode when you're negotiating a package deal and don't want to show your working. The quote remembers your choice, even through edits."
visual: "Side-by-side comparison: LEFT showing itemised quote (3 nights @ R1,200, cleaning, breakfast × 2), RIGHT showing single-total quote (Total: R4,350 — all-inclusive)"
```

### Sub-Feature 3: Soft Calendar Holds

```yaml
icon: CalendarCheck
headline: "Your dates are protected while you negotiate"
description: "The moment you send a quote, Vilo soft-blocks those dates on your calendar. Other guests see them as tentatively unavailable. If the quote is declined or expires, the hold clears automatically. No more double-bookings during the back-and-forth."
visual: "Calendar view showing dates marked with 'Quote pending' badge, tooltip explaining 'Held for Sarah Mitchell until 20 Nov'"
```

### Sub-Feature 4: Version History

```yaml
icon: History
headline: "Every edit, every version — nothing lost"
description: "Guest asks for a discount? Different dates? Extra night? Edit the quote, and Vilo snapshots the previous version automatically. Full audit trail of what was offered, when, and what changed. When it comes time to confirm, everyone knows exactly what was agreed."
visual: "Version history panel showing: v1 (Original, 15 Nov), v2 (Added discount, 16 Nov), v3 (Changed dates, 17 Nov) with 'View' buttons"
```

### Sub-Feature 5: Branded PDF Generation

```yaml
icon: FileText
headline: "Professional quotes with your branding — generated instantly"
description: "Every quote generates a PDF with your logo, trading name, VAT number, banking details, and cancellation policy. The guest sees a polished, professional document — not a hastily typed WhatsApp message. First impressions matter. This one works in your favour."
visual: "PDF preview showing host branding at top, guest details, stay summary, itemised pricing, banking details, and 'Accept Quote' button with expiry date"
```

### Sub-Feature 6: Guest Response Portal

```yaml
icon: ExternalLink
headline: "Guests accept with one tap — no login required"
description: "The quote email includes a secure link to a dedicated quote page. Guests view the full details, see your banking info if they want to pay manually, and accept or decline with one button. No account creation. No password. No friction. Just a clean decision point."
visual: "Mobile phone mockup showing guest quote view with 'Accept' and 'Decline' buttons, property photo, and stay summary"
```

### Sub-Feature 7: Deposit & Balance Terms

```yaml
icon: Percent
headline: "Set your payment terms upfront"
description: "Require a 50% deposit now, balance due 7 days before check-in? Full payment upfront? Reserve with no deposit? Configure it per quote. The guest sees exactly what's due and when. No awkward follow-up conversations about 'so when do I pay the rest?'"
visual: "Payment terms section showing: Deposit (50%): R1,875 due now / Balance: R1,875 due by 8 Nov"
```

### Sub-Feature 8: Add-ons & Custom Fees

```yaml
icon: Plus
headline: "Upsell breakfast, transfers, early check-in — right in the quote"
description: "Add line items for anything: airport transfer, breakfast package, late checkout, pet fee. Catalog add-ons pull from your saved items with pre-set prices. Custom fees let you add one-off charges. Every quote is an upsell opportunity."
visual: "Add-ons section showing: Breakfast (2 guests × 3 days) R450, Airport transfer R350, Early check-in R200"
```

### Sub-Feature 9: View Analytics

```yaml
icon: Eye
headline: "Know when they've seen it"
description: "Vilo tracks when the guest opens your quote — and what device they used. Opened on mobile at 2pm? They're probably browsing from work. Opened three times and still no response? They're comparing options. Now you know when to follow up, and when to hold back."
visual: "Analytics card showing: 'Viewed 3 times · Last opened: Today, 2:34pm · Device: Mobile'"
```

### Sub-Feature 10: Internal Notes

```yaml
icon: StickyNote
headline: "Private notes the guest never sees"
description: "Add context that helps you manage the deal. 'Referred by John at the wine farm.' 'Wants a discount for their anniversary — approved 10% off.' 'Follow up Friday if no response.' Your notes stay with the quote, visible only to you and your team."
visual: "Notes panel with example: 'Referred by Cape Wine Tours. Celebrating 25th anniversary. Offered 10% — approved by owner. — Thandi, 15 Nov'"
```

### Sub-Feature 11: Inbox Integration

```yaml
icon: MessageSquare
headline: "Every quote lives in the conversation"
description: "Quotes appear as cards in your inbox thread with the guest. Quote sent, quote viewed, quote revised, quote accepted — every event shows up in context. When you open the conversation, you see the full history: messages, quotes, booking. No separate tabs. No hunting."
visual: "Inbox thread showing message bubbles interspersed with quote event cards: 'Quote sent · R3,750 · Awaiting response' → 'Quote viewed' → 'Quote accepted'"
```

### Sub-Feature 12: One-Click Accept to Booking

```yaml
icon: CheckCircle
headline: "Accepted quote becomes a booking — automatically"
description: "When the guest clicks 'Accept', Vilo creates the booking instantly. Guest details, dates, pricing, deposit terms — all transferred. No re-keying. No copy-paste errors. The booking appears in your calendar, the guest gets a confirmation, and you're ready to collect payment."
visual: "Flow diagram: Quote Accepted → Booking Created (auto) → Payment Request Sent → Booking Confirmed"
```

---

## 6. How It Works

### Section Header

```
Eyebrow: "Simple workflow"
Headline: "From enquiry to booking — in four steps."
```

### Host Journey

```
Step 1: Create — Enter guest details, select dates and rooms. Takes 30 seconds.
  Visual: Form with guest name, email, date picker, room selector

Step 2: Price — Vilo auto-calculates from your live rates. Add discounts or extras if needed.
  Visual: Pricing breakdown with edit option, discount field, add-on selector

Step 3: Send — One click. Guest receives email with PDF and accept link. Dates are held.
  Visual: "Send Quote" button, then confirmation with "Quote sent to sarah@email.com"

Step 4: Convert — Guest accepts, booking is created. You collect payment.
  Visual: Notification "Sarah accepted! Booking VILO-2026-AB3471 created"
```

### Guest Journey

```
Step 1: Receive — Email arrives with quote summary and "View Quote" button
  Visual: Email preview in inbox

Step 2: Review — Open secure quote page, see full details, no login required
  Visual: Quote page on mobile with property photo, pricing, terms

Step 3: Decide — Accept with one tap, or decline with optional message
  Visual: Accept/Decline buttons

Step 4: Pay — If deposit required, pay via Paystack/PayPal/EFT. Booking confirmed.
  Visual: Payment confirmation screen
```

### Visual Treatment

```
Desktop: Numbered steps connected by dotted lines, alternating left/right with screenshots
Mobile: Vertical stack, numbers in circles, screenshots below each step
Animation: Steps reveal on scroll with subtle rise animation
```

---

## 7. Social Proof Section

### Section Header

```
Eyebrow: "From real hosts"
Headline: "What hosts say about Vilo Quotes"
```

### Testimonial Placeholders

```
Testimonial 1:
  Quote: "I used to spend 20 minutes on every quote — checking rates, formatting a doc, remembering to block the calendar. Now it's two minutes, and it looks better than anything I could design. Three quotes last month converted same-day."
  Name: "[Name]"
  Property: "Safari Lodge · Hoedspruit"

Testimonial 2:
  Quote: "The view tracking changed everything. I used to wonder if my quotes were even being read. Now I know exactly when to follow up — and my conversion rate has gone through the roof."
  Name: "[Name]"
  Property: "Guesthouse · Franschhoek"

Testimonial 3:
  Quote: "We had a double-booking disaster last December. Never again. The soft-hold feature means I can negotiate without risking my calendar."
  Name: "[Name]"
  Property: "Self-catering · Plettenberg Bay"
```

### Use Case Scenarios

```
Scenario 1: A Kruger-area lodge sends 40+ quotes per month to international guests. Auto-pricing and branded PDFs save hours — and look professional to guests comparing options.

Scenario 2: A Winelands B&B uses single-total mode for wedding groups, keeping package negotiations clean while protecting margins on the line-item breakdown.

Scenario 3: A Cape Town self-catering unit tracks quote views to time follow-ups. "I call when I see they've opened it twice — that's when they're deciding."
```

### Stats (placeholder)

```
Stat 1: [X] quotes sent by founding hosts
Stat 2: [X]% average quote-to-booking conversion
Stat 3: [X] minutes average time to create and send
```

---

## 8. Comparison Section

### Section Header

```
Eyebrow: "Side by side"
Headline: "Quoting without Vilo vs. with Vilo"
```

### Comparison Table

| Without Vilo | With Vilo |
|--------------|-----------|
| Copy-paste a Word doc or type prices into WhatsApp | Branded PDF generated in seconds |
| Manually calculate rates, extras, cleaning fee | Auto-priced from your live availability |
| No idea if the guest even opened it | View tracking shows when, how many times, what device |
| Forget to block the calendar — risk double-booking | Soft-hold protects dates automatically |
| Lose track of what was offered in which version | Full version history, every edit saved |
| Guest accepts — now re-enter everything as a booking | One-click accept creates booking automatically |
| Chase payment terms over WhatsApp | Deposit/balance terms built into the quote |
| Notes scattered across notebooks and message threads | Internal notes attached to each quote |

---

## 9. FAQ Section

### Questions & Answers

```
Q: Does Vilo Quotes use my existing rates?
A: Yes. Vilo pulls from your nightly rates, seasonal pricing rules, weekend premiums, and occupancy settings automatically. If you've set up your pricing in Vilo, quotes calculate correctly without any extra work.

Q: Can I offer discounts?
A: Absolutely. Add a percentage or fixed-amount discount to any quote. You can include an optional reason ('returning guest', 'anniversary special') that appears on the PDF.

Q: What if the guest wants changes after I send the quote?
A: Edit and re-send. Vilo automatically saves the previous version, so you have a full history of what was offered. The guest always sees the latest version.

Q: How do I know if the guest has seen my quote?
A: Vilo tracks when the quote is opened and from what device. You'll see this in the quote details — 'Viewed 2 times · Last opened: Today, 3:15pm · Mobile'. No more wondering.

Q: What happens when they accept?
A: One click from the guest creates a booking automatically. Their details, dates, and pricing transfer over. If you've set deposit terms, a payment request goes out. You can also manually convert a quote if the guest accepted via WhatsApp or phone.

Q: Is there a limit on how many quotes I can send?
A: No limit. Send as many quotes as your business needs.

Q: Can guests pay directly from the quote?
A: When a guest accepts, they're prompted to pay any deposit via Paystack, PayPal, or manual EFT. The quote includes your banking details for manual transfers.

Q: What if the quote expires?
A: You set the expiry date. When it passes, the soft-hold on your calendar clears automatically. The guest can no longer accept — they'd need to request a new quote.
```

---

## 10. Final CTA Section

### Section Content

```
Eyebrow: "Ready to send better quotes?"
Headline: "Your next enquiry deserves a quote that wins."
Body: "See how much the slow, messy quoting process is costing your business. Take the 2-minute scorecard — it's free, no card required, and you'll know exactly where you stand."

Primary CTA: "Take the 2-minute Scorecard" → #scorecard
Secondary CTA: "Claim your founding spot" → /signup/host

Trust elements:
  - No card required
  - 90-day money-back guarantee
  - Quotes included in every Vilo plan
```

---

## 11. Design Notes for Claude Design

### Brand Reference

**Colours:**
| Token | Hex | Usage |
|-------|-----|-------|
| `brand-primary` | `#10B981` | CTAs, links, active states |
| `brand-secondary` | `#064E3B` | Featured/promo, price emphasis |
| `brand-accent` | `#D1FAE5` | Hover surfaces, badges |
| `brand-light` | `#F0FDF4` | Page background |
| `brand-dark` | `#0A1510` | Hero, footer |
| `brand-ink` | `#052E1F` | Body text |
| `brand-mute` | `#4A7C6A` | Secondary text |
| `brand-line` | `#DCEAE0` | Borders, dividers |

**Typography:**
- Display: Plus Jakarta Sans — headlines, KPIs
- Body: Inter — UI text
- Mono: JetBrains Mono — codes, quote references

**Components:**
- Use shadcn/ui exclusively
- Icons: lucide-react, 1.5px stroke
- Radius: `rounded-card` 16px for feature cards, `rounded-pill` for CTAs
- Shadows: `shadow-card` resting, `shadow-lift` on hover

### Page Layout

```
1. HERO (dark gradient + dot grid)
   - Two-column: copy left, visual right
   - Visual: quote builder + PDF preview composite

2. PROBLEM SECTION (light background)
   - Pain points as cards with icons
   - "Before Vilo" narrative as highlighted callout

3. SOLUTION OVERVIEW (white background)
   - Transformation statement prominent
   - Differentiators as icon + text rows

4. FEATURE DEEP-DIVE (alternating light/white)
   - 12 sub-features as cards or alternating left/right sections
   - Each has icon, headline, description, visual
   - Group into logical clusters:
     * Pricing & Flexibility (1-2)
     * Calendar & Versions (3-4)
     * Professional Output (5-6)
     * Terms & Upsells (7-8)
     * Tracking & Communication (9-11)
     * Conversion (12)

5. HOW IT WORKS (light background)
   - Step-by-step with numbers
   - Host journey top, Guest journey below
   - Connected by dotted lines

6. SOCIAL PROOF (white background)
   - Testimonial cards in 3-column grid
   - Stats bar below

7. COMPARISON TABLE (light background)
   - Full-width table with check/x icons
   - "Without" column muted, "With" column highlighted

8. FAQ (white background)
   - Accordion style, expand on click
   - 2-column on desktop

9. FINAL CTA (dark gradient)
   - Centered, single-column
   - Scorecard card matching /launch page
```

### Responsive Behaviour

```
Mobile (< 768px):
  - Single column throughout
  - Feature cards stack vertically
  - Comparison table scrolls horizontally
  - Hero visual below copy

Tablet (768-1024px):
  - 2-column grids
  - Feature cards in 2-column grid

Desktop (> 1024px):
  - Full layout as described
  - Hero side-by-side
  - 3-column testimonials
```

### Animations

```
- Rise animation on scroll (elements fade in and rise 14px)
- Feature cards lift on hover (shadow-lift)
- FAQ accordions expand smoothly (200ms ease-out)
- All animations respect prefers-reduced-motion
```

### Lucide Icons Reference

| Sub-Feature | Icon |
|-------------|------|
| Auto-Pricing | `Calculator` |
| Itemised/Single-Total | `List` |
| Soft Calendar Holds | `CalendarCheck` |
| Version History | `History` |
| Branded PDF | `FileText` |
| Guest Portal | `ExternalLink` |
| Deposit Terms | `Percent` |
| Add-ons | `Plus` |
| View Analytics | `Eye` |
| Internal Notes | `StickyNote` |
| Inbox Integration | `MessageSquare` |
| One-Click Accept | `CheckCircle` |

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
- [x] 12 sub-features documented with icons
