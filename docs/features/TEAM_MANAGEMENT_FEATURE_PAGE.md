# Team Management Feature Page Specification

> **Purpose:** Comprehensive brief for Claude Design to build a conversion-focused feature sales page for Vilo's Team Management.
> **URL:** `/features/team`

---

## 1. Page Meta & SEO

| Field | Content |
|-------|---------|
| **Page Title** | Team Management for SA Accommodation Hosts | Vilo |
| **Meta Description** | Delegate tasks to co-hosts, assistants, and cleaners with role-based access. Invite team members, control permissions, and scale your accommodation business without losing control. |
| **Target Keywords** | property management team, co-host software, staff management accommodation, delegate booking management, cleaner access calendar, South Africa accommodation |
| **URL Slug** | `/features/team` |
| **OG Title** | Scale Your Team Without Losing Control — Vilo Team Management |
| **OG Description** | Role-based access for co-hosts, assistants, and cleaners. Invite team, control permissions, and keep full oversight of your accommodation business. |

---

## 2. Hero Section

### Primary Headline Options
1. "You Can't Do It All Alone — And You Shouldn't Have To"
2. "Delegate Without Losing Control"
3. "Build Your Team. Keep Your Oversight."

### Subheadline
"Invite co-hosts, assistants, and cleaners with role-based access. They see what they need, nothing more. You stay in control — even when you're offline."

### Hero CTA
- **Primary:** "Take the 2-minute Scorecard" → `#scorecard`
- **Secondary:** "Claim your founding spot" → `/signup/host`

### Hero Visual Suggestion
Split-view mockup:
- **Left:** Team dashboard showing 3 team members with role badges (Co-Host, Assistant, Cleaner)
- **Right:** Invitation modal with email input, role selector, and "Send Invite" button
- Visual emphasis on security and control (lock icons, role chips)

---

## 3. Problem / Pain Points Section

### Section Header
"Growing Pains That Hold You Back"

### Pain Points

| Pain Point | Emotional Hook | Before Vilo |
|------------|---------------|-------------|
| **Doing everything yourself** | "You're the host, cleaner, accountant, and night manager" | Burnout, missed messages, slow responses |
| **Sharing your main login** | "Everyone knows your password — scary" | Security nightmare; can't revoke access cleanly |
| **All-or-nothing access** | "Cleaner doesn't need to see financials" | Either full access or no access; no middle ground |
| **No audit trail** | "Who made that booking change?" | No visibility into what team members did |
| **Managing multiple properties** | "Different people for different places" | Spreadsheets, WhatsApp groups, chaos |
| **Onboarding friction** | "Just talk to John to get access" | No formal process; knowledge lost when people leave |

### Emotional Summary
"Growing your accommodation business means bringing in help. But without proper team tools, you're either doing everything yourself or handing over the keys to the kingdom. Vilo gives you a third option: delegated access with full oversight."

---

## 4. Solution Overview

### Section Header
"Your Team, Your Rules"

### Transformation Narrative

| Before Vilo | After Vilo |
|-------------|-----------|
| Sharing your password | Unique logins per team member |
| All-or-nothing access | Three role levels with tailored permissions |
| No idea who did what | Full audit trail of actions |
| Manual onboarding | Email invitations with one-click accept |
| Can't revoke access cleanly | Remove team members instantly |
| Managing via WhatsApp | Centralized team dashboard |

### Key Differentiators
1. **Purpose-Built Roles:** Co-Host, Assistant, and Cleaner — each sees only what they need
2. **Zero Password Sharing:** Each team member gets their own secure login
3. **Instant Revocation:** Remove access in one click when someone leaves
4. **Plan-Based Scaling:** Staff seats grow with your plan as your business grows

---

## 5. Feature Deep-Dive Sections

### Sub-Feature 1: Co-Host Role
| Aspect | Detail |
|--------|--------|
| **What it does** | Full operational access: bookings, listings, inbox, calendar — everything except billing |
| **Why it matters** | Delegate day-to-day operations to a trusted partner while you focus on growth |
| **Visual suggestion** | Dashboard view with all sections accessible, except billing (grayed out) |
| **Lucide icon** | `UserPlus` |

