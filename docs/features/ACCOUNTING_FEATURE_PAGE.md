# Accounting & Ledger Feature — Sales Page Specification

> **For:** Claude Design
> **Feature:** Full Accounting Ledger
> **URL:** `/features/accounting`
> **Status:** Ready for implementation

---

## 1. Page Meta & SEO

```yaml
title: "Accounting & Invoicing for Accommodation Hosts — Wielo"
meta_description: "Auto-generated invoices, payment tracking, credit notes, and receipts. Your books done as you go. VAT-compliant. Built for SA accommodation hosts."
url_slug: /features/accounting
keywords:
  - accommodation accounting software
  - guesthouse invoicing south africa
  - lodge bookkeeping system
  - hospitality financial management
  - B&B invoice generator
og_title: "Full Accounting Ledger — Your Books, Done | Wielo"
og_description: "Invoices, receipts, credit notes, and payment tracking — all automatic. VAT-compliant accounting built for SA hosts."
og_image: "/images/features/accounting-og.jpg"
```

---

## 2. Hero Section

### Headline Options

```
Option A: "Your books. Done as you go."
Option B: "Invoices, receipts, and your ledger — all automatic."
Option C: "Stop dreading month-end. Wielo does your books."
```

**Recommended:** Option A — simple, powerful promise, addresses ongoing pain.

### Subheadline

```
"Wielo generates professional invoices the moment a booking confirms, tracks every payment, issues receipts automatically, and keeps a running ledger of what every guest owes. VAT-compliant, PDF-ready, and one less thing you need to think about."
```

### Hero CTA

```
Primary: "Take the 2-minute Scorecard" → #scorecard
Secondary: "See a sample invoice" → [link to demo invoice PDF]
```

### Hero Visual

```
Dashboard view showing:
- KPI cards at top: "R24,500 Collected" / "R3,200 Outstanding" / "47 Invoices"
- Transaction ledger table with columns: Date, Guest, Type, Amount, Balance
- Sample invoice PDF floating alongside showing:
  - Professional header with host logo
  - Line items (Accommodation, Cleaning, Add-ons)
  - VAT breakdown
  - "Paid" stamp

Floating elements:
- Receipt card: "Receipt #HOST-RCT2026-0014 · R2,400"
- Credit note badge: "Credit Note Issued"
```

---

## 3. Problem / Pain Points Section

### Section Header

```
Eyebrow: "The bookkeeping burden"
Headline: "You didn't start hosting to become an accountant."
```

### Pain Points

```
1. Pain: You create invoices manually in Word or Excel. It takes forever, and half of them have mistakes.
   Emotion: Tedium, frustration
   Cost: Hours spent on admin that doesn't grow your business.

2. Pain: You don't know exactly what guests owe you. Some paid deposits, some paid in full, some... you're not sure.
   Emotion: Anxiety, confusion
   Cost: Cash flow problems. Missed payments. Awkward chasing.

3. Pain: Your accountant asks for "all your invoices" and you spend a day hunting through emails and folders.
   Emotion: Dread
   Cost: Accounting fees for sorting your mess. Tax season stress.

4. Pain: You're VAT-registered but your invoices don't show VAT properly. Or you're not sure if they should.
   Emotion: Worry
   Cost: SARS compliance risk. Potential penalties.

5. Pain: A guest wants a receipt for their company. You have to create one from scratch, figure out the numbering, and hope it looks professional.
   Emotion: Embarrassment
   Cost: Time wasted. Amateur impression.
```

### "Before Wielo" Scenario

```
"It's the 28th of the month. Your accountant is waiting for your records. You have a folder of Word invoices — some numbered, some not. A WhatsApp thread with deposit confirmations. A bank statement you haven't reconciled. You promise yourself you'll be more organized next month. You've been saying that for a year."
```

---

## 4. Solution Overview

### Section Header

```
Eyebrow: "The Wielo way"
Headline: "Accounting that happens without you thinking about it."
```

### Transformation Statement

```
"From scattered Word docs and end-of-month panic to a complete, real-time ledger where every booking has an invoice, every payment has a receipt, and you know exactly what every guest owes — always."
```

### Key Differentiators

```
1. Invoices auto-generate — The moment a booking confirms, the invoice exists. Professional, numbered, VAT-compliant if you're registered. No manual creation.

2. Running balance per guest — Your ledger shows exactly what each guest owes after every transaction. Deposits, payments, credits — all tracked automatically.

3. Receipts stamp automatically — When a payment is recorded (manually or via Paystack/PayPal), a receipt number is assigned and the PDF is ready. No extra work.

4. One click at month-end — Export your full ledger, close the accounting period, hand it to your accountant. Done in minutes, not hours.
```

---

## 5. Feature Deep-Dive Sections

### Sub-Feature 1: Automatic Invoice Generation

