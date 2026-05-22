# Vilo Platform — Booking Sync (iCal / External Calendar Integration)

**Version:** 1.0
**Last Updated:** May 2026
**MVP Phase:** Phase 2 (Weeks 4–6)
**Companion Docs:** `supabase_database.md` Domain 2, `PHASE_PLAN.md`, `AGENT_RULES.md`

---

## 1. Overview

Booking Sync prevents double bookings by keeping the Vilo availability calendar in sync with external booking platforms (Airbnb, Booking.com, VRBO, Expedia, direct website calendar tools, etc.).

It works in both directions:

| Direction | What it does |
|---|---|
| **Import (inbound)** | Host adds an external feed URL. Vilo fetches it every 15 minutes and blocks any dates that have confirmed bookings on the external platform. |
| **Export (outbound)** | Vilo generates a unique iCal feed URL for each listing. Host copies this URL into their external platform's calendar import setting. External platforms fetch it and block those dates on their side. |

The standard used is **RFC 5545 iCalendar** (`.ics` format) — the universal format used by Airbnb, Booking.com, Google Calendar, Apple Calendar, Outlook, and virtually every other calendar tool.

---

## 2. Design Principles

**Conflict prevention, not conflict resolution.** The system blocks dates proactively — not retroactively after a double booking has already happened.

**Non-destructive syncing.** Importing an external feed only creates `blocked_dates` rows with `source = 'ical'`. It never touches manual blocks or Vilo booking blocks. Removing dates from an external feed only removes the rows that feed created.

**Visible sync status.** Hosts always know when their feeds were last synced, how many dates were imported, and whether any feed has an error. The calendar UI makes iCal-sourced blocks visually distinct from manual blocks and Vilo bookings.

**No guest data exported.** The outbound iCal feed only exports date ranges and a generic summary ("Booking via Vilo"). No guest names, contact details, or payment information is included.

---

## 3. Feature Availability by Plan

| Feature | Free | Basic | Pro | Business |
|---|---|---|---|---|
| iCal export (outbound) | ✅ | ✅ | ✅ | ✅ |
| iCal import feeds | ❌ | 1 feed | 5 feeds | Unlimited |
| Sync frequency | — | 15 min | 15 min | 15 min |
| Rotate export token | ✅ | ✅ | ✅ | ✅ |

Feature key: `ical_import` (checked before adding a new feed)
Limit key: `ical_import_limit` (max feeds per listing — plan-dependent)

---

## 4. Database Schema

### `ical_feeds` — New Table (Domain 2)

```sql
CREATE TABLE public.ical_feeds (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id        uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  host_id           uuid        NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,

  -- Inbound (import)
  direction         text        NOT NULL CHECK (direction IN ('import', 'export')),
  source_label      text,                    -- e.g. "Airbnb", "Booking.com", "Custom"
  feed_url          text,                    -- inbound: external URL. export: null (generated).

  -- Export token (outbound)
  export_token      text        UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),

  -- Sync state
  status            text        NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'paused', 'error')),
  last_synced_at    timestamptz,
  last_error        text,                    -- last sync error message (truncated to 500 chars)
  imported_count    integer     NOT NULL DEFAULT 0,  -- how many date blocks currently imported

  -- Metadata
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ical_feeds_listing   ON ical_feeds(listing_id);
CREATE INDEX idx_ical_feeds_host      ON ical_feeds(host_id);
CREATE INDEX idx_ical_feeds_direction ON ical_feeds(direction);
CREATE INDEX idx_ical_feeds_active    ON ical_feeds(status) WHERE status = 'active';
CREATE INDEX idx_ical_feeds_import    ON ical_feeds(listing_id, direction)
  WHERE direction = 'import' AND status = 'active';

ALTER TABLE ical_feeds ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN ical_feeds.export_token IS
  '32-byte random hex token. Part of the public iCal feed URL. Treat as a secret — rotate only on host request.';
COMMENT ON COLUMN ical_feeds.feed_url IS
  'Inbound feeds only: the external .ics URL to fetch. Validated for SSRF risks before saving.';
COMMENT ON COLUMN ical_feeds.last_error IS
  'Set on failed sync. Cleared on next successful sync. Never expose raw errors to host UI.';
```

### Changes to `blocked_dates` table

