# Unified Inbox Feature — Sales Page Specification

> **For:** Claude Design
> **Feature:** Unified Inbox & Guest Messaging
> **URL:** `/features/inbox`
> **Status:** Ready for implementation

---

## 1. Page Meta & SEO

```yaml
title: "Unified Inbox for Accommodation Hosts — Vilo"
meta_description: "One inbox for every guest conversation. Real-time messaging, quote cards, payment links, and read receipts — all in one WhatsApp-style interface. Built for SA hosts."
url_slug: /features/inbox
keywords:
  - guest communication software
  - accommodation messaging system
  - guesthouse inbox management
  - hospitality CRM south africa
  - unified messaging for hosts
og_title: "Unified Inbox — Every Guest, One Place | Vilo"
og_description: "Real-time guest messaging with quote cards, payment links, and read receipts. Never miss a booking enquiry again."
og_image: "/images/features/inbox-og.jpg"
```

---

## 2. Hero Section

### Headline Options

```
Option A: "Every guest conversation. One inbox."
Option B: "Stop juggling WhatsApp, email, and platform messages."
Option C: "The inbox that turns enquiries into bookings."
```

**Recommended:** Option A — clear, benefit-focused, promises simplicity.

### Subheadline

```
"Vilo's unified inbox brings every guest message into one real-time feed — with quote cards, payment links, read receipts, and instant notifications. No more scattered conversations. No more missed bookings."
```

### Hero CTA

```
Primary: "Take the 2-minute Scorecard" → #scorecard
Secondary: "See the inbox in action" → #how-it-works
```

### Hero Visual

```
Two-pane inbox interface:
LEFT PANE: Conversation list showing:
  - "Sarah Mitchell" (Enquiry chip, amber) — "That sounds perfect! Can we..."
  - "Johan van der Berg" (Confirmed chip, green) — "Looking forward to our stay"
  - "Emma Thompson" (Website chip, sky) — "Hi, I found you on Google..."
  - Unread badge on first conversation

RIGHT PANE: Active thread showing:
  - WhatsApp-style chat bubbles
  - Quote card inline (showing R4,200 total, "Accepted" badge)
  - Host's latest message with blue double-tick (read)
  - Composer at bottom with quick-reply chips

Floating elements:
  - Push notification mockup: "Sarah replied: That sounds perfect!"
  - Badge showing "3 unread"
```

---

## 3. Problem / Pain Points Section

### Section Header

```
Eyebrow: "The messaging chaos"
Headline: "Your guest conversations are everywhere except where you need them."
```

### Pain Points

```
1. Pain: You're checking WhatsApp, email, Airbnb messages, and Booking.com extranet — constantly switching, constantly missing things.
   Emotion: Overwhelm, anxiety
   Cost: Slow replies lose bookings. The host who responds first usually wins.

2. Pain: A guest asked about availability last week. You can't remember if it was WhatsApp or email. You search for 10 minutes and still can't find it.
   Emotion: Frustration
   Cost: Wasted time. Unprofessional follow-up. Lost context.

3. Pain: You sent a quote, but you don't know if the guest even opened it. Do you follow up? Wait? You're guessing.
   Emotion: Uncertainty
   Cost: Either you seem pushy, or you lose the booking to silence.

4. Pain: Your phone buzzes constantly. WhatsApp for one guest, email for another, SMS for a third. No break, no boundaries.
   Emotion: Burnout
   Cost: Your personal life blurs into work. You never fully switch off.

5. Pain: You have no history when a returning guest messages. You ask questions they already answered last year.
   Emotion: Embarrassment
   Cost: Guests feel like a number, not a person. Repeat business suffers.
```

### "Before Vilo" Scenario

```
"A guest sends an enquiry via your website at 6pm. You see it the next morning — buried under 47 WhatsApp messages. By then, they've booked somewhere else. You'll never know you lost them. This happens more than you think."
```

---

## 4. Solution Overview

### Section Header

```
Eyebrow: "The Vilo way"
Headline: "One inbox. Every guest. Real-time."
```

### Transformation Statement

```
"From juggling five apps and losing track of who said what to one unified inbox where every conversation, quote, and booking lives together — with instant notifications so you never miss a message."
```

### Key Differentiators

```
1. Real-time messaging — Messages arrive instantly with push notifications. No refresh needed. No delay. Respond while the guest is still thinking about you.

2. Quote cards inline — Quotes appear as visual cards right in the conversation. See status (sent, accepted, declined), amounts, and guest view tracking — without leaving the thread.

3. Read receipts like WhatsApp — Know when your message was delivered. Know when they read it. Time your follow-ups perfectly.

4. Full conversation history — Every message, quote, and booking in one timeline. When a guest returns next year, you have the full context.
```

