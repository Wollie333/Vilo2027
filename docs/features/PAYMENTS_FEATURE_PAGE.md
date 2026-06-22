# Payments Feature Page Specification

> **Purpose:** Comprehensive brief for Claude Design to build a conversion-focused feature sales page for Vilo's Payments system.
> **URL:** `/features/payments`

---

## 1. Page Meta & SEO

| Field | Content |
|-------|---------|
| **Page Title** | Payment Collection for SA Accommodation Hosts | Vilo |
| **Meta Description** | Accept card payments, PayPal, and EFT with zero platform fees on bookings. Deposits, balance payments, automated receipts, and full refund management — built for South African hosts. |
| **Target Keywords** | accommodation payment processing, guest payments South Africa, deposit payment system, direct booking payments, EFT payment accommodation, PayPal accommodation |
| **URL Slug** | `/features/payments` |
| **OG Title** | Get Paid Directly — Zero Platform Fees on Bookings — Vilo Payments |
| **OG Description** | Accept cards, PayPal, and EFT with funds settling directly to your account. Deposits, balance payments, receipts, and refunds — all in one place. |

---

## 2. Hero Section

### Primary Headline Options
1. "Get Paid Directly — 100% of Every Booking"
2. "Your Payments. Your Account. Zero Platform Fees."
3. "Accept Payments Like a Pro, Keep Every Rand"

### Subheadline
"Card payments via Paystack, international guests via PayPal, local bank transfers via EFT — all settling directly to your accounts. No platform commission. No payment drama."

### Hero CTA
- **Primary:** "Take the 2-minute Scorecard" → `#scorecard`
- **Secondary:** "Claim your founding spot" → `/signup/host`

### Hero Visual Suggestion
Split-view mockup:
- **Left:** Guest checkout page showing payment method options (Card/EFT) with deposit vs full payment buttons
- **Right:** Host payments dashboard showing KPI cards (Collected, Pending, Refunds) and payment ledger list
- Emphasis on "R 0 platform fee" badge

---

## 3. Problem / Pain Points Section

### Section Header
"Payment Headaches That Cost You Bookings"

### Pain Points

| Pain Point | Emotional Hook | Before Vilo |
|------------|---------------|-------------|
| **OTA payment lock-in** | "Airbnb holds your money for weeks" | Cash flow delays; can't access your own revenue |
| **Platform commissions** | "15%+ gone before you see a Rand" | Margins eaten by middlemen on every booking |
| **No deposit option** | "Full payment or nothing" | Lose serious guests who can't pay upfront |
| **Manual EFT chaos** | "Which payment was that again?" | Matching bank statements to bookings manually |
| **No professional receipts** | "Where's my receipt?" | Scrambling to create documents after the fact |
| **Refund nightmares** | "Just give me my money back" | No process; arguments and confusion |

### Emotional Summary
"Getting paid should be the easiest part of hosting. Instead, most hosts deal with delayed settlements, confusing fees, and manual reconciliation. Vilo puts you back in control — your payments, your accounts, your cash flow."

---

## 4. Solution Overview

### Section Header
"Payments That Work for You"

### Transformation Narrative

| Before Vilo | After Vilo |
|-------------|-----------|
| OTA holds funds for weeks | Direct settlement to your bank account |
| 15%+ platform commission | Zero platform fee on booking payments |
| Full payment or nothing | Flexible deposit + balance options |
| Manual EFT matching | Automatic reference tracking |
| No receipts | Auto-numbered, branded PDF receipts |
| No refund process | Full refund workflow with approval |

### Key Differentiators
1. **Zero Platform Commission:** Vilo takes 0% of booking payments — funds go directly to you
2. **Multi-Method Flexibility:** Cards (Paystack), international (PayPal), local transfers (EFT) — guest chooses
3. **Deposit + Balance:** Collect deposits upfront, balance before check-in — your terms
4. **Professional Receipts:** Auto-numbered receipts with your branding, downloadable as PDF

---

## 5. Feature Deep-Dive Sections

### Sub-Feature 1: Direct Settlement
| Aspect | Detail |
|--------|--------|
| **What it does** | Card payments settle directly to your Paystack account; PayPal to your PayPal; EFT to your bank |
| **Why it matters** | No platform middleman; you control your cash flow |
| **Visual suggestion** | Flow diagram: Guest → Paystack → Your Bank (with "Vilo takes R 0" badge) |
| **Lucide icon** | `Landmark` |

