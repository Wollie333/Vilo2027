# Reporting & Analytics Feature Page Specification

> **Purpose:** Comprehensive brief for Claude Design to build a conversion-focused feature sales page for Wielo's Reporting & Analytics.
> **URL:** `/features/reporting`

---

## 1. Page Meta & SEO

| Field | Content |
|-------|---------|
| **Page Title** | Reporting & Analytics for SA Accommodation Hosts | Wielo |
| **Meta Description** | Understand your accommodation business with real-time KPIs, revenue trends, occupancy tracking, and exportable reports. Built for South African hosts who want data-driven decisions. |
| **Target Keywords** | accommodation analytics, hospitality reporting, revenue dashboard, occupancy tracking, property management reports, South Africa accommodation |
| **URL Slug** | `/features/reporting` |
| **OG Title** | Data-Driven Decisions for Your Accommodation Business — Wielo Reporting |
| **OG Description** | Real-time KPIs, revenue trends, channel mix analysis, and scheduled reports — all designed for SA accommodation hosts. |

---

## 2. Hero Section

### Primary Headline Options
1. "Know Your Numbers. Grow Your Bookings."
2. "From Gut Feel to Data-Driven Decisions"
3. "The Dashboard Your Accommodation Business Deserves"

### Subheadline
"Real-time KPIs, revenue trends, channel analysis, and exportable reports — built specifically for South African accommodation hosts who want to understand what's working."

### Hero CTA
- **Primary:** "Take the 2-minute Scorecard" → `#scorecard`
- **Secondary:** "Claim your founding spot" → `/signup/host`

### Hero Visual Suggestion
Dashboard mockup showing:
- **Top row:** 4 primary KPI cards (Revenue, RevPAR, ADR, Occupancy) with sparklines and growth percentages
- **Bottom left:** Revenue trend chart with dual lines (current vs prior period)
- **Bottom right:** Channel mix pie chart showing Direct vs OTA breakdown
- All with real-looking South African data (Rand values, familiar property types)

---

## 3. Problem / Pain Points Section

### Section Header
"Running Blind Costs You Money"

### Pain Points

| Pain Point | Emotional Hook | Before Wielo |
|------------|---------------|-------------|
| **No revenue visibility** | "How much did you actually make last month?" | Spreadsheets, receipts, bank statements — never a clear answer |
| **Unknown occupancy rate** | "Are you full? Half-full? No idea?" | Counting bookings manually; missing the big picture |
| **OTA vs Direct mystery** | "Which channels actually make you money?" | No way to compare direct bookings against OTA performance |
| **Seasonal blindspots** | "When should you raise or lower rates?" | Guessing based on feel, missing pricing opportunities |
| **Export nightmares** | "Accountant needs numbers. Where are they?" | Hours rebuilding data from scratch every month |
| **No early warnings** | "Cancellations creeping up? Wouldn't know." | Problems only visible when revenue already lost |

### Emotional Summary
"Most accommodation hosts are excellent at hospitality but flying blind on their numbers. Wielo gives you the dashboard you wish you'd always had — without the enterprise software price tag or complexity."

---

## 4. Solution Overview

### Section Header
"Your Accommodation Business at a Glance"

### Transformation Narrative

| Before Wielo | After Wielo |
|-------------|-----------|
| Scattered spreadsheets | One real-time dashboard |
| Manual revenue tracking | Automatic KPI calculations |
| No period comparisons | Current vs prior period built-in |
| Guessing at channel ROI | Visual channel mix breakdown |
| Manual export for accountants | One-click CSV, PDF, or Excel |
| Flying blind on trends | Revenue sparklines and trends |
| No scheduled insights | Automated reports to your inbox |

### Key Differentiators
1. **Built for SA Hosts:** Rand currency, province-level analytics, local seasonality patterns
2. **Period Comparison:** Every metric shows current vs prior period with growth/decline percentage
3. **Zero Setup:** All reporting auto-generated from your bookings — no data entry required
4. **Export Flexibility:** CSV for spreadsheets, PDF for presentations, Excel for accountants

---

## 5. Feature Deep-Dive Sections

### Sub-Feature 1: Primary KPIs Dashboard
| Aspect | Detail |
|--------|--------|
| **What it does** | Shows 4 core metrics: Total Revenue, RevPAR, ADR, Occupancy — all with period comparison |
| **Why it matters** | Instant snapshot of business health; see growth or decline at a glance |
| **Visual suggestion** | Four KPI cards in a row, each with large number, sparkline, and green/red delta badge |
| **Lucide icon** | `LayoutDashboard` |