```yaml
icon: FileText
headline: "Invoices appear the moment bookings confirm"
description: "When a guest's booking is confirmed, Wielo automatically creates a professional invoice. Line items for accommodation, cleaning, add-ons — all pulled from the booking. Numbered sequentially (INV2026-0001, INV2026-0002...). Ready to send or download as PDF."
visual: "Booking confirmation → Invoice auto-created notification → Invoice preview with line items"
```

### Sub-Feature 2: Professional Invoice Design

```yaml
icon: Palette
headline: "Invoices that look like you hired a designer"
description: "Your invoices include your business name, logo, VAT number, and banking details. Guest details, stay dates, itemized charges, and total — all laid out cleanly. Guests see a professional document, not a rushed Word file."
visual: "Invoice PDF showing: host logo + business details, guest info, line items, subtotal/VAT/total, banking details, 'Tax Invoice' header"
```

### Sub-Feature 3: VAT-Compliant

```yaml
icon: Receipt
headline: "VAT handled correctly — automatically"
description: "If you're VAT-registered, enter your VAT number once. Wielo calculates VAT on every booking, shows the breakdown on invoices, and labels them 'Tax Invoice'. Not registered? Invoices show the total without VAT. Either way, it's correct."
visual: "Invoice showing: Subtotal R3,000 / VAT (15%) R450 / Total R3,450 — with 'Tax Invoice' header"
```

### Sub-Feature 4: Payment Ledger

```yaml
icon: Wallet
headline: "Every payment tracked in one ledger"
description: "Wielo maintains a running ledger of all transactions: deposits, balance payments, card payments, EFT confirmations, refunds, credits. Filter by guest, booking, or date range. See what's been collected, what's outstanding, and who owes what."
visual: "Ledger table: Date, Guest, Type (Deposit/Balance/Refund), Amount, Running Balance — with filter dropdowns"
```

### Sub-Feature 5: Running Balance Per Guest

```yaml
icon: Calculator
headline: "Know exactly what each guest owes"
description: "Your ledger calculates a running balance after every transaction. Guest paid a 50% deposit? Balance shows what's left. Full payment came in? Balance is zero. Overpaid? Store credit is tracked automatically. No spreadsheet required."
visual: "Guest ledger view: 3 transactions listed, running balance column showing R4,200 → R2,100 → R0"
```

### Sub-Feature 6: Automatic Receipts

```yaml
icon: CheckCircle
headline: "Receipts generated the moment payment is recorded"
description: "When you record a payment — or when it comes through Paystack/PayPal automatically — a receipt number is assigned (RCT2026-0001). The guest can access their receipt via a secure link. No manual work. Proof of payment, always available."
visual: "Payment recorded → Receipt auto-generated toast → Receipt PDF preview"
```

### Sub-Feature 7: Credit Notes

```yaml
icon: FileX
headline: "Issue credit notes when you need to adjust"
description: "Guest's booking total needs to change? Issue a credit note against their invoice. Specify the amount and reason. The credit note links to the original invoice, posts to store credit, and adjusts the balance. Professional, auditable, clean."
visual: "Credit note creation form: Select invoice, enter amount, add reason → Credit note preview"
```

### Sub-Feature 8: Overpayment to Store Credit

```yaml
icon: Gift
headline: "Overpayments become store credit — automatically"
description: "If a guest pays more than their balance, the excess posts to store credit against their account. Use it for their next booking, or refund it. You never lose track of who's owed what."
visual: "Payment recorded: R5,000 on R4,500 booking → Store credit: R500 toast notification"
```

### Sub-Feature 9: Multi-Invoice Per Booking

```yaml
icon: Layers
headline: "Add charges after the original invoice"
description: "Guest adds breakfast? Late checkout fee? Wielo creates a supplementary add-on invoice linked to the same booking. Each invoice has its own number and PDF. The booking's total updates, and the ledger reflects the new balance."
visual: "Booking with 2 invoices: 'Accommodation Invoice' + 'Add-on Invoice' — each with separate number and amount"
```

### Sub-Feature 10: Public Invoice & Receipt Links

```yaml
icon: Link
headline: "Share invoices and receipts with a secure link"
description: "Every invoice and receipt has a unique hosted URL. Share it with guests or their companies for expense claims. No login required — just a secure token link that shows the document."
visual: "URL bar showing 'wieloplatform.com/invoice/abc123...' with invoice view loading"
```

### Sub-Feature 11: Accounting Period Close

```yaml
icon: Lock
headline: "Close the month and lock your records"
description: "At month-end, close the accounting period. Once closed, no transactions can be created or voided for that month — protecting your audit trail. Reopen if you made a mistake (before your accountant files). Clean handoffs, no back-dating."
visual: "Period control: 'May 2026 · Open' with 'Close Period' button, then 'May 2026 · Closed' badge with lock icon"
```