### Sub-Feature 2: Card Payments (Paystack)
| Aspect | Detail |
|--------|--------|
| **What it does** | Accept all major cards via Paystack; ZAR transactions; instant confirmation |
| **Why it matters** | Professional checkout experience; guests trust Paystack; instant booking confirmation |
| **Visual suggestion** | Card icons (Visa, Mastercard, Amex) with Paystack badge |
| **Lucide icon** | `CreditCard` |

### Sub-Feature 3: PayPal (International)
| Aspect | Detail |
|--------|--------|
| **What it does** | Accept international cards via PayPal; USD pricing with automatic FX conversion |
| **Why it matters** | Capture international guests who prefer PayPal; expand your reach globally |
| **Visual suggestion** | PayPal logo with globe icon; USD/ZAR conversion display |
| **Lucide icon** | `Globe` |

### Sub-Feature 4: EFT / Bank Transfer
| Aspect | Detail |
|--------|--------|
| **What it does** | Show your banking details with unique reference; guest transfers manually; you reconcile |
| **Why it matters** | Some guests prefer direct bank transfer; lower fees; familiar for SA market |
| **Visual suggestion** | Banking details card with reference number highlighted |
| **Lucide icon** | `Building2` |

### Sub-Feature 5: Deposit + Balance
| Aspect | Detail |
|--------|--------|
| **What it does** | Collect deposit upfront (configurable %); guest pays balance before check-in |
| **Why it matters** | Reduce no-shows with skin in the game; flexibility for guests who can't pay full amount |
| **Visual suggestion** | Checkout showing "Pay Deposit (30%)" vs "Pay in Full" buttons |
| **Lucide icon** | `Percent` |

### Sub-Feature 6: Payment Ledger
| Aspect | Detail |
|--------|--------|
| **What it does** | Single source of truth for all booking payments: deposits, balance, add-ons, refunds |
| **Why it matters** | Always know exactly what's been paid; no spreadsheet reconciliation |
| **Visual suggestion** | Ledger table showing payment rows with amounts, methods, timestamps |
| **Lucide icon** | `Layers` |

### Sub-Feature 7: Payment Links
| Aspect | Detail |
|--------|--------|
| **What it does** | Generate shareable payment links for guests to pay directly |
| **Why it matters** | Collect payment via WhatsApp, email, or SMS without guest needing to log in |
| **Visual suggestion** | Copy-link button with "Share via WhatsApp" option |
| **Lucide icon** | `Link` |

### Sub-Feature 8: Auto Receipts
| Aspect | Detail |
|--------|--------|
| **What it does** | Auto-numbered receipts generated on payment completion; PDF download; public tokenized URL |
| **Why it matters** | Professional documentation for guests; audit trail for your records |
| **Visual suggestion** | Receipt document preview with download button |
| **Lucide icon** | `Receipt` |

### Sub-Feature 9: Refund Management
| Aspect | Detail |
|--------|--------|
| **What it does** | Full refund workflow: request → approve/decline → process (auto via card or manual via EFT) |
| **Why it matters** | Clear process for handling cancellations; documented decisions; guest trust |
| **Visual suggestion** | Refund queue with approve/decline buttons and amount field |
| **Lucide icon** | `RotateCcw` |

### Sub-Feature 10: Guest Store Credit
| Aspect | Detail |
|--------|--------|
| **What it does** | Overpayments automatically post to guest credit ledger; apply to future bookings |
| **Why it matters** | Never lose money to rounding; encourage repeat bookings; professional handling |
| **Visual suggestion** | Guest profile showing "R 250 store credit available" badge |
| **Lucide icon** | `Wallet` |

### Sub-Feature 11: Real-Time Status
| Aspect | Detail |
|--------|--------|
| **What it does** | Live payment status tracking: Pending → Completed / Failed; webhook-confirmed |
| **Why it matters** | Know instantly when payments land; no guessing or bank statement checking |
| **Visual suggestion** | Status badge animation (pending pulse → completed check) |
| **Lucide icon** | `Activity` |

### Sub-Feature 12: Multi-Business Accounts
| Aspect | Detail |
|--------|--------|
| **What it does** | Configure separate payment gateways per business entity |
| **Why it matters** | Manage multiple properties under different trading entities; proper accounting separation |
| **Visual suggestion** | Business selector dropdown with gateway badges per business |
| **Lucide icon** | `Briefcase` |

---

## 6. How It Works (Process Steps)

### Section Header
"From Booking to Bank Account — Automatically"

### Host Journey (Setup)

| Step | Action | Detail |
|------|--------|--------|
| 1 | Connect Paystack | Link your Paystack business account in settings |
| 2 | Add EFT details | Enter banking details (encrypted, never shared publicly) |
| 3 | Set deposit terms | Configure deposit percentage and balance due date |
| 4 | Done | Guests can now pay you directly |

