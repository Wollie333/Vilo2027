# Feature Page Specification Template

> **Purpose:** This template provides Claude Design with everything needed to build a conversion-focused, SEO-optimized feature sales page for Wielo. Copy this file and fill in the placeholders for each new feature page.

---

## 1. Page Meta & SEO

```yaml
title: "[Feature Name] — Wielo"
meta_description: "[150-160 chars describing the feature benefit for SA accommodation hosts]"
url_slug: /features/[feature-name]
keywords:
  - [primary keyword]
  - [secondary keyword]
  - [long-tail keyword]
og_title: "[Feature Name] for South African Hosts | Wielo"
og_description: "[Same as meta description or shorter variant]"
og_image: "/images/features/[feature-name]-og.jpg"
```

---

## 2. Hero Section

### Headline Options
Provide 2-3 benefit-focused headline options. Headlines should:
- Focus on the outcome, not the feature name
- Speak directly to the host's pain or desire
- Be 6-12 words maximum

```
Option A: [Headline focusing on time saved]
Option B: [Headline focusing on money/bookings gained]
Option C: [Headline focusing on professionalism/trust]
```

### Subheadline
One sentence (15-25 words) that clarifies what the feature does and who it's for.

```
[Subheadline text]
```

### Hero CTA
```
Primary: "Take the 2-minute Scorecard" → #scorecard
Secondary: "See how it works" → #how-it-works (anchor link)
```

### Hero Visual
Describe what screenshot, mockup, or illustration should appear:
```
[Description of hero visual - e.g., "Screenshot of the quote builder with a completed quote showing itemized pricing, guest details, and send button highlighted"]
```

---

## 3. Problem / Pain Points Section

### Section Header
```
Eyebrow: [2-3 word label, e.g., "The problem"]
Headline: [Problem-focused headline that resonates emotionally]
```

### Pain Points (3-5)
For each pain point:
- **Pain:** [What the host experiences]
- **Emotion:** [How it makes them feel]
- **Cost:** [What it costs them - time, money, bookings, reputation]

```
1. Pain: [Description]
   Emotion: [Frustration/anxiety/embarrassment]
   Cost: [Lost bookings/wasted hours/unprofessional image]

2. Pain: [Description]
   Emotion: [...]
   Cost: [...]

3. Pain: [Description]
   Emotion: [...]
   Cost: [...]
```

### "Before Wielo" Scenario
Write a short narrative (3-4 sentences) describing a typical host struggling without this feature. Use second person ("you").

```
[Before scenario narrative]
```

---

## 4. Solution Overview

### Section Header
```
Eyebrow: [e.g., "The Wielo way"]
Headline: [Solution-focused headline showing transformation]
```

### Transformation Statement
One powerful sentence showing the before → after shift.

```
[Transformation statement]
```

### Key Differentiators (3-4)
What makes Wielo's approach unique vs. manual processes or other tools?

```
1. [Differentiator + why it matters]
2. [Differentiator + why it matters]
3. [Differentiator + why it matters]
```

---

## 5. Feature Deep-Dive Sections

For each sub-feature, complete this block:

### Sub-Feature: [Name]

```yaml
icon: [Lucide icon name]
headline: "[Benefit-focused headline, 4-8 words]"
description: "[2-3 sentences explaining what it does and why it matters]"
visual: "[Description of screenshot/animation to show]"
```

**Repeat for each sub-feature.**

---

## 6. How It Works

### Host Journey
```
Step 1: [Action] — [Brief description]
Step 2: [Action] — [Brief description]
Step 3: [Action] — [Brief description]
Step 4: [Action] — [Brief description]
```

### Guest Journey (if applicable)
```
Step 1: [Action] — [Brief description]
Step 2: [Action] — [Brief description]
Step 3: [Action] — [Brief description]
```

### Visual Suggestion
```
[Describe the visual treatment - e.g., "Numbered steps with icons, connected by dotted lines, alternating left/right on desktop, stacked on mobile"]
```