### Sub-Feature 12: Download & Export

```yaml
icon: Download
headline: "Download PDFs anytime — export your ledger too"
description: "Every invoice, receipt, and credit note can be downloaded as a professional PDF. Export your full transaction ledger for your accountant. No more hunting through folders. Everything in one place, one click."
visual: "Export dropdown: 'Download PDF', 'Export Ledger (CSV)' — with download progress indicator"
```

---

## 6. How It Works

### Section Header

```
Eyebrow: "Zero effort accounting"
Headline: "The books that keep themselves."
```

### Automatic Flow

```
Step 1: Guest books & confirms — Invoice auto-generated with all line items
  Visual: Booking card → "Invoice #HOST-INV2026-0047 created" notification

Step 2: Guest pays (or you record it) — Payment logged, receipt stamped
  Visual: Payment modal → "Receipt #HOST-RCT2026-0052 generated" toast

Step 3: Ledger updates automatically — Running balance reflects new state
  Visual: Ledger row appearing with Amount, Balance column updated

Step 4: Month-end: close & export — Hand your accountant a clean ledger
  Visual: "Close May 2026" button → Export download → "Period closed" badge
```

### Manual Actions (When Needed)

```
Record EFT payment — Guest paid via bank transfer? Record it manually. Receipt auto-generates.
Issue credit note — Need to reduce an invoice? Create a credit note with reason.
Void a payment — Made an error? Void the entry with a reason. Audit trail preserved.
```

---

## 7. Social Proof Section

### Section Header

```
Eyebrow: "From real hosts"
Headline: "Finally, bookkeeping that doesn't hurt"
```

### Testimonial Placeholders

```
Testimonial 1:
  Quote: "I used to spend the last weekend of every month sorting invoices. Now it just... happens. My accountant thinks I hired a bookkeeper."
  Name: "[Name]"
  Property: "Guesthouse · Stellenbosch"

Testimonial 2:
  Quote: "The running balance feature is everything. I always know exactly what's outstanding. No more awkward 'did you pay the balance?' messages."
  Name: "[Name]"
  Property: "Self-catering · Cape Town"

Testimonial 3:
  Quote: "My corporate guests need proper tax invoices. Wielo does them automatically with our VAT number and everything. Professional and effortless."
  Name: "[Name]"
  Property: "Lodge · Pretoria"
```

### Use Case Scenarios

```
Scenario 1: A Franschhoek guesthouse processes 80 bookings a month. Each one auto-generates an invoice — saving 20+ hours of manual invoicing.

Scenario 2: A VAT-registered lodge exports monthly ledgers for their accountant. Period close prevents back-dated changes. Audit-ready records.

Scenario 3: A Knysna B&B tracks store credits for returning guests. Overpayments carry forward seamlessly — no spreadsheet tracking.
```

### Stats (placeholder)

```
Stat 1: [X] invoices auto-generated by founding hosts
Stat 2: [X] hours saved per month on average
Stat 3: 100% — VAT compliance for registered hosts
```

---

## 8. Comparison Section

### Section Header

```
Eyebrow: "Side by side"
Headline: "Manual bookkeeping vs. Wielo Accounting"
```

### Comparison Table

| Without Wielo | With Wielo |
|--------------|-----------|
| Create invoices manually in Word/Excel | Invoices auto-generate on booking confirmation |
| Track payments in a spreadsheet | Running ledger with automatic balance calculation |
| Forget who owes what | Per-guest balance always visible |
| VAT calculation — manual and error-prone | VAT calculated automatically per booking |
| Receipts — create from scratch | Receipts auto-stamp when payment recorded |
| Month-end panic sorting documents | One-click export, period close in seconds |
| Credit notes — what's that? | Credit notes linked to invoices, audit trail intact |
| Hand accountant a folder of chaos | Hand accountant a clean CSV ledger |

---

## 9. FAQ Section

### Questions & Answers

```
Q: Are invoices created automatically?
A: Yes. The moment a booking is confirmed, an invoice is generated with all line items (accommodation, cleaning, add-ons). You don't need to do anything.

Q: What if I'm not VAT-registered?
A: No problem. Invoices show the total without VAT breakdown. The moment you add a VAT number to your business profile, future invoices will include VAT automatically.

Q: How do I track EFT payments?
A: When a guest pays via bank transfer, you record the payment manually in Wielo. A receipt is auto-generated, and the ledger updates. Card payments via Paystack/PayPal are tracked automatically.

Q: What's a credit note?
A: A credit note reduces an invoice. If you need to adjust a guest's balance — discount, partial refund, error correction — you issue a credit note. It links to the original invoice and posts to their store credit.

Q: Can guests see their invoices?
A: Yes. Every invoice has a secure public link you can share. Guests can view or download the PDF without logging in.

Q: What does "close the period" mean?
A: Closing an accounting period (e.g., May 2026) locks all transactions for that month. No new entries can be created or voided for closed periods. This protects your audit trail and makes accountant handoffs clean.

Q: Can I export my ledger?
A: Yes. Export your full transaction history as a CSV or PDF. Filter by date range, guest, or booking before exporting.

Q: What if I make a mistake on a payment?
A: Void the payment entry with a reason. The void is recorded (not deleted), and the balance recalculates. Audit trail stays intact.
```