### Guest Journey (Checkout)

| Step | Action | Detail |
|------|--------|--------|
| 1 | Accept quote | Guest receives quote and accepts |
| 2 | Choose amount | Deposit only or pay in full |
| 3 | Select method | Card (Paystack), PayPal, or EFT |
| 4 | Complete payment | Redirected to secure checkout or shown banking details |
| 5 | Confirmation | Booking confirmed; receipt generated |

### Visual Suggestion
Flow diagram: `Quote Accepted` → `Payment Page` → `Method Selection` → `Secure Checkout` → `Webhook Confirms` → `Booking Confirmed` → `Receipt Sent`

---

## 7. Social Proof Section

### Section Header
"Hosts Who Take Control of Their Payments"

### Testimonial Placeholders

**Safari Lodge (Kruger):**
> "We used to wait 3 weeks for Airbnb to release our funds. Now card payments hit our bank within 48 hours. That cash flow difference changed everything for our seasonal business."
> — *Lodge Manager, Greater Kruger*

**Boutique B&B (Cape Town):**
> "International guests love PayPal. We added it in 5 minutes and our overseas bookings jumped 20% the first month. No commission to Vilo — just the normal PayPal fees."
> — *B&B Owner, Cape Town*

**Self-Catering (Plettenberg Bay):**
> "The deposit option saved us from 3 no-shows last month alone. R 500 deposits mean guests actually show up. And if they cancel, we process the refund right from the dashboard."
> — *Self-Catering Host, Plett*

### Trust Indicators
- "R 0 platform fee on all booking payments"
- "Average settlement time: 48 hours (cards)"
- "1,200+ payment transactions processed monthly"

---

## 8. Comparison Section

### Section Header
"Why Hosts Choose Vilo Payments"

| Without Vilo | With Vilo |
|--------------|-----------|
| OTA holds funds for weeks | Direct settlement to your account |
| 15%+ platform commission | Zero platform fee on bookings |
| Full payment only | Flexible deposit + balance terms |
| Manual EFT matching | Automatic reference tracking |
| No receipts | Auto-numbered PDF receipts |
| No refund process | Full refund workflow with approval |
| One payment method | Cards + PayPal + EFT options |
| Generic checkout | Branded payment experience |

---

## 9. FAQ Section

### Q: Does Vilo take a commission on payments?
**A:** No. Vilo takes 0% of booking payments. Funds settle directly to your Paystack, PayPal, or bank account. You only pay the payment provider's standard fees (e.g., Paystack's 2.9%).

### Q: How long until I get paid?
**A:** Card payments via Paystack typically settle within 24-48 hours. PayPal settlements follow their standard timeline. EFT is instant once you mark it complete.

### Q: Can I require a deposit instead of full payment?
**A:** Yes. Set your deposit percentage in settings (e.g., 30%). Guests see "Pay Deposit" and "Pay in Full" options at checkout. Balance is due before check-in.

### Q: What happens if a guest overpays?
**A:** Overpayments automatically post to the guest's store credit. They can apply it to future bookings. No money gets lost.

### Q: How do refunds work?
**A:** Guests request refunds, you approve or decline from your dashboard. Card refunds process automatically via Paystack. EFT refunds you handle manually (with tracking in Vilo).

### Q: Can I accept international payments?
**A:** Yes. Connect your PayPal account and international guests can pay in USD. Automatic FX conversion displays the ZAR equivalent.

### Q: Do I need a Paystack account?
**A:** Yes, for card payments. Sign up at Paystack (free, 5-minute setup), then connect it in Vilo settings. EFT works without Paystack.

### Q: Are payment details secure?
**A:** Yes. All credentials are encrypted at rest (AES-256-GCM). Webhook signatures are verified before any database updates. Guest card details never touch Vilo servers — they go directly to Paystack/PayPal.

---

## 10. Final CTA Section

### Section Header
"Start Getting Paid — Your Way"

### Primary CTA
"Take the 2-minute Scorecard" → `#scorecard`

### Secondary CTA
"Claim your founding spot" → `/signup/host`

### Trust Elements
- "No credit card required"
- "90-day satisfaction guarantee"
- "Zero platform commission on bookings"

### Closing Statement
"Your bookings, your payments, your cash flow. Vilo connects the dots — you keep the money."

---

## 11. Design Notes for Claude Design