---

## 5. Feature Deep-Dive Sections

### Sub-Feature 1: Two-Pane Inbox Design

```yaml
icon: LayoutPanelLeft
headline: "See all conversations, respond instantly"
description: "Your inbox shows every guest conversation in a clean list — newest first, unread highlighted, pinned at top. Click any thread and the full conversation opens alongside. No page loads. No context switching. Just fast, focused communication."
visual: "Split-screen inbox: conversation list on left, active thread on right, with hover state on list item"
```

### Sub-Feature 2: Real-Time Messages

```yaml
icon: Zap
headline: "Messages arrive the moment they're sent"
description: "Vilo uses real-time channels, not email polling. When a guest sends a message, it appears in your inbox instantly — with a push notification to your phone. Respond while they're still looking at their screen."
visual: "Phone mockup showing push notification: 'Sarah Mitchell: That sounds perfect! When should...' with Vilo app icon"
```

### Sub-Feature 3: Read Receipts (WhatsApp-Style)

```yaml
icon: CheckCheck
headline: "Know when they've seen your message"
description: "Single tick: sent. Double grey tick: delivered. Double blue tick: read. You know exactly where your message stands — and when to follow up. No more wondering if your quote landed in spam."
visual: "Message bubble with blue double-tick, tooltip showing 'Read at 3:42pm'"
```

### Sub-Feature 4: Quote Cards Inline

```yaml
icon: FileText
headline: "Quotes live inside the conversation"
description: "When you send a quote, it appears as a visual card in the thread — showing the total, check-in/out dates, and status. When the guest views or accepts, the card updates. Earlier versions are preserved but greyed out. Full context, no tab-switching."
visual: "Chat thread with embedded quote card: 'R4,200 · 3 nights · Quote Sent · Viewed 2x'"
```

### Sub-Feature 5: Payment Links in Chat

```yaml
icon: CreditCard
headline: "Send payment links without leaving the conversation"
description: "Balance due? Click one button to drop a secure payment link directly into the chat. The guest clicks, pays, and you're notified. No separate email. No copy-pasting bank details. Just a smooth path from conversation to confirmation."
visual: "Details drawer showing 'Balance due: R2,100' with 'Send in chat' button, then message bubble with payment link card"
```

### Sub-Feature 6: Quick-Reply Templates

```yaml
icon: Sparkles
headline: "Respond in seconds with saved replies"
description: "Create templates for common responses — availability queries, check-in instructions, thank-you messages. Variables like {{guest_name}} and {{check_in}} fill automatically. One tap inserts the template. You're responding faster than anyone else."
visual: "Chip row above composer: 'Thanks for booking', 'Check-in details', 'Request more info' — with template editor modal"
```

### Sub-Feature 7: Conversation Status & Chips

```yaml
icon: Tag
headline: "See thread status at a glance"
description: "Each conversation shows its origin and state: Enquiry (amber), Website (sky), Confirmed (green), Awaiting payment, Completed, Cancelled. Filter by status to focus on what matters right now — like all unread enquiries or all pending payments."
visual: "Conversation list with colored status chips: Enquiry, Confirmed, Website, Awaiting payment"
```

### Sub-Feature 8: Pin & Archive

```yaml
icon: Pin
headline: "Pin important conversations. Archive the rest."
description: "VIP guest negotiating a long stay? Pin them to the top. Season over and conversations resolved? Archive them to declutter — but never lose them. Archived threads are always searchable and restorable."
visual: "Pinned conversation at top with star icon, Archive button in thread header"
```

### Sub-Feature 9: Internal Notes

```yaml
icon: StickyNote
headline: "Add notes the guest never sees"
description: "Record context that helps you (or your team) manage the relationship. 'Referred by wine farm.' 'Negotiated 10% off.' 'Follow up Friday.' Notes attach to the conversation, visible only to your team."
visual: "Notes panel in details drawer with example note: 'Celebrating anniversary — owner approved 10% discount'"
```

### Sub-Feature 10: Guest Details Drawer

```yaml
icon: User
headline: "Full guest context, one click away"
description: "Open the details drawer to see everything: guest name, email, phone, WhatsApp link, booking details, payment status, and listing info. Everything you need to respond helpfully — without leaving the conversation."
visual: "Slide-over drawer showing guest card, booking card (check-in/out, total, reference), and payment status"
```

### Sub-Feature 11: Multi-Listing Filter

```yaml
icon: Building2
headline: "Filter by property when you need to"
description: "Running multiple listings? Filter your inbox to show conversations for just one property. Perfect for focused work sessions or when you have staff managing specific properties."
visual: "Dropdown filter showing 'All Properties' with options: 'Beach House', 'Mountain Lodge', 'City Apartment'"
```