---

## 10. Final CTA Section

### Section Content

```
Eyebrow: "Ready to stop dreading month-end?"
Headline: "Your books — done, accurate, and waiting."
Body: "See how much time you're losing to manual invoicing and scattered records. Take the 2-minute scorecard and find out what automated accounting could save you."

Primary CTA: "Take the 2-minute Scorecard" → #scorecard
Secondary CTA: "Claim your founding spot" → /signup/host

Trust elements:
  - No card required
  - 90-day money-back guarantee
  - Full accounting ledger included in every plan
  - VAT-compliant for SA hosts
```

---

## 11. Design Notes for Claude Design

### Brand Reference

**Colours:**
| Token | Hex | Usage |
|-------|-----|-------|
| `brand-primary` | `#10B981` | CTAs, positive numbers (collected) |
| `brand-secondary` | `#064E3B` | Headers, emphasis |
| `brand-accent` | `#D1FAE5` | Hover, backgrounds |
| `brand-light` | `#F0FDF4` | Page background |
| `brand-dark` | `#0A1510` | Hero, footer |
| `status-pending` | `#F59E0B` | Outstanding amounts (amber) |
| `status-cancelled` | `#EF4444` | Voided, refunded (red) |

**Accounting-Specific Colors:**
- Collected: `#10B981` (green)
- Outstanding: `#F59E0B` (amber)
- Refunded: `#EF4444` (red)
- Credits: `#6366F1` (indigo)
- Voided entries: `#94A3B8` (slate, strikethrough)

**Typography:**
- Display: Plus Jakarta Sans (headlines, KPIs)
- Body: Inter (descriptions)
- Mono: JetBrains Mono (invoice numbers, amounts, references)

### Page Layout

```
1. HERO (dark gradient + dot grid)
   - Two-column: copy left, dashboard mockup right
   - Dashboard shows KPI cards + ledger table

2. PROBLEM SECTION (light background)
   - Pain points as numbered cards
   - "Before Wielo" scenario as callout

3. SOLUTION OVERVIEW (white background)
   - Transformation statement
   - 4 differentiators as icon cards

4. FEATURE DEEP-DIVE (alternating light/white)
   - 12 sub-features grouped:
     * Invoice Generation (1-3): Auto, Design, VAT
     * Tracking (4-6): Ledger, Balance, Receipts
     * Adjustments (7-9): Credit Notes, Overpayment, Multi-Invoice
     * Management (10-12): Links, Period Close, Export

5. HOW IT WORKS (light background)
   - Automatic flow (4 steps)
   - Manual actions sidebar

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
1. Accounting dashboard with KPI cards + ledger table
2. Invoice PDF preview (with VAT breakdown)
3. Receipt PDF preview
4. Credit note creation form
5. Ledger detail view (per-guest transactions)
6. Period close control with locked badge
7. Payment recording modal
```

### Responsive Behaviour

```
Mobile (< 768px):
  - Single column
  - KPI cards stack vertically
  - Ledger table horizontal scroll

Tablet (768-1024px):
  - 2-column KPI cards
  - Full ledger table visible

Desktop (> 1024px):
  - Full dashboard layout
  - 4-column KPI cards
```

### Animations

```
- KPI numbers count up on first view
- Ledger rows animate in on scroll
- Invoice PDF slides in from right
- "Paid" stamp appears with subtle scale effect
```

### Lucide Icons Reference

| Sub-Feature | Icon |
|-------------|------|
| Auto Invoice | `FileText` |
| Invoice Design | `Palette` |
| VAT Compliant | `Receipt` |
| Payment Ledger | `Wallet` |
| Running Balance | `Calculator` |
| Receipts | `CheckCircle` |
| Credit Notes | `FileX` |
| Store Credit | `Gift` |
| Multi-Invoice | `Layers` |
| Public Links | `Link` |
| Period Close | `Lock` |
| Export | `Download` |

---

## Checklist

- [x] All sections completed with specific content
- [x] Headlines are benefit-focused
- [x] Pain points use emotional language
- [x] All claims verified against codebase (auto-invoice, VAT, receipts, credit notes, etc.)
- [x] CTAs match /launch page pattern
- [x] Visual descriptions specific to accounting UI
- [x] FAQs address real concerns (VAT, EFT, credit notes)
- [x] Design notes include ledger color coding
- [x] 12 sub-features documented with icons