---

## 7. Social Proof Section

### Testimonial Placeholders
```
Testimonial 1:
  Quote: "[Placeholder quote about specific benefit]"
  Name: "[Name]"
  Property: "[Property type] · [Location]"

Testimonial 2:
  Quote: "[Placeholder quote about different benefit]"
  Name: "[Name]"
  Property: "[Property type] · [Location]"
```

### Use Case Scenarios
```
Scenario 1: [Property type] uses [feature] to [achieve outcome]
Scenario 2: [Property type] uses [feature] to [achieve outcome]
```

### Stats (placeholder or real)
```
Stat 1: [Number] — [What it measures]
Stat 2: [Number] — [What it measures]
```

---

## 8. Comparison Section

### Section Header
```
Eyebrow: "Side by side"
Headline: "[Comparison headline]"
```

### Comparison Table
| Without Wielo | With Wielo |
|--------------|-----------|
| [Pain point] | [Solution] |
| [Pain point] | [Solution] |
| [Pain point] | [Solution] |
| [Pain point] | [Solution] |

---

## 9. FAQ Section

### Questions & Answers
For each FAQ:
```
Q: [Question hosts commonly ask]
A: [Clear, concise answer - 2-4 sentences max]
```

Aim for 5-8 FAQs covering:
- How it works
- Compatibility with existing setup
- Pricing/plan availability
- Common objections
- Technical questions

---

## 10. Final CTA Section

### Section Content
```
Eyebrow: "[e.g., 'Ready to start?']"
Headline: "[Action-oriented headline]"
Body: "[1-2 sentences reinforcing the value and reducing friction]"
Primary CTA: "Take the 2-minute Scorecard" → #scorecard
Secondary CTA: "Claim your founding spot" → /signup/host
Trust elements:
  - No card required
  - 90-day money-back guarantee
  - [Feature-specific trust element]
```

---

## 11. Design Notes for Claude Design

### Brand Reference
See `DESIGN_SYSTEM.md` for full token reference. Key values:

**Colours:**
- Primary: `#10B981` — CTAs, links, active states
- Secondary: `#064E3B` — Featured/promo emphasis
- Accent: `#D1FAE5` — Hover surfaces, badges
- Light: `#F0FDF4` — Page background
- Dark: `#0A1510` — Hero/footer
- Ink: `#052E1F` — Body text
- Mute: `#4A7C6A` — Secondary text
- Line: `#DCEAE0` — Borders

**Typography:**
- Display: Plus Jakarta Sans (headlines, KPIs)
- Body: Inter (UI text)
- Mono: JetBrains Mono (codes, references)

**Components:**
- Use shadcn/ui exclusively
- Icons: lucide-react, 1.5px stroke
- Radius: `rounded-card` 16px, `rounded-pill` for CTAs
- Shadows: `shadow-card` resting, `shadow-lift` hover

### Layout Pattern
Match `/launch` page aesthetic:
- Dark gradient hero with dot grid overlay
- Alternating light (`#F0FDF4`) / white sections
- Sticky nav with scorecard CTA
- Mobile-first responsive
- Rise animations (150-300ms, ease-out)

### Responsive Breakpoints
- Mobile: < 768px (single column, stacked)
- Tablet: 768-1024px (2-column grids)
- Desktop: > 1024px (full layout)

### Accessibility
- All images need alt text
- Colour contrast meets WCAG AA
- Focus states on interactive elements
- Reduced motion support

---

## Checklist Before Handoff

- [ ] All sections completed with specific content
- [ ] Headlines are benefit-focused, not feature-focused
- [ ] Pain points use emotional language
- [ ] All claims match actual codebase capabilities
- [ ] CTAs match the /launch page pattern
- [ ] Visual descriptions are specific enough to implement
- [ ] FAQs address real objections
- [ ] Design notes reference correct brand tokens