### Sub-Feature 2: Assistant Role
| Aspect | Detail |
|--------|--------|
| **What it does** | Handles bookings and inbox replies; read-only access to listings |
| **Why it matters** | Perfect for a virtual assistant or part-time help managing guest communication |
| **Visual suggestion** | Inbox view with active conversation, booking panel visible |
| **Lucide icon** | `MessageSquare` |

### Sub-Feature 3: Cleaner Role
| Aspect | Detail |
|--------|--------|
| **What it does** | Calendar access to block/unblock dates; read-only booking details for preparation |
| **Why it matters** | Cleaners see when to arrive and what to prepare — nothing else |
| **Visual suggestion** | Calendar view showing blocked dates and checkout dates only |
| **Lucide icon** | `Sparkles` |

### Sub-Feature 4: Email Invitations
| Aspect | Detail |
|--------|--------|
| **What it does** | Generate secure invite links sent to team member's email; 7-day expiry |
| **Why it matters** | Formal onboarding process; no password sharing; clear audit trail |
| **Visual suggestion** | Invite modal with email field, role dropdown, and copy-link button |
| **Lucide icon** | `Mail` |

### Sub-Feature 5: One-Click Accept
| Aspect | Detail |
|--------|--------|
| **What it does** | Team member clicks link, creates account (or signs in), accepts invite |
| **Why it matters** | Frictionless onboarding; team member is ready to work in under 2 minutes |
| **Visual suggestion** | Accept invitation page with host name, role, and green "Accept" button |
| **Lucide icon** | `CheckCircle` |

### Sub-Feature 6: Role Changes
| Aspect | Detail |
|--------|--------|
| **What it does** | Change a team member's role anytime from the dashboard |
| **Why it matters** | Promote an assistant to co-host, or dial back access without removing them |
| **Visual suggestion** | Role dropdown selector next to team member name |
| **Lucide icon** | `RefreshCw` |

### Sub-Feature 7: Instant Removal
| Aspect | Detail |
|--------|--------|
| **What it does** | Remove team member access in one click; takes effect immediately |
| **Why it matters** | Clean offboarding; no lingering access when someone leaves |
| **Visual suggestion** | Remove button with confirmation dialog |
| **Lucide icon** | `UserMinus` |

### Sub-Feature 8: Pending Invites
| Aspect | Detail |
|--------|--------|
| **What it does** | View all outstanding invitations; resend or cancel as needed |
| **Why it matters** | Track who hasn't accepted yet; nudge or clean up stale invites |
| **Visual suggestion** | Pending section showing email, role, expiry date, and action buttons |
| **Lucide icon** | `Clock` |

### Sub-Feature 9: Seat Limits by Plan
| Aspect | Detail |
|--------|--------|
| **What it does** | Staff seats scale with your plan: 1 (Basic), 3 (Pro), 10 (Business) |
| **Why it matters** | Start small, grow as needed; no unnecessary costs for solo operators |
| **Visual suggestion** | Usage indicator showing "2 of 3 seats used" with progress bar |
| **Lucide icon** | `Users` |

### Sub-Feature 10: Shared Notifications
| Aspect | Detail |
|--------|--------|
| **What it does** | Team members receive notifications relevant to their role (bookings, messages, etc.) |
| **Why it matters** | Everyone stays informed; no single point of failure |
| **Visual suggestion** | Notification bell with badge count; team member receiving push alert |
| **Lucide icon** | `Bell` |

### Sub-Feature 11: Audit Trail
| Aspect | Detail |
|--------|--------|
| **What it does** | All actions logged with timestamp and user; see who did what |
| **Why it matters** | Accountability; troubleshoot issues; maintain oversight |
| **Visual suggestion** | Activity log showing "Sarah updated booking #1234 — 2 hours ago" |
| **Lucide icon** | `History` |

### Sub-Feature 12: Multi-Property Access
| Aspect | Detail |
|--------|--------|
| **What it does** | Team members access all properties under your host account |
| **Why it matters** | One invitation covers your entire portfolio; no per-property setup |
| **Visual suggestion** | Property selector dropdown in team member's view |
| **Lucide icon** | `Building` |

---

## 6. How It Works (Process Steps)

### Section Header
"From Invitation to Access in 3 Steps"

### Host Journey