### Sub-Feature 2: Revenue Trend Chart
| Aspect | Detail |
|--------|--------|
| **What it does** | Line chart showing daily revenue, with current and prior period overlay |
| **Why it matters** | Spot patterns, seasonality, and anomalies; understand your revenue rhythm |
| **Visual suggestion** | Dual-line chart with blue (current) and gray (prior) lines, time range toggles |
| **Lucide icon** | `TrendingUp` |

### Sub-Feature 3: Channel Mix Analysis
| Aspect | Detail |
|--------|--------|
| **What it does** | Pie chart showing revenue and bookings by channel: Direct, Airbnb, Booking.com, Expedia, Other |
| **Why it matters** | Know which channels deliver value; optimize your distribution strategy |
| **Visual suggestion** | Donut chart with channel labels, revenue amounts, and percentage share |
| **Lucide icon** | `PieChart` |

### Sub-Feature 4: Conversion Funnel
| Aspect | Detail |
|--------|--------|
| **What it does** | Tracks Views → Inquiries → Quotes → Bookings with conversion rates at each stage |
| **Why it matters** | Find where you're losing potential guests; optimize your weakest stage |
| **Visual suggestion** | Funnel visualization with 4 stages, counts, and conversion percentages between each |
| **Lucide icon** | `Filter` |

### Sub-Feature 5: Property Performance Table
| Aspect | Detail |
|--------|--------|
| **What it does** | Sortable, paginated table showing revenue, occupancy, ADR, and bookings per property |
| **Why it matters** | Compare properties side-by-side; identify your top and bottom performers |
| **Visual suggestion** | Data table with property thumbnails, sortable columns, pagination controls |
| **Lucide icon** | `Table` |

### Sub-Feature 6: Guest Demographics
| Aspect | Detail |
|--------|--------|
| **What it does** | Shows returning vs new guest ratio, plus country breakdown of guest origins |
| **Why it matters** | Understand your audience; tailor marketing to your actual guest profile |
| **Visual suggestion** | Two-column card: left shows returning/new split, right shows top 5 countries |
| **Lucide icon** | `Users` |

### Sub-Feature 7: Regional Breakdown
| Aspect | Detail |
|--------|--------|
| **What it does** | Revenue and bookings by South African province (WC, GP, KZN, EC, Other) |
| **Why it matters** | See where your guests come from; focus marketing on high-value regions |
| **Visual suggestion** | Horizontal bar chart with province labels, revenue amounts, percentage bars |
| **Lucide icon** | `MapPin` |

### Sub-Feature 8: Seasonality Heatmap
| Aspect | Detail |
|--------|--------|
| **What it does** | 12-month × region matrix showing occupancy/revenue intensity across the year |
| **Why it matters** | Visual calendar of your busy and slow periods; plan pricing and promotions |
| **Visual suggestion** | Heatmap grid with months as columns, regions as rows, color intensity = demand |
| **Lucide icon** | `Calendar` |

### Sub-Feature 9: Refunds & Cancellations
| Aspect | Detail |
|--------|--------|
| **What it does** | Tracks refund count, rate, and amount; cancellation count, rate, and reasons |
| **Why it matters** | Early warning system for problems; understand why bookings fall through |
| **Visual suggestion** | Metrics card showing refund/cancellation KPIs with trend arrows |
| **Lucide icon** | `XCircle` |

### Sub-Feature 10: Commission Savings
| Aspect | Detail |
|--------|--------|
| **What it does** | Calculates cumulative commission saved by booking direct instead of through OTAs |
| **Why it matters** | See the tangible value of direct bookings; motivation to push direct channels |
| **Visual suggestion** | Hero-style card showing "R 45,000 saved in commission" with lifetime total |
| **Lucide icon** | `Wallet` |

### Sub-Feature 11: Export Reports
| Aspect | Detail |
|--------|--------|
| **What it does** | One-click export to CSV (spreadsheets), PDF (presentations), or XLSX (Excel) |
| **Why it matters** | Get data to your accountant, bank, or tax advisor in their preferred format |
| **Visual suggestion** | Export dropdown menu with format icons; "Download" button |
| **Lucide icon** | `Download` |

### Sub-Feature 12: Scheduled Reports
| Aspect | Detail |
|--------|--------|
| **What it does** | Set up daily, weekly, or monthly reports delivered automatically to your inbox |
| **Why it matters** | Stay informed without logging in; reports arrive on your schedule |
| **Visual suggestion** | Schedule configuration modal with frequency options, recipient list, format picker |
| **Lucide icon** | `Clock` |

---

## 6. How It Works (Process Steps)

### Section Header
"From Bookings to Insights — Automatically"

### Host Journey