```sql
-- Add columns to track source of each blocked date
ALTER TABLE blocked_dates
  ADD COLUMN source      text NOT NULL DEFAULT 'manual'
                         CHECK (source IN ('manual', 'booking', 'ical')),
  ADD COLUMN ical_feed_id uuid REFERENCES ical_feeds(id) ON DELETE CASCADE;

-- Index for fast cleanup when re-syncing a feed
CREATE INDEX idx_blocked_dates_ical_feed ON blocked_dates(ical_feed_id)
  WHERE ical_feed_id IS NOT NULL;

COMMENT ON COLUMN blocked_dates.source IS
  'manual = host manually blocked | booking = Vilo booking | ical = imported from external feed';
COMMENT ON COLUMN blocked_dates.ical_feed_id IS
  'Only set when source = ical. FK to ical_feeds. Cascade deletes clean up on feed removal.';
```

---

## 5. RLS Policies

```sql
-- Hosts can manage their own feeds
CREATE POLICY "host_own_ical_feeds" ON ical_feeds
  FOR ALL USING (host_id IN (
    SELECT id FROM hosts WHERE user_id = auth.uid()
  ));

-- Staff can view but not create/delete feeds
CREATE POLICY "staff_view_ical_feeds" ON ical_feeds
  FOR SELECT USING (host_id IN (
    SELECT host_id FROM staff_members WHERE user_id = auth.uid()
  ));

-- Admin full access
CREATE POLICY "admin_full_access" ON ical_feeds
  FOR ALL USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'super_admin'
  );

-- Export token endpoint: anon can read export feeds by token (no auth required)
-- This is enforced in the Edge Function directly — not via RLS (anon key used)
```

---

## 6. Edge Functions

### `ical-export` — Generate outbound iCal feed

**Method:** `GET`
**Auth:** None (public URL with token auth)
**URL pattern:** `/functions/v1/ical-export?listing_id=[uuid]&token=[export_token]`

**Behaviour:**
1. Validate `token` matches `ical_feeds.export_token` for this listing
2. Fetch all confirmed bookings for the listing from `bookings` where `status IN ('confirmed', 'checked_in')` and `check_out >= now()`
3. Generate RFC 5545 `.ics` response:

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Vilo//ViloCalendar//EN
CALNAME:Vilo - [Listing Name]
REFRESH-INTERVAL;VALUE=DURATION:PT15M
X-WR-CALNAME:Vilo - [Listing Name]

BEGIN:VEVENT
DTSTART;VALUE=DATE:20260612
DTEND;VALUE=DATE:20260615
SUMMARY:Booking via Vilo
UID:[booking_id]@viloplatform.com
END:VEVENT

END:VCALENDAR
```

**Rules:**
- `SUMMARY` must be generic: `"Booking via Vilo"` — never include guest name, email, or any PII
- `DTEND` is exclusive (RFC 5545 convention) — check-out date is the day after the last night
- Only export bookings within next 24 months
- `Content-Type: text/calendar; charset=utf-8`
- `Content-Disposition: attachment; filename="vilo-[listing_handle].ics"`

---

### `ical-import` — Fetch and process one inbound feed

**Method:** `POST` (internal — called by `ical-sync-all` or by host triggering manual sync)
**Auth:** Service role (internal only)

**Input:**
```typescript
{ feed_id: string }
```

**Algorithm:**
```
1. Fetch ical_feeds row by feed_id — verify status = 'active'
2. Validate feed_url is not a private IP range (SSRF check — see Section 9)
3. Fetch feed_url with 10-second timeout
4. Validate response Content-Type contains 'text/calendar' or 'application/octet-stream'
5. Parse RFC 5545 with ical.js
6. Extract all VEVENT records where:
   - DTSTART is in the future (or within past 1 day for in-progress bookings)
   - DTSTART is within 24 months from now
   - Status is not CANCELLED
7. Generate list of individual dates from each VEVENT date range
8. Cap at 500 dates per feed — log warning if exceeded
9. Begin transaction:
   a. DELETE FROM blocked_dates WHERE ical_feed_id = feed_id AND source = 'ical'
   b. INSERT INTO blocked_dates for each new date (source='ical', ical_feed_id=feed_id)
      — ON CONFLICT (listing_id, date) DO NOTHING  (Vilo booking or manual block takes priority)
   c. UPDATE ical_feeds SET last_synced_at=now(), status='active', last_error=null,
      imported_count=[count inserted]