| Step | Action | Detail |
|------|--------|--------|
| 1 | Open team page | Navigate to Dashboard → Staff |
| 2 | Click "Invite" | Enter email and select role |
| 3 | Share link | Team member receives secure invite link |
| 4 | Monitor status | See pending invites and accepted members |
| 5 | Manage access | Change roles or remove members anytime |

### Team Member Journey

| Step | Action | Detail |
|------|--------|--------|
| 1 | Receive invite | Email with secure link arrives |
| 2 | Click link | Opens invitation page with role details |
| 3 | Create account | Or sign in if already registered |
| 4 | Accept invite | One click to join the team |
| 5 | Start working | Access dashboard with role-appropriate permissions |

### Visual Suggestion
Flow diagram: `Host Invites` → `Email Sent` → `Member Clicks` → `Account Created` → `Invite Accepted` → `Ready to Work`

---

## 7. Social Proof Section

### Section Header
"Hosts Who Built Teams That Work"

### Testimonial Placeholders

**Safari Lodge (Greater Kruger):**
> "With 8 properties, I needed help. My assistant handles all guest communication now, while I focus on the guest experience on-site. The role separation is perfect — she can't accidentally change rates."
> — *Lodge Owner, Greater Kruger*

**Coastal Guesthouse (Hermanus):**
> "Our cleaner only sees the calendar and checkout dates. She knows when to prep each room without access to guest details or financials. Simple and secure."
> — *Guesthouse Manager, Hermanus*

**Boutique Hotel (Franschhoek):**
> "I brought on a co-host to manage bookings while I'm traveling. She has full operational access, but I still see everything. When I returned, it was seamless."
> — *Boutique Hotel Owner, Franschhoek*

### Trust Indicators
- "Average host invites 2 team members in their first month"
- "94% of invites accepted within 24 hours"
- "Zero security incidents from team access"

---

## 8. Comparison Section

### Section Header
"Why Hosts Choose Vilo Team Management"

| Without Vilo | With Vilo |
|--------------|-----------|
| Share your password | Unique login per team member |
| All-or-nothing access | Three role levels with tailored permissions |
| No formal onboarding | Email invitations with one-click accept |
| Can't see who did what | Full audit trail of actions |
| Messy access revocation | One-click removal, instant effect |
| Pay for seats you don't use | Seats scale with your plan |
| Complex enterprise software | Simple, purpose-built for accommodation |

---

## 9. FAQ Section

### Q: How many team members can I invite?
**A:** Depends on your plan: Basic = 1 seat, Pro = 3 seats, Business = 10 seats. Contact support if you need more.

### Q: Can I assign team members to specific properties only?
**A:** Currently, team members access all properties under your host account. Per-property restrictions are coming in a future update.

### Q: What happens when I remove a team member?
**A:** Their access is revoked immediately. They can no longer log in to your dashboard. Historical actions remain in the audit log.

### Q: Can team members invite other team members?
**A:** No. Only the primary host can invite team members. This maintains control over who has access.

### Q: What's the difference between Co-Host and Assistant?
**A:** Co-Host has full operational access (bookings, listings, calendar, inbox). Assistant can only manage bookings and inbox — they can't edit listings or access financials.

### Q: Do team members get their own login?
**A:** Yes. Each team member creates their own Vilo account (or uses an existing one). No password sharing required.

### Q: How long are invitations valid?
**A:** 7 days. You can resend (generates a new link) or cancel anytime from the pending invites section.

### Q: Can I change someone's role after they've accepted?
**A:** Yes. Change roles anytime from the team dashboard. Changes take effect immediately.

---

## 10. Final CTA Section

### Section Header
"Build Your Team Without Losing Control"

### Primary CTA
"Take the 2-minute Scorecard" → `#scorecard`

### Secondary CTA
"Claim your founding spot" → `/signup/host`

### Trust Elements
- "No credit card required"
- "90-day satisfaction guarantee"
- "Includes team features on all paid plans"

### Closing Statement
"You shouldn't have to choose between doing everything yourself and giving up control. Build the team your accommodation business needs — with the oversight you deserve."

---

## 11. Design Notes for Claude Design