### Sub-Feature 12: Search & History

```yaml
icon: Search
headline: "Find any conversation in seconds"
description: "Search by guest name, email, listing, or message content. Your full history is preserved — returning guests show their entire relationship with you. No more 'who was that guest last March?'"
visual: "Search bar with results: matching guest names highlighted, message previews showing keyword context"
```

---

## 6. How It Works

### Section Header

```
Eyebrow: "Simple flow"
Headline: "From message to booking — without leaving the inbox."
```

### Host Journey

```
Step 1: Guest enquires — Website form, quote request, or direct message lands in your inbox
  Visual: Push notification + new conversation appearing in list with "Enquiry" chip

Step 2: You respond — Type your reply or use a quick template. Send with Enter.
  Visual: Composer with template chips, message appearing in thread

Step 3: Quote inline — Send a quote; it appears as a card in the conversation
  Visual: Quote card showing "R3,600 · 3 nights · Sent" with view tracking

Step 4: Guest accepts — Booking created, payment link sent, all in the same thread
  Visual: "Booking confirmed" system message + payment card
```

### Guest Journey

```
Step 1: Receive message — Push notification or email alerts guest to new message
  Visual: Guest's phone with notification

Step 2: Open portal — Guest views conversation in their Vilo portal (no login if via link)
  Visual: Clean mobile inbox view

Step 3: Reply instantly — Guest types response, host sees it in real-time
  Visual: Message bubble appearing with typing indicator

Step 4: Accept & pay — Quote accepted, payment made, all from the chat
  Visual: Payment success confirmation
```

---

## 7. Social Proof Section

### Section Header

```
Eyebrow: "From real hosts"
Headline: "One inbox changed everything"
```

### Testimonial Placeholders

```
Testimonial 1:
  Quote: "I used to check four different apps every morning. Now I check Vilo once. All my enquiries, all my guests, all in one place. I've probably saved an hour a day."
  Name: "[Name]"
  Property: "Guesthouse · Franschhoek"

Testimonial 2:
  Quote: "The read receipts are a game-changer. I know exactly when to follow up on a quote — not too early, not too late. My conversion rate has gone up noticeably."
  Name: "[Name]"
  Property: "Self-catering · Knysna"

Testimonial 3:
  Quote: "Having the quote cards right in the conversation means I never lose context. I can see what I offered, when they viewed it, and pick up exactly where we left off."
  Name: "[Name]"
  Property: "Lodge · Hoedspruit"
```

### Use Case Scenarios

```
Scenario 1: A Winelands guesthouse receives 30+ enquiries a week. Quick-reply templates cut response time from 5 minutes to 30 seconds. More enquiries answered = more bookings won.

Scenario 2: A Kruger lodge negotiates multi-night safari packages. Quote cards track every version offered. When the guest accepts after a week, the host knows exactly what was agreed.

Scenario 3: A Cape Town apartment owner manages 3 listings. Multi-listing filter lets them focus on one property at a time during admin hours.
```

### Stats (placeholder)

```
Stat 1: [X] messages sent through Vilo inboxes
Stat 2: [X] seconds average response time for hosts using templates
Stat 3: [X]% quote acceptance rate increase with read receipts
```

---

## 8. Comparison Section

### Section Header

```
Eyebrow: "Side by side"
Headline: "Scattered messages vs. Vilo Inbox"
```

### Comparison Table

| Without Vilo | With Vilo |
|--------------|-----------|
| Check WhatsApp, email, Airbnb, Booking.com separately | One inbox for every conversation |
| No idea if guest read your message | WhatsApp-style read receipts |
| Quote sent via email — lost in thread | Quote card inline with view tracking |
| Search 4 apps to find old conversation | Full search across all history |
| Copy-paste bank details for payment | One-click payment link in chat |
| Type same responses repeatedly | Quick-reply templates |
| No context when guest returns | Full conversation history preserved |
| Notifications from everywhere | One notification channel |

---

## 9. FAQ Section

### Questions & Answers

```
Q: Does this replace WhatsApp?
A: It can. All guest conversations happen inside Vilo — you can send your inbox link to guests instead of your WhatsApp number. Many hosts use both initially, then shift guests to Vilo over time.

Q: How do guests message me if they don't have a Vilo account?
A: Guests can reply directly from email notifications or your website contact form. If they request a quote, an account is created for them automatically (no password required initially).

Q: Do I get notified instantly?
A: Yes. Push notifications go to your phone (iOS and Android) the moment a guest sends a message. You also see an unread count badge in the app.

Q: Can my team access the inbox?
A: Yes. Staff with inbox permissions see the same conversations. Conversations can be assigned to team members, and internal notes help with handoffs.

Q: Is message history preserved forever?
A: Yes. Nothing is deleted. When a guest returns next year, you have the full history of your relationship — every message, quote, and booking.

Q: Can I send attachments?
A: Yes. Images and PDFs can be attached to messages. Perfect for sharing directions, menus, or brochures.

Q: What about messages from OTA platforms?
A: Vilo's inbox handles direct messages only. OTA messages (Airbnb, Booking.com) stay in their platforms — but once you convert a guest to direct booking, all future communication is in Vilo.

Q: How do quick-reply templates work?
A: Create templates with placeholders like {{guest_name}} and {{check_in}}. When you use a template, these fill automatically with the guest's details. One tap to insert, Enter to send.
```