| Step | Action | Detail |
|------|--------|--------|
| 1 | Bookings happen | Direct bookings, iCal imports, manual entries all count |
| 2 | Data aggregates | Wielo automatically calculates KPIs, trends, and comparisons |
| 3 | Open dashboard | Visit Reports page to see real-time analytics |
| 4 | Filter & drill down | Select date range, property, channel, or region |
| 5 | Compare periods | Toggle "vs prior period" to see growth/decline |
| 6 | Export or schedule | Download one-time reports or set up automated delivery |

### Visual Suggestion
Flow diagram: `Bookings` → `Auto-calculation` → `Dashboard` → `Filter` → `Compare` → `Export/Schedule`

---

## 7. Social Proof Section

### Section Header
"Hosts Who Make Data-Driven Decisions"

### Testimonial Placeholders

**Safari Lodge (Limpopo):**
> "Before Wielo, I had no idea Airbnb was costing me 18% more than direct bookings. Now I see the channel mix and I've shifted my marketing budget. Direct is up 35% in three months."
> — *Lodge Owner, Limpopo*

**Boutique Guesthouse (Stellenbosch):**
> "The seasonality heatmap showed me exactly when to raise rates for wine harvest season. I'd been leaving money on the table for years without knowing."
> — *Guesthouse Manager, Stellenbosch*

**Self-Catering (Durban):**
> "My accountant used to take two days to piece together my numbers from different sources. Now I send her one Excel export. Done in 30 seconds."
> — *Self-Catering Owner, Durban*

### Trust Indicators
- "R 12M+ in bookings analyzed monthly across Wielo hosts"
- "Average host saves 4 hours per month on reporting"
- "89% of hosts discover optimization opportunities in their first week"

---

## 8. Comparison Section

### Section Header
"Why Hosts Switch to Wielo Analytics"

| Without Wielo | With Wielo |
|--------------|-----------|
| Multiple spreadsheets and tools | One unified dashboard |
| Manual calculations | Automatic KPIs and trends |
| No period comparisons | Built-in current vs prior analysis |
| Guessing at channel performance | Visual channel mix breakdown |
| Hours building reports | One-click CSV, PDF, or Excel |
| No scheduled insights | Automated reports to your inbox |
| Enterprise pricing | Included with your Wielo plan |
| Generic hospitality metrics | SA-specific: Rand, provinces, local seasons |

---

## 9. FAQ Section

### Q: How far back does reporting go?
**A:** From your first booking in Wielo. All historical data is preserved and included in analytics. There's no limit on date ranges.

### Q: Can I see analytics for a single property?
**A:** Yes. Use the "Listing" filter to scope all reports to a single property. Great for comparing property performance or sharing reports with property owners.

### Q: What's the difference between RevPAR and ADR?
**A:** ADR (Average Daily Rate) is your average price per booked night. RevPAR (Revenue Per Available Room/Night) factors in occupancy, showing revenue potential across all available nights — booked or not.

### Q: Can my accountant access reports?
**A:** You can export reports in CSV, PDF, or Excel format and email them directly. For recurring needs, set up a scheduled report that emails your accountant automatically.

### Q: How do scheduled reports work?
**A:** Choose a report type, format (CSV/PDF/Excel), frequency (daily/weekly/monthly), and recipient emails. Reports generate and deliver automatically on schedule.

### Q: Is iCal data included in analytics?
**A:** Yes. Bookings imported via iCal sync appear in all reports. The channel is auto-detected from the source (Airbnb, Booking.com, etc.) for accurate channel mix analysis.

### Q: What's the Commission Savings metric?
**A:** It calculates how much you've saved by booking direct instead of through OTAs. Based on standard OTA commission rates (15%+), it shows the tangible value of your direct booking strategy.

### Q: Can I compare this year to last year?
**A:** Yes. The "vs prior period" toggle shows automatic period comparison. Select any date range and Wielo calculates the equivalent prior period automatically.

---

## 10. Final CTA Section

### Section Header
"Start Making Data-Driven Decisions Today"

### Primary CTA
"Take the 2-minute Scorecard" → `#scorecard`

### Secondary CTA
"Claim your founding spot" → `/signup/host`

### Trust Elements
- "No credit card required"
- "90-day satisfaction guarantee"
- "Full analytics on every plan"

### Closing Statement
"Stop guessing. Start knowing. Your bookings already hold the answers — Wielo just makes them visible."

---

## 11. Design Notes for Claude Design