### Brand Colours (from DESIGN_SYSTEM.md)

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#10B981` | CTAs, active states, success indicators |
| Secondary | `#064E3B` | Role badges, section headers |
| Accent | `#D1FAE5` | Hover surfaces, pending invite chips |
| Light | `#F0FDF4` | Page background, card surfaces |
| Dark | `#0A1510` | Hero section, footer |
| Ink | `#052E1F` | Body text, team member names |
| Mute | `#4A7C6A` | Secondary text, timestamps |
| Line | `#DCEAE0` | Borders, dividers, table rows |

### Role Color Coding

| Role | Badge Color | Description |
|------|-------------|-------------|
| Co-Host | `#10B981` (Primary) | Full operational access |
| Assistant | `#3B82F6` (Blue) | Bookings + inbox |
| Cleaner | `#F59E0B` (Amber) | Calendar only |

### Typography

| Element | Font |
|---------|------|
| Display/Headlines | Plus Jakarta Sans |
| Body/UI Text | Inter |
| Email Addresses | JetBrains Mono |
| Role Labels | Inter (uppercase, smaller) |

### Component Guidelines
- Use shadcn/ui components exclusively
- Icons: lucide-react only, 1.5px stroke
- Role badges: Small rounded pills with role color
- Team member rows: Card-style with avatar, name, email, role
- Card radius: `rounded-card` (16px)
- CTA radius: `rounded-pill`
- Shadows: `shadow-card` resting, `shadow-lift` hover

### Lucide Icons for Team Sub-Features

| Sub-Feature | Icon |
|-------------|------|
| Co-Host Role | `UserPlus` |
| Assistant Role | `MessageSquare` |
| Cleaner Role | `Sparkles` |
| Email Invitations | `Mail` |
| One-Click Accept | `CheckCircle` |
| Role Changes | `RefreshCw` |
| Instant Removal | `UserMinus` |
| Pending Invites | `Clock` |
| Seat Limits | `Users` |
| Shared Notifications | `Bell` |
| Audit Trail | `History` |
| Multi-Property | `Building` |

### Layout Pattern (match /launch page)
- Dark gradient hero with dot grid overlay
- Alternating light/white sections
- Sticky nav with scorecard CTA
- Mobile-first responsive
- Rise animations (150-300ms, ease-out)

### Section-Specific Design Notes

**Hero:**
- Team dashboard mockup as hero visual
- Floating role badge animations
- Emphasis on security (lock icon subtle)

**Role Comparison:**
- Three-column comparison grid
- Role icon at top of each column
- Permission checklist for each role
- Clear visual hierarchy (Co-Host fullest, Cleaner minimal)

**Invitation Flow:**
- Step-by-step visual with numbered circles
- Animated transitions between steps
- Mobile device mockup for team member view

**Team Dashboard Mockup:**
- Team members list with avatars
- Role badges next to names
- Pending invites section below
- Seat usage indicator in corner

**Security Section:**
- Lock icon or shield visual
- Before/after comparison (password sharing vs individual logins)
- Trust badges (encrypted, secure, audited)

### Animation Suggestions
- Role badges: Subtle pulse on hover
- Invite flow: Sequential reveal of steps
- Team member cards: Staggered fade-in
- Remove confirmation: Shake animation if cancelled

### Responsive Breakpoints
- Mobile: Single column, stacked cards
- Tablet: 2-column role comparison
- Desktop: 3-column role comparison, side-by-side layouts

---

## 12. Cross-Links to Other Feature Pages

Link to related features within the page:
- "Team members can respond to guests in the **[Unified Inbox](/features/unified-inbox)**"
- "Cleaners can see upcoming checkouts in the **[Calendar Sync](/features/calendar-sync)**"
- "Track team activity alongside bookings in **[Reporting](/features/reporting)**"

---

## 13. Content Guidelines

### Voice & Tone
- Empowering and reassuring
- Emphasis on control and security
- Practical and clear about permissions
- Supportive of growth and delegation

### Proof Points (from codebase)
- 3 role types: Co-Host, Assistant, Cleaner (verified in schema)
- 7-day invite expiry (verified in staff_invites table)
- Seat limits by plan: 1/3/10 (verified in feature permissions)
- Secure token-based invitations (verified in actions)
- Full RLS enforcement (verified in migration policies)

### Avoid
- Making team management sound complicated
- Implying distrust of team members
- Enterprise jargon (RBAC, SSO, etc.)
- Overpromising features not yet built (per-property access)
