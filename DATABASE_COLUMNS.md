# Database Column Reference

**Purpose:** Quick reference for column names across all tables to prevent schema mismatches when writing queries, RPC functions, or migrations.

**Last Updated:** 2026-06-05

---

## Core Tables

### `bookings`

**Money/Pricing Columns:**
- `total_amount` ← **Use this for total booking price** (NOT `total_price`)
- `subtotal` - Base amount before tax/fees
- `base_amount` - Original listing price
- `deposit_amount` - Security deposit
- `balance_amount` - Outstanding balance
- `discount_amount` - Discounts applied
- `addons_total` - Sum of addon prices
- `price_breakdown` - JSONB with detailed breakdown

**Status/Tracking:**
- `status` - confirmed | pending | cancelled | checked_in | checked_out
- `channel` - direct | airbnb | booking | expedia | other
- `nights` - Number of nights
- `check_in_date` - Check-in date
- `check_out_date` - Check-out date
- `deleted_at` - Soft delete timestamp

**Relationships:**
- `id` - Primary key (UUID)
- `listing_id` - Foreign key to listings
- `host_id` - Denormalized for performance
- `guest_id` - Foreign key to user_profiles
- `quote_id` - Optional quote reference

---

### `listings`

**Key Columns:**
- `id` - Primary key (UUID)
- `host_id` - Foreign key to hosts
- `name` - Listing title
- `slug` - URL-friendly identifier
- `province` - Western Cape | Eastern Cape | Gauteng | KwaZulu-Natal | Limpopo | (other SA provinces)
- `room_count` - Number of bookable rooms/units
- `base_price` - Starting price per night
- `deleted_at` - Soft delete timestamp

**Location:**
- `street_address`
- `suburb`
- `city`
- `province`
- `postal_code`
- `country` - Default 'ZA'
- `latitude`
- `longitude`

---

### `hosts`

**Key Columns:**
- `id` - Primary key (UUID)
- `user_id` - Foreign key to auth.users
- `display_name` - Business name
- `deleted_at` - Soft delete timestamp

**Relationships:**
- One host has many listings
- One host has many bookings (via listings)

---

### `user_profiles`

**Key Columns:**
- `id` - Primary key (UUID, matches auth.users.id)
- `email` - User email
- `first_name`
- `last_name`
- `country` - ISO 3166-1 alpha-2 (ZA, GB, US, etc.)
- `phone`
- `deleted_at` - Soft delete timestamp

---

### `quotes`

**Money Columns:**
- `total_amount` - Total quote amount
- `subtotal` - Base amount
- `vat_amount` - Tax amount
- `discount_amount` - Discounts

**Status:**
- `status` - draft | sent | accepted | rejected | expired
- `valid_until` - Expiration date

**Relationships:**
- `id` - Primary key
- `host_id` - Foreign key to hosts
- `listing_id` - Foreign key to listings
- `guest_id` - Foreign key to user_profiles

---

### `refunds`

**Money Columns:**
- `amount` - Refund amount
- `requested_amount` - Amount requested by guest
- `approved_amount` - Amount approved by host
- `refunded_amount` - Actual amount refunded

**Status:**
- `status` - pending | approved | rejected | completed

**Relationships:**
- `booking_id` - Foreign key to bookings

---

### `reviews`

**Key Columns:**
- `id` - Primary key
- `booking_id` - Foreign key to bookings
- `rating` - Numeric rating (1-5)
- `comment` - Review text
- `created_at` - Review date

---

## Analytics Tables

### `listing_view_events`

**Tracking Columns:**
- `id` - Primary key
- `listing_id` - Foreign key to listings
- `session_id` - Browser session identifier
- `user_id` - Optional (if logged in)
- `duration_seconds` - Time spent viewing
- `device` - desktop | mobile | tablet
- `referrer` - Source URL
- `country` - ISO country code
- `viewed_at` - Timestamp

**Purpose:** Tracks listing page views for conversion funnel analysis.

---

### `scheduled_reports`

**Key Columns:**
- `id` - Primary key
- `host_id` - Foreign key to hosts
- `name` - Report name
- `report_type` - portfolio_summary | revenue_detail | channel_mix | guest_satisfaction | refunds_cancellations | occupancy_forecast
- `schedule_cron` - Cron expression (e.g., "0 8 * * *")
- `schedule_label` - Human-readable (e.g., "Daily · 08:00")
- `format` - pdf | csv | xlsx
- `recipients` - JSONB array of {email, name}
- `scope_filter` - JSONB filter criteria
- `is_active` - Boolean
- `next_run_at` - Timestamp
- `last_run_at` - Timestamp

---

### `report_runs`

**Execution Tracking:**
- `id` - Primary key
- `scheduled_report_id` - Foreign key
- `status` - pending | running | completed | failed
- `started_at` - Timestamp
- `completed_at` - Timestamp
- `file_url` - Supabase Storage URL (signed, 7-day expiry)
- `error_message` - Error details if failed

**Purpose:** Audit log of report generation (append-only).

---

## Common Patterns

### Money Columns
- **Always use `total_amount`** for booking prices (NOT `total_price`)
- Most tables use `amount`, `subtotal`, `total_amount` pattern
- Currency is always ZAR (South African Rand) - store in full Rand units, NOT cents
- Convert to kobo (cents) only when calling Paystack API

### Soft Deletes
- **Never hard-delete** these tables: `user_profiles`, `hosts`, `listings`, `bookings`
- Always use `deleted_at IS NULL` in queries
- RLS policies automatically filter soft-deleted rows

### Foreign Keys
- All use UUID type
- Most relationships include a `deleted_at` check in joins
- Denormalized `host_id` on bookings for performance

### Timestamps
- `created_at` - Auto-set on INSERT
- `updated_at` - Auto-updated on UPDATE (via trigger)
- `deleted_at` - Soft delete marker (NULL = active)

---

## Analytics Query Examples

### Correct (uses total_amount):
```sql
SELECT SUM(total_amount) AS revenue
FROM bookings
WHERE host_id = $1
  AND status IN ('confirmed', 'checked_in', 'checked_out')
  AND deleted_at IS NULL;
```

### Incorrect (uses total_price):
```sql
-- ❌ WRONG - column doesn't exist
SELECT SUM(total_price) AS revenue
FROM bookings;
```

---

## When Adding New Columns

1. **Check existing naming conventions** in this file first
2. **Use snake_case** for all column names
3. **Add `deleted_at` for soft deletes** (if table supports it)
4. **Include in RLS policies** if row-level filtering needed
5. **Update this file** with the new column

---

## Related Documentation

- `supabase_database.md` - Complete schema with RLS policies
- `ARCHITECTURE.md` - Data flow and relationships
- `CONVENTIONS.md` - Code style and naming
- `ENV_VARS.md` - Environment variables

---

**Maintenance:** Update this file whenever:
- Adding new tables
- Adding money/amount columns
- Changing column names (with migration)
- Adding analytics-related fields