10. Commit
```

**On error:**
- Catch all errors
- `UPDATE ical_feeds SET status='error', last_error=[message truncated to 500 chars], last_synced_at=now()`
- Log full error to Sentry
- Do NOT throw — return error response so cron job can continue to next feed

---

### `ical-sync-all` — Re-sync all active import feeds

**Method:** `POST` (internal — called by pg_cron every 15 minutes)
**Auth:** Service role

**Behaviour:**
```typescript
// Fetch all active import feeds
const feeds = await supabase
  .from('ical_feeds')
  .select('id, listing_id, feed_url')
  .eq('direction', 'import')
  .eq('status', 'active')  // skip errored feeds — host must re-enable

// Process each feed sequentially (not parallel — avoid hammering external servers)
for (const feed of feeds) {
  await fetch(`${SUPABASE_URL}/functions/v1/ical-import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ feed_id: feed.id }),
  });
  // Brief delay between feeds
  await new Promise(r => setTimeout(r, 200));
}
```

---

## 7. pg_cron Job

```sql
-- Re-sync all active iCal feeds every 15 minutes
SELECT cron.schedule(
  'ical-sync-all',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/ical-sync-all',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);
```

Migration file: `20260503000000_add_ical_sync_cron.sql`

---

## 8. Host UI — Calendar Sync Settings

**Location:** `Dashboard → Listings → [Listing] → Calendar → Sync`

Or accessible from the listing editor: **Calendar tab → External Sync section**

---

### 8.1 Export Section (Outbound)

```
Your Vilo iCal Feed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copy this URL and paste it into your external calendar
(Airbnb, Booking.com, Google Calendar, etc.)

[https://viloplatform.com/ical/abc123.../token123....ics] [Copy]

Last updated: Just now
Includes: 4 upcoming confirmed bookings

[Rotate URL]  ← only on explicit click, with warning modal
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Rotate warning modal:**
> "Rotating your feed URL will break any external calendars that have already subscribed to it. You will need to re-copy the new URL into each external platform. Are you sure?"
> [Cancel] [Yes, rotate URL]

---

### 8.2 Import Section (Inbound)

```
External Calendar Feeds
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Import bookings from Airbnb, Booking.com, or any
platform that exports an iCal feed.

[+ Add calendar feed]

┌─────────────────────────────────────────────────┐
│ Airbnb                           ● Active       │
│ Last synced: 3 minutes ago · 8 dates blocked    │
│ [Sync now]  [Edit]  [Remove]                    │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Booking.com                      ⚠ Error        │
│ Last checked: 12 minutes ago                    │
│ Could not fetch the calendar feed. Check that   │
│ the URL is still valid in Booking.com.          │
│ [Retry]  [Edit]  [Remove]                       │
└─────────────────────────────────────────────────┘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Add feed form:**
- Label (text input): e.g. "Airbnb" — optional but encouraged
- Feed URL (text input): must start with `http://` or `https://` and end with `.ics` or `ical`
- [Add & Sync] button — immediately triggers one sync on add

**Plan limit enforcement:**
If host is on Basic (1 feed limit) and already has 1 feed:
- "Add" button shows `UpgradePrompt` inline — "Import up to 5 feeds on Pro."

---

### 8.3 Calendar View — Blocked Date Display

In the host availability calendar:

| Block type | Colour | Tooltip |
|---|---|---|
| Vilo booking | Brand green `#1B4D3E` | "Booking: [guest name] · [reference]" |
| Manual block | Slate `#94A3B8` | "Manually blocked" |
| iCal import | Amber `#F59E0B` | "Blocked via [feed label] · Synced [X] min ago" |

This makes it immediately clear to the host which blocks came from external platforms.

---

## 9. Security Considerations

### SSRF Prevention
External feed URLs are fetched server-side by Edge Functions. Before fetching, validate the URL does not resolve to a private or loopback address:

```typescript
function isPrivateUrl(url: string): boolean {
  const { hostname } = new URL(url);
  const privatePatterns = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^::1$/,
    /^0\.0\.0\.0$/,
  ];
  return privatePatterns.some(p => p.test(hostname));
}

if (isPrivateUrl(feedUrl)) {
  return errorResponse('ICAL_FEED_URL_INVALID', 'Feed URL must be a public URL.', 400);
}
```

### Export Token Security
- Export tokens are 32-byte random hex strings (64 chars) — not guessable
- Tokens are never logged, never included in Sentry payloads
- The export URL is public but self-authenticating via the token

### Data Privacy
- Outbound feeds contain only `DTSTART`, `DTEND`, `SUMMARY: Booking via Vilo`, and a non-guessable `UID`
- No guest name, email, phone, or payment data is ever included in the iCal export

---

## 10. Edge Function Error Codes

See `ERROR_CODES.md` → Calendar Sync Errors section for the full list:
- `ICAL_FEED_NOT_FOUND`
- `ICAL_FEED_URL_INVALID`
- `ICAL_FETCH_FAILED`
- `ICAL_PARSE_FAILED`
- `ICAL_FEED_ALREADY_EXISTS`
- `ICAL_FEED_LIMIT_REACHED`
- `ICAL_EXPORT_TOKEN_INVALID`

---

## 11. Migration Files

```
supabase/migrations/
  20260503000000_create_ical_feeds_table.sql
  20260503000001_alter_blocked_dates_add_source.sql
  20260503000002_create_ical_feeds_indexes.sql
  20260503000003_create_ical_feeds_rls.sql
  20260503000004_add_ical_sync_cron.sql
  20260503000005_seed_ical_plan_features.sql
```

### Seed — plan_features for iCal

```sql
-- 20260503000005_seed_ical_plan_features.sql
INSERT INTO plan_features (plan, feature_key, is_enabled, limit_value) VALUES
  ('free',     'ical_import', false, 0),
  ('basic',    'ical_import', true,  1),
  ('pro',      'ical_import', true,  5),
  ('business', 'ical_import', true,  NULL)  -- unlimited
ON CONFLICT (plan, feature_key) DO UPDATE
  SET is_enabled = EXCLUDED.is_enabled,
      limit_value = EXCLUDED.limit_value;
```

---

## 12. Notifications

| Event | Host | Channel |
|---|---|---|
| Feed added and first sync completes | ✅ | Dashboard toast |
| Feed sync error (first occurrence) | ✅ | Dashboard alert banner on Calendar page |
| Feed sync error (persists 1+ hour) | ✅ | Push notification + dashboard banner |
| Feed sync recovered after error | ✅ | Dashboard: error banner dismissed |
| iCal block conflicts with existing Vilo booking | ✅ | Dashboard alert — requires manual review |

**Conflict alert (rare edge case):** If `ical-import` tries to block a date that already has a confirmed Vilo booking, the iCal block is skipped (ON CONFLICT DO NOTHING) but a conflict record is logged and the host receives a dashboard warning: "External calendar conflict detected on [date]. A Vilo booking already exists. Please check your [Airbnb] calendar manually."

---

## 13. Permission Matrix

| Action | Guest | Staff | Host | Super Admin |
|---|---|---|---|---|
| View iCal export URL | — | ✅ | ✅ | ✅ |
| Copy iCal export URL | — | ✅ | ✅ | ✅ |
| Rotate iCal export token | — | — | ✅ | ✅ |
| Add import feed | — | — | ✅ | ✅ |
| Edit / remove import feed | — | — | ✅ | ✅ |
| Trigger manual sync | — | ✅ | ✅ | ✅ |
| View sync status | — | ✅ | ✅ | ✅ |
| Pause / resume feed | — | — | ✅ | ✅ |
| View all host feeds (admin) | — | — | — | ✅ |

---

## 14. How External Platforms Set Up the Integration

### Airbnb
1. In Airbnb: `Listing → Availability → Sync calendars → Export calendar` → copy URL
2. Paste into Vilo: `Calendar → Sync → Add calendar feed → URL field`
3. In Airbnb: `Sync calendars → Import calendar → paste Vilo export URL`

### Booking.com
1. In Booking.com: `Property → Calendar → iCal → Export iCal URL` → copy URL
2. Paste into Vilo: same as above
3. In Booking.com: `iCal → Import iCal → paste Vilo export URL`

### Google Calendar / Apple Calendar
- Subscribe to the Vilo export URL as a read-only external calendar
- Useful for hosts who want to see Vilo bookings alongside personal calendars

---

*This feature is critical for preventing double bookings. Any change to the sync logic, feed format, or blocked_dates schema must be reviewed against this spec before implementation.*