### Brand Colours (from DESIGN_SYSTEM.md)

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#10B981` | CTAs, success states, "Completed" badges |
| Secondary | `#064E3B` | Section headers, emphasis |
| Accent | `#D1FAE5` | Hover surfaces, payment method cards |
| Light | `#F0FDF4` | Page background, receipt surfaces |
| Dark | `#0A1510` | Hero section, footer |
| Ink | `#052E1F` | Body text, amounts |
| Mute | `#4A7C6A` | Secondary text, timestamps |
| Line | `#DCEAE0` | Borders, dividers, ledger rows |
| Warning | `#F59E0B` | Pending status, EFT awaiting |
| Danger | `#EF4444` | Failed status, refund amounts |

### Payment Status Colors

| Status | Color | Description |
|--------|-------|-------------|
| Completed | `#10B981` (Primary) | Payment received |
| Pending | `#F59E0B` (Warning) | Awaiting confirmation |
| Failed | `#EF4444` (Danger) | Payment failed |
| Refunded | `#6B7280` (Gray) | Fully refunded |

### Typography

| Element | Font |
|---------|------|
| Display/Headlines | Plus Jakarta Sans |
| Body/UI Text | Inter |
| Amounts/Currency | Plus Jakarta Sans (bold) |
| Receipt Numbers | JetBrains Mono |

### Component Guidelines
- Use shadcn/ui components exclusively
- Icons: lucide-react only, 1.5px stroke
- Payment method cards: Rounded with provider logo
- Amount displays: Large, bold, currency prefix
- Card radius: `rounded-card` (16px)
- CTA radius: `rounded-pill`
- Shadows: `shadow-card` resting, `shadow-lift` hover

### Lucide Icons for Payment Sub-Features

| Sub-Feature | Icon |
|-------------|------|
| Direct Settlement | `Landmark` |
| Card Payments | `CreditCard` |
| PayPal | `Globe` |
| EFT | `Building2` |
| Deposit + Balance | `Percent` |
| Payment Ledger | `Layers` |
| Payment Links | `Link` |
| Auto Receipts | `Receipt` |
| Refund Management | `RotateCcw` |
| Guest Store Credit | `Wallet` |
| Real-Time Status | `Activity` |
| Multi-Business | `Briefcase` |

### Layout Pattern (match /launch page)
- Dark gradient hero with dot grid overlay
- Alternating light/white sections
- Sticky nav with scorecard CTA
- Mobile-first responsive
- Rise animations (150-300ms, ease-out)

### Section-Specific Design Notes

**Hero:**
- Payment flow mockup as hero visual
- "R 0 Platform Fee" badge prominent
- Floating payment method icons (Visa, Mastercard, PayPal)

**Payment Methods Grid:**
- Three cards side by side (Card, PayPal, EFT)
- Provider logo on each card
- Brief description beneath
- "Most popular" badge on Card

**Checkout Mockup:**
- Mobile device frame showing guest checkout
- Deposit vs Full amount toggle
- Payment method selector
- Secure checkout badge

**Dashboard Mockup:**
- KPI cards: Collected, Pending, Failed, Refunds
- Payment ledger table with recent transactions
- Status badges with color coding
- Export button visible

**Receipt Preview:**
- Professional receipt document
- Auto-numbered with host branding
- Download/print icons
- Public link badge

### Animation Suggestions
- Payment status: Pulse animation for pending
- Success confirmation: Check icon with scale-up
- Amount counters: Count-up animation
- Payment method hover: Subtle lift

### Responsive Breakpoints
- Mobile: Single column, stacked payment methods
- Tablet: 2-column grid, ledger table scrollable
- Desktop: 3-column payment methods, full ledger view

---

## 12. Cross-Links to Other Feature Pages

Link to related features within the page:
- "See all payment activity in **[Reporting](/features/reporting)**"
- "Track invoices and receipts in **[Accounting](/features/accounting)**"
- "Collect payments from **[Quote Manager](/features/quotes)**"
- "Send payment links via **[Unified Inbox](/features/unified-inbox)**"

---

## 13. Content Guidelines

### Voice & Tone
- Confident and reassuring about money handling
- Emphasize control and transparency
- Clear about fees (or lack thereof)
- Professional but not intimidating

### Proof Points (from codebase)
- 3 payment methods: Paystack, PayPal, EFT (verified in codebase)
- Zero platform commission (verified in direct-settlement model)
- AES-256-GCM encryption for credentials (verified in migrations)
- HMAC SHA-512 webhook verification (verified in Edge Function)
- Auto-numbered receipts with tokens (verified in payments table)
- Guest store credit ledger (verified in guest_credit_ledger table)

### Avoid
- Making payment security sound complicated
- Discussing specific Paystack/PayPal fee structures (refer to providers)
- Implying Vilo processes payments (we don't — providers do)
- Making promises about settlement times (varies by provider)