---

## 10. Final CTA Section

### Section Content

```
Eyebrow: "Ready to simplify guest communication?"
Headline: "One inbox. Every guest. No more chaos."
Body: "See how much time you're losing to scattered messages and slow responses. Take the 2-minute scorecard — it's free, and you'll know exactly where you stand."

Primary CTA: "Take the 2-minute Scorecard" → #scorecard
Secondary CTA: "Claim your founding spot" → /signup/host

Trust elements:
  - No card required
  - 90-day money-back guarantee
  - Unlimited messages on every plan
  - Real-time notifications included
```

---

## 11. Design Notes for Claude Design

### Brand Reference

**Colours:**
| Token | Hex | Usage |
|-------|-----|-------|
| `brand-primary` | `#10B981` | Sent message bubbles, CTAs |
| `brand-secondary` | `#064E3B` | Header accents |
| `brand-accent` | `#D1FAE5` | Hover states |
| `brand-light` | `#F0FDF4` | Page background |
| `brand-dark` | `#0A1510` | Hero, footer |
| `status-pending` | `#F59E0B` | Enquiry chip (amber) |
| `status-confirmed` | `#10B981` | Confirmed chip (green) |
| `status-cancelled` | `#EF4444` | Cancelled chip (red) |

**Inbox-Specific Colors:**
- Sent messages: `#10B981` (brand-primary) with white text
- Received messages: `#FFFFFF` with dark text
- System messages: `#F59E0B` (amber) pill, centered
- Read receipts: `#3B82F6` (blue) for read ticks

**Typography:**
- Display: Plus Jakarta Sans (headlines)
- Body: Inter (UI, messages)
- Mono: JetBrains Mono (booking references)

### Page Layout

```
1. HERO (dark gradient + dot grid)
   - Two-column: copy left, inbox mockup right
   - Inbox shows two-pane design with active conversation

2. PROBLEM SECTION (light background)
   - Pain points as icon + text cards
   - "Before Vilo" scenario as callout

3. SOLUTION OVERVIEW (white background)
   - Transformation statement
   - 4 differentiators as horizontal cards

4. FEATURE DEEP-DIVE (alternating light/white)
   - 12 sub-features grouped:
     * Interface (1-2): Two-pane, Real-time
     * Communication (3-6): Read receipts, Quote cards, Payment links, Templates
     * Organization (7-9): Status chips, Pin/Archive, Internal notes
     * Context (10-12): Details drawer, Multi-listing, Search

5. HOW IT WORKS (light background)
   - Host journey (4 steps)
   - Guest journey (4 steps)
   - Connected flow diagram

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

### Responsive Behaviour

```
Mobile (< 768px):
  - Single column
  - Inbox mockup shows list OR thread (not both)
  - Feature cards stack

Tablet (768-1024px):
  - 2-column grids
  - Inbox shows both panes

Desktop (> 1024px):
  - Full two-pane inbox visible
  - 3-column testimonials
```

### Animations

```
- Message bubbles animate in (slide up + fade)
- Read ticks transition from grey to blue
- Quote cards have subtle glow on status change
- List items have hover lift effect
```

### Lucide Icons Reference

| Sub-Feature | Icon |
|-------------|------|
| Two-Pane Design | `LayoutPanelLeft` |
| Real-Time | `Zap` |
| Read Receipts | `CheckCheck` |
| Quote Cards | `FileText` |
| Payment Links | `CreditCard` |
| Templates | `Sparkles` |
| Status Chips | `Tag` |
| Pin & Archive | `Pin` |
| Internal Notes | `StickyNote` |
| Details Drawer | `User` |
| Multi-Listing | `Building2` |
| Search | `Search` |

---

## Checklist

- [x] All sections completed with specific content
- [x] Headlines are benefit-focused
- [x] Pain points use emotional language
- [x] All claims verified against codebase (real-time, read receipts, quote cards, etc.)
- [x] CTAs match /launch page pattern
- [x] Visual descriptions specific to inbox UI
- [x] FAQs address real concerns
- [x] Design notes include message bubble colors
- [x] 12 sub-features documented with icons