### Brand Colours (from DESIGN_SYSTEM.md)

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#10B981` | CTAs, positive deltas, growth indicators |
| Secondary | `#064E3B` | Chart emphasis, section headers |
| Accent | `#D1FAE5` | Hover surfaces, KPI card backgrounds |
| Light | `#F0FDF4` | Page background, card surfaces |
| Dark | `#0A1510` | Hero section, footer, heatmap dark |
| Ink | `#052E1F` | Body text, chart labels |
| Mute | `#4A7C6A` | Secondary text, prior period lines |
| Line | `#DCEAE0` | Borders, dividers, grid lines |
| Danger | `#EF4444` | Negative deltas, cancellation indicators |

### Typography

| Element | Font |
|---------|------|
| Display/Headlines | Plus Jakarta Sans |
| Body/UI Text | Inter |
| Chart Labels | Inter (smaller size) |
| KPI Numbers | Plus Jakarta Sans (larger weight) |
| Timestamps | JetBrains Mono |

### Component Guidelines
- Use shadcn/ui components exclusively
- Icons: lucide-react only, 1.5px stroke
- KPI cards: Large numbers, small labels, sparkline right-aligned
- Charts: Recharts library styling, consistent color palette
- Card radius: `rounded-card` (16px)
- CTA radius: `rounded-pill`
- Shadows: `shadow-card` resting, `shadow-lift` hover

### Lucide Icons for Reporting Sub-Features

| Sub-Feature | Icon |
|-------------|------|
| Primary KPIs | `LayoutDashboard` |
| Revenue Trend | `TrendingUp` |
| Channel Mix | `PieChart` |
| Conversion Funnel | `Filter` |
| Property Table | `Table` |
| Guest Demographics | `Users` |
| Regional Breakdown | `MapPin` |
| Seasonality Heatmap | `Calendar` |
| Refunds/Cancellations | `XCircle` |
| Commission Savings | `Wallet` |
| Export Reports | `Download` |
| Scheduled Reports | `Clock` |

### Layout Pattern (match /launch page)
- Dark gradient hero with dot grid overlay
- Alternating light/white sections
- Sticky nav with scorecard CTA
- Mobile-first responsive
- Rise animations (150-300ms, ease-out)

### Section-Specific Design Notes

**Hero:**
- Dashboard mockup as hero image
- Floating KPI cards with subtle parallax
- Animated sparklines on load

**KPI Cards:**
- Large primary number (Revenue: "R 124,500")
- Small label below
- Sparkline chart (7-10 points)
- Delta badge ("+12.5%" or "-3.2%")
- Green for positive, red for negative

**Charts:**
- Clean, minimal chart design
- Tooltips on hover
- Legend placement outside chart area
- Consistent color palette across all charts

**Property Table:**
- Zebra striping for rows
- Property thumbnail images
- Sortable column headers with chevron indicators
- Pagination controls at bottom

**Heatmap:**
- Color scale: Light (low) → Primary green (high)
- Month labels at top
- Region labels on left
- Cell hover shows exact value

**Export Section:**
- Dropdown with format icons (CSV, PDF, Excel)
- Visual preview of each format
- "Download" button prominent

### Animation Suggestions
- KPI numbers: Count-up animation on scroll
- Charts: Progressive line drawing animation
- Cards: Staggered fade-in from left
- Heatmap cells: Sequential reveal
- Period toggle: Smooth transition between current/prior

### Responsive Breakpoints
- Mobile: Single column, stacked KPIs, simplified charts
- Tablet: 2-column grid, full charts
- Desktop: 4-column KPI row, side-by-side layouts

---

## 12. Cross-Links to Other Feature Pages

Link to related features within the page:
- "Track how quotes convert in **[Quote Manager](/features/quotes)**"
- "See how reviews impact your metrics in **[Review Manager](/features/review-manager)**"
- "Understand your revenue drivers with **[Revenue Tools](/features/revenue-tools)**"
- "Export accounting data to **[Accounting](/features/accounting)**"

---

## 13. Content Guidelines

### Voice & Tone
- Professional and confident
- Data-forward but not overwhelming
- Empathetic to hosts who aren't "numbers people"
- Clear explanations of metrics without jargon

### Proof Points (from codebase)
- 4 primary KPIs + 11 secondary metrics (verified in RPC functions)
- CSV, PDF, and XLSX export (verified in export actions)
- Daily, weekly, monthly scheduled reports (verified in database schema)
- Province-level regional breakdown (WC, GP, KZN, EC)
- 5 channel types tracked (Direct, Airbnb, Booking.com, Expedia, Other)
- Period-vs-period comparison built into all RPCs

### Avoid
- Naming competitors directly
- Overwhelming with too many metrics at once
- Technical jargon without explanation
- Making analytics seem complicated or intimidating
