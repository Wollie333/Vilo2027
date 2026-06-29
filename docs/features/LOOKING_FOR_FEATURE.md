# Wielo — "Looking For" Feature Specification

**Version:** 5.0  
**Status:** Draft  
**Last Updated:** June 2026  
**Feature Codename:** `looking-for`

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [User Stories](#2-user-stories)
3. [Subscription Gating & Quota System](#3-subscription-gating--quota-system)
4. [Data Models](#4-data-models)
5. [Guest Side — Posting a "Looking For" Request](#5-guest-side--posting-a-looking-for-request)
6. [Host Side — Browsing & Responding with Quotes](#6-host-side--browsing--responding-with-quotes)
7. [Public Directory Page](#7-public-directory-page)
8. [Geo-Proximity Sorting](#8-geo-proximity-sorting)
9. [Admin Controls](#9-admin-controls)
10. [Notifications](#10-notifications)
11. [UI/UX Screens Summary](#11-uiux-screens-summary)
12. [API / RPC Endpoints](#12-api--rpc-endpoints)
13. [Edge Cases & Business Rules](#13-edge-cases--business-rules)
14. [MVP Scope — In / Out](#14-mvp-scope--in--out)
15. [Code Reuse & Existing Infrastructure](#15-code-reuse--existing-infrastructure)
16. [Notification Specification (Full Detail)](#16-notification-specification-full-detail)
17. [Enterprise Enhancement Features — Low-Hanging Fruit](#17-enterprise-enhancement-features--low-hanging-fruit)
18. [Implementation Priority Guide for Claude Code](#18-implementation-priority-guide-for-claude-code)
19. [Sidebar Navigation — Structure & Pattern](#19-sidebar-navigation--structure--pattern)
20. [Subscription Gating — Feature Flag Integration](#20-subscription-gating--feature-flag-integration)
21. [Admin Product & Permissions Wiring](#21-admin-product--permissions-wiring)

*Feature totals: 21 confirmed enhancements (§17.1–17.3) + 8 additional enhancements (§17.4) = 29 total enhancement features across guest, host, and platform.*

---

## 1. Feature Overview

**"Looking For"** is a demand-side marketplace layer on top of the existing Wielo directory. It allows guests to publicly post accommodation or experience requests (e.g., "Looking for a lodge for 4 adults near Kruger, first week of August, budget R3 000/night"), and allows hosts to browse those posts and respond with a formal quote using Wielo's existing internal quote/messaging system.

### How It Fits Into Wielo

```
PUBLIC DIRECTORY
  └── "Looking For" Tab / Page
        ├── Guest posts their request (public)
        └── Hosts browse requests → send quote via Inbox

HOST DASHBOARD
  └── "Looking For" Section (new nav item)
        ├── Browse all active requests
        ├── Filter by location, dates, category, budget
        └── Click "Send Quote" → opens existing quote flow
```

### Core Flow

```
Guest posts request
      │
      ▼
Request appears on:
  1. Public /looking-for directory page
  2. Host dashboard "Looking For" browse section
      │
      ▼
Host views request → clicks "Send Quote"
      │
      ▼
Existing quote system fires:
  - Pre-filled with guest request details
  - Sent to guest's inbox
      │
      ▼
Guest receives quote in their inbox
  - Can accept, decline, or message host
```

---

## 2. User Stories

### Guest Stories

| ID | Story |
|----|-------|
| G1 | As a guest, I want to post a "Looking For" request describing what accommodation or experience I need, so that hosts can reach out to me with quotes. |
| G2 | As a guest, I want to specify my travel dates, group size, location preference, category, and budget when posting my request. |
| G3 | As a guest, I want to see how many quotes I have left to post this month based on my plan. |
| G4 | As a guest, I want to manage (edit, deactivate, delete) my "Looking For" posts from my profile. |
| G5 | As a guest, I want to receive quotes from hosts in my Wielo inbox in response to my post. |
| G6 | As a guest, I want my post to expire automatically after my travel dates have passed. |

### Host Stories

| ID | Story |
|----|-------|
| H1 | As a host, I want to browse all active "Looking For" requests from a dedicated section in my dashboard. |
| H2 | As a host, I want the requests most relevant to my location to appear at the top of my browse view. |
| H3 | As a host, I want to filter requests by location, category, date range, group size, and budget. |
| H4 | As a host, I want to click "Send Quote" on any request and have it pre-populate the existing quote form with the guest's details. |
| H5 | As a host, I want to see how many quotes I have left to send today / this month based on my subscription. |
| H6 | As a host, I want to see a badge on requests I've already responded to, so I don't send duplicate quotes. |

### Admin Stories

| ID | Story |
|----|-------|
| A1 | As a super admin, I want to control how many "Looking For" posts guests can create per day/month/year per plan. |
| A2 | As a super admin, I want to control how many quotes hosts can send in response to "Looking For" posts per day/month/year per plan. |
| A3 | As a super admin, I want to be able to remove or flag any "Looking For" post that violates platform rules. |
| A4 | As a super admin, I want to see aggregate stats: total active requests, quotes sent, response rates. |

---

## 3. Subscription Gating & Quota System

### 3.1 Overview

All "Looking For" activity is controlled by a **quota system** configured per subscription plan in the admin panel. Quotas can be set per **day**, **month**, or **year** independently for both guests and hosts.

### 3.2 Guest Quotas — Posting Requests

Controls how many "Looking For" posts a guest can create within a given period.

| Plan | Posts/Day | Posts/Month | Posts/Year | Notes |
|------|-----------|-------------|------------|-------|
| Free | 1 | 3 | 12 | Default |
| Basic | 3 | 10 | 60 | Configurable by admin |
| Pro | 10 | 30 | 200 | Configurable by admin |
| Business | Unlimited | Unlimited | Unlimited | Admin can cap if needed |

> All values above are **defaults only** — the super admin can override every cell from the admin panel.

### 3.3 Host Quotas — Sending Quotes on "Looking For" Posts

Controls how many quotes a host can send **specifically in response to "Looking For" posts** (separate from regular booking quote limits).

| Plan | Quotes/Day | Quotes/Month | Quotes/Year | Notes |
|------|------------|--------------|-------------|-------|
| Free | 0 | 0 | 0 | Cannot respond to requests |
| Basic | 3 | 15 | 100 | Configurable by admin |
| Pro | 10 | 50 | 400 | Configurable by admin |
| Business | 30 | 200 | Unlimited | Configurable by admin |

### 3.4 Quota Enforcement Logic

```
Before posting / sending:
  1. Fetch quota_config for user's plan (from plan_looking_for_quotas table)
  2. Count usage in relevant window (today / this month / this year)
  3. If usage >= any applicable limit → block action, show friendly message
  4. If within limits → allow action, increment usage counter
```

- All three windows (day / month / year) are checked. The **most restrictive** active limit applies.
- A `NULL` value in any quota field means **unlimited** for that window.
- Usage counters reset automatically at midnight (day), calendar month start, and January 1 (year) via a Supabase pg_cron job.

### 3.5 Admin Quota Configuration

The super admin panel will have a dedicated **"Looking For Quotas"** settings section where every cell in the tables above is editable per plan, for both guest posting and host quoting, with live-save.

---

## 4. Data Models

### 4.1 `looking_for_posts` Table

```sql
CREATE TABLE looking_for_posts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Request details
  title             TEXT NOT NULL,                        -- e.g. "Looking for family lodge near Kruger"
  description       TEXT,                                 -- Free-text details
  category          TEXT NOT NULL,                        -- 'accommodation' | 'experience' | 'venue' | 'other'
  sub_category      TEXT,                                 -- e.g. 'self-catering', 'game lodge', 'spa'

  -- Travel details
  check_in_date     DATE,
  check_out_date    DATE,
  adults            INT DEFAULT 1,
  children          INT DEFAULT 0,
  infants           INT DEFAULT 0,

  -- Location preference
  location_text     TEXT,                                 -- Human-readable, e.g. "Mpumalanga, near Sabie"
  location_region   TEXT,                                 -- Province / region for filtering
  location_lat      DECIMAL(9,6),                        -- Optional precise coords
  location_lng      DECIMAL(9,6),

  -- Budget
  budget_min        DECIMAL(10,2),
  budget_max        DECIMAL(10,2),
  budget_currency   TEXT DEFAULT 'ZAR',
  budget_per        TEXT DEFAULT 'night',                 -- 'night' | 'person' | 'total'

  -- Status
  status            TEXT DEFAULT 'active',                -- 'active' | 'fulfilled' | 'expired' | 'removed'
  is_public         BOOLEAN DEFAULT TRUE,
  expires_at        TIMESTAMPTZ,                          -- Auto-set to check_out_date or 30 days

  -- Metadata
  view_count        INT DEFAULT 0,
  quote_count       INT DEFAULT 0,                        -- Denormalized count of quotes received
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_lfp_guest_id ON looking_for_posts(guest_id);
CREATE INDEX idx_lfp_status ON looking_for_posts(status);
CREATE INDEX idx_lfp_location_region ON looking_for_posts(location_region);
CREATE INDEX idx_lfp_check_in ON looking_for_posts(check_in_date);
CREATE INDEX idx_lfp_created_at ON looking_for_posts(created_at DESC);
```

### 4.2 `looking_for_quotes` Table

Tracks which host sent a quote to which "Looking For" post, linking to the existing `quotes` or `inbox_threads` system.

```sql
CREATE TABLE looking_for_quotes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id             UUID NOT NULL REFERENCES looking_for_posts(id) ON DELETE CASCADE,
  host_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_id            UUID REFERENCES quotes(id),         -- Link to existing quote record
  thread_id           UUID REFERENCES inbox_threads(id),  -- Link to inbox conversation

  status              TEXT DEFAULT 'sent',                -- 'sent' | 'viewed' | 'accepted' | 'declined'
  sent_at             TIMESTAMPTZ DEFAULT NOW(),
  viewed_at           TIMESTAMPTZ,
  responded_at        TIMESTAMPTZ,

  UNIQUE(post_id, host_id)                               -- One quote per host per post
);

CREATE INDEX idx_lfq_post_id ON looking_for_quotes(post_id);
CREATE INDEX idx_lfq_host_id ON looking_for_quotes(host_id);
```

### 4.3 `plan_looking_for_quotas` Table

Admin-configurable quota limits per subscription plan.

```sql
CREATE TABLE plan_looking_for_quotas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id             TEXT NOT NULL UNIQUE,               -- 'free' | 'basic' | 'pro' | 'business'

  -- Guest: posting "Looking For" requests
  guest_posts_per_day     INT,                            -- NULL = unlimited
  guest_posts_per_month   INT,
  guest_posts_per_year    INT,

  -- Host: sending quotes on "Looking For" posts
  host_quotes_per_day     INT,
  host_quotes_per_month   INT,
  host_quotes_per_year    INT,

  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_by          UUID REFERENCES auth.users(id)
);
```

### 4.4 `looking_for_usage` Table

Rolling usage tracking for quota enforcement.

```sql
CREATE TABLE looking_for_usage (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,                              -- 'guest_post' | 'host_quote'
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lfu_user_action_time ON looking_for_usage(user_id, action, occurred_at DESC);
```

> Usage is counted by querying this table for records within the relevant window. pg_cron can purge records older than 1 year to keep it lean.

---

## 5. Guest Side — Posting a "Looking For" Request

### 5.1 Entry Points

- Guest profile dashboard → "My Requests" tab → "Post a Request" button
- Public directory `/looking-for` page → "Post Your Request" CTA (authenticated guests only)

### 5.2 Post Request Form Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Title | Text (max 100 chars) | ✅ | Auto-suggested placeholder |
| Category | Select | ✅ | Accommodation / Experience / Venue / Other |
| Sub-category | Select (dynamic) | ❌ | Depends on category |
| Description | Textarea (max 500 chars) | ❌ | What makes this request special |
| Check-in date | Date picker | ❌ | Used for expiry calculation |
| Check-out date | Date picker | ❌ | Post auto-expires after this date |
| Adults | Number | ✅ | Min 1 |
| Children | Number | ❌ | Default 0 |
| Infants | Number | ❌ | Default 0 |
| Location preference | Text + region select | ✅ | Human-readable + province dropdown |
| Budget min | Currency input | ❌ | |
| Budget max | Currency input | ❌ | |
| Budget per | Select | ❌ | Per night / per person / total |
| Visibility | Toggle | ✅ | Public (default) or Private (only visible to specific hosts) |

### 5.3 Quota Check on Submit

Before submission, the frontend calls `check_guest_post_quota(user_id)` which returns:

```json
{
  "allowed": true,
  "remaining_today": 0,
  "remaining_month": 2,
  "remaining_year": 10,
  "limit_hit": "day"
}
```

If `allowed: false`, show a friendly message:
> "You've reached your daily request limit. Your quota resets at midnight, or upgrade your plan for more posts."

### 5.4 Post Management (Guest)

From their dashboard "My Requests" tab, guests can:
- **Edit** a post (any field, while status is `active`)
- **Mark as Fulfilled** (status → `fulfilled`) — removes from public directory
- **Delete** a post (soft delete)
- **View** all quotes/responses received per post

---

## 6. Host Side — Browsing & Responding with Quotes

### 6.1 Dashboard Section: "Looking For"

A new top-level navigation item in the host dashboard sidebar:

```
Dashboard Sidebar
  ├── Overview
  ├── Listings
  ├── Bookings
  ├── Inbox          ← existing
  ├── Looking For    ← NEW ✨
  ├── Reviews
  ├── Calendar
  └── Settings
```

The "Looking For" section contains a **browse view** of all active guest requests, geo-sorted and filterable.

### 6.2 Browse View Layout

- **Card grid / list toggle** (default: list on mobile, grid on desktop)
- Each card shows:
  - Request title
  - Category badge
  - Location (region + proximity indicator if close to host's property)
  - Travel dates
  - Group size summary (e.g., "2 adults, 1 child")
  - Budget range
  - Posted X time ago
  - Number of quotes already sent (so host knows competition)
  - "Already quoted" badge if host has responded
  - **"Send Quote" CTA button**

### 6.3 Filters Available to Host

| Filter | Type | Notes |
|--------|------|-------|
| Location / Region | Multi-select | Province / region list |
| Category | Multi-select | Accommodation, Experience, etc. |
| Check-in date range | Date range picker | "Guests arriving between..." |
| Group size | Min/max slider | |
| Budget range | Min/max slider | |
| Status | Toggle | Show only un-responded / all |
| Sort by | Select | Nearest first (default) / Newest / Budget high-low |

### 6.4 "Send Quote" Flow

When a host clicks **"Send Quote"** on a request:

1. **Quota check fires** — `check_host_quote_quota(host_id)` called
   - If blocked: show upgrade prompt with quota details
   - If allowed: proceed

2. **Pre-filled quote modal opens** using the existing quote system with:
   - Guest name / identifier
   - Travel dates from the request (pre-filled, editable)
   - Group size (pre-filled, editable)
   - A reference to the "Looking For" post (shown as context)
   - Host's listing selector (if host has multiple listings)
   - Price fields, inclusions, terms (standard quote fields)
   - Optional personal message to guest

3. **On send:**
   - Quote is created via existing quote system
   - A `looking_for_quotes` record is created linking `post_id` ↔ `host_id` ↔ `quote_id`
   - Guest receives the quote in their Wielo inbox
   - Usage is logged to `looking_for_usage`
   - `quote_count` on the post is incremented
   - Host's card for that post updates to show "Quoted ✓"

### 6.5 Quota Display for Hosts

A subtle quota widget shown at the top of the "Looking For" dashboard section:

```
┌─────────────────────────────────────────┐
│  Quotes available:  7 today · 43/month  │
│  [Upgrade for more]                     │
└─────────────────────────────────────────┘
```

---

## 7. Public Directory Page

### 7.1 Route

```
/looking-for
```

This is a **public-facing page** accessible to anyone (logged in or not), living inside the existing Wielo public directory.

### 7.2 Page Layout

```
/looking-for
  ├── Hero banner: "Find your next guest. Browse what travellers are looking for."
  ├── Filter bar (location, dates, category, budget)
  ├── "Post a Request" CTA (visible to logged-in guests only)
  ├── Request cards grid (geo-sorted for logged-in hosts, chronological for guests/visitors)
  └── Pagination / infinite scroll
```

### 7.3 Visibility Rules

| Viewer | What They See |
|--------|---------------|
| Not logged in | All public active posts (no geo-sort, no "Send Quote" button) |
| Logged-in guest | All public posts + their own posts + "Post a Request" button |
| Logged-in host | All public posts, geo-sorted by proximity to their property + "Send Quote" button (quota-gated) |
| Super admin | All posts including removed/flagged + moderation actions |

### 7.4 Post Card on Public Page

```
┌─────────────────────────────────────────────────────┐
│  🏕️  [Category Badge]    📍 Mpumalanga · ~45km away  │
│                                                      │
│  Looking for family self-catering lodge near Sabie  │
│                                                      │
│  📅 1–7 Aug 2026   👥 2 adults, 2 children           │
│  💰 R1 500 – R2 500 / night                          │
│                                                      │
│  "We'd love something with a pool and braai area,   │
│   near hiking trails..."                            │
│                                                     │
│  Posted 2 hours ago · 3 quotes sent                 │
│                          [Send Quote →]             │
└─────────────────────────────────────────────────────┘
```

---

## 8. Geo-Proximity Sorting

### 8.1 How It Works

When a **logged-in host** views the "Looking For" section (either in their dashboard or on the public `/looking-for` page), requests are sorted by **geographic proximity** to their establishment's location.

### 8.2 Implementation

1. **Host property coordinates** are stored on their listing record (`lat`, `lng` — already in Wielo's schema).
2. **Guest request location** stores `location_lat` and `location_lng` (optional precise coords) and always stores `location_region` (province/region string) as a fallback.
3. Sorting uses **PostGIS** (already available in Supabase/PostgreSQL) with a `ST_Distance` calculation:

```sql
-- RPC: get_looking_for_posts_for_host(host_id UUID)
SELECT
  lfp.*,
  ST_Distance(
    ST_MakePoint(lfp.location_lng, lfp.location_lat)::geography,
    ST_MakePoint(h.lng, h.lat)::geography
  ) AS distance_meters
FROM looking_for_posts lfp
CROSS JOIN (
  SELECT lng, lat FROM host_listings WHERE host_id = $1 LIMIT 1
) h
WHERE lfp.status = 'active'
  AND lfp.expires_at > NOW()
ORDER BY
  -- Posts with coords: sort by distance
  CASE WHEN lfp.location_lat IS NOT NULL AND h.lat IS NOT NULL
    THEN ST_Distance(...)
    ELSE 99999999
  END ASC,
  -- Fallback: matching region first
  CASE WHEN lfp.location_region = h.region THEN 0 ELSE 1 END ASC,
  -- Then by newest
  lfp.created_at DESC;
```

### 8.3 Proximity Display Label

On each card, show a human-readable distance badge if coordinates are available:

- `< 50km` → "~Xkm away" (green badge)
- `50–200km` → "~Xkm away" (yellow badge)
- `> 200km` → Region name only (no distance)
- No coords → Just show `location_text`

### 8.4 Fallback for Guests / Visitors

Non-host viewers see posts sorted by **most recent** (no geo-sort since there's no host property to compare against).

---

## 9. Admin Controls

### 9.1 Admin Panel Section: "Looking For"

Location in admin panel: **Settings → Looking For**

Sub-sections:
- **Quota Configuration** — Edit all quota values per plan (guest posts + host quotes, per day/month/year)
- **Post Moderation** — View, flag, or remove any post
- **Analytics** — Stats dashboard

### 9.2 Quota Configuration UI

A table editable inline:

| Plan | Guest Posts/Day | Guest Posts/Month | Guest Posts/Year | Host Quotes/Day | Host Quotes/Month | Host Quotes/Year |
|------|-----------------|-------------------|------------------|-----------------|-------------------|------------------|
| Free | [1] | [3] | [12] | [0] | [0] | [0] |
| Basic | [3] | [10] | [60] | [3] | [15] | [100] |
| Pro | [10] | [30] | [200] | [10] | [50] | [400] |
| Business | [∞] | [∞] | [∞] | [30] | [200] | [∞] |

- Each cell is an editable number input. Empty / blank = unlimited.
- Changes take effect immediately (no deploy needed).
- A log of quota changes is stored with timestamp + admin user.

### 9.3 Post Moderation

Admin can:
- **View all posts** (including expired, removed, fulfilled)
- **Remove a post** (status → `removed`, hidden from all views)
- **Flag a post** for review (visible to other admins, post remains live)
- **View post details** including all quotes sent in response

### 9.4 Analytics Dashboard

| Metric | Description |
|--------|-------------|
| Active Requests | Count of posts with `status = 'active'` |
| Total Posts (all time) | |
| Total Quotes Sent | Via "Looking For" |
| Average Quotes per Post | |
| Response Rate | % of posts that received at least 1 quote |
| Top Regions | Where most requests are coming from |
| Quota Hits | How often users hit their quota limit (signals upgrade opportunity) |

---

## 10. Notifications

### 10.1 Guest Notifications

| Trigger | In-App | Push | Email |
|---------|--------|------|-------|
| Quote received on their post | ✅ | ✅ | ✅ |
| Post expiring in 24h | ✅ | ✅ | ✅ |
| Post automatically expired | ✅ | — | ✅ |
| Post removed by admin | ✅ | — | ✅ |

### 10.2 Host Notifications

| Trigger | In-App | Push | Email |
|---------|--------|------|-------|
| New "Looking For" post in their region | ✅ | ✅ | — |
| Quote quota running low (< 20% remaining) | ✅ | — | — |
| Guest accepted their quote | ✅ | ✅ | ✅ |
| Guest declined their quote | ✅ | ✅ | — |

### 10.3 Email Templates Required

- `looking-for-quote-received` (to guest)
- `looking-for-post-expiring` (to guest)
- `looking-for-new-request-in-region` (to host — digest, not per-post)
- `looking-for-quote-accepted` (to host)

---

## 11. UI/UX Screens Summary

### New Screens / Routes

| Route | Who | Description |
|-------|-----|-------------|
| `/looking-for` | Public | Public directory of all active guest requests |
| `/looking-for/[id]` | Public | Individual request detail page |
| `/dashboard/looking-for` | Host | Browse + filter all requests, send quotes |
| `/profile/requests` | Guest | Manage own "Looking For" posts |
| `/profile/requests/new` | Guest | Create new request form |
| `/profile/requests/[id]/edit` | Guest | Edit existing request |
| `/admin/looking-for` | Admin | Quota config + moderation + analytics |

### Modified Screens

| Screen | Change |
|--------|--------|
| Dashboard sidebar | Add "Looking For" nav item with optional badge (new requests in region) |
| Public Directory | Add "Looking For" as a tab alongside existing listings |
| Quote modal (existing) | Accept pre-fill context from "Looking For" post |
| Guest profile/dashboard | Add "My Requests" tab |

---

## 12. API / RPC Endpoints

All via Supabase PostgREST or RPC functions:

| Method | Endpoint / RPC | Auth | Description |
|--------|----------------|------|-------------|
| GET | `/rest/v1/looking_for_posts?status=eq.active` | Public | List all active posts |
| POST | `/rest/v1/looking_for_posts` | Guest | Create new post |
| PATCH | `/rest/v1/looking_for_posts?id=eq.[id]` | Guest (owner) | Edit own post |
| DELETE | `/rest/v1/looking_for_posts?id=eq.[id]` | Guest (owner) / Admin | Soft delete |
| RPC | `get_looking_for_posts_for_host(host_id)` | Host | Geo-sorted + filtered list |
| RPC | `check_guest_post_quota(user_id)` | Guest | Returns quota status |
| RPC | `check_host_quote_quota(user_id)` | Host | Returns quota status |
| RPC | `send_looking_for_quote(post_id, host_id, quote_payload)` | Host | Send quote, log usage |
| GET | `/rest/v1/looking_for_quotes?host_id=eq.[id]` | Host | Host's sent quotes |
| GET | `/rest/v1/looking_for_quotes?post_id=eq.[id]` | Guest/Admin | Quotes on a post |
| GET | `/rest/v1/plan_looking_for_quotas` | Admin | Read quota config |
| PATCH | `/rest/v1/plan_looking_for_quotas?plan_id=eq.[plan]` | Admin | Update quota config |

### RLS Policies Required

```sql
-- looking_for_posts
-- Public can read active posts
-- Guests can insert/update/delete their own
-- Admins can do everything

-- looking_for_quotes
-- Hosts can read/insert their own
-- Guests can read quotes on their own posts
-- Admins can read all

-- plan_looking_for_quotas
-- Admins only for read/write
-- Service role for enforcement functions
```

---

## 13. Edge Cases & Business Rules

| Scenario | Handling |
|----------|----------|
| Guest deletes account | Their posts soft-deleted, quotes already sent remain in host's inbox |
| Guest post expires (check-out date passes) | Auto-set status to `expired` via pg_cron nightly job |
| Host sends quote but guest has already marked request as fulfilled | Quote still allowed; guest inbox receives it with fulfilled badge visible |
| Host tries to send second quote to same post | Blocked by `UNIQUE(post_id, host_id)` constraint. UI shows "Already Quoted" |
| No location coords on guest post | Falls back to `location_region` text for region-matching proximity sort |
| Guest on free plan tries to post | Blocked after reaching free quota; shown upgrade CTA |
| Host on free plan tries to send quote | Blocked entirely; shown upgrade CTA explaining feature requires Basic+ |
| Admin removes a post | Removed from all public views; existing quotes in inboxes remain visible |
| Quote flow: host has no listings yet | Prompt to create a listing first before sending a quote |
| Post with no dates set | No auto-expiry; admin can manually expire or system expires after 90 days |

---

## 14. MVP Scope — In / Out

### ✅ In MVP

- Guest can create, edit, deactivate, and delete "Looking For" posts
- Posts appear on public `/looking-for` directory page
- Posts appear in host dashboard "Looking For" browse section
- Geo-proximity sorting for logged-in hosts
- Filters: location, category, dates, group size, budget
- "Send Quote" CTA opens existing quote flow pre-filled with post details
- `looking_for_quotes` tracking (one quote per host per post)
- "Already Quoted" badge on host browse view
- Quota system with admin-configurable limits (per day/month/year, per plan)
- Quota display widget for guests and hosts
- Admin panel: quota config table, post moderation, basic analytics
- Notifications: new quote (guest), new request in region (host), post expiry (guest)
- Auto-expiry via pg_cron

### ❌ Out of MVP (Future Iterations)

- Guest can invite specific hosts to respond to their private post
- "Boost" a post (paid feature to increase visibility)
- Guest can rate/review a quote interaction
- AI-assisted post writing (suggest title/description from inputs)
- Host can "save" or bookmark posts to respond to later
- Guest post templates (e.g., "Weekend Getaway" preset)
- SMS notifications
- Aggregated weekly digest email for hosts ("5 new requests in your area")
- Analytics export for admins

---

## 15. Code Reuse & Existing Infrastructure

This section is **critical for the Claude Code implementation**. The "Looking For" feature must reuse existing Wielo components and services wherever possible. No new parallel systems should be built when an existing one already covers the need.

### 15.1 Existing Systems to Reuse — Do Not Rebuild

| Existing Feature | How It's Reused in "Looking For" |
|-----------------|----------------------------------|
| **Quote System** | The entire quote form, quote record, quote state machine, and quote PDF generation are reused unchanged. The only addition is a `looking_for_post_id` foreign key on the existing `quotes` table to track the originating post. |
| **Custom Inbox** | All host↔guest communication after a quote is sent happens in the existing inbox. No new messaging UI. The "Looking For" quote creates an inbox thread exactly as a regular quote does. |
| **Guest Record (CRM)** | When a host sends a quote to a "Looking For" post, if the guest does not already exist in the host's guest records, a new guest record is **automatically created** using the existing guest record creation logic. See §15.2. |
| **Notifications System** | All push, in-app, and email notification delivery uses the existing notification infrastructure. New notification event types are added to the existing event enum — no new delivery pipeline. |
| **Subscription / Plan Gates** | Quota enforcement calls the existing plan feature-flag system. The `plan_looking_for_quotas` table extends — not replaces — the existing `plan_features` table structure. |
| **Auth & RLS** | No new auth logic. Existing `host` / `guest` / `admin` role system applies directly. |
| **Geo / Location Fields** | Host listing `lat`/`lng` fields already exist. PostGIS is already enabled in the Supabase project. |
| **File / Image Uploads** | Guest post optional images (e.g., "this is the vibe I'm looking for") use the existing Supabase Storage bucket and upload component. |
| **Admin Panel Structure** | The "Looking For" admin section is a new page added to the existing admin panel layout and navigation — same sidebar, same UI components. |

### 15.2 Guest Record Auto-Creation Principle

This is an **existing business rule in Wielo** that must be honoured inside this feature:

> **When a host quotes any guest — from any entry point — a guest record must be created or updated in that host's guest CRM if one does not already exist.**

For "Looking For" specifically, the sequence is:

```
Host clicks "Send Quote" on a Looking For post
  │
  ├── Does guest already exist in this host's guest_records?
  │     ├── YES → Attach existing guest record to the quote (existing logic)
  │     └── NO  → Auto-create guest record using:
  │                 - Guest display name (from their Wielo profile)
  │                 - Guest email (from auth record, visible post-quote-send)
  │                 - Source tagged as: "Looking For — [Post Title]"
  │                 - Created_via: 'looking_for'
  │
  └── Proceed with quote creation (existing quote flow)
```

The `created_via` field on the guest record should be set to `'looking_for'` so hosts can later filter their CRM by acquisition source. This is a **one-line addition** to the existing guest record creation call — not a new function.

### 15.3 Quote Form Integration — Exact Pre-Fill Mapping

When a host clicks "Send Quote" on a Looking For post, the **existing quote modal/form** opens with these fields pre-populated:

| Quote Form Field | Pre-filled From |
|-----------------|-----------------|
| Guest name | `looking_for_posts.guest_id → profiles.display_name` |
| Check-in date | `looking_for_posts.check_in_date` |
| Check-out date | `looking_for_posts.check_out_date` |
| Adults | `looking_for_posts.adults` |
| Children | `looking_for_posts.children` |
| Infants | `looking_for_posts.infants` |
| Internal notes | Auto-text: *"Quote in response to Looking For post: [post title]"* |
| Budget reference | `looking_for_posts.budget_max` (suggested price ceiling, editable) |

All pre-filled fields remain **fully editable** by the host before sending. The quote form is otherwise identical to the regular flow.

### 15.4 Quote Negotiation — Reusing Existing Inbox

Once a quote is sent, the **existing inbox thread** handles all negotiation. No new UI is needed for this. What must be confirmed in the existing system:

- Guests can **counter-propose** via the inbox message thread (text-based negotiation, always supported)
- Hosts can **send a revised quote** by opening a new quote from within the same inbox thread (existing "send quote from thread" functionality)
- Each revised quote appears as a new quote record, linked to the same `looking_for_post_id`
- The inbox thread title should reference the Looking For post: *"Re: [Post Title]"*

This means the negotiation cycle is: **Quote sent → Guest replies in inbox → Host sends revised quote from thread → repeat until accepted or declined.** All of this is existing functionality.

---

## 16. Notification Specification (Full Detail)

### 16.1 Guest Notifications

| Event | In-App | Push | Email | Template Name |
|-------|--------|------|-------|---------------|
| Post successfully published | ✅ | — | ✅ | `lf-post-published` |
| First quote received on post | ✅ | ✅ | ✅ | `lf-first-quote-received` |
| Each subsequent quote received | ✅ | ✅ | — | `lf-quote-received` |
| Quote revised/updated by host | ✅ | ✅ | ✅ | `lf-quote-revised` |
| Post expiring in 48h | ✅ | ✅ | ✅ | `lf-post-expiring-soon` |
| Post auto-expired | ✅ | — | ✅ | `lf-post-expired` |
| Post removed by admin | ✅ | — | ✅ | `lf-post-removed` |
| Guest's own quota running low (1 remaining) | ✅ | — | — | *(in-app only)* |

### 16.2 Host Notifications

| Event | In-App | Push | Email | Template Name |
|-------|--------|------|-------|---------------|
| New post in host's region | ✅ | ✅ | — | *(in-app + push only — not email spam)* |
| Quote accepted by guest | ✅ | ✅ | ✅ | `lf-quote-accepted` |
| Quote declined by guest | ✅ | ✅ | — | `lf-quote-declined` |
| Guest replies to quote thread | ✅ | ✅ | — | *(existing inbox notification)* |
| Host's quote quota at 20% remaining | ✅ | — | — | *(in-app only)* |
| Host's quote quota exhausted | ✅ | ✅ | — | *(upgrade prompt)* |

### 16.3 Notification Delivery Rules

- **"New post in region"** notifications are **batched** — hosts receive at most one push per hour even if multiple posts appear in their region. In-app badge updates in real-time.
- **First quote received** triggers email; subsequent quotes on the same post do NOT send email (only in-app + push) to prevent inbox flooding.
- All email templates extend the **existing Wielo email template system** (Resend + existing branded layout). New templates are additions, not replacements.
- All push notifications use the **existing Expo Push notification service** — no new push infrastructure.

---

## 17. Confirmed Feature Enhancements — All 21

> **Note:** Features G1–G10, H1–H8, and P1 (§17.1–§17.3) were confirmed in a prior revision. Section §17.4 below adds 8 additional confirmed enhancements based on real-world usage review.

All 21 enhancements below are **confirmed for inclusion** in the "Looking For" feature. They are ordered Guest Side → Host Side → Shared/Platform. Each reuses existing Wielo infrastructure and requires no new external dependencies.

---

### Guest Side Enhancements

#### G1 — Request Visibility Boost ("Urgent")
Guest can mark their post as "Urgent" with a single toggle on the post form or from "My Requests." Urgent posts display a red **"Urgent"** badge on their card and are sorted above non-urgent posts in the host browse view for 24 hours from when the toggle is activated.
*Benefit: Drives faster host responses when the guest has a time-critical need.*
- DB: Add `is_urgent BOOLEAN DEFAULT FALSE` and `urgent_until TIMESTAMPTZ` to `looking_for_posts`.
- Logic: Sort query adds `is_urgent AND urgent_until > NOW()` as the top sort tier.
- Quota: Urgent toggles are limited per plan (e.g., 1/month on Basic, 3/month on Pro). Add to `plan_looking_for_quotas`.

#### G2 — Request Templates / Presets
When creating a post, guest can choose a starting template before the form loads: **"Weekend Getaway," "Family Holiday," "Business Trip," "Honeymoon," "Group Escape," "Special Occasion."** Selecting a template pre-fills: category, sensible group-size defaults, a suggested description placeholder, and relevant sub-category.
*Benefit: Removes the blank-page problem for first-time posters; faster, better-quality submissions.*
- Implementation: Frontend-only. A template picker step (step 0) before the main form. Templates are a static config object — no new DB table needed.

#### G3 — View Counter on Own Posts
In the guest's "My Requests" dashboard, each post shows **"Seen by X hosts."** The `view_count` column (already on `looking_for_posts`) is incremented each time a distinct host loads the post detail view. The guest sees this count on their dashboard card.
*Benefit: Gives the guest feedback that their post is getting traction — or signals they should edit it if views are low but quotes aren't coming.*
- DB: `view_count` already exists. Add `looking_for_post_views (post_id, host_id, viewed_at)` for distinct-host counting (prevents one host inflating the count).

#### G4 — One-Tap Expiry Extension
When a post is within 48 hours of expiry, the guest receives a notification with a single **"Extend 7 days"** action button. Tapping it extends `expires_at` by 7 days without opening any form. Extensions are quota-gated per plan.
*Benefit: Keeps active requests alive with minimal friction; guest doesn't need to recreate the post.*
- DB: Add `extension_count INT DEFAULT 0` to `looking_for_posts`. Add `max_extensions_per_month` to `plan_looking_for_quotas`.
- RPC: `extend_looking_for_post(post_id, user_id)` — checks quota, updates `expires_at`, increments counter.

#### G5 — Duplicate & Repost
From "My Requests," guest can click **"Repost"** on any previous post (active, fulfilled, or expired). Opens the new post form pre-filled with all fields from the original post except dates (left blank for guest to update).
*Benefit: Repeat travellers (annual trips, regular bookings) don't start from scratch each time.*
- Implementation: Frontend-only pre-fill. Calls existing post creation flow with initial state populated from the source post record.

#### G6 — Quote Comparison View
When a guest has received 2 or more quotes on a single post, a **"Compare Quotes"** button appears on that post card in "My Requests." Opens a summary table: property name, star rating, price, check-in/out dates, and a "View in Inbox" link per quote.
*Benefit: Guest can evaluate offers side-by-side without navigating through multiple inbox threads.*
- DB: Read from `looking_for_quotes` joined to `quotes` and `host_profiles`. No new tables.
- UI: Modal or slide-over panel. Reuses existing quote display components.

#### G7 — Request Fulfilled Source Attribution
When a guest marks their post as **"Fulfilled,"** a single follow-up prompt appears: *"Great! Did you book through Wielo?"* — Yes / No / Not yet. If Yes: link to their booking record. If No: quick dropdown — OTA / Direct with host / Other.
*Benefit: Closes the analytics loop for admin (LF → Wielo booking conversion rate). Shows guests the value of booking direct.*
- DB: Add `fulfilled_via TEXT` (`'vilo_booking'` | `'ota'` | `'direct'` | `'other'` | `null`) and `fulfilled_booking_id UUID` (nullable FK to `bookings`) to `looking_for_posts`.

#### G8 — Share Post Link
Each "Looking For" post has a public URL: `/looking-for/[id]`. A **"Share"** button on the post card (in My Requests and on the public directory) triggers the native share sheet on mobile or copies the link on desktop. The link includes Open Graph meta tags so it renders a rich preview card on WhatsApp and social media.
*Benefit: Guest can amplify their request beyond Wielo's existing host base by sharing on their own channels.*
- Implementation: Route already exists. Share button is a single component. OG tags are meta tag additions to the page `<head>`.

#### G9 — Minimum Host Rating Filter
On the post creation form, an optional field: **"Only show my post to hosts rated X★ or above"** (4★ / 4.5★ / 5★ / No filter). Stored on the post. When a host below the threshold views the post, the "Send Quote" button is replaced with: *"This guest has set a minimum rating of 4★."* The post is still visible to all hosts (transparency), but quote submission is blocked for hosts below the threshold.
*Benefit: Guests who prioritise quality can self-filter; reduces unwanted quotes from low-rated properties.*
- DB: Add `min_host_rating DECIMAL(2,1)` to `looking_for_posts`.
- Gate logic: `check_host_quote_quota` also checks host's average rating against `post.min_host_rating`.

#### G10 — Response Deadline
Optional field on the post form: **"Quote by"** date. Displayed on the post card as a countdown: *"Quotes close in 2 days."* After the deadline, the post status changes to `quotes_closed` — still visible but no new quotes accepted. Guest receives a notification when the deadline passes with a summary of quotes received.
*Benefit: Drives urgency for hosts to respond quickly; guest avoids receiving quotes after they've already decided.*
- DB: Add `quote_deadline TIMESTAMPTZ` to `looking_for_posts`. pg_cron job closes posts past their deadline nightly (same job as auto-expiry).

---

### Host Side Enhancements

#### H1 — Saved Search Alerts
From the **"Request Alerts"** sidebar link, host sets up one or more saved searches: region(s), category, min/max group size, min/max budget. When a new post matching any saved search is published, the host receives an in-app notification and optional push.
*Benefit: Host never misses a relevant request without having to check the browse view manually.*
- DB: New table `looking_for_alerts (id, host_id, criteria_json, is_active, created_at)`.
- Logic: Edge Function triggered on `INSERT` to `looking_for_posts` — evaluates new post against all active alert records, fires notifications for matches. Reuses existing notification pipeline.

#### H2 — "Not a Fit" Pass Button
On each post card in the host browse view, a secondary action: **"Not a Fit."** Host selects a reason from a short list: *Dates conflict / Wrong category / Outside my capacity / Budget too low / Other.* The post moves to a "Passed" tab and is hidden from the main browse view.
*Benefit: Cleans up the browse view so host isn't re-reading posts they've already considered. Admin gets structured data on why posts don't attract quotes.*
- DB: New table `looking_for_passes (id, post_id, host_id, reason, passed_at)`.
- UI: A "Passed" tab in the host browse section. RLS: host sees only their own pass records.

#### H3 — Quote Response Time Badge
Track the time between a host first viewing a "Looking For" post and sending a quote on it. Calculate rolling average. Display on the host's **public listing profile**: *"Typically responds to requests within 2 hours."*
*Benefit: Fast-responding hosts get a visible trust signal on their public profile; incentivises prompt quoting.*
- DB: `looking_for_post_views.viewed_at` (from G3) + `looking_for_quotes.sent_at` → calculate delta per host. Store rolling average in `host_profiles.lf_avg_response_minutes`.
- Displayed only when host has sent ≥ 5 quotes (enough data to be meaningful).

#### H4 — Post Match Score
Each post card in the host browse view shows a coloured badge calculated from how well the post fits the host's listing(s):
- **Great Match** (8–10 pts) — green
- **Good Match** (5–7 pts) — amber
- **Low Match** (<5 pts) — no badge shown

Scoring: location match (+3), category match (+3), group size within listing capacity (+2), guest budget overlaps host pricing (+2).
*Benefit: Host can instantly prioritise the most relevant posts in a long browse list without reading every card.*
- Implementation: Calculated in the `get_looking_for_posts_for_host` RPC. Pure SQL calculation against existing listing data. No new DB columns.

#### H5 — Quick-Load Message Templates
When the quote modal opens from a "Looking For" post, a **"Load Template"** dropdown appears above the message body field. Pulls from the host's existing saved message templates (already in the system).
*Benefit: Host can respond professionally and at speed — especially useful on mobile where typing is slow.*
- Implementation: One additional UI element in the existing quote modal. Calls the existing templates endpoint. No new backend work.

#### H6 — Quote History Status (My Quotes Sent)
In the host's **"My Quotes Sent"** view, each sent quote shows a live status pill:
- **Sent** (grey) — quote delivered, not yet viewed
- **Viewed** (blue) — guest opened the inbox thread
- **Accepted** (green) — guest accepted the quote
- **Declined** (red) — guest declined

*Benefit: Host knows exactly which quotes need a follow-up and which have converted, without opening each inbox thread.*
- DB: `looking_for_quotes.status` already tracks this. `viewed_at` updated when guest opens the thread (hook into existing inbox read-receipt logic).

#### H7 — Looking For Performance in Reports
A **"Looking For"** sub-tab added to the existing host reporting dashboard, showing:
- Total quotes sent via Looking For
- Quote acceptance rate (%)
- Bookings attributed to Looking For (via `fulfilled_booking_id`)
- Estimated revenue from Looking For bookings
- Average response time
- Top regions where host's quotes were accepted

*Benefit: Host can measure ROI from the feature and adjust their quoting behaviour accordingly.*
- Implementation: New reporting tab using existing chart components. All data from `looking_for_quotes` + `bookings` joins. No new data collection needed.

#### H8 — Bookmark / Save for Later
A **bookmark icon** on every post card. Tapping it saves the post to the host's "Saved" tab in the Looking For dashboard section. Saved posts persist even as the main browse list refreshes or the post scrolls out of view.
*Benefit: Host can quickly flag posts during a browse session and respond more carefully later — useful for busy hosts on mobile.*
- DB: New table `looking_for_bookmarks (host_id, post_id, saved_at)` — two columns + unique constraint. Extremely lightweight.

---

### Post #21 — Shared / Public Activity Metrics

#### P1 — Post Activity Metrics (Public & Host-Visible)
Every "Looking For" post — both on the **public `/looking-for` directory page** and in the **host dashboard browse view** — displays live activity metrics on the post card:

```
👁  47 views   ·   💬 6 quotes sent
```

**What is shown:**
- **Views:** Total number of distinct host accounts that have viewed this post
- **Quotes sent:** Total number of quotes submitted on this post

**What is never shown:**
- The identity of any host who quoted
- The content, price, or details of any quote
- Any personal information about responding hosts

These are purely **activity signals** — the same way a property listing shows "X people viewed this in the last 7 days" on OTA platforms.

*Benefit — For guests:* Social proof that their post is attracting attention. Urgency signal when multiple hosts have quoted. Motivation to keep the post active.
*Benefit — For hosts:* Competitive awareness — "6 quotes sent" tells the host they're entering a competitive post and may need to price sharply. "0 quotes sent" signals an opportunity to be first.
*Benefit — For the platform:* Activity metrics on the public directory page make the feature feel alive and trustworthy to new visitors, increasing guest post submissions and host engagement.

**Implementation:**
- `view_count` and `quote_count` already exist on `looking_for_posts` as denormalized integers.
- `view_count` increments via the `looking_for_post_views` table (distinct host views — from G3).
- `quote_count` increments atomically when a `looking_for_quotes` record is inserted (DB trigger or RPC).
- Both fields are publicly readable (no auth required) — just two integers, no PII.
- Displayed as a footer row on every post card in both the public directory and the host browse view.
- On the full post detail page (`/looking-for/[id]`), displayed more prominently with a small activity timeline: *"Last quote sent 2 hours ago."*


---

### 17.4 Additional Confirmed Enhancements (8 More — Real-World Gap Review)

The following 8 features address gaps identified through real-world usage analysis of the full guest→host→quote flow. All are confirmed for inclusion. Features originally discussed as #3 (Express Interest) and #5 (Convert to Booking) were excluded as they are already handled by the existing codebase.

---

#### A1 — Guest Identity & Trust Verification Badge

**The problem:** A host browsing requests has no way to know if a guest is a serious traveller or a tyre-kicker. A request with no profile photo and no booking history gets ignored.

**What it does:** Guests who have at least one completed booking on Wielo receive a **"Verified Guest" badge** displayed on their post card and post detail page. The badge is calculated automatically from the guest's booking history — no manual process.

**Benefit:** Hosts prioritise verified requests, knowing the guest has a track record of completing bookings. Unverified guests are still visible but hosts can filter them out.

- DB: Add `is_verified_guest BOOLEAN` as a computed/cached field on `profiles`, updated by a trigger when a booking reaches `COMPLETED` status. Or calculate inline in the RPC from `bookings` count.
- Display: A small tick-shield icon on the post card alongside the guest's name. Tooltip: *"This guest has completed X bookings on Wielo."*
- Filter: Add "Verified guests only" as an optional toggle in the host browse filter bar.

---

#### A2 — Private / Targeted Requests (Send to Specific Host)

**The problem:** A repeat guest wants to go back to a property they loved, or they've seen a specific listing and want availability — but the current spec only supports fully public broadcast posts.

**What it does:** On the post creation form, guest can toggle **"Send to specific hosts"** instead of "Public." They search for and select 1–5 host accounts by name or property name. The post is created with `is_public = FALSE` and only appears in the selected hosts' dashboards — not on the public directory and not visible to other hosts.

**Benefit:** Enables high-value repeat business and targeted outreach. Hosts receiving a private request know the guest specifically chose them, making the interaction more personal and the conversion rate higher.

- DB: New junction table `looking_for_post_targets (post_id, host_id)`. RLS policy: host can only see a private post if a matching record exists in this table.
- UI: Host search/selector on the post form (reuses existing host/property search component from directory). Shows selected hosts as removable chips.
- Private posts show a **"Private Request"** badge instead of being visible on `/looking-for`. They appear in the targeted host's dashboard with a purple "Private" indicator.
- Guest can switch a private post to public at any time from "My Requests."

---

#### A3 — Quote Expiry & Ghost Guest Protection

**The problem:** A host sends a carefully crafted quote. The guest goes silent — no acceptance, no decline, no message. The host has no closure and doesn't know if they should follow up or move on. Currently there is no time-out mechanism.

**What it does:** Every quote sent via "Looking For" has an **auto-expiry window** (default: 5 days, configurable by admin per plan). If the guest has not accepted or declined by the expiry date:
1. The quote status changes to `expired`.
2. The guest receives a gentle nudge notification: *"You have 2 quotes waiting — they expire in 48 hours. Don't miss out."*
3. After expiry, the host sees the quote marked as **"Expired — no response"** in their "My Quotes Sent" view.
4. The host's quota usage for that quote is **refunded** (the slot is returned to their monthly allowance).

**Benefit:** Protects host effort. Creates urgency for guests to respond. Quota refund removes the disincentive to quote on posts where guests may be unresponsive.

- DB: Add `expires_at TIMESTAMPTZ` and `status` already includes `expired` on `looking_for_quotes`. Add `quote_expiry_days INT` to `plan_looking_for_quotas`.
- pg_cron: Nightly job checks `looking_for_quotes` for records past `expires_at` with status `sent` or `viewed` → updates to `expired`, fires guest nudge notification, refunds quota usage (deletes the `looking_for_usage` record for that quote).
- Admin can configure the expiry window per plan (e.g., Basic: 5 days, Pro: 7 days, Business: 14 days).

---

#### A4 — Host Calendar Availability Indicator on Browse View

**The problem:** A host browses requests and opens a post only to discover the requested dates are already fully booked on their calendar. Wasted time, repeated for every post they open.

**What it does:** Each post card in the host browse view shows a small **availability dot** in the top-right corner, calculated automatically against the host's existing booking calendar for the requested dates:
- 🟢 **Available** — no bookings conflict with the requested dates
- 🟡 **Partial** — some dates are free, some are booked
- 🔴 **Unavailable** — fully booked for the requested dates
- ⚪ **No dates set** — the guest didn't specify dates

**Benefit:** Hosts can instantly skip posts where they have no availability, making the browse experience significantly faster. Reduces wasted quote attempts.

- Implementation: Calculated in `get_looking_for_posts_for_host` RPC. For each post, cross-reference `post.check_in_date / check_out_date` against the host's `bookings` table (existing data). Returns `availability_status` field per post.
- No new DB tables. Pure SQL calculation in the existing RPC.
- Dots are visual only — tapping a red-dot post still allows the host to open it (they may have cancellations, or want to redirect to another listing they manage).

---

#### A5 — Guest "Re-Open Post" After Fulfillment or Expiry

**The problem:** A guest marks their post as fulfilled or it expires — then the booking falls through (host cancels, payment fails, plans change). Currently they must create an entirely new post, losing all quote history and starting from zero.

**What it does:** On any fulfilled or expired post in the guest's "My Requests" view, a **"Re-Open"** button restores the post to `active` status with one tap. The post's original content, dates (updated by the guest if needed), and history are preserved. Hosts who previously quoted on this post receive a notification: *"A guest you quoted is looking again — [Post Title]."*

**Benefit:** Guest recovers their post quickly in a frustrating situation. Hosts who already showed interest get a second chance. Reduces duplicate posts cluttering the directory.

- DB: Add `reopen_count INT DEFAULT 0` to `looking_for_posts`. Add `reopened_at TIMESTAMPTZ`.
- RPC: `reopen_looking_for_post(post_id, user_id)` — validates ownership, resets status to `active`, recalculates `expires_at`, increments `reopen_count`, fires notification to all hosts in `looking_for_quotes` for that post.
- Quota: Reopening counts against the guest's monthly post quota (same as creating a new post). Prevents abuse.
- Posts that have been reopened show a subtle **"Reopened"** tag on the card so hosts have context.

---

#### A6 — Strategic Browse Filters for Hosts ("0 Quotes" & "Expiring Soon")

**The problem:** The public `/looking-for` directory and host browse view currently filter by location, category, dates, group size, and budget. But a strategically minded host wants to find *opportunity* — posts nobody has responded to yet, or posts about to expire where the guest is likely desperate.

**What it does:** Two additional filter/sort options added to the host browse view and public directory:

**"No quotes yet"** toggle — filters to posts where `quote_count = 0`. These are untapped opportunities where the host will be the first responder.

**"Expiring soon"** toggle — filters to posts where `expires_at` is within the next 72 hours. Guests with expiring posts are most motivated to accept a quote quickly.

Both can be combined with existing filters (e.g., "No quotes yet + Mpumalanga + Accommodation").

**Benefit:** Gives hosts a competitive edge. Fast movers who quote on "0 quotes" posts get the guest's full attention. Quoting on "expiring soon" posts often leads to faster acceptance.

- Implementation: Two filter chips added to the existing filter bar. Both are simple WHERE clause additions to the `get_looking_for_posts_for_host` RPC (`quote_count = 0` and `expires_at < NOW() + INTERVAL '72 hours'`). No new DB columns.

---

#### A7 — Cap Public Quote Count Display ("5+ Quotes")

**The problem:** Showing the exact quote count publicly on every post card has an unintended consequence: posts showing "14 quotes sent" may deter new hosts from quoting (feels overcrowded) AND may make guests feel their request is no longer special. Both outcomes hurt the feature.

**What it does:** The public quote count display is **capped at a threshold** set by admin (default: 5). Posts with fewer than 5 quotes show the exact count: *"3 quotes sent."* Posts at or above the threshold show: *"5+ quotes sent."* The actual count is still visible to the guest on their own "My Requests" dashboard (no cap there — it's their data).

**Benefit:** Keeps posts feeling competitive and worth quoting on for hosts. Prevents the "overcrowded post" perception that discourages both new host quotes and guest engagement. Admin can tune the threshold.

- DB: Add `public_quote_count_cap INT DEFAULT 5` to `plan_looking_for_quotas` (or a global platform settings table).
- Implementation: Single display logic change — `Math.min(quote_count, cap)` with a `+` suffix when capped. One line of frontend code.
- Admin configures the cap from the Looking For admin panel (§21.5).

---

#### A8 — Group / Event Request Category

**The problem:** A travel agent, wedding planner, tour operator, or large group organiser has fundamentally different needs than a solo traveller. They may need accommodation + experiences + transport, large group sizes (20–200 people), multi-day events, and structured quote responses with itemised pricing. The current single-post form doesn't accommodate this and these are the highest-spend guests on the platform.

**What it does:** A dedicated **"Group / Event Request"** category option on the post form. Selecting it reveals an extended form with:
- Event type: Wedding / Corporate / Tour Group / Family Reunion / Other
- Total headcount (up to 500)
- Multi-vendor needs checkboxes: Accommodation ☑ / Experiences ☑ / Transport ☑ / Catering ☑
- Event date (distinct from check-in/check-out framing)
- Structured budget: per-person OR total event budget
- Optional: "I need an all-in quote" toggle — signals to hosts that a single comprehensive quote covering multiple services is preferred

Group/Event posts are tagged and filterable separately. Hosts quoting on them are prompted to include itemised pricing in the quote form.

**Benefit:** Opens the feature to the highest-value guest segment on the platform. A single wedding booking could be worth 10× a standard accommodation booking. Requires almost no new infrastructure — it's primarily a form extension and a new category tag.

- DB: Add `event_type TEXT`, `total_headcount INT`, `vendor_needs TEXT[]`, `is_all_in_quote BOOLEAN` to `looking_for_posts`. All nullable — only populated for Group/Event category.
- Group/Event posts display a distinct **"Event"** badge (gold) on cards vs the standard category badges.
- Admin can gate Group/Event requests to Pro and Business plans only (via quota config).

---

---

## 18. Implementation Priority Guide for Claude Code

Use this ordering when implementing. Each phase is independently shippable.

### Phase 1 — Core Foundation (Ship First)
1. DB migrations: `looking_for_posts`, `looking_for_quotes`, `plan_looking_for_quotas`, `looking_for_usage`
2. RLS policies on all new tables
3. Guest: create/edit/delete post form and "My Requests" dashboard tab
4. Public `/looking-for` directory page (read-only, no auth required)
5. Host: "Looking For" dashboard section with browse view (no quote yet)
6. Geo-proximity sort RPC (`get_looking_for_posts_for_host`)
7. Quota check RPCs (`check_guest_post_quota`, `check_host_quote_quota`)
8. Auto-expiry pg_cron job

### Phase 2 — Quote Integration (Core Value)
9. "Send Quote" button on host browse cards → opens **existing** quote modal with pre-fill
10. `looking_for_quotes` record creation on quote send
11. Guest record auto-creation on quote send (extend existing guest record logic)
12. "Already Quoted" badge on host browse view
13. Quota usage logging + enforcement

### Phase 3 — Notifications
14. New notification event types registered in existing notification system
15. Guest notifications: quote received, post expiring, post published
16. Host notifications: new post in region (batched), quote accepted/declined
17. Email templates (extend existing Resend templates)

### Phase 4 — Admin Panel
18. Quota configuration table (admin panel new page)
19. Post moderation view
20. Basic analytics: active posts, quotes sent, response rate

### Phase 5 — Confirmed Feature Enhancements (All 21 — see §17 for full detail)
All enhancements in §17 are confirmed for implementation. Build in any order after Phase 4. Recommended grouping by effort:
- **Quickest wins (1–2 hrs each):** Share Post Link, View Counter on Own Posts, Already-Quoted Count (public metric), Duplicate & Repost, One-Tap Expiry Extension, Bookmark / Save for Later, Not a Fit Pass, Regional New-Post Badge, Quick-Load Message Templates, Quote History Status
- **Half-day builds:** Request Templates / Presets, Response Deadline, Post Match Score, Saved Search Alerts, Quote Comparison View, Looking For Performance in Reports, Post Activity Metrics on Public Directory
- **Full-day builds:** Request Visibility Boost (Urgent), Minimum Rating Filter, Quote Response Time Badge, Request Fulfilled Source Attribution

---

---

## 19. Sidebar Navigation — Structure & Pattern

### 19.1 Pattern Reference

"Looking For" follows the **exact same pattern as "Properties"** in the existing sidebar. Properties is a collapsible section header with child action links underneath it. "Looking For" is a new section header at the same level, with its own child links below it.

### 19.2 Host Dashboard Sidebar (Updated)

```
HOST DASHBOARD SIDEBAR
─────────────────────────────────
  Dashboard
  ─────────────────────────────
  Properties                        ← existing section title
    └── All Properties
    └── Add Property
    └── Rooms
  ─────────────────────────────
  Bookings
    └── All Bookings
    └── Calendar
  ─────────────────────────────
  Looking For             🔒/✨     ← NEW SECTION TITLE (gated)
    └── Browse Requests             /dashboard/looking-for
    └── My Quotes Sent             /dashboard/looking-for/my-quotes
    └── Saved Requests             /dashboard/looking-for/saved
    └── Request Alerts             /dashboard/looking-for/alerts
  ─────────────────────────────
  Guests
  Inbox
  Reviews
  Payments
  Website
  Settings
```

- The section title **"Looking For"** is always visible in the sidebar (even when locked), so users know the feature exists.
- When the user's plan does not include "Looking For", the section title shows a **lock icon (🔒)** and child links are hidden or greyed. Clicking the title shows the upgrade prompt.
- When unlocked, the section expands/collapses exactly like Properties.

### 19.3 Guest Dashboard Sidebar (Updated)

```
GUEST DASHBOARD SIDEBAR
─────────────────────────────────
  My Bookings
  My Reviews
  ─────────────────────────────
  Looking For             🔒/✨     ← NEW SECTION TITLE (gated)
    └── My Requests                /guest/looking-for/my-requests
    └── Post a Request             /guest/looking-for/new
    └── Quotes Received            /guest/looking-for/quotes
  ─────────────────────────────
  Inbox
  Profile
  Settings
```

### 19.4 Navigation Config Object

Following the existing `sidebarNavigation` config pattern in the codebase:

```typescript
// In the existing sidebar navigation config file
{
  id: 'looking-for',
  label: 'Looking For',
  icon: 'Search',                          // Lucide icon
  featureFlag: 'looking_for_access',       // Key in plan_features table
  expandable: true,
  lockedBehavior: 'show-locked',           // Show title + lock icon, hide children
  upgradePrompt: {
    title: 'Unlock Looking For',
    body: 'Post requests or browse what travellers are looking for. Available on Basic and above.',
    cta: 'Upgrade Plan',
  },
  children: [
    // HOST children
    {
      id: 'lf-browse',
      label: 'Browse Requests',
      path: '/dashboard/looking-for',
      icon: 'List',
      roles: ['host'],
    },
    {
      id: 'lf-my-quotes',
      label: 'My Quotes Sent',
      path: '/dashboard/looking-for/my-quotes',
      icon: 'SendHorizonal',
      roles: ['host'],
    },
    {
      id: 'lf-saved',
      label: 'Saved Requests',
      path: '/dashboard/looking-for/saved',
      icon: 'Bookmark',
      roles: ['host'],
    },
    {
      id: 'lf-alerts',
      label: 'Request Alerts',
      path: '/dashboard/looking-for/alerts',
      icon: 'Bell',
      roles: ['host'],
    },
    // GUEST children
    {
      id: 'lf-my-requests',
      label: 'My Requests',
      path: '/guest/looking-for/my-requests',
      icon: 'FileText',
      roles: ['guest'],
    },
    {
      id: 'lf-new-request',
      label: 'Post a Request',
      path: '/guest/looking-for/new',
      icon: 'Plus',
      roles: ['guest'],
    },
    {
      id: 'lf-quotes-received',
      label: 'Quotes Received',
      path: '/guest/looking-for/quotes',
      icon: 'Inbox',
      roles: ['guest'],
    },
  ],
}
```

### 19.5 Badge / Indicator on Sidebar

The "Looking For" sidebar title shows a **notification badge** in two cases:

| Condition | Badge shown |
|-----------|-------------|
| Host: new posts in their region since last visit | Green dot (unread count) |
| Guest: new quote received on one of their posts | Green dot (unread count) |

Badge is cleared when the user opens the relevant child page. Uses the existing unread badge pattern from Inbox.

---

## 20. Subscription Gating — Feature Flag Integration

### 20.1 Principle

"Looking For" is a **standalone gated feature** controlled by the existing `plan_features` table. It is not bundled silently inside another feature. It has its own feature flag key: `looking_for_access`.

The quota system (§3) is a **secondary layer** on top of access. A user must first have `looking_for_access = true` before quota limits even apply. Users without access see the locked state; users with access see their quota.

### 20.2 Feature Flag in `plan_features`

Add the following rows to the existing `plan_features` table (one per plan):

```sql
-- Add to existing plan_features table
INSERT INTO plan_features (plan_id, feature_key, enabled, config) VALUES
  ('free',     'looking_for_access', false, null),
  ('basic',    'looking_for_access', true,  '{"tier": "basic"}'),
  ('pro',      'looking_for_access', true,  '{"tier": "pro"}'),
  ('business', 'looking_for_access', true,  '{"tier": "business"}');
```

- **Free plan**: `looking_for_access = false` — feature is locked entirely.
- **Basic and above**: `looking_for_access = true` — feature is active, quotas apply per plan tier.

### 20.3 Gate Check Pattern (Reuse Existing)

The existing `useFeatureFlag('looking_for_access')` hook (or equivalent) is used on every "Looking For" page and the "Send Quote" action. This is the same pattern used by Website, Cross-Sync, and other gated features. No new gate mechanism is built.

```typescript
// Reuse existing pattern — example
const { hasAccess, isLoading } = useFeatureFlag('looking_for_access');

if (!hasAccess) {
  return <FeatureLockedPrompt feature="Looking For" requiredPlan="Basic" />;
}
```

### 20.4 Upgrade Prompt UI

When a user without access tries to interact with "Looking For" (sidebar click, public directory "Send Quote" button, etc.), show the **existing `<FeatureLockedPrompt>` component** with:

- Feature name: "Looking For"
- Short pitch: "Post requests or browse what travellers are looking for. Hosts can quote directly. Guests get personalised offers."
- Required plan: "Basic and above"
- CTA: "Upgrade Plan" → existing `/pricing` or subscription upgrade flow

---

## 21. Admin Product & Permissions Wiring

This section defines exactly how the super admin configures, prices, and controls access to "Looking For" through the existing admin product/package system. The goal is zero hardcoding — every permission and pricing decision is made by the admin in the panel.

### 21.1 Admin Panel Location

```
ADMIN PANEL SIDEBAR
─────────────────────────────────
  Dashboard
  Users
  Hosts
  Subscriptions
  ─────────────────────────────
  Products & Packages             ← existing section
    └── Plans                     ← existing (Free/Basic/Pro/Business)
    └── Feature Flags             ← existing
    └── Add-Ons                   ← existing or new
  ─────────────────────────────
  Looking For                     ← NEW admin section
    └── Quota Configuration       /admin/looking-for/quotas
    └── Post Moderation           /admin/looking-for/posts
    └── Analytics                 /admin/looking-for/analytics
  ─────────────────────────────
  Settings
  Design System
```

### 21.2 "Products & Packages → Feature Flags" — What Admin Configures

The existing Feature Flags admin page gets a new row for "Looking For":

| Feature Key | Display Name | Description | Per-Plan Toggle |
|-------------|-------------|-------------|-----------------|
| `looking_for_access` | Looking For | Allow users to browse and post "Looking For" requests and send quotes | Free: ❌ / Basic: ✅ / Pro: ✅ / Business: ✅ |

Admin can toggle this per plan **without a code deploy**. If admin turns off `looking_for_access` for Basic, all Basic users are locked out instantly.

### 21.3 "Products & Packages → Plans" — Pricing Wiring

The existing Plans admin page shows each plan's feature list. "Looking For" appears as a line item on each plan:

```
BASIC PLAN — Feature List
  ✅ Bookings
  ✅ Inbox
  ✅ Guest Records
  ✅ Quote System
  ✅ Looking For               ← appears here, toggleable
     └── Host quotes/month: 15
     └── Guest posts/month: 10
  ✅ Website
  ...
```

Clicking the "Looking For" row on a plan expands an inline config panel where admin sets the quota values for that plan (reuses the quota table from §3, surfaced here contextually).

### 21.4 "Products & Packages → Add-Ons" (Future-Ready)

Prepare the data structure so "Looking For" can be sold as a **standalone add-on** in future — i.e., a Free plan user could purchase "Looking For Access" separately without upgrading their full plan.

The `plan_features` table should support an `override_source` field:

```sql
ALTER TABLE plan_features ADD COLUMN override_source TEXT;
-- Values: 'plan' (default) | 'addon' | 'admin_grant' | 'trial'
```

When `override_source = 'addon'`, the feature is active regardless of plan tier. This wires cleanly into the future add-on billing system without breaking current logic.

Admin can also **manually grant** "Looking For" to a specific user account from the Users panel (for beta testers, enterprise deals, etc.) — this sets `override_source = 'admin_grant'` on their personal feature override record.

### 21.5 Admin: Looking For — Quota Configuration Page

Route: `/admin/looking-for/quotas`

This page renders the full quota table (§3.2 and §3.3) as an inline-editable grid. Admin sees:

```
LOOKING FOR — QUOTA CONFIGURATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  GUEST — Posts per period
  ┌──────────┬───────────┬─────────────┬────────────┐
  │ Plan     │ Per Day   │ Per Month   │ Per Year   │
  ├──────────┼───────────┼─────────────┼────────────┤
  │ Free     │ [1]       │ [3]         │ [12]       │
  │ Basic    │ [3]       │ [10]        │ [60]       │
  │ Pro      │ [10]      │ [30]        │ [200]      │
  │ Business │ [∞]       │ [∞]         │ [∞]        │
  └──────────┴───────────┴─────────────┴────────────┘

  HOST — Quotes per period (on Looking For posts)
  ┌──────────┬───────────┬─────────────┬────────────┐
  │ Plan     │ Per Day   │ Per Month   │ Per Year   │
  ├──────────┼───────────┼─────────────┼────────────┤
  │ Free     │ [0]       │ [0]         │ [0]        │
  │ Basic    │ [3]       │ [15]        │ [100]      │
  │ Pro      │ [10]      │ [50]        │ [400]      │
  │ Business │ [30]      │ [200]       │ [∞]        │
  └──────────┴───────────┴─────────────┴────────────┘

  [Save Changes]    Last updated: Jun 28, 2026 by admin@wielo.com
```

- Blank cell = unlimited.
- Changes are saved instantly to `plan_looking_for_quotas`.
- A change log shows the last 10 edits with timestamp + admin name.

### 21.6 Admin: Looking For — Post Moderation Page

Route: `/admin/looking-for/posts`

Tabbed view:
- **Active** — All live posts (sortable by region, date, quote count)
- **Expired** — Posts past their expiry date
- **Flagged** — Posts flagged for review
- **Removed** — Soft-deleted posts

Per-post actions: View detail, Flag, Remove, Restore, View all quotes sent on this post.

### 21.7 Admin: Looking For — Analytics Page

Route: `/admin/looking-for/analytics`

| Metric | Display |
|--------|---------|
| Active requests right now | Big number card |
| Total posts (all time) | Number card |
| Total quotes sent (all time) | Number card |
| Response rate (posts with ≥1 quote) | % card |
| Quota hits (users who hit their limit) | Chart — signals upgrade candidates |
| Posts by region | Bar chart |
| Posts by category | Pie chart |
| LF posts → Wielo booking conversion rate | % (from `fulfilled_via_vilo` flag) |
| Daily activity (posts + quotes) | Line chart, last 30 days |

All charts use the **existing admin analytics chart components** — no new charting library.

### 21.8 Complete Database Migration Checklist for Claude Code

When implementing, run these migrations in order:

```sql
-- 1. Add feature flag row to existing plan_features table
INSERT INTO plan_features ...  (see §20.2)

-- 2. Add override_source column to plan_features (future-ready)
ALTER TABLE plan_features ADD COLUMN override_source TEXT DEFAULT 'plan';

-- 3. Create looking_for_posts table (see §4.1)
-- 4. Create looking_for_quotes table (see §4.2)
-- 5. Create plan_looking_for_quotas table (see §4.3)
-- 6. Create looking_for_usage table (see §4.4)

-- 7. Seed default quota values
INSERT INTO plan_looking_for_quotas ...

-- 8. Add looking_for_post_id FK to existing quotes table
ALTER TABLE quotes ADD COLUMN looking_for_post_id UUID REFERENCES looking_for_posts(id);

-- 9. Add created_via column to existing guest_records table
ALTER TABLE guest_records ADD COLUMN created_via TEXT DEFAULT 'direct';
-- Valid values: 'direct' | 'looking_for' | 'import' | 'manual'

-- 10. Enable PostGIS if not already active
CREATE EXTENSION IF NOT EXISTS postgis;

-- 11. Add pg_cron jobs for auto-expiry and usage cleanup
SELECT cron.schedule('expire-looking-for-posts', '0 2 * * *', $$
  UPDATE looking_for_posts
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at < NOW();
$$);
```

---

*End of "Looking For" Feature Specification v3.0*
