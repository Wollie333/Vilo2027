# Wielo — Live Database Schema (GENERATED)

> ⚠️ **GENERATED FILE — DO NOT EDIT BY HAND.** Your edits will be overwritten.
> 
> **Regenerate:** `node scripts/generate-schema-doc.mjs`
> **Source of truth:** the **live linked Supabase project** — not the migrations, not prose.
> **Last generated:** 2026-07-17

Every hand-written schema doc in this repo has eventually lied: a rename orphaned a cron
for 30 days, a lifecycle doc described a call site that never existed, the lifecycle index
carried four phantom rows. Prose goes stale because nothing forces it to stay true. This
file is derived from the database, so read it instead of trusting a note — and regenerate
it after any migration.

## Summary

| | |
|---|---|
| Tables | **182** (181 with RLS) |
| Functions | **159** (127 SECURITY DEFINER, 57 trigger fns) |
| Cron jobs | **36** (11 Vault-gated, 0 inactive) |
| Vault secrets set | **9** |

## 🚩 Automated red flags

These checks re-run on every regeneration. Each is a bug class that has already cost this
project real time — see the comments in `scripts/generate-schema-doc.mjs` for the history.

### 73 × SECURITY DEFINER function with **no pinned `search_path`** — runs as owner, resolves object names via the caller's path. Fix: `SET search_path = public, pg_temp`.

- `_host_guest_rows`
- `_materialize_booking_party`
- `assign_receipt_number`
- `assign_refund_number`
- `block_special_dates`
- `booking_business_id`
- `broadcast_audience`
- `business_doc_code`
- `calculate_booking_price`
- `calculate_policy_refund_amount`
- `can_send_broadcast`
- `check_feature_permission`
- `check_host_quote_quota`
- `count_broadcast_recipients`
- `ensure_booking_invoice`
- `ensure_host_booking_terms`
- `ensure_host_default_policies`
- `ensure_host_legal_presets`
- `ensure_host_policy_presets`
- `ensure_listing_policy_assignments`
- `expire_specials`
- `fetch_guest_record`
- `fetch_host_guests`
- `fetch_host_guests_summary`
- `gen_booking_reference`
- `gen_refund_reference`
- `get_host_inbox_stats`
- `get_host_refund_stats`
- `get_listing_availability`
- `get_listing_policy_summary`
- `get_min_nights_for_stay`
- `get_my_host_id`
- `get_my_host_id_as_staff`
- `get_my_role`
- `handle_new_user`
- `has_admin_permission`
- `increment_help_article_view`
- `is_super_admin`
- `listing_doc_code`
- `log_refund_status_change`
- `materialize_booking_party`
- `mint_wielo_invoice_on_ledger_complete`
- `next_credit_note_number`
- `next_forfeit_number`
- `next_invoice_number`
- `next_quote_number`
- `next_receipt_number`
- `next_refund_number`
- `on_booking_cancelled`
- `on_booking_confirmed`
- `on_booking_confirmed_create_invoice`
- `on_host_created_default_business`
- `on_message_inserted`
- `on_payment_completed_mark_invoice_paid`
- `on_quote_status_change`
- `on_review_published`
- `on_special_status_change`
- `recalculate_listing_ranking`
- `redeem_coupon`
- `redeem_special`
- `release_addon_stock`
- `release_booking_addon_stock`
- `release_special`
- `reserve_addon_stock`
- `resolve_listing_policy_id`
- `seed_host_policies_on_create`
- `set_listing_default_business`
- `snapshot_booking_policies`
- `sync_booking_refund_flag`
- `sync_listing_policy_label`
- `sync_review_helpful_count`
- `update_payment_refunded_amount`
- `vote_help_article`

### 4 × Vault-gated cron whose secret is NOT set. An unset secret makes the job return early — so it reports `succeeded` while doing nothing at all. Needs a founder to `vault.create_secret` per environment.

- `drain-looking-for-notifications` needs `looking_for_worker_url`
- `poll-website-domains` needs `website_domain_poll_url`
- `publish-scheduled-posts` needs `blog_publish_url`
- `sync-external-reviews` needs `external_reviews_worker_url`, `external_reviews_worker_secret`

### 4 × **SECURITY DEFINER function executable by `anon`** — runs as owner, bypasses RLS, reachable at `POST /rest/v1/rpc/<name>` with the publishable key. Some legitimately serve public pages; each needs a judgement. Remember `REVOKE ... FROM anon` is a NO-OP — revoke from **PUBLIC**.

- `check_feature_permission`
- `fetch_platform_commission_saved`
- `get_listing_policy_summary`
- `product_units_sold`

### 1 × SECURITY INVOKER trigger writing to a DIFFERENT RLS table — if the target's policy excludes the user who fired the trigger, the write matches **zero rows and says nothing** (this is the `view_count` bug). VERIFY each hit: it is safe if every writer reaches it through a SECURITY DEFINER function.

- `tr_help_article_feedback_counters` on `help_article_feedback` → writes `help_articles`


## Cron jobs

| job | schedule | active | Vault-gated |
|---|---|---|---|
| `affiliate-clawback-backstop` | `23 2 * * *` | yes | — |
| `alert-missing-policies` | `0 10 * * *` | yes | — |
| `alert-pending-refunds` | `0 9 * * *` | yes | — |
| `apply-subscription-changes` | `0 * * * *` | yes | — |
| `auto-archive-dead-enquiries` | `30 2 * * *` | yes | — |
| `broadcast-fanout` | `* * * * *` | yes | yes |
| `cancel-unresponded-requests` | `0 * * * *` | yes | — |
| `clean-expired-invites` | `0 2 * * *` | yes | — |
| `clean-search-logs` | `0 1 * * *` | yes | — |
| `clear-affiliate-commissions` | `7 * * * *` | yes | — |
| `deactivate-expired-broadcasts` | `15 * * * *` | yes | — |
| `drain-checkin-reminders` | `10 * * * *` | yes | yes |
| `drain-digest-queue` | `5 * * * *` | yes | yes |
| `drain-email-queue` | `* * * * *` | yes | yes |
| `drain-looking-for-notifications` | `20 * * * *` | yes | yes |
| `drain-push-queue` | `* * * * *` | yes | yes |
| `drain-review-requests` | `* * * * *` | yes | yes |
| `expire-eft-bookings` | `0 * * * *` | yes | — |
| `expire-host-overrides` | `0 * * * *` | yes | — |
| `expire-pending-bookings` | `*/5 * * * *` | yes | — |
| `expire-quotes` | `5 * * * *` | yes | — |
| `expire-specials` | `15 2 * * *` | yes | — |
| `looking_for_auto_expire` | `0 * * * *` | yes | — |
| `looking_for_expiry_notify` | `0 10 * * *` | yes | — |
| `looking_for_region_digest` | `0 9 * * *` | yes | — |
| `poll-website-domains` | `*/2 * * * *` | yes | yes |
| `publish-scheduled-posts` | `*/5 * * * *` | yes | yes |
| `queue-review-requests` | `0 9 * * *` | yes | — |
| `recalculate-rankings` | `*/15 * * * *` | yes | — |
| `restrict-overdue-subscriptions` | `0 * * * *` | yes | — |
| `scheduled-reports-hourly` | `0 * * * *` | yes | — |
| `send-access-cards` | `*/15 * * * *` | yes | — |
| `subscription-expiry-warnings` | `0 8 * * *` | yes | — |
| `sync-external-reviews` | `0 3 * * *` | yes | yes |
| `sync-ical-feeds` | `*/15 * * * *` | yes | yes |
| `update-response-rates` | `0 3 * * *` | yes | — |

## Functions

`SD` = SECURITY DEFINER. A denormalised counter written by a trigger across an ownership
boundary **must** be SD, or RLS silently drops the write (see `sync_looking_for_view_count`).

| function | SD | search_path pinned | kind |
|---|---|---|---|
| `_access_line` | — | — | callable |
| `_can_read_host` | — | — | callable |
| `_host_guest_rows` | **yes** | **NO** | callable |
| `_materialize_booking_party` | **yes** | **NO** | callable |
| `_trg_materialize_booking_party` | — | — | trigger |
| `accrue_affiliate_commission` | **yes** | yes | callable |
| `affiliate_tier_bonus` | **yes** | yes | callable |
| `app_purge_user_account` | **yes** | yes | callable |
| `apply_booking_vat` | **yes** | yes | trigger |
| `apply_due_subscription_changes` | **yes** | yes | callable |
| `apply_wielo_credit` | **yes** | yes | callable |
| `assign_receipt_number` | **yes** | **NO** | trigger |
| `assign_refund_number` | **yes** | **NO** | trigger |
| `block_special_dates` | **yes** | **NO** | callable |
| `booking_business_id` | **yes** | **NO** | callable |
| `broadcast_audience` | **yes** | **NO** | callable |
| `business_doc_code` | **yes** | **NO** | callable |
| `calculate_booking_price` | **yes** | **NO** | callable |
| `calculate_looking_for_match_score` | **yes** | yes | callable |
| `calculate_policy_refund_amount` | **yes** | **NO** | callable |
| `can_send_broadcast` | **yes** | **NO** | callable |
| `check_feature_permission` | **yes** | **NO** | callable |
| `check_host_availability_for_dates` | **yes** | yes | callable |
| `check_host_quote_quota` | **yes** | **NO** | callable |
| `claim_email_queue_batch` | **yes** | yes | callable |
| `claim_push_queue_batch` | **yes** | yes | callable |
| `clawback_affiliate_commission` | **yes** | yes | callable |
| `clawback_affiliate_commission` | **yes** | yes | callable |
| `clear_all` | **yes** | yes | callable |
| `compute_addon_subtotal` | — | — | callable |
| `count_broadcast_recipients` | **yes** | **NO** | callable |
| `create_affiliate_payout` | **yes** | yes | callable |
| `effective_vat_rate` | **yes** | yes | callable |
| `emit_affiliate_commission_ledger` | **yes** | yes | trigger |
| `emit_affiliate_payout_ledger` | **yes** | yes | trigger |
| `enforce_listing_requires_bank` | **yes** | yes | trigger |
| `enforce_one_active_membership` | — | — | trigger |
| `enqueue_in_app_notification` | **yes** | yes | callable |
| `ensure_booking_invoice` | **yes** | **NO** | callable |
| `ensure_host_booking_terms` | **yes** | **NO** | callable |
| `ensure_host_default_policies` | **yes** | **NO** | callable |
| `ensure_host_legal_presets` | **yes** | **NO** | callable |
| `ensure_host_policy_presets` | **yes** | **NO** | callable |
| `ensure_listing_policy_assignments` | **yes** | **NO** | callable |
| `expire_specials` | **yes** | **NO** | callable |
| `fetch_channel_mix` | **yes** | yes | callable |
| `fetch_conversion_funnel` | **yes** | yes | callable |
| `fetch_guest_demographics` | **yes** | yes | callable |
| `fetch_guest_record` | **yes** | **NO** | callable |
| `fetch_host_guests` | **yes** | **NO** | callable |
| `fetch_host_guests_summary` | **yes** | **NO** | callable |
| `fetch_host_savings` | **yes** | yes | callable |
| `fetch_looking_for_stats` | **yes** | yes | callable |
| `fetch_platform_commission_saved` | **yes** | yes | callable |
| `fetch_popular_rooms` | **yes** | yes | callable |
| `fetch_primary_kpis` | **yes** | yes | callable |
| `fetch_property_performance` | **yes** | yes | callable |
| `fetch_refunds_cancellations` | **yes** | yes | callable |
| `fetch_regional_breakdown` | **yes** | yes | callable |
| `fetch_revenue_trend` | **yes** | yes | callable |
| `fetch_seasonality_heatmap` | **yes** | yes | callable |
| `fetch_secondary_metrics` | **yes** | yes | callable |
| `fetch_time_to_book` | **yes** | yes | callable |
| `forbid_forfeit_statement_mutation` | — | — | trigger |
| `forbid_policy_snapshot_mutation` | — | — | trigger |
| `forbid_second_active_membership` | — | — | trigger |
| `gen_booking_reference` | **yes** | **NO** | trigger |
| `gen_refund_reference` | **yes** | **NO** | trigger |
| `gen_url_token` | — | — | callable |
| `generate_host_handle` | — | — | trigger |
| `generate_listing_slug` | — | — | trigger |
| `generate_policy_plain_text` | — | — | trigger |
| `get_host_inbox_stats` | **yes** | **NO** | callable |
| `get_host_refund_stats` | **yes** | **NO** | callable |
| `get_listing_availability` | **yes** | **NO** | callable |
| `get_listing_policy_summary` | **yes** | **NO** | callable |
| `get_min_nights_for_stay` | **yes** | **NO** | callable |
| `get_my_host_id` | **yes** | **NO** | callable |
| `get_my_host_id_as_staff` | **yes** | **NO** | callable |
| `get_my_role` | **yes** | **NO** | callable |
| `get_special_booking_conflict` | — | — | callable |
| `guest_gkey_for_email` | — | — | callable |
| `handle_new_user` | **yes** | **NO** | trigger |
| `has_admin_permission` | **yes** | **NO** | callable |
| `import_ical_blocks` | **yes** | yes | callable |
| `increment_help_article_view` | **yes** | **NO** | callable |
| `is_period_closed` | **yes** | yes | callable |
| `is_super_admin` | **yes** | **NO** | callable |
| `listing_doc_code` | **yes** | **NO** | callable |
| `listing_is_available_whole` | — | — | callable |
| `log_refund_status_change` | **yes** | **NO** | trigger |
| `log_subscription_event` | **yes** | yes | callable |
| `mark_delivery_read` | **yes** | yes | callable |
| `materialize_booking_party` | **yes** | **NO** | callable |
| `mint_wielo_credit_note_on_ledger_complete` | **yes** | yes | trigger |
| `mint_wielo_invoice_on_ledger_complete` | **yes** | **NO** | trigger |
| `next_credit_note_number` | **yes** | **NO** | callable |
| `next_forfeit_number` | **yes** | **NO** | callable |
| `next_invoice_number` | **yes** | **NO** | callable |
| `next_quote_number` | **yes** | **NO** | callable |
| `next_receipt_number` | **yes** | **NO** | callable |
| `next_refund_number` | **yes** | **NO** | callable |
| `on_booking_cancelled` | **yes** | **NO** | trigger |
| `on_booking_confirmed` | **yes** | **NO** | trigger |
| `on_booking_confirmed_create_invoice` | **yes** | **NO** | trigger |
| `on_host_created_default_business` | **yes** | **NO** | trigger |
| `on_message_inserted` | **yes** | **NO** | trigger |
| `on_payment_completed_mark_invoice_paid` | **yes** | **NO** | trigger |
| `on_quote_booking_confirmed` | **yes** | yes | trigger |
| `on_quote_status_change` | **yes** | **NO** | trigger |
| `on_review_published` | **yes** | **NO** | trigger |
| `on_special_status_change` | **yes** | **NO** | trigger |
| `on_subscription_change` | **yes** | yes | trigger |
| `on_subscription_insert` | **yes** | yes | trigger |
| `product_units_sold` | **yes** | yes | callable |
| `protect_review_content` | — | — | trigger |
| `recalculate_listing_ranking` | **yes** | **NO** | callable |
| `record_guest_post` | **yes** | yes | callable |
| `redeem_coupon` | **yes** | **NO** | callable |
| `redeem_platform_coupon` | **yes** | yes | callable |
| `redeem_special` | **yes** | **NO** | callable |
| `refund_lf_quote_credit_on_expire` | **yes** | yes | trigger |
| `release_addon_stock` | **yes** | **NO** | callable |
| `release_booking_addon_stock` | **yes** | **NO** | callable |
| `release_special` | **yes** | **NO** | callable |
| `release_special_dates` | — | — | callable |
| `reserve_addon_stock` | **yes** | **NO** | callable |
| `resolve_listing_policy_id` | **yes** | **NO** | callable |
| `resolve_notification_prefs` | **yes** | yes | callable |
| `room_is_available` | — | — | callable |
| `seed_host_policies_on_create` | **yes** | **NO** | trigger |
| `send_due_access_cards` | **yes** | yes | callable |
| `set_affiliate_status` | **yes** | yes | callable |
| `set_guest_credit_business` | — | — | trigger |
| `set_listing_default_business` | **yes** | **NO** | trigger |
| `set_looking_for_post_expiry` | — | — | trigger |
| `set_updated_at` | — | — | trigger |
| `settle_affiliate_payout` | **yes** | yes | callable |
| `snapshot_booking_policies` | **yes** | **NO** | callable |
| `special_dates_available` | — | — | callable |
| `sync_booking_refund_flag` | **yes** | **NO** | trigger |
| `sync_help_article_feedback_counters` | — | — | trigger |
| `sync_listing_location` | — | — | trigger |
| `sync_listing_policy_label` | **yes** | **NO** | trigger |
| `sync_looking_for_quote_count` | **yes** | yes | trigger |
| `sync_looking_for_view_count` | **yes** | yes | trigger |
| `sync_review_helpful_count` | **yes** | **NO** | trigger |
| `tg_affiliate_clawback_on_refund` | **yes** | yes | trigger |
| `tg_notify_affiliate_commission_earned` | **yes** | yes | trigger |
| `touch_addons_updated_at` | — | — | trigger |
| `touch_coupons_updated_at` | — | — | trigger |
| `touch_listing_rooms_updated_at` | — | — | trigger |
| `touch_platform_coupons_updated_at` | — | — | trigger |
| `touch_seasonal_pricing_updated_at` | — | — | trigger |
| `touch_wielo_credit_wallet` | — | — | trigger |
| `update_payment_refunded_amount` | **yes** | **NO** | trigger |
| `update_updated_at` | — | — | trigger |
| `version_policy_on_update` | — | — | trigger |
| `vote_help_article` | **yes** | **NO** | callable |

## Tables

### `accounting_periods`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `period_month` | date | — | — |
| `closed_by` | uuid | yes | — |
| `closed_at` | timestamp with time zone | — | `now()` |
| `note` | text | yes | — |

**Foreign keys:**
- `FOREIGN KEY (closed_by) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (host_id, period_month)`

**RLS policies:**
- `admin_read_periods` (SELECT) — `USING is_super_admin()`
- `host_read_own_periods` (SELECT) — `USING ((host_id = get_my_host_id()) OR (host_id = get_my_host_id_as_staff()))`

### `addons`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `name` | text | — | — |
| `description` | text | yes | — |
| `image_path` | text | yes | — |
| `pricing_model` | text | — | — |
| `unit_price` | numeric | — | — |
| `currency` | text | — | `'ZAR'::text` |
| `min_quantity` | integer | — | `1` |
| `max_quantity` | integer | yes | — |
| `is_required` | boolean | — | `false` |
| `is_active` | boolean | — | `true` |
| `lead_time_days` | integer | — | `0` |
| `sort_order` | integer | — | `0` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `category` | text | yes | — |
| `vat_included` | boolean | — | `false` |
| `daily_capacity` | integer | yes | — |
| `allow_custom_quantity` | boolean | — | `true` |
| `stock_quantity` | integer | yes | — |
| `is_refundable` | boolean | — | `true` |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`

**Checks:**
- `CHECK (((char_length(name) >= 1) AND (char_length(name) <= 120)))`
- `CHECK (((category IS NULL) OR (category = ANY (ARRAY['food_drink'::text, 'comfort'::text, 'experiences'::text, 'transport'::text, 'romance'::text, 'flexibility'::text]))))`
- `CHECK (((max_quantity IS NULL) OR (max_quantity >= min_quantity)))`
- `CHECK (((daily_capacity IS NULL) OR (daily_capacity >= 0)))`
- `CHECK ((lead_time_days >= 0))`
- `CHECK ((min_quantity >= 0))`
- `CHECK ((pricing_model = ANY (ARRAY['per_stay'::text, 'per_night'::text, 'per_guest'::text, 'per_guest_per_night'::text, 'per_couple'::text])))`
- `CHECK (((stock_quantity IS NULL) OR (stock_quantity >= 0)))`
- `CHECK ((unit_price >= (0)::numeric))`

**Triggers:**
- `trigger_addons_touch` → `touch_addons_updated_at()`

**RLS policies:**
- `admin_full_addons` (ALL) — `USING is_super_admin()`
- `host_manage_own_addons` (ALL) — `USING (host_id = get_my_host_id())`
- `public_read_active_addons` (SELECT) — `USING (is_active = true)`
- `staff_read_addons` (SELECT) — `USING (host_id = get_my_host_id_as_staff())`

### `admin_audit_log`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `admin_id` | uuid | — | — |
| `impersonating` | uuid | yes | — |
| `action` | text | — | — |
| `target_type` | text | — | — |
| `target_id` | uuid | yes | — |
| `payload` | jsonb | yes | — |
| `ip_address` | inet | yes | — |
| `user_agent` | text | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (admin_id) REFERENCES user_profiles(id) ON DELETE RESTRICT`
- `FOREIGN KEY (impersonating) REFERENCES user_profiles(id) ON DELETE SET NULL`

**Checks:**
- `CHECK ((target_type = ANY (ARRAY['host'::text, 'guest'::text, 'user'::text, 'booking'::text, 'listing'::text, 'business'::text, 'addon'::text, 'policy'::text, 'review'::text, 'subscription'::text, 'plan'::text, 'plan_feature'::text, 'platform_service'::text, 'product'::text, 'product_feature'::text, 'platform_ledger'::text, 'platform_coupon'::text, 'feature_override'::text, 'platform_setting'::text, 'platform_staff'::text, 'staff_member'::text, 'impersonation'::text, 'permission_denied'::text, 'help_article'::text, 'help_video'::text, 'help_faq'::text, 'help_category'::text, 'help_status'::text, 'help_settings'::text, 'help_article_suggestion'::text, 'broadcast'::text, 'notification_send'::text, 'listing_category'::text, 'amenity_group'::text, 'amenity_catalog'::text, 'special_category'::text, 'affiliate'::text, 'affiliate_payout'::text, 'affiliate_settings'::text, 'marketing_asset'::text, 'looking_for_requirement_group'::text, 'looking_for_requirement_option'::text])))`

**RLS policies:**
- `admin_read_audit` (SELECT) — `USING is_super_admin()`

### `admin_message_batches`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `created_by` | uuid | — | — |
| `title` | text | — | — |
| `body` | text | — | — |
| `link_url` | text | yes | — |
| `link_label` | text | yes | — |
| `severity` | text | — | `'default'::text` |
| `channels` | jsonb | — | `'["in_app"]'::jsonb` |
| `recipient_ids` | uuid[] | — | — |
| `recipient_count` | integer | yes | `COALESCE(array_length(recipient_ids, 1), 0)` |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE RESTRICT`

**Checks:**
- `CHECK ((severity = ANY (ARRAY['info'::text, 'default'::text, 'high'::text])))`

**RLS policies:**
- `admin_message_batches_admin_select` (SELECT) — `USING (is_super_admin() OR has_admin_permission('notifications.view_history'::text))`

### `admin_notifications`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `category` | text | — | — |
| `kind` | text | — | — |
| `title` | text | — | — |
| `body` | text | yes | — |
| `user_id` | uuid | yes | — |
| `host_id` | uuid | yes | — |
| `ledger_id` | uuid | yes | — |
| `order_id` | uuid | yes | — |
| `href` | text | yes | — |
| `is_read` | boolean | — | `false` |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE SET NULL`
- `FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE SET NULL`

**Checks:**
- `CHECK ((category = ANY (ARRAY['finance'::text, 'support'::text])))`

**RLS policies:**
- `admin_notifs_staff_read` (SELECT) — `USING (EXISTS ( SELECT 1
   FROM platform_staff ps
  WHERE ((ps.user_id = auth.uid()) AND ps.is_active)))`
- `admin_notifs_staff_update` (UPDATE) — `USING (EXISTS ( SELECT 1
   FROM platform_staff ps
  WHERE ((ps.user_id = auth.uid()) AND ps.is_active)))`

### `admin_permissions`

| column | type | null | default |
|---|---|---|---|
| `key` | text | — | — |
| `domain` | text | — | — |
| `description` | text | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |

**RLS policies:**
- `admin_full_admin_permissions` (ALL) — `USING is_super_admin()`
- `staff_read_permission_catalog` (SELECT) — `USING has_admin_permission('audit.view'::text)`

### `admin_role_permissions`

| column | type | null | default |
|---|---|---|---|
| `role_id` | text | — | — |
| `permission_key` | text | — | — |
| `granted_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (permission_key) REFERENCES admin_permissions(key) ON DELETE CASCADE`
- `FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE CASCADE`

**RLS policies:**
- `admin_full_admin_role_permissions` (ALL) — `USING is_super_admin()`
- `staff_read_role_grants` (SELECT) — `USING has_admin_permission('audit.view'::text)`

### `admin_roles`

| column | type | null | default |
|---|---|---|---|
| `id` | text | — | — |
| `name` | text | — | — |
| `description` | text | yes | — |
| `is_system` | boolean | — | `false` |
| `created_at` | timestamp with time zone | — | `now()` |

**RLS policies:**
- `admin_full_admin_roles` (ALL) — `USING is_super_admin()`
- `staff_read_roles` (SELECT) — `USING has_admin_permission('audit.view'::text)`

### `admin_support_grants`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `host_user_id` | uuid | — | — |
| `requested_by` | uuid | yes | — |
| `reason` | text | yes | — |
| `status` | text | — | `'pending'::text` |
| `requested_at` | timestamp with time zone | — | `now()` |
| `decided_at` | timestamp with time zone | yes | — |
| `expires_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`
- `FOREIGN KEY (host_user_id) REFERENCES user_profiles(id) ON DELETE CASCADE`
- `FOREIGN KEY (requested_by) REFERENCES user_profiles(id) ON DELETE SET NULL`

**Checks:**
- `CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text, 'revoked'::text])))`

**RLS policies:**
- `support_grants_host_read` (SELECT) — `USING (host_user_id = auth.uid())`
- `support_grants_host_update` (UPDATE) — `USING (host_user_id = auth.uid())`

### `admin_user_notes`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `user_id` | uuid | — | — |
| `author_id` | uuid | yes | — |
| `body` | text | — | — |
| `is_pinned` | boolean | — | `false` |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (author_id) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE`

### `affiliate_accounts`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `user_id` | uuid | — | — |
| `slug` | text | — | — |
| `status` | text | — | `'active'::text` |
| `terms_version` | text | — | — |
| `accepted_at` | timestamp with time zone | — | `now()` |
| `payout_threshold` | numeric | yes | — |
| `currency` | text | — | `'ZAR'::text` |
| `default_payout_method` | text | yes | — |
| `suspended_at` | timestamp with time zone | yes | — |
| `suspended_by` | uuid | yes | — |
| `suspended_reason` | text | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (suspended_by) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (slug)`
- `UNIQUE (user_id)`

**Checks:**
- `CHECK ((default_payout_method = ANY (ARRAY['eft'::text, 'paystack'::text, 'paypal'::text])))`
- `CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text])))`

**RLS policies:**
- `affiliate_accounts_own_read` (SELECT) — `USING (user_id = auth.uid())`

### `affiliate_clicks`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `affiliate_id` | uuid | — | — |
| `slug` | text | — | — |
| `visitor_hash` | text | yes | — |
| `landing_path` | text | yes | — |
| `referer` | text | yes | — |
| `user_agent` | text | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (affiliate_id) REFERENCES affiliate_accounts(id) ON DELETE CASCADE`

**RLS policies:**
- `affiliate_clicks_own_read` (SELECT) — `USING (affiliate_id IN ( SELECT affiliate_accounts.id
   FROM affiliate_accounts
  WHERE (affiliate_accounts.user_id = auth.uid())))`

### `affiliate_commissions`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `affiliate_id` | uuid | — | — |
| `referral_id` | uuid | — | — |
| `referred_host_id` | uuid | yes | — |
| `product_id` | uuid | yes | — |
| `source_ledger_id` | uuid | — | — |
| `entry_type` | text | — | `'accrual'::text` |
| `kind` | text | — | `'subscription'::text` |
| `base_amount` | numeric | — | — |
| `rate_type` | text | — | — |
| `rate_value` | numeric | — | — |
| `commission_amount` | numeric | — | — |
| `currency` | text | — | `'ZAR'::text` |
| `status` | text | — | `'pending'::text` |
| `billing_period` | integer | yes | — |
| `hold_until` | timestamp with time zone | — | — |
| `cleared_at` | timestamp with time zone | yes | — |
| `voided_at` | timestamp with time zone | yes | — |
| `void_reason` | text | yes | — |
| `refund_ledger_id` | uuid | yes | — |
| `payout_id` | uuid | yes | — |
| `paid_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (affiliate_id) REFERENCES affiliate_accounts(id) ON DELETE RESTRICT`
- `FOREIGN KEY (payout_id) REFERENCES affiliate_payouts(id) ON DELETE SET NULL`
- `FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL`
- `FOREIGN KEY (referral_id) REFERENCES affiliate_referrals(id) ON DELETE RESTRICT`
- `FOREIGN KEY (referred_host_id) REFERENCES hosts(id) ON DELETE SET NULL`
- `FOREIGN KEY (refund_ledger_id) REFERENCES platform_ledger(id) ON DELETE SET NULL`
- `FOREIGN KEY (source_ledger_id) REFERENCES platform_ledger(id) ON DELETE RESTRICT`

**Checks:**
- `CHECK ((entry_type = ANY (ARRAY['accrual'::text, 'clawback'::text])))`
- `CHECK ((kind = ANY (ARRAY['subscription'::text, 'setup_fee'::text])))`
- `CHECK ((rate_type = ANY (ARRAY['amount'::text, 'percent'::text])))`
- `CHECK ((status = ANY (ARRAY['pending'::text, 'cleared'::text, 'voided'::text, 'paid'::text])))`

**Triggers:**
- `trg_emit_affiliate_commission_ledger` → `emit_affiliate_commission_ledger()` *(SECURITY DEFINER)*
- `trg_notify_affiliate_earned` → `tg_notify_affiliate_commission_earned()` *(SECURITY DEFINER)*

**RLS policies:**
- `affiliate_commissions_own_read` (SELECT) — `USING (affiliate_id IN ( SELECT affiliate_accounts.id
   FROM affiliate_accounts
  WHERE (affiliate_accounts.user_id = auth.uid())))`

### `affiliate_payout_fees`

| column | type | null | default |
|---|---|---|---|
| `method` | text | — | — |
| `fixed_fee` | numeric | — | `0` |
| `percent_fee` | numeric | — | `0` |
| `cap_fee` | numeric | yes | — |
| `currency` | text | — | `'ZAR'::text` |
| `updated_at` | timestamp with time zone | — | `now()` |

**Checks:**
- `CHECK ((method = ANY (ARRAY['eft'::text, 'paystack'::text, 'paypal'::text])))`

### `affiliate_payout_methods`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `affiliate_id` | uuid | — | — |
| `method` | text | — | — |
| `is_default` | boolean | — | `false` |
| `bank_name` | text | yes | — |
| `account_name` | text | yes | — |
| `account_number` | text | yes | — |
| `branch_code` | text | yes | — |
| `paystack_recipient_code` | text | yes | — |
| `paypal_email` | text | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (affiliate_id) REFERENCES affiliate_accounts(id) ON DELETE CASCADE`

**Checks:**
- `CHECK ((method = ANY (ARRAY['eft'::text, 'paystack'::text, 'paypal'::text])))`

**RLS policies:**
- `affiliate_payout_methods_own_all` (ALL) — `USING (affiliate_id IN ( SELECT affiliate_accounts.id
   FROM affiliate_accounts
  WHERE (affiliate_accounts.user_id = auth.uid()))) CHECK (affiliate_id IN ( SELECT affiliate_accounts.id
   FROM affiliate_accounts
  WHERE (affiliate_accounts.user_id = auth.uid())))`

### `affiliate_payouts`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `affiliate_id` | uuid | — | — |
| `method` | text | — | — |
| `status` | text | — | `'requested'::text` |
| `gross_amount` | numeric | — | — |
| `fee_amount` | numeric | — | `0` |
| `net_amount` | numeric | — | — |
| `currency` | text | — | `'ZAR'::text` |
| `fee_config_snapshot` | jsonb | yes | — |
| `destination_snapshot` | jsonb | yes | — |
| `provider` | text | yes | — |
| `provider_reference` | text | yes | — |
| `requested_at` | timestamp with time zone | — | `now()` |
| `processed_by` | uuid | yes | — |
| `processed_at` | timestamp with time zone | yes | — |
| `failure_reason` | text | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (affiliate_id) REFERENCES affiliate_accounts(id) ON DELETE RESTRICT`
- `FOREIGN KEY (processed_by) REFERENCES user_profiles(id) ON DELETE SET NULL`

**Unique:**
- `UNIQUE (provider_reference)`

**Checks:**
- `CHECK ((method = ANY (ARRAY['eft'::text, 'paystack'::text, 'paypal'::text])))`
- `CHECK ((status = ANY (ARRAY['requested'::text, 'approved'::text, 'processing'::text, 'paid'::text, 'failed'::text, 'rejected'::text])))`

**Triggers:**
- `trg_emit_affiliate_payout_ledger` → `emit_affiliate_payout_ledger()` *(SECURITY DEFINER)*

**RLS policies:**
- `affiliate_payouts_own_read` (SELECT) — `USING (affiliate_id IN ( SELECT affiliate_accounts.id
   FROM affiliate_accounts
  WHERE (affiliate_accounts.user_id = auth.uid())))`

### `affiliate_referrals`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `affiliate_id` | uuid | — | — |
| `referred_user_id` | uuid | — | — |
| `referred_host_id` | uuid | yes | — |
| `source` | text | yes | — |
| `click_id` | uuid | yes | — |
| `bound_at` | timestamp with time zone | — | `now()` |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (affiliate_id) REFERENCES affiliate_accounts(id) ON DELETE RESTRICT`
- `FOREIGN KEY (click_id) REFERENCES affiliate_clicks(id) ON DELETE SET NULL`
- `FOREIGN KEY (referred_host_id) REFERENCES hosts(id) ON DELETE SET NULL`
- `FOREIGN KEY (referred_user_id) REFERENCES user_profiles(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (referred_user_id)`

**RLS policies:**
- `affiliate_referrals_own_read` (SELECT) — `USING (affiliate_id IN ( SELECT affiliate_accounts.id
   FROM affiliate_accounts
  WHERE (affiliate_accounts.user_id = auth.uid())))`

### `affiliate_settings`

| column | type | null | default |
|---|---|---|---|
| `id` | boolean | — | `true` |
| `cookie_days` | integer | — | `30` |
| `hold_days` | integer | — | `30` |
| `min_payout_threshold` | numeric | — | `250` |
| `currency` | text | — | `'ZAR'::text` |
| `terms_version` | text | — | `'v1'::text` |
| `self_referral_blocked` | boolean | — | `true` |
| `attribution_model` | text | — | `'last_click'::text` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `terms_content` | text | yes | — |

**Checks:**
- `CHECK ((attribution_model = ANY (ARRAY['first_click'::text, 'last_click'::text])))`
- `CHECK (id)`

### `affiliate_tiers`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `name` | text | — | — |
| `min_lifetime_earnings` | numeric | — | `0` |
| `bonus_percent` | numeric | — | `0` |
| `sort_order` | integer | — | `0` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |

**Checks:**
- `CHECK ((bonus_percent >= (0)::numeric))`
- `CHECK ((min_lifetime_earnings >= (0)::numeric))`

**RLS policies:**
- `affiliate_tiers_read` (SELECT) — `USING (auth.role() = 'authenticated'::text)`

### `amenity_catalog`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `group_id` | uuid | — | — |
| `slug` | text | — | — |
| `label` | text | — | — |
| `icon` | text | — | `'check-circle-2'::text` |
| `sort_order` | integer | — | `100` |
| `is_published` | boolean | — | `true` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |

**Foreign keys:**
- `FOREIGN KEY (group_id) REFERENCES amenity_groups(id) ON DELETE RESTRICT`

**Triggers:**
- `set_amenity_catalog_updated_at` → `update_updated_at()`

**RLS policies:**
- `admin_full_amenity_catalog` (ALL) — `USING (is_super_admin() OR has_admin_permission('taxonomy.manage'::text))`
- `public_read_amenity_catalog` (SELECT) — `USING ((is_published = true) AND (deleted_at IS NULL))`

### `amenity_groups`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `slug` | text | — | — |
| `label` | text | — | — |
| `icon` | text | — | `'sparkles'::text` |
| `sort_order` | integer | — | `100` |
| `is_published` | boolean | — | `true` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |

**Triggers:**
- `set_amenity_groups_updated_at` → `update_updated_at()`

**RLS policies:**
- `admin_full_amenity_groups` (ALL) — `USING (is_super_admin() OR has_admin_permission('taxonomy.manage'::text))`
- `public_read_amenity_groups` (SELECT) — `USING ((is_published = true) AND (deleted_at IS NULL))`

### `blocked_dates`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `property_id` | uuid | — | — |
| `date` | date | — | — |
| `reason` | text | yes | — |
| `booking_id` | uuid | yes | — |
| `created_by` | uuid | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `room_id` | uuid | yes | — |
| `quote_id` | uuid | yes | — |
| `source` | text | — | `'manual'::text` |
| `ical_feed_id` | uuid | yes | — |
| `special_id` | uuid | yes | — |

**Foreign keys:**
- `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL`
- `FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (ical_feed_id) REFERENCES ical_feeds(id) ON DELETE SET NULL`
- `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`
- `FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE`
- `FOREIGN KEY (room_id) REFERENCES property_rooms(id) ON DELETE CASCADE`
- `FOREIGN KEY (special_id) REFERENCES specials(id) ON DELETE CASCADE`

**Checks:**
- `CHECK ((source = ANY (ARRAY['manual'::text, 'booking'::text, 'ical'::text, 'quote_hold'::text, 'special'::text])))`

**RLS policies:**
- `admin_full_blocked` (ALL) — `USING is_super_admin()`
- `host_manage_blocked` (ALL) — `USING (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.host_id = get_my_host_id())))`
- `public_read_blocked` (SELECT) — `USING (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.is_published = true)))`
- `staff_manage_blocked` (ALL) — `USING (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.host_id = get_my_host_id_as_staff())))`

### `booking_addons`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `booking_id` | uuid | — | — |
| `label` | text | — | — |
| `quantity` | numeric | — | `1` |
| `unit_price` | numeric | — | — |
| `sort_order` | integer | — | `0` |
| `created_at` | timestamp with time zone | — | `now()` |
| `addon_id` | uuid | yes | — |
| `pricing_model` | text | yes | — |
| `currency` | text | — | `'ZAR'::text` |
| `is_required` | boolean | — | `false` |
| `subtotal` | numeric | — | `0` |
| `source` | text | — | `'quote'::text` |
| `invoice_id` | uuid | yes | — |
| `added_by` | uuid | yes | — |
| `created_at_tx` | timestamp with time zone | yes | — |

**Foreign keys:**
- `FOREIGN KEY (added_by) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (addon_id) REFERENCES addons(id) ON DELETE SET NULL`
- `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE`
- `FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL`

**Checks:**
- `CHECK (((char_length(label) >= 1) AND (char_length(label) <= 200)))`
- `CHECK ((pricing_model = ANY (ARRAY['per_stay'::text, 'per_night'::text, 'per_guest'::text, 'per_guest_per_night'::text, 'per_couple'::text])))`
- `CHECK ((source = ANY (ARRAY['quote'::text, 'host_added'::text, 'guest_added'::text])))`

**RLS policies:**
- `admin_full_booking_addons` (ALL) — `USING is_super_admin()`
- `guest_read_own_booking_addons` (SELECT) — `USING (booking_id IN ( SELECT bookings.id
   FROM bookings
  WHERE (bookings.guest_id = auth.uid())))`
- `host_manage_own_booking_addons` (ALL) — `USING (booking_id IN ( SELECT bookings.id
   FROM bookings
  WHERE (bookings.host_id = get_my_host_id())))`

### `booking_notes`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `booking_id` | uuid | — | — |
| `author_id` | uuid | — | — |
| `body` | text | — | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (author_id) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE`

**RLS policies:**
- `admin_full_booking_notes` (ALL) — `USING is_super_admin()`
- `host_manage_booking_notes` (ALL) — `USING (booking_id IN ( SELECT bookings.id
   FROM bookings
  WHERE (bookings.host_id = get_my_host_id())))`
- `staff_manage_booking_notes` (ALL) — `USING (booking_id IN ( SELECT bookings.id
   FROM bookings
  WHERE (bookings.host_id = get_my_host_id_as_staff())))`

### `booking_rooms`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `booking_id` | uuid | — | — |
| `room_id` | uuid | — | — |
| `base_amount` | numeric | — | — |
| `cleaning_fee` | numeric | — | `0` |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE`
- `FOREIGN KEY (room_id) REFERENCES property_rooms(id) ON DELETE RESTRICT`

**Unique:**
- `UNIQUE (booking_id, room_id)`

**RLS policies:**
- `admin_full_booking_rooms` (ALL) — `USING is_super_admin()`
- `guest_read_own_booking_rooms` (SELECT) — `USING (booking_id IN ( SELECT bookings.id
   FROM bookings
  WHERE (bookings.guest_id = auth.uid())))`
- `host_manage_own_booking_rooms` (ALL) — `USING (booking_id IN ( SELECT bookings.id
   FROM bookings
  WHERE (bookings.host_id = get_my_host_id())))`
- `host_read_own_booking_rooms` (SELECT) — `USING (booking_id IN ( SELECT bookings.id
   FROM bookings
  WHERE (bookings.host_id = get_my_host_id())))`

### `bookings`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `property_id` | uuid | — | — |
| `host_id` | uuid | — | — |
| `guest_id` | uuid | yes | — |
| `reference` | text | — | — |
| `status` | text | — | `'pending'::text` |
| `previous_status` | text | yes | — |
| `check_in` | date | yes | — |
| `check_out` | date | yes | — |
| `session_date` | timestamp with time zone | yes | — |
| `nights` | integer | yes | `
CASE
    WHEN ((check_in IS NOT NULL) AND (check_out IS NOT` |
| `guests_count` | integer | — | `1` |
| `guests_breakdown` | jsonb | yes | — |
| `base_amount` | numeric | — | — |
| `cleaning_fee` | numeric | — | `0` |
| `total_amount` | numeric | — | — |
| `currency` | text | — | `'ZAR'::text` |
| `payment_method` | text | yes | — |
| `payment_status` | text | — | `'pending'::text` |
| `eft_proof_url` | text | yes | — |
| `confirmed_at` | timestamp with time zone | yes | — |
| `declined_at` | timestamp with time zone | yes | — |
| `cancelled_at` | timestamp with time zone | yes | — |
| `checked_in_at` | timestamp with time zone | yes | — |
| `checked_out_at` | timestamp with time zone | yes | — |
| `cancellation_reason` | text | yes | — |
| `cancelled_by` | text | yes | — |
| `special_requests` | text | yes | — |
| `internal_notes` | text | yes | — |
| `actioned_by` | uuid | yes | — |
| `deleted_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `refund_total` | numeric | yes | `0` |
| `has_open_refund` | boolean | yes | `false` |
| `policy_acknowledged` | boolean | — | `false` |
| `policy_acknowledged_at` | timestamp with time zone | yes | — |
| `scope` | text | — | `'whole_listing'::text` |
| `origin` | text | — | `'guest_request'::text` |
| `host_payment_note` | text | yes | — |
| `guest_name` | text | yes | — |
| `guest_email` | text | yes | — |
| `guest_phone` | text | yes | — |
| `quote_id` | uuid | yes | — |
| `additional_guests` | jsonb | — | `'[]'::jsonb` |
| `discount_amount` | numeric | — | `0` |
| `price_breakdown` | jsonb | yes | — |
| `coupon_id` | uuid | yes | — |
| `coupon_discount` | numeric | — | `0` |
| `deposit_amount` | numeric | — | `0` |
| `balance_due` | numeric | — | `0` |
| `balance_due_date` | date | yes | — |
| `host_message` | text | yes | — |
| `access_card_sent_at` | timestamp with time zone | yes | — |
| `channel` | text | yes | `'direct'::text` |
| `vat_rate` | numeric | — | `0` |
| `vat_amount` | numeric | — | `0` |
| `pay_token` | text | — | `gen_url_token()` |
| `accepted_terms_version` | integer | yes | — |
| `accepted_privacy_version` | integer | yes | — |
| `special_id` | uuid | yes | — |
| `booked_via` | text | yes | — |
| `capi_purchase_sent_at` | timestamp with time zone | yes | — |

**Foreign keys:**
- `FOREIGN KEY (actioned_by) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL`
- `FOREIGN KEY (guest_id) REFERENCES user_profiles(id) ON DELETE RESTRICT`
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE RESTRICT`
- `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT`
- `FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL`
- `FOREIGN KEY (special_id) REFERENCES specials(id) ON DELETE SET NULL`

**Unique:**
- `UNIQUE (reference)`

**Checks:**
- `CHECK ((balance_due >= (0)::numeric))`
- `CHECK (((booked_via IS NULL) OR (booked_via = ANY (ARRAY['platform'::text, 'website'::text]))))`
- `CHECK ((cancelled_by = ANY (ARRAY['guest'::text, 'host'::text, 'admin'::text, 'system'::text])))`
- `CHECK ((channel = ANY (ARRAY['direct'::text, 'wielo'::text, 'website'::text, 'airbnb'::text, 'booking'::text, 'expedia'::text, 'other'::text])))`
- `CHECK ((deposit_amount >= (0)::numeric))`
- `CHECK (((guest_id IS NOT NULL) OR ((guest_name IS NOT NULL) AND (guest_email IS NOT NULL))))`
- `CHECK ((origin = ANY (ARRAY['guest_request'::text, 'host_manual'::text, 'quote_converted'::text, 'special_booked'::text])))`
- `CHECK ((payment_method = ANY (ARRAY['paystack'::text, 'paypal'::text, 'eft'::text])))`
- `CHECK ((payment_status = ANY (ARRAY['pending'::text, 'partial'::text, 'authorised'::text, 'completed'::text, 'failed'::text, 'refunded'::text, 'partially_refunded'::text, 'voided'::text, 'forfeited'::text])))`
- `CHECK ((scope = ANY (ARRAY['whole_listing'::text, 'rooms'::text])))`
- `CHECK ((status = ANY (ARRAY['pending'::text, 'pending_eft'::text, 'pending_eft_review'::text, 'confirmed'::text, 'checked_in'::text, 'completed'::text, 'cancelled_by_host'::text, 'cancelled_by_guest'::text, 'declined'::text, 'expired'::text, 'no_show'::text])))`

**Triggers:**
- `set_updated_at` → `update_updated_at()`
- `trg_apply_booking_vat` → `apply_booking_vat()` *(SECURITY DEFINER)*
- `trg_materialize_booking_party` → `_trg_materialize_booking_party()`
- `trigger_booking_cancelled` → `on_booking_cancelled()` *(SECURITY DEFINER)*
- `trigger_booking_confirmed` → `on_booking_confirmed()` *(SECURITY DEFINER)*
- `trigger_booking_confirmed_invoice` → `on_booking_confirmed_create_invoice()` *(SECURITY DEFINER)*
- `trigger_gen_booking_reference` → `gen_booking_reference()` *(SECURITY DEFINER)*
- `trigger_on_booking_cancelled` → `on_booking_cancelled()` *(SECURITY DEFINER)*
- `trigger_payment_completed_invoice_paid` → `on_payment_completed_mark_invoice_paid()` *(SECURITY DEFINER)*
- `trigger_quote_booking_confirmed` → `on_quote_booking_confirmed()` *(SECURITY DEFINER)*

**RLS policies:**
- `admin_full_bookings` (ALL) — `USING is_super_admin()`
- `guest_read_own_bookings` (SELECT) — `USING (guest_id = auth.uid())`
- `guest_update_own_bookings` (UPDATE) — `USING (guest_id = auth.uid()) CHECK (guest_id = auth.uid())`
- `host_manage_own_bookings` (ALL) — `USING (host_id = get_my_host_id())`
- `staff_read_bookings` (SELECT) — `USING (host_id = get_my_host_id_as_staff())`
- `staff_update_bookings` (UPDATE) — `USING (host_id = get_my_host_id_as_staff())`

### `broadcast_acknowledgements`

| column | type | null | default |
|---|---|---|---|
| `broadcast_id` | uuid | — | — |
| `user_id` | uuid | — | — |
| `dismissed_at` | timestamp with time zone | yes | — |
| `acknowledged_at` | timestamp with time zone | yes | — |
| `link_clicked_at` | timestamp with time zone | yes | — |

**Foreign keys:**
- `FOREIGN KEY (broadcast_id) REFERENCES broadcast_announcements(id) ON DELETE CASCADE`
- `FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE`

**RLS policies:**
- `broadcast_ack_admin_select` (SELECT) — `USING is_super_admin()`
- `broadcast_ack_owner_all` (ALL) — `USING (user_id = auth.uid()) CHECK (user_id = auth.uid())`

### `broadcast_announcements`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `created_by` | uuid | — | — |
| `severity` | text | — | — |
| `audience` | text | — | — |
| `title` | text | — | — |
| `body` | text | — | — |
| `link_url` | text | yes | — |
| `link_label` | text | yes | — |
| `requires_ack` | boolean | — | `false` |
| `starts_at` | timestamp with time zone | — | `now()` |
| `ends_at` | timestamp with time zone | yes | — |
| `cancelled_at` | timestamp with time zone | yes | — |
| `email_fanout_completed_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE RESTRICT`

**Checks:**
- `CHECK ((audience = ANY (ARRAY['all'::text, 'hosts'::text, 'guests'::text, 'staff'::text, 'super_admins'::text])))`
- `CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text])))`

**RLS policies:**
- `broadcast_admin_all` (ALL) — `USING is_super_admin() CHECK is_super_admin()`
- `broadcast_recipients_select` (SELECT) — `USING ((cancelled_at IS NULL) AND (starts_at <= now()) AND ((ends_at IS NULL) OR (ends_at > now())) AND ((audience = 'all'::text) OR ((audience = 'hosts'::text) AND (get_my_role() = 'host'::text)) OR ((audience = 'guests'::text) AND (get_my_role() = 'guest'::text)) OR ((audience = 'staff'::text) AND (get_my_role() = 'staff'::text)) OR ((audience = 'super_admins'::text) AND (get_my_role() = 'super_admin'::text))))`

### `business_counters`

| column | type | null | default |
|---|---|---|---|
| `business_id` | uuid | — | — |
| `last_quote_number` | integer | — | `0` |
| `last_invoice_number` | integer | — | `0` |
| `last_credit_note_number` | integer | — | `0` |
| `last_refund_number` | integer | — | `0` |
| `last_receipt_number` | integer | — | `0` |
| `updated_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE`

**RLS policies:**
- `business_counters_owner_read` (SELECT) — `USING (business_id IN ( SELECT b.id
   FROM (businesses b
     JOIN hosts h ON ((h.id = b.host_id)))
  WHERE (h.user_id = auth.uid())))`

### `businesses`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `legal_name` | text | yes | — |
| `trading_name` | text | yes | — |
| `vat_number` | text | yes | — |
| `company_registration_number` | text | yes | — |
| `address_line1` | text | yes | — |
| `address_line2` | text | yes | — |
| `city` | text | yes | — |
| `province` | text | yes | — |
| `postal_code` | text | yes | — |
| `country` | text | — | `'ZA'::text` |
| `latitude` | numeric | yes | — |
| `longitude` | numeric | yes | — |
| `logo_path` | text | yes | — |
| `default_currency` | text | — | `'ZAR'::text` |
| `default_language` | text | — | `'en'::text` |
| `is_default` | boolean | — | `false` |
| `is_archived` | boolean | — | `false` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `municipality` | text | yes | — |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`

**Triggers:**
- `set_updated_at_businesses` → `update_updated_at()`

**RLS policies:**
- `businesses_owner_all` (ALL) — `USING (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid()))) CHECK (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid())))`

### `conversation_notes`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `conversation_id` | uuid | — | — |
| `author_id` | uuid | yes | — |
| `body` | text | — | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (author_id) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE`

**RLS policies:**
- `conversation_notes_host_manage` (ALL) — `USING (conversation_id IN ( SELECT conversations.id
   FROM conversations
  WHERE (conversations.host_id IN ( SELECT hosts.id
           FROM hosts
          WHERE (hosts.user_id = auth.uid()))))) CHECK (conversation_id IN ( SELECT conversations.id
   FROM conversations
  WHERE (conversations.host_id IN ( SELECT hosts.id
           FROM hosts
          WHERE (hosts.user_id = auth.uid())))))`

### `conversations`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | yes | — |
| `guest_id` | uuid | — | — |
| `property_id` | uuid | yes | — |
| `booking_id` | uuid | yes | — |
| `status` | text | — | `'open'::text` |
| `is_enquiry` | boolean | — | `false` |
| `unread_host` | integer | — | `0` |
| `unread_guest` | integer | — | `0` |
| `last_message_at` | timestamp with time zone | yes | — |
| `last_message_preview` | text | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `pipeline_stage` | text | yes | — |
| `assigned_to` | uuid | yes | — |
| `follow_up_at` | timestamp with time zone | yes | — |
| `pinned` | boolean | — | `false` |
| `lost_reason` | text | yes | — |
| `host_last_seen_at` | timestamp with time zone | yes | — |
| `guest_last_seen_at` | timestamp with time zone | yes | — |
| `source` | text | yes | — |
| `channel` | text | — | `'guest'::text` |

**Foreign keys:**
- `FOREIGN KEY (assigned_to) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL`
- `FOREIGN KEY (guest_id) REFERENCES user_profiles(id) ON DELETE CASCADE`
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`
- `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL`

**Checks:**
- `CHECK ((channel = ANY (ARRAY['guest'::text, 'platform'::text])))`
- `CHECK ((pipeline_stage = ANY (ARRAY['new_quote'::text, 'quote_sent'::text, 'negotiating'::text, 'accepted'::text, 'declined'::text, 'lost'::text])))`
- `CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text, 'archived'::text])))`

**Triggers:**
- `set_updated_at` → `update_updated_at()`

**RLS policies:**
- `admin_full_conv` (ALL) — `USING is_super_admin()`
- `guest_manage_conv` (ALL) — `USING (guest_id = auth.uid())`
- `host_manage_conv` (ALL) — `USING (host_id = get_my_host_id())`
- `staff_manage_conv` (ALL) — `USING (host_id = get_my_host_id_as_staff())`

### `coupon_redemptions`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `coupon_id` | uuid | — | — |
| `booking_id` | uuid | — | — |
| `guest_id` | uuid | yes | — |
| `amount_discounted` | numeric | — | — |
| `currency` | text | — | `'ZAR'::text` |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE`
- `FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE`
- `FOREIGN KEY (guest_id) REFERENCES user_profiles(id) ON DELETE SET NULL`

**Unique:**
- `UNIQUE (coupon_id, booking_id)`

**RLS policies:**
- `admin_full_redemptions` (ALL) — `USING is_super_admin()`
- `host_read_own_redemptions` (SELECT) — `USING (coupon_id IN ( SELECT c.id
   FROM (coupons c
     JOIN hosts h ON ((h.id = c.host_id)))
  WHERE (h.user_id = auth.uid())))`

### `coupons`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `code` | text | — | — |
| `description` | text | yes | — |
| `discount_type` | text | — | `'percent'::text` |
| `discount_value` | numeric | — | — |
| `scope` | text | — | `'order'::text` |
| `property_id` | uuid | yes | — |
| `room_id` | uuid | yes | — |
| `currency` | text | — | `'ZAR'::text` |
| `min_nights` | integer | yes | — |
| `min_spend` | numeric | yes | — |
| `starts_at` | timestamp with time zone | yes | — |
| `ends_at` | timestamp with time zone | yes | — |
| `max_redemptions` | integer | yes | — |
| `per_guest_limit` | integer | yes | — |
| `redeemed_count` | integer | — | `0` |
| `is_active` | boolean | — | `true` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `addon_id` | uuid | yes | — |

**Foreign keys:**
- `FOREIGN KEY (addon_id) REFERENCES addons(id) ON DELETE CASCADE`
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`
- `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`
- `FOREIGN KEY (room_id) REFERENCES property_rooms(id) ON DELETE CASCADE`

**Checks:**
- `CHECK (((addon_id IS NULL) OR (scope = 'addons'::text)))`
- `CHECK (((starts_at IS NULL) OR (ends_at IS NULL) OR (ends_at >= starts_at)))`
- `CHECK (((discount_type <> 'percent'::text) OR ((discount_value > (0)::numeric) AND (discount_value <= (100)::numeric))))`
- `CHECK (((room_id IS NULL) OR (property_id IS NOT NULL)))`
- `CHECK ((discount_type = ANY (ARRAY['percent'::text, 'fixed'::text])))`
- `CHECK ((discount_value > (0)::numeric))`
- `CHECK (((max_redemptions IS NULL) OR (max_redemptions > 0)))`
- `CHECK (((min_nights IS NULL) OR (min_nights > 0)))`
- `CHECK (((min_spend IS NULL) OR (min_spend >= (0)::numeric)))`
- `CHECK (((per_guest_limit IS NULL) OR (per_guest_limit > 0)))`
- `CHECK ((scope = ANY (ARRAY['order'::text, 'accommodation'::text, 'addons'::text])))`

**Triggers:**
- `trigger_coupons_touch` → `touch_coupons_updated_at()`

**RLS policies:**
- `admin_full_coupons` (ALL) — `USING is_super_admin()`
- `host_manage_own_coupons` (ALL) — `USING (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid()))) CHECK (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid())))`

### `credit_notes`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `credit_note_number` | text | — | — |
| `invoice_id` | uuid | — | — |
| `booking_id` | uuid | — | — |
| `host_id` | uuid | — | — |
| `guest_id` | uuid | yes | — |
| `refund_request_id` | uuid | yes | — |
| `host_snapshot` | jsonb | — | — |
| `guest_snapshot` | jsonb | — | — |
| `line_items` | jsonb | — | `'[]'::jsonb` |
| `reason` | text | yes | — |
| `subtotal` | numeric | — | — |
| `vat_amount` | numeric | — | `0` |
| `total_amount` | numeric | — | — |
| `currency` | text | — | `'ZAR'::text` |
| `origin` | text | — | `'manual'::text` |
| `status` | text | — | `'issued'::text` |
| `issued_at` | timestamp with time zone | — | `now()` |
| `cancelled_at` | timestamp with time zone | yes | — |
| `pdf_storage_path` | text | yes | — |
| `hosted_token` | text | — | `gen_url_token()` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `voided_at` | timestamp with time zone | yes | — |
| `voided_by` | uuid | yes | — |
| `void_reason` | text | yes | — |

**Foreign keys:**
- `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT`
- `FOREIGN KEY (guest_id) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE RESTRICT`
- `FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT`
- `FOREIGN KEY (refund_request_id) REFERENCES refund_requests(id) ON DELETE SET NULL`
- `FOREIGN KEY (voided_by) REFERENCES user_profiles(id) ON DELETE SET NULL`

**Unique:**
- `UNIQUE (credit_note_number)`
- `UNIQUE (hosted_token)`

**Checks:**
- `CHECK ((origin = ANY (ARRAY['manual'::text, 'cancellation'::text, 'refund_auto'::text])))`
- `CHECK ((status = ANY (ARRAY['draft'::text, 'issued'::text, 'cancelled'::text])))`
- `CHECK ((total_amount >= (0)::numeric))`

**Triggers:**
- `set_updated_at` → `update_updated_at()`

**RLS policies:**
- `admin_full_credit_notes` (ALL) — `USING is_super_admin()`
- `guest_read_own_credit_notes` (SELECT) — `USING (guest_id = auth.uid())`
- `host_insert_own_credit_notes` (INSERT) — `CHECK (host_id = get_my_host_id())`
- `host_read_own_credit_notes` (SELECT) — `USING (host_id = get_my_host_id())`
- `host_update_own_credit_notes` (UPDATE) — `USING (host_id = get_my_host_id()) CHECK (host_id = get_my_host_id())`
- `staff_insert_credit_notes` (INSERT) — `CHECK (host_id = get_my_host_id_as_staff())`
- `staff_read_credit_notes` (SELECT) — `USING (host_id = get_my_host_id_as_staff())`

### `data_requests`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `user_id` | uuid | — | — |
| `request_type` | text | — | — |
| `status` | text | — | `'pending'::text` |
| `notes` | text | yes | — |
| `fulfilled_by` | uuid | yes | — |
| `fulfilled_at` | timestamp with time zone | yes | — |
| `rejected_reason` | text | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (fulfilled_by) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE`

**Checks:**
- `CHECK ((request_type = ANY (ARRAY['export'::text, 'deletion'::text])))`
- `CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'rejected'::text, 'cancelled'::text])))`

**Triggers:**
- `set_data_requests_updated_at` → `update_updated_at()`

**RLS policies:**
- `admin_full_data_requests` (ALL) — `USING is_super_admin()`
- `users_cancel_own_pending_data_request` (UPDATE) — `USING ((user_id = auth.uid()) AND (status = 'pending'::text)) CHECK ((user_id = auth.uid()) AND (status = ANY (ARRAY['pending'::text, 'cancelled'::text])))`
- `users_create_own_data_request` (INSERT) — `CHECK (user_id = auth.uid())`
- `users_read_own_data_request` (SELECT) — `USING (user_id = auth.uid())`

### `directory_search_logs`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `query` | text | yes | — |
| `filters` | jsonb | yes | — |
| `result_count` | integer | yes | — |
| `clicked_property` | uuid | yes | — |
| `session_id` | text | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (clicked_property) REFERENCES properties(id) ON DELETE SET NULL`

### `eft_banking_details`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `bank_name` | text | — | — |
| `account_holder` | text | — | — |
| `account_number` | text | — | — |
| `branch_code` | text | — | — |
| `swift_code` | text | yes | — |
| `reference_format` | text | — | `'{booking_ref}'::text` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `label` | text | — | `'Primary'::text` |
| `account_type` | text | — | `'cheque'::text` |
| `is_default` | boolean | — | `false` |
| `is_archived` | boolean | — | `false` |
| `business_id` | uuid | — | — |

**Foreign keys:**
- `FOREIGN KEY (business_id) REFERENCES businesses(id)`
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`

**Checks:**
- `CHECK ((account_type = ANY (ARRAY['cheque'::text, 'savings'::text, 'transmission'::text, 'business'::text])))`

**Triggers:**
- `set_updated_at` → `update_updated_at()`
- `set_updated_at_eft_banking` → `update_updated_at()`

**RLS policies:**
- `admin_full_eft` (ALL) — `USING is_super_admin()`
- `eft_banking_owner_all` (ALL) — `USING (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid()))) CHECK (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid())))`
- `host_manage_eft` (ALL) — `USING (host_id = get_my_host_id())`

### `external_review_sources`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `source` | text | — | — |
| `external_account_id` | text | — | — |
| `account_name` | text | yes | — |
| `account_url` | text | yes | — |
| `access_token` | text | yes | — |
| `refresh_token` | text | yes | — |
| `token_expires_at` | timestamp with time zone | yes | — |
| `api_key` | text | yes | — |
| `api_secret` | text | yes | — |
| `is_active` | boolean | — | `true` |
| `last_synced_at` | timestamp with time zone | yes | — |
| `last_sync_error` | text | yes | — |
| `sync_cursor` | text | yes | — |
| `deleted_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (host_id, source, external_account_id)`

**Checks:**
- `CHECK ((source = ANY (ARRAY['google'::text, 'facebook'::text, 'trustpilot'::text])))`

**Triggers:**
- `set_updated_at_external_review_sources` → `set_updated_at()`

**RLS policies:**
- `admin_full_external_review_sources` (ALL) — `USING is_super_admin()`
- `host_manage_external_review_sources` (ALL) — `USING (host_id = get_my_host_id())`

### `external_review_sync_log`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `source_id` | uuid | — | — |
| `sync_type` | text | — | — |
| `status` | text | — | — |
| `reviews_fetched` | integer | yes | `0` |
| `reviews_added` | integer | yes | `0` |
| `reviews_updated` | integer | yes | `0` |
| `error_message` | text | yes | — |
| `error_code` | text | yes | — |
| `started_at` | timestamp with time zone | — | `now()` |
| `completed_at` | timestamp with time zone | yes | — |

**Foreign keys:**
- `FOREIGN KEY (source_id) REFERENCES external_review_sources(id) ON DELETE CASCADE`

**Checks:**
- `CHECK ((status = ANY (ARRAY['started'::text, 'completed'::text, 'failed'::text])))`
- `CHECK ((sync_type = ANY (ARRAY['auto'::text, 'manual'::text])))`

**RLS policies:**
- `admin_read_external_review_sync_log` (SELECT) — `USING is_super_admin()`
- `host_read_external_review_sync_log` (SELECT) — `USING (source_id IN ( SELECT external_review_sources.id
   FROM external_review_sources
  WHERE (external_review_sources.host_id = get_my_host_id())))`

### `external_reviews`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `source_id` | uuid | — | — |
| `host_id` | uuid | — | — |
| `property_id` | uuid | yes | — |
| `external_review_id` | text | — | — |
| `external_reviewer_id` | text | yes | — |
| `reviewer_name` | text | yes | — |
| `reviewer_avatar_url` | text | yes | — |
| `rating` | integer | yes | — |
| `body` | text | yes | — |
| `review_url` | text | yes | — |
| `host_reply` | text | yes | — |
| `host_reply_at` | timestamp with time zone | yes | — |
| `reply_synced` | boolean | — | `false` |
| `reply_sync_error` | text | yes | — |
| `reviewed_at` | timestamp with time zone | — | — |
| `language` | text | yes | — |
| `is_visible` | boolean | — | `true` |
| `is_featured` | boolean | — | `false` |
| `deleted_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`
- `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL`
- `FOREIGN KEY (source_id) REFERENCES external_review_sources(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (source_id, external_review_id)`

**Checks:**
- `CHECK (((rating IS NULL) OR ((rating >= 1) AND (rating <= 5))))`

**Triggers:**
- `set_updated_at_external_reviews` → `set_updated_at()`

**RLS policies:**
- `admin_full_external_reviews` (ALL) — `USING is_super_admin()`
- `host_manage_external_reviews` (ALL) — `USING (host_id = get_my_host_id())`
- `public_read_visible_external_reviews` (SELECT) — `USING ((is_visible = true) AND (deleted_at IS NULL))`

### `featured_listings`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `property_id` | uuid | — | — |
| `featured_by` | uuid | — | — |
| `reason` | text | yes | — |
| `sort_order` | integer | — | `0` |
| `expires_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (featured_by) REFERENCES user_profiles(id) ON DELETE RESTRICT`
- `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (property_id)`

**RLS policies:**
- `admin_manage_featured` (ALL) — `USING is_super_admin()`
- `public_read_featured` (SELECT) — `USING true`

### `finance_audit_log`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `actor_id` | uuid | yes | — |
| `action` | text | — | — |
| `booking_id` | uuid | yes | — |
| `txn_id` | text | yes | — |
| `entity_type` | text | yes | — |
| `entity_id` | uuid | yes | — |
| `amount` | numeric | yes | — |
| `currency` | text | yes | — |
| `reason` | text | yes | — |
| `metadata` | jsonb | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (actor_id) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL`
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`

**RLS policies:**
- `admin_read_finance_audit` (SELECT) — `USING is_super_admin()`
- `host_read_own_finance_audit` (SELECT) — `USING ((host_id = get_my_host_id()) OR (host_id = get_my_host_id_as_staff()))`

### `forfeit_statements`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `statement_number` | text | — | — |
| `booking_id` | uuid | — | — |
| `host_id` | uuid | — | — |
| `guest_id` | uuid | yes | — |
| `invoice_id` | uuid | yes | — |
| `host_snapshot` | jsonb | — | — |
| `guest_snapshot` | jsonb | — | — |
| `currency` | text | — | `'ZAR'::text` |
| `booking_total` | numeric | — | — |
| `amount_paid` | numeric | — | — |
| `amount_forfeited` | numeric | — | — |
| `amount_refunded` | numeric | — | `0` |
| `amount_written_off` | numeric | — | — |
| `policy_applied` | text | yes | — |
| `reason` | text | yes | — |
| `hosted_token` | text | — | `gen_url_token()` |
| `pdf_storage_path` | text | yes | — |
| `created_by` | uuid | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT`
- `FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (guest_id) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE RESTRICT`
- `FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL`

**Unique:**
- `UNIQUE (hosted_token)`
- `UNIQUE (statement_number)`

**Triggers:**
- `trg_forfeit_statements_immutable` → `forbid_forfeit_statement_mutation()`

**RLS policies:**
- `admin_full_forfeit_statements` (ALL) — `USING is_super_admin()`
- `guest_read_own_forfeit_statements` (SELECT) — `USING (guest_id = auth.uid())`
- `host_insert_own_forfeit_statements` (INSERT) — `CHECK (host_id = get_my_host_id())`
- `host_read_own_forfeit_statements` (SELECT) — `USING (host_id = get_my_host_id())`
- `staff_insert_forfeit_statements` (INSERT) — `CHECK (host_id = get_my_host_id_as_staff())`
- `staff_read_forfeit_statements` (SELECT) — `USING (host_id = get_my_host_id_as_staff())`

### `form_drafts`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `user_id` | uuid | — | — |
| `entity_type` | text | — | — |
| `entity_id` | uuid | yes | — |
| `scope_id` | uuid | yes | — |
| `payload` | jsonb | — | — |
| `updated_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE NULLS NOT DISTINCT (user_id, entity_type, entity_id, scope_id)`

**RLS policies:**
- `form_drafts_owner_delete` (DELETE) — `USING (auth.uid() = user_id)`
- `form_drafts_owner_insert` (INSERT) — `CHECK (auth.uid() = user_id)`
- `form_drafts_owner_select` (SELECT) — `USING (auth.uid() = user_id)`
- `form_drafts_owner_update` (UPDATE) — `USING (auth.uid() = user_id) CHECK (auth.uid() = user_id)`

### `fx_rates`

| column | type | null | default |
|---|---|---|---|
| `base_currency` | text | — | — |
| `quote_currency` | text | — | — |
| `rate` | numeric(18,8) | — | — |
| `source` | text | — | `'auto'::text` |
| `is_manual_override` | boolean | — | `false` |
| `fetched_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |

**Checks:**
- `CHECK ((rate > (0)::numeric))`

**Triggers:**
- `set_updated_at_fx_rates` → `update_updated_at()`

**RLS policies:**
- `fx_rates_read` (SELECT) — `USING true`

### `guest_broadcasts`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `subject` | text | — | — |
| `body` | text | — | — |
| `audience` | text | — | — |
| `recipient_count` | integer | — | `0` |
| `status` | text | — | `'sent'::text` |
| `created_by` | uuid | yes | — |
| `sent_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`

**Checks:**
- `CHECK ((status = ANY (ARRAY['sent'::text, 'failed'::text])))`

**RLS policies:**
- `admin_read_guest_broadcasts` (SELECT) — `USING is_super_admin()`
- `host_read_guest_broadcasts` (SELECT) — `USING (host_id = get_my_host_id())`
- `staff_read_guest_broadcasts` (SELECT) — `USING (host_id = get_my_host_id_as_staff())`

### `guest_business_links`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `contact_id` | uuid | — | — |
| `business_id` | uuid | — | — |
| `source_booking_id` | uuid | yes | — |
| `first_linked_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE`
- `FOREIGN KEY (contact_id) REFERENCES host_contacts(id) ON DELETE CASCADE`
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`
- `FOREIGN KEY (source_booking_id) REFERENCES bookings(id) ON DELETE SET NULL`

**Unique:**
- `UNIQUE (contact_id, business_id)`

**RLS policies:**
- `gbl_owner_all` (ALL) — `USING (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid()))) CHECK (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid())))`

### `guest_credit_ledger`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `gkey` | text | — | — |
| `guest_id` | uuid | yes | — |
| `guest_email` | text | yes | — |
| `amount` | numeric | — | — |
| `currency` | text | — | `'ZAR'::text` |
| `reason` | text | — | — |
| `booking_id` | uuid | yes | — |
| `payment_id` | uuid | yes | — |
| `created_by` | uuid | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `business_id` | uuid | yes | — |

**Foreign keys:**
- `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL`
- `FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL`
- `FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (guest_id) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`
- `FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL`

**Triggers:**
- `trg_set_guest_credit_business` → `set_guest_credit_business()`

**RLS policies:**
- `admin_full_guest_credit` (ALL) — `USING is_super_admin()`
- `host_read_own_guest_credit` (SELECT) — `USING ((host_id = get_my_host_id()) OR (host_id = get_my_host_id_as_staff()))`

### `guest_marketing`

| column | type | null | default |
|---|---|---|---|
| `host_id` | uuid | — | — |
| `gkey` | text | — | — |
| `email` | text | — | — |
| `is_subscribed` | boolean | — | `true` |
| `unsub_token` | uuid | — | `gen_random_uuid()` |
| `source` | text | yes | — |
| `subscribed_at` | timestamp with time zone | — | `now()` |
| `unsubscribed_at` | timestamp with time zone | yes | — |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`

**RLS policies:**
- `admin_read_guest_marketing` (SELECT) — `USING is_super_admin()`
- `host_all_guest_marketing` (ALL) — `USING (host_id = get_my_host_id()) CHECK (host_id = get_my_host_id())`
- `staff_all_guest_marketing` (ALL) — `USING (host_id = get_my_host_id_as_staff()) CHECK (host_id = get_my_host_id_as_staff())`

### `guest_notes`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `gkey` | text | — | — |
| `author_id` | uuid | yes | — |
| `body` | text | — | — |
| `is_pinned` | boolean | — | `false` |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (author_id) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`

**RLS policies:**
- `admin_read_guest_notes` (SELECT) — `USING is_super_admin()`
- `host_all_guest_notes` (ALL) — `USING (host_id = get_my_host_id()) CHECK (host_id = get_my_host_id())`
- `staff_all_guest_notes` (ALL) — `USING (host_id = get_my_host_id_as_staff()) CHECK (host_id = get_my_host_id_as_staff())`

### `guest_ratings`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `guest_id` | uuid | — | — |
| `host_id` | uuid | — | — |
| `rating` | integer | — | — |
| `summary` | text | yes | — |
| `rating_payments` | integer | yes | — |
| `rating_communication` | integer | yes | — |
| `rating_cleanliness` | integer | yes | — |
| `rating_house_rules` | integer | yes | — |
| `rating_integrity` | integer | yes | — |
| `note_payments` | text | yes | — |
| `note_communication` | text | yes | — |
| `note_cleanliness` | text | yes | — |
| `note_house_rules` | text | yes | — |
| `note_integrity` | text | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (guest_id) REFERENCES user_profiles(id) ON DELETE CASCADE`
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (host_id, guest_id)`

**Checks:**
- `CHECK (((rating >= 1) AND (rating <= 5)))`
- `CHECK (((rating_cleanliness >= 1) AND (rating_cleanliness <= 5)))`
- `CHECK (((rating_communication >= 1) AND (rating_communication <= 5)))`
- `CHECK (((rating_house_rules >= 1) AND (rating_house_rules <= 5)))`
- `CHECK (((rating_integrity >= 1) AND (rating_integrity <= 5)))`
- `CHECK (((rating_payments >= 1) AND (rating_payments <= 5)))`

**Triggers:**
- `set_updated_at` → `update_updated_at()`

**RLS policies:**
- `admin_full_guest_ratings` (ALL) — `USING is_super_admin()`
- `host_delete_own_guest_rating` (DELETE) — `USING (host_id = get_my_host_id())`
- `host_insert_own_guest_rating` (INSERT) — `CHECK (host_id = get_my_host_id())`
- `host_read_all_guest_ratings` (SELECT) — `USING (EXISTS ( SELECT 1
   FROM hosts h
  WHERE ((h.user_id = auth.uid()) AND (h.deleted_at IS NULL))))`
- `host_update_own_guest_rating` (UPDATE) — `USING (host_id = get_my_host_id()) CHECK (host_id = get_my_host_id())`

### `guest_relationships`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `contact_id` | uuid | — | — |
| `related_contact_id` | uuid | — | — |
| `source_booking_id` | uuid | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (contact_id) REFERENCES host_contacts(id) ON DELETE CASCADE`
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`
- `FOREIGN KEY (related_contact_id) REFERENCES host_contacts(id) ON DELETE CASCADE`
- `FOREIGN KEY (source_booking_id) REFERENCES bookings(id) ON DELETE SET NULL`

**Unique:**
- `UNIQUE (host_id, contact_id, related_contact_id, source_booking_id)`

**Checks:**
- `CHECK ((contact_id <> related_contact_id))`

**RLS policies:**
- `guest_relationships_owner_all` (ALL) — `USING (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid()))) CHECK (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid())))`

### `help_article_feedback`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `article_id` | uuid | — | — |
| `user_id` | uuid | yes | — |
| `vote` | text | — | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (article_id) REFERENCES help_articles(id) ON DELETE CASCADE`
- `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL`

**Unique:**
- `UNIQUE (article_id, user_id)`

**Checks:**
- `CHECK ((vote = ANY (ARRAY['up'::text, 'down'::text])))`

**Triggers:**
- `tr_help_article_feedback_counters` → `sync_help_article_feedback_counters()`

**RLS policies:**
- `admin_full_help_feedback` (ALL) — `USING (is_super_admin() OR has_admin_permission('help.manage'::text))`
- `user_own_help_feedback_read` (SELECT) — `USING (user_id = auth.uid())`
- `user_own_help_feedback_update` (UPDATE) — `USING (user_id = auth.uid()) CHECK (user_id = auth.uid())`
- `user_own_help_feedback_write` (INSERT) — `CHECK (user_id = auth.uid())`

### `help_article_suggestions`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `user_id` | uuid | yes | — |
| `email` | text | yes | — |
| `message` | text | — | — |
| `status` | text | — | `'open'::text` |
| `resolved_at` | timestamp with time zone | yes | — |
| `resolved_by` | uuid | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (resolved_by) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL`

**Checks:**
- `CHECK ((status = ANY (ARRAY['open'::text, 'planned'::text, 'shipped'::text, 'dismissed'::text])))`

**RLS policies:**
- `admin_full_help_suggestions` (ALL) — `USING (is_super_admin() OR has_admin_permission('help.manage'::text))`
- `authed_insert_help_suggestions` (INSERT) — `CHECK (auth.uid() IS NOT NULL)`

### `help_articles`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `slug` | text | — | — |
| `title` | text | — | — |
| `excerpt` | text | — | `''::text` |
| `body_html` | text | — | `''::text` |
| `body_json` | jsonb | — | `'{}'::jsonb` |
| `category_id` | uuid | yes | — |
| `audience` | text | — | `'both'::text` |
| `status` | text | — | `'draft'::text` |
| `featured_rank` | smallint | yes | — |
| `read_time_minutes` | smallint | — | `4` |
| `view_count` | integer | — | `0` |
| `helpful_count` | integer | — | `0` |
| `not_helpful_count` | integer | — | `0` |
| `saved_count` | integer | — | `0` |
| `has_video` | boolean | — | `false` |
| `published_at` | timestamp with time zone | yes | — |
| `author_id` | uuid | yes | — |
| `last_editor_id` | uuid | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |
| `search_tsv` | tsvector | yes | `((setweight(to_tsvector('english'::regconfig, COALESCE(title` |

**Foreign keys:**
- `FOREIGN KEY (author_id) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (category_id) REFERENCES help_categories(id) ON DELETE SET NULL`
- `FOREIGN KEY (last_editor_id) REFERENCES user_profiles(id) ON DELETE SET NULL`

**Unique:**
- `UNIQUE (slug)`

**Checks:**
- `CHECK ((audience = ANY (ARRAY['host'::text, 'guest'::text, 'both'::text])))`
- `CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))`

**Triggers:**
- `set_help_articles_updated_at` → `update_updated_at()`

**RLS policies:**
- `admin_full_help_articles` (ALL) — `USING (is_super_admin() OR has_admin_permission('help.manage'::text))`
- `public_read_help_articles` (SELECT) — `USING ((status = 'published'::text) AND (deleted_at IS NULL))`

### `help_categories`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `slug` | text | — | — |
| `name` | text | — | — |
| `description` | text | yes | — |
| `icon` | text | — | `'book-open'::text` |
| `audience` | text | — | `'both'::text` |
| `sort_order` | integer | — | `100` |
| `is_published` | boolean | — | `true` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |

**Unique:**
- `UNIQUE (slug)`

**Checks:**
- `CHECK ((audience = ANY (ARRAY['host'::text, 'guest'::text, 'both'::text])))`

**Triggers:**
- `set_help_categories_updated_at` → `update_updated_at()`

**RLS policies:**
- `admin_full_help_categories` (ALL) — `USING (is_super_admin() OR has_admin_permission('help.manage'::text))`
- `public_read_help_categories` (SELECT) — `USING ((is_published = true) AND (deleted_at IS NULL))`

### `help_faqs`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `question` | text | — | — |
| `answer_html` | text | — | — |
| `category_id` | uuid | yes | — |
| `audience` | text | — | `'both'::text` |
| `is_featured` | boolean | — | `false` |
| `sort_order` | integer | — | `100` |
| `is_published` | boolean | — | `true` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |

**Foreign keys:**
- `FOREIGN KEY (category_id) REFERENCES help_categories(id) ON DELETE SET NULL`

**Checks:**
- `CHECK ((audience = ANY (ARRAY['host'::text, 'guest'::text, 'both'::text])))`

**Triggers:**
- `set_help_faqs_updated_at` → `update_updated_at()`

**RLS policies:**
- `admin_full_help_faqs` (ALL) — `USING (is_super_admin() OR has_admin_permission('help.manage'::text))`
- `public_read_help_faqs` (SELECT) — `USING ((is_published = true) AND (deleted_at IS NULL))`

### `help_settings`

| column | type | null | default |
|---|---|---|---|
| `key` | text | — | — |
| `value` | jsonb | — | — |
| `updated_at` | timestamp with time zone | — | `now()` |

**Triggers:**
- `set_help_settings_updated_at` → `update_updated_at()`

**RLS policies:**
- `admin_full_help_settings` (ALL) — `USING (is_super_admin() OR has_admin_permission('help.manage'::text))`
- `public_read_help_settings` (SELECT) — `USING true`

### `help_status_components`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `name` | text | — | — |
| `icon` | text | — | `'activity'::text` |
| `uptime_pct` | numeric(5,2) | — | `100.00` |
| `status` | text | — | `'normal'::text` |
| `note` | text | yes | — |
| `spark_values` | jsonb | — | `'[80, 90, 85, 95, 90, 100, 95]'::jsonb` |
| `sort_order` | integer | — | `100` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |

**Checks:**
- `CHECK ((status = ANY (ARRAY['normal'::text, 'degraded'::text, 'incident'::text, 'maintenance'::text])))`
- `CHECK (((uptime_pct >= (0)::numeric) AND (uptime_pct <= (100)::numeric)))`

**Triggers:**
- `set_help_status_components_updated_at` → `update_updated_at()`

**RLS policies:**
- `admin_full_help_status` (ALL) — `USING (is_super_admin() OR has_admin_permission('help.manage'::text))`
- `public_read_help_status` (SELECT) — `USING true`

### `help_videos`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `title` | text | — | — |
| `description` | text | — | `''::text` |
| `category_id` | uuid | yes | — |
| `audience` | text | — | `'both'::text` |
| `embed_provider` | text | — | `'youtube'::text` |
| `embed_id` | text | — | — |
| `embed_url` | text | — | — |
| `thumbnail_url` | text | yes | — |
| `duration_seconds` | integer | — | `0` |
| `status` | text | — | `'draft'::text` |
| `featured_rank` | smallint | yes | — |
| `sort_order` | integer | — | `100` |
| `is_new` | boolean | — | `false` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |

**Foreign keys:**
- `FOREIGN KEY (category_id) REFERENCES help_categories(id) ON DELETE SET NULL`

**Checks:**
- `CHECK ((audience = ANY (ARRAY['host'::text, 'guest'::text, 'both'::text])))`
- `CHECK ((embed_provider = ANY (ARRAY['youtube'::text, 'vimeo'::text])))`
- `CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))`

**Triggers:**
- `set_help_videos_updated_at` → `update_updated_at()`

**RLS policies:**
- `admin_full_help_videos` (ALL) — `USING (is_super_admin() OR has_admin_permission('help.manage'::text))`
- `public_read_help_videos` (SELECT) — `USING ((status = 'published'::text) AND (deleted_at IS NULL))`

### `host_contacts`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `guest_id` | uuid | yes | — |
| `email` | text | — | — |
| `name` | text | yes | — |
| `phone` | text | yes | — |
| `tags` | text[] | — | `'{}'::text[]` |
| `notes` | text | yes | — |
| `blocked` | boolean | — | `false` |
| `last_stage` | text | yes | — |
| `last_seen_at` | timestamp with time zone | — | `now()` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `country` | text | yes | — |
| `email_consent` | boolean | — | `false` |
| `blocked_reason` | text | yes | — |
| `blocked_at` | timestamp with time zone | yes | — |

**Foreign keys:**
- `FOREIGN KEY (guest_id) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`

**Triggers:**
- `set_updated_at_host_contacts` → `update_updated_at()`

**RLS policies:**
- `host_contacts_owner_all` (ALL) — `USING (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid()))) CHECK (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid())))`

### `host_feature_overrides`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `feature_key` | text | — | — |
| `is_enabled` | boolean | — | — |
| `limit_value` | integer | yes | — |
| `reason` | text | — | — |
| `overridden_by` | uuid | — | — |
| `expires_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`
- `FOREIGN KEY (overridden_by) REFERENCES user_profiles(id) ON DELETE RESTRICT`

**Unique:**
- `UNIQUE (host_id, feature_key)`

**RLS policies:**
- `admin_manage_overrides` (ALL) — `USING is_super_admin()`
- `host_read_own_overrides` (SELECT) — `USING (host_id = get_my_host_id())`

### `host_payment_gateways`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `gateway` | text | — | — |
| `environment` | text | — | `'live'::text` |
| `public_identifier` | text | yes | — |
| `secret_cipher` | text | yes | — |
| `secret_last4` | text | yes | — |
| `statement_descriptor` | text | yes | — |
| `is_enabled` | boolean | — | `true` |
| `last_validated_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `business_id` | uuid | — | — |
| `mode` | text | — | `'test'::text` |
| `test_public_identifier` | text | yes | — |
| `test_secret_cipher` | text | yes | — |
| `test_secret_last4` | text | yes | — |
| `live_public_identifier` | text | yes | — |
| `live_secret_cipher` | text | yes | — |
| `live_secret_last4` | text | yes | — |

**Foreign keys:**
- `FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE`
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`

**Checks:**
- `CHECK ((environment = ANY (ARRAY['test'::text, 'live'::text])))`
- `CHECK ((gateway = ANY (ARRAY['paystack'::text, 'paypal'::text])))`
- `CHECK ((mode = ANY (ARRAY['test'::text, 'live'::text])))`

**Triggers:**
- `set_updated_at_host_payment_gateways` → `update_updated_at()`

**RLS policies:**
- `host_payment_gateways_owner_all` (ALL) — `USING (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid()))) CHECK (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid())))`

### `host_personal_details`

| column | type | null | default |
|---|---|---|---|
| `host_id` | uuid | — | — |
| `address_line1` | text | yes | — |
| `address_line2` | text | yes | — |
| `city` | text | yes | — |
| `province` | text | yes | — |
| `postal_code` | text | yes | — |
| `country` | text | — | `'ZA'::text` |
| `latitude` | numeric | yes | — |
| `longitude` | numeric | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `municipality` | text | yes | — |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`

**Triggers:**
- `set_updated_at_host_personal` → `update_updated_at()`

**RLS policies:**
- `host_personal_owner_all` (ALL) — `USING (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid()))) CHECK (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid())))`

### `host_websites`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `business_id` | uuid | — | — |
| `host_id` | uuid | — | — |
| `subdomain` | text | — | — |
| `custom_domain` | text | yes | — |
| `domain_status` | text | — | `'none'::text` |
| `ssl_status` | text | — | `'none'::text` |
| `verification_token` | text | yes | — |
| `status` | text | — | `'draft'::text` |
| `brand` | jsonb | — | `'{}'::jsonb` |
| `theme` | jsonb | — | `'{}'::jsonb` |
| `seo` | jsonb | — | `'{}'::jsonb` |
| `settings` | jsonb | — | `'{}'::jsonb` |
| `published_snapshot` | jsonb | yes | — |
| `published_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |
| `theme_id` | uuid | yes | — |
| `saved_sections` | jsonb | — | `'[]'::jsonb` |
| `navigation` | jsonb | — | `'{}'::jsonb` |
| `meta_capi_access_token` | text | yes | — |
| `meta_capi_enabled` | boolean | — | `false` |
| `content_profile` | jsonb | — | `'{}'::jsonb` |

**Foreign keys:**
- `FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE`
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`
- `FOREIGN KEY (theme_id) REFERENCES site_themes(id) ON DELETE SET NULL`

**Unique:**
- `UNIQUE (business_id)`
- `UNIQUE (custom_domain)`
- `UNIQUE (subdomain)`

**Checks:**
- `CHECK ((domain_status = ANY (ARRAY['none'::text, 'pending'::text, 'verifying'::text, 'active'::text, 'error'::text])))`
- `CHECK ((ssl_status = ANY (ARRAY['none'::text, 'pending'::text, 'active'::text, 'error'::text])))`
- `CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'unpublished'::text])))`
- `CHECK (((subdomain = lower(subdomain)) AND (subdomain ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$'::text)))`

**Triggers:**
- `set_updated_at_host_websites` → `update_updated_at()`

**RLS policies:**
- `host_websites_admin_all` (ALL) — `USING is_super_admin()`
- `host_websites_owner_all` (ALL) — `USING (host_id = get_my_host_id()) CHECK (host_id = get_my_host_id())`

### `hosts`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `user_id` | uuid | — | — |
| `handle` | text | — | — |
| `display_name` | text | — | — |
| `bio` | text | yes | — |
| `cover_photo_url` | text | yes | — |
| `avatar_url` | text | yes | — |
| `website_url` | text | yes | — |
| `languages_spoken` | text[] | yes | `'{}'::text[]` |
| `social_links` | jsonb | yes | `'{}'::jsonb` |
| `is_active` | boolean | — | `true` |
| `is_verified` | boolean | — | `false` |
| `response_rate` | numeric | yes | `0` |
| `avg_response_hours` | numeric | yes | `0` |
| `total_bookings` | integer | — | `0` |
| `total_reviews` | integer | — | `0` |
| `avg_rating` | numeric | yes | `0` |
| `deleted_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `highlights` | text[] | — | `'{}'::text[]` |
| `is_superhost` | boolean | — | `false` |
| `phone_verified` | boolean | — | `false` |
| `payout_verified` | boolean | — | `false` |
| `default_currency` | text | — | `'ZAR'::text` |
| `enquiry_auto_reply` | text | yes | — |
| `account_kind` | text | — | `'host'::text` |
| `quote_access` | boolean | — | `true` |
| `platform_access` | boolean | — | `true` |
| `brochure_path` | text | yes | — |
| `brochure_name` | text | yes | — |

**Foreign keys:**
- `FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE RESTRICT`

**Unique:**
- `UNIQUE (handle)`

**Checks:**
- `CHECK ((handle ~ '^[a-z0-9-]+$'::text))`
- `CHECK (((char_length(handle) >= 3) AND (char_length(handle) <= 60)))`
- `CHECK ((account_kind = ANY (ARRAY['host'::text, 'quote_only'::text])))`
- `CHECK ((default_currency = ANY (ARRAY['ZAR'::text, 'USD'::text])))`

**Triggers:**
- `set_updated_at` → `update_updated_at()`
- `trg_host_default_business` → `on_host_created_default_business()` *(SECURITY DEFINER)*
- `trg_seed_host_policies` → `seed_host_policies_on_create()` *(SECURITY DEFINER)*
- `trigger_host_handle` → `generate_host_handle()`

**RLS policies:**
- `admin_full_access_hosts` (ALL) — `USING is_super_admin()`
- `host_manage_own` (ALL) — `USING (user_id = auth.uid())`
- `public_read_active_hosts` (SELECT) — `USING ((is_active = true) AND (deleted_at IS NULL))`
- `staff_read_host` (SELECT) — `USING (id = get_my_host_id_as_staff())`

### `ical_feeds`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `property_id` | uuid | — | — |
| `source_label` | text | — | — |
| `url` | text | — | — |
| `status` | text | — | `'active'::text` |
| `last_sync_at` | timestamp with time zone | yes | — |
| `last_error` | text | yes | — |
| `imported_count` | integer | — | `0` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `room_id` | uuid | yes | — |

**Foreign keys:**
- `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`
- `FOREIGN KEY (room_id) REFERENCES property_rooms(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (property_id, url)`

**Checks:**
- `CHECK ((status = ANY (ARRAY['active'::text, 'error'::text, 'disabled'::text])))`

**Triggers:**
- `set_ical_feeds_updated_at` → `update_updated_at()`

**RLS policies:**
- `admin_full_ical_feeds` (ALL) — `USING is_super_admin()`
- `host_manage_own_ical_feeds` (ALL) — `USING (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.host_id = get_my_host_id()))) CHECK (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.host_id = get_my_host_id())))`

### `impersonation_sessions`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `admin_id` | uuid | — | — |
| `target_user_id` | uuid | — | — |
| `started_at` | timestamp with time zone | — | `now()` |
| `ended_at` | timestamp with time zone | yes | — |
| `duration_seconds` | integer | yes | `
CASE
    WHEN (ended_at IS NOT NULL) THEN (EXTRACT(epoch FR` |

**Foreign keys:**
- `FOREIGN KEY (admin_id) REFERENCES user_profiles(id) ON DELETE RESTRICT`
- `FOREIGN KEY (target_user_id) REFERENCES user_profiles(id) ON DELETE RESTRICT`

### `in_app_notifications`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `user_id` | uuid | — | — |
| `kind` | text | — | — |
| `title` | text | — | — |
| `body` | text | yes | — |
| `link` | text | yes | — |
| `payload` | jsonb | — | `'{}'::jsonb` |
| `read_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `category_id` | text | — | `'bookings'::text` |
| `severity` | text | — | `'default'::text` |

**Foreign keys:**
- `FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE`

**Checks:**
- `CHECK ((severity = ANY (ARRAY['info'::text, 'default'::text, 'high'::text, 'critical'::text])))`

**RLS policies:**
- `in_app_notifications_owner_select` (SELECT) — `USING (user_id = auth.uid())`
- `in_app_notifications_owner_update` (UPDATE) — `USING (user_id = auth.uid()) CHECK (user_id = auth.uid())`

### `invoices`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `invoice_number` | text | — | — |
| `booking_id` | uuid | — | — |
| `host_id` | uuid | — | — |
| `guest_id` | uuid | yes | — |
| `host_snapshot` | jsonb | — | — |
| `guest_snapshot` | jsonb | — | — |
| `line_items` | jsonb | — | — |
| `subtotal` | numeric | — | — |
| `vat_amount` | numeric | — | `0` |
| `total_amount` | numeric | — | — |
| `currency` | text | — | `'ZAR'::text` |
| `status` | text | — | `'issued'::text` |
| `issued_at` | timestamp with time zone | — | `now()` |
| `paid_at` | timestamp with time zone | yes | — |
| `cancelled_at` | timestamp with time zone | yes | — |
| `pdf_storage_path` | text | yes | — |
| `hosted_token` | text | — | `gen_url_token()` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `kind` | text | — | `'booking'::text` |
| `payment_id` | uuid | yes | — |
| `voided_at` | timestamp with time zone | yes | — |
| `voided_by` | uuid | yes | — |
| `void_reason` | text | yes | — |

**Foreign keys:**
- `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT`
- `FOREIGN KEY (guest_id) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE RESTRICT`
- `FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL`
- `FOREIGN KEY (voided_by) REFERENCES user_profiles(id) ON DELETE SET NULL`

**Unique:**
- `UNIQUE (hosted_token)`
- `UNIQUE (invoice_number)`

**Checks:**
- `CHECK ((kind = ANY (ARRAY['booking'::text, 'addon'::text])))`
- `CHECK ((status = ANY (ARRAY['draft'::text, 'issued'::text, 'paid'::text, 'cancelled'::text])))`

**Triggers:**
- `set_updated_at` → `update_updated_at()`

**RLS policies:**
- `admin_full_invoices` (ALL) — `USING is_super_admin()`
- `guest_read_own_invoices` (SELECT) — `USING (guest_id = auth.uid())`
- `host_read_own_invoices` (SELECT) — `USING (host_id = get_my_host_id())`
- `host_update_own_invoices` (UPDATE) — `USING (host_id = get_my_host_id()) CHECK (host_id = get_my_host_id())`
- `staff_read_invoices` (SELECT) — `USING (host_id = get_my_host_id_as_staff())`

### `listing_reports`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `property_id` | uuid | yes | — |
| `listing_name` | text | yes | — |
| `host_id` | uuid | yes | — |
| `reporter_name` | text | — | — |
| `reporter_email` | text | — | — |
| `reporter_phone` | text | yes | — |
| `reason` | text | — | — |
| `message` | text | — | — |
| `status` | text | — | `'open'::text` |
| `admin_note` | text | yes | — |
| `reviewed_by` | uuid | yes | — |
| `reviewed_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `target_type` | text | — | `'listing'::text` |
| `target_id` | uuid | — | — |
| `target_label` | text | yes | — |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE SET NULL`
- `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`
- `FOREIGN KEY (reviewed_by) REFERENCES user_profiles(id) ON DELETE SET NULL`

**Checks:**
- `CHECK ((reason = ANY (ARRAY['scam'::text, 'not_real'::text, 'inappropriate'::text, 'safety'::text, 'spam'::text, 'other'::text])))`
- `CHECK ((status = ANY (ARRAY['open'::text, 'reviewing'::text, 'actioned'::text, 'dismissed'::text])))`
- `CHECK ((target_type = ANY (ARRAY['listing'::text, 'deal'::text, 'user'::text])))`

**RLS policies:**
- `admin_full_listing_reports` (ALL) — `USING is_super_admin()`
- `staff_read_listing_reports` (SELECT) — `USING has_admin_permission('listings.moderate'::text)`

### `looking_for_alerts`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `name` | text | yes | — |
| `is_active` | boolean | — | `true` |
| `last_matched_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `category` | text | yes | — |
| `location_region` | text | yes | — |
| `min_budget` | numeric(10,2) | yes | — |
| `max_budget` | numeric(10,2) | yes | — |
| `min_guests` | integer | yes | — |
| `max_guests` | integer | yes | — |
| `check_in_from` | date | yes | — |
| `check_in_to` | date | yes | — |
| `match_count` | integer | — | `0` |
| `last_notified_at` | timestamp with time zone | yes | — |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`

**RLS policies:**
- `Hosts manage own alerts` (ALL) — `USING (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid())))`

### `looking_for_bookmarks`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `post_id` | uuid | — | — |
| `saved_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`
- `FOREIGN KEY (post_id) REFERENCES looking_for_posts(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (host_id, post_id)`

**RLS policies:**
- `Hosts manage own bookmarks` (ALL) — `USING (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid())))`

### `looking_for_expiry_notifications`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `post_id` | uuid | — | — |
| `days_before` | integer | — | — |
| `sent_at` | timestamp with time zone | yes | `now()` |
| `dispatched_at` | timestamp with time zone | yes | — |

**Foreign keys:**
- `FOREIGN KEY (post_id) REFERENCES looking_for_posts(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (post_id, days_before)`

**RLS policies:**
- `Service role full access` (ALL) — `USING (auth.role() = 'service_role'::text)`

### `looking_for_passes`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `post_id` | uuid | — | — |
| `reason` | text | yes | — |
| `passed_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`
- `FOREIGN KEY (post_id) REFERENCES looking_for_posts(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (host_id, post_id)`

**Checks:**
- `CHECK ((reason = ANY (ARRAY['dates_conflict'::text, 'wrong_category'::text, 'outside_capacity'::text, 'budget_too_low'::text, 'other'::text])))`

**RLS policies:**
- `Hosts manage own passes` (ALL) — `USING (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid())))`

### `looking_for_post_requirements`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `post_id` | uuid | — | — |
| `option_key` | text | — | — |
| `option_label` | text | yes | — |
| `group_slug` | text | yes | — |
| `option_id` | uuid | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (option_id) REFERENCES looking_for_requirement_options(id) ON DELETE SET NULL`
- `FOREIGN KEY (post_id) REFERENCES looking_for_posts(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (post_id, option_key)`

**RLS policies:**
- `Guests manage own post requirements` (ALL) — `USING (post_id IN ( SELECT looking_for_posts.id
   FROM looking_for_posts
  WHERE (looking_for_posts.guest_id = auth.uid())))`
- `Public read requirements of public posts` (SELECT) — `USING (post_id IN ( SELECT looking_for_posts.id
   FROM looking_for_posts
  WHERE ((looking_for_posts.is_public = true) AND (looking_for_posts.status = 'active'::text))))`

### `looking_for_post_targets`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `post_id` | uuid | — | — |
| `host_id` | uuid | — | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`
- `FOREIGN KEY (post_id) REFERENCES looking_for_posts(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (post_id, host_id)`

**RLS policies:**
- `Post owners can manage targets` (ALL) — `USING (post_id IN ( SELECT looking_for_posts.id
   FROM looking_for_posts
  WHERE (looking_for_posts.guest_id = auth.uid())))`
- `Targeted hosts can view their targets` (SELECT) — `USING (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid())))`

### `looking_for_post_unlocks`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `post_id` | uuid | — | — |
| `host_id` | uuid | — | — |
| `unlocked_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`
- `FOREIGN KEY (post_id) REFERENCES looking_for_posts(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (post_id, host_id)`

**RLS policies:**
- `looking_for_post_unlocks_select_own` (SELECT) — `USING (host_id IN ( SELECT h.id
   FROM hosts h
  WHERE ((h.user_id = auth.uid()) AND (h.deleted_at IS NULL))))`

### `looking_for_post_views`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `post_id` | uuid | — | — |
| `host_id` | uuid | — | — |
| `viewed_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`
- `FOREIGN KEY (post_id) REFERENCES looking_for_posts(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (post_id, host_id)`

**Triggers:**
- `looking_for_post_views_sync_count` → `sync_looking_for_view_count()` *(SECURITY DEFINER)*

**RLS policies:**
- `Hosts can insert views` (INSERT) — `CHECK (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid())))`
- `Post owners can view their post views` (SELECT) — `USING (post_id IN ( SELECT looking_for_posts.id
   FROM looking_for_posts
  WHERE (looking_for_posts.guest_id = auth.uid())))`

### `looking_for_posts`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `guest_id` | uuid | — | — |
| `title` | text | — | — |
| `description` | text | yes | — |
| `category` | text | — | `'accommodation'::text` |
| `sub_category` | text | yes | — |
| `check_in_date` | date | yes | — |
| `check_out_date` | date | yes | — |
| `adults` | integer | — | `1` |
| `children` | integer | — | `0` |
| `infants` | integer | — | `0` |
| `location_text` | text | yes | — |
| `location_region` | text | yes | — |
| `location_lat` | numeric(9,6) | yes | — |
| `location_lng` | numeric(9,6) | yes | — |
| `budget_min` | numeric(10,2) | yes | — |
| `budget_max` | numeric(10,2) | yes | — |
| `budget_currency` | text | — | `'ZAR'::text` |
| `budget_per` | text | yes | `'night'::text` |
| `status` | text | — | `'active'::text` |
| `is_public` | boolean | — | `true` |
| `expires_at` | timestamp with time zone | yes | — |
| `view_count` | integer | — | `0` |
| `quote_count` | integer | — | `0` |
| `is_urgent` | boolean | — | `false` |
| `urgent_until` | timestamp with time zone | yes | — |
| `min_host_rating` | numeric(2,1) | yes | — |
| `quote_deadline` | timestamp with time zone | yes | — |
| `fulfilled_via` | text | yes | — |
| `fulfilled_booking_id` | uuid | yes | — |
| `extension_count` | integer | — | `0` |
| `reopen_count` | integer | — | `0` |
| `event_type` | text | yes | — |
| `total_headcount` | integer | yes | — |
| `vendor_needs` | text[] | yes | — |
| `is_all_in_quote` | boolean | yes | `false` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `image_url` | text | yes | — |
| `date_flexibility_days` | integer | — | `0` |
| `search_radius_km` | numeric | yes | — |

**Foreign keys:**
- `FOREIGN KEY (fulfilled_booking_id) REFERENCES bookings(id)`
- `FOREIGN KEY (guest_id) REFERENCES user_profiles(id) ON DELETE CASCADE`

**Checks:**
- `CHECK ((adults >= 1))`
- `CHECK ((budget_per = ANY (ARRAY['night'::text, 'person'::text, 'total'::text])))`
- `CHECK ((category = ANY (ARRAY['accommodation'::text, 'experience'::text, 'venue'::text, 'event'::text, 'other'::text])))`
- `CHECK ((children >= 0))`
- `CHECK (((date_flexibility_days >= 0) AND (date_flexibility_days <= 60)))`
- `CHECK (((description IS NULL) OR (char_length(description) <= 20000)))`
- `CHECK ((event_type = ANY (ARRAY['wedding'::text, 'corporate'::text, 'tour_group'::text, 'family_reunion'::text, 'other'::text])))`
- `CHECK ((fulfilled_via = ANY (ARRAY['vilo_booking'::text, 'ota'::text, 'direct'::text, 'other'::text])))`
- `CHECK ((infants >= 0))`
- `CHECK (((min_host_rating IS NULL) OR ((min_host_rating >= 1.0) AND (min_host_rating <= 5.0))))`
- `CHECK ((status = ANY (ARRAY['active'::text, 'fulfilled'::text, 'expired'::text, 'removed'::text, 'quotes_closed'::text, 'cancelled'::text, 'flagged'::text, 'suspended'::text])))`
- `CHECK ((char_length(title) <= 100))`
- `CHECK (((total_headcount IS NULL) OR (total_headcount >= 1)))`

**Triggers:**
- `looking_for_posts_set_expiry` → `set_looking_for_post_expiry()`
- `looking_for_posts_updated_at` → `update_updated_at()`

**RLS policies:**
- `Guests can delete own posts` (DELETE) — `USING (guest_id = auth.uid())`
- `Guests can insert own posts` (INSERT) — `CHECK (guest_id = auth.uid())`
- `Guests can update own posts` (UPDATE) — `USING (guest_id = auth.uid())`
- `Guests can view own posts` (SELECT) — `USING (guest_id = auth.uid())`
- `Public can view active posts` (SELECT) — `USING ((status = 'active'::text) AND (is_public = true))`

### `looking_for_region_digest_queue`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `region` | text | — | — |
| `post_count` | integer | — | `0` |
| `sample_post_ids` | uuid[] | — | `'{}'::uuid[]` |
| `queued_at` | timestamp with time zone | yes | `now()` |
| `processed_at` | timestamp with time zone | yes | — |

**RLS policies:**
- `Service role full access` (ALL) — `USING (auth.role() = 'service_role'::text)`

### `looking_for_requirement_groups`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `slug` | text | — | — |
| `label` | text | — | — |
| `icon` | text | — | `'list-checks'::text` |
| `select_mode` | text | — | `'multi'::text` |
| `sort_order` | integer | — | `100` |
| `is_published` | boolean | — | `true` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |

**Checks:**
- `CHECK ((select_mode = ANY (ARRAY['single'::text, 'multi'::text])))`

**Triggers:**
- `lf_req_groups_updated_at` → `update_updated_at()`

**RLS policies:**
- `admin_full_lf_req_groups` (ALL) — `USING (is_super_admin() OR has_admin_permission('taxonomy.manage'::text))`
- `public_read_lf_req_groups` (SELECT) — `USING ((is_published = true) AND (deleted_at IS NULL))`

### `looking_for_requirement_options`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `group_id` | uuid | — | — |
| `slug` | text | — | — |
| `label` | text | — | — |
| `icon` | text | — | `'check'::text` |
| `sort_order` | integer | — | `100` |
| `is_published` | boolean | — | `true` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |

**Foreign keys:**
- `FOREIGN KEY (group_id) REFERENCES looking_for_requirement_groups(id) ON DELETE RESTRICT`

**Triggers:**
- `lf_req_options_updated_at` → `update_updated_at()`

**RLS policies:**
- `admin_full_lf_req_options` (ALL) — `USING (is_super_admin() OR has_admin_permission('taxonomy.manage'::text))`
- `public_read_lf_req_options` (SELECT) — `USING ((is_published = true) AND (deleted_at IS NULL))`

### `looking_for_responses`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `post_id` | uuid | — | — |
| `host_id` | uuid | — | — |
| `quote_id` | uuid | yes | — |
| `thread_id` | uuid | yes | — |
| `status` | text | — | `'sent'::text` |
| `sent_at` | timestamp with time zone | — | `now()` |
| `viewed_at` | timestamp with time zone | yes | — |
| `expires_at` | timestamp with time zone | yes | — |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`
- `FOREIGN KEY (post_id) REFERENCES looking_for_posts(id) ON DELETE CASCADE`
- `FOREIGN KEY (quote_id) REFERENCES quotes(id)`
- `FOREIGN KEY (thread_id) REFERENCES conversations(id)`

**Unique:**
- `UNIQUE (post_id, host_id)`

**Checks:**
- `CHECK ((status = ANY (ARRAY['sent'::text, 'viewed'::text, 'accepted'::text, 'declined'::text, 'expired'::text])))`

**Triggers:**
- `looking_for_responses_sync_count` → `sync_looking_for_quote_count()` *(SECURITY DEFINER)*

**RLS policies:**
- `Guests can view responses to own posts` (SELECT) — `USING (post_id IN ( SELECT looking_for_posts.id
   FROM looking_for_posts
  WHERE (looking_for_posts.guest_id = auth.uid())))`
- `Hosts can insert own responses` (INSERT) — `CHECK (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid())))`
- `Hosts can view own responses` (SELECT) — `USING (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid())))`

### `looking_for_usage`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `user_id` | uuid | — | — |
| `action` | text | — | — |
| `post_id` | uuid | yes | — |
| `occurred_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (post_id) REFERENCES looking_for_posts(id) ON DELETE SET NULL`
- `FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE`

**Checks:**
- `CHECK ((action = ANY (ARRAY['guest_post'::text, 'host_quote'::text, 'guest_extension'::text])))`

**RLS policies:**
- `Users can view own usage` (SELECT) — `USING (user_id = auth.uid())`
- `Users insert own usage` (INSERT) — `CHECK (user_id = auth.uid())`

### `marketing_assets`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `title` | text | — | — |
| `description` | text | yes | — |
| `category` | text | — | `'banner'::text` |
| `file_path` | text | yes | — |
| `file_url` | text | yes | — |
| `mime_type` | text | yes | — |
| `width` | integer | yes | — |
| `height` | integer | yes | — |
| `is_active` | boolean | — | `true` |
| `sort_order` | integer | — | `0` |
| `created_by` | uuid | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `body` | text | yes | — |
| `link_url` | text | yes | — |

**Foreign keys:**
- `FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE SET NULL`

**RLS policies:**
- `marketing_assets_read` (SELECT) — `USING (is_active = true)`

### `message_templates`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `title` | text | — | — |
| `body` | text | — | — |
| `sort_order` | integer | — | `0` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`

**Triggers:**
- `set_updated_at` → `update_updated_at()`

**RLS policies:**
- `admin_full_templates` (ALL) — `USING is_super_admin()`
- `host_manage_templates` (ALL) — `USING (host_id = get_my_host_id())`

### `messages`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `conversation_id` | uuid | — | — |
| `sender_id` | uuid | yes | — |
| `body` | text | yes | — |
| `attachment_url` | text | yes | — |
| `attachment_type` | text | yes | — |
| `attachment_filename` | text | yes | — |
| `is_system_message` | boolean | — | `false` |
| `system_event` | text | yes | — |
| `read_by_host` | boolean | — | `false` |
| `read_by_guest` | boolean | — | `false` |
| `read_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `quote_id` | uuid | yes | — |
| `quote_version_no` | integer | yes | — |

**Foreign keys:**
- `FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE`
- `FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL`
- `FOREIGN KEY (sender_id) REFERENCES user_profiles(id) ON DELETE SET NULL`

**Checks:**
- `CHECK ((attachment_type = ANY (ARRAY['image'::text, 'pdf'::text, 'other'::text])))`

**Triggers:**
- `trigger_message_inserted` → `on_message_inserted()` *(SECURITY DEFINER)*

**RLS policies:**
- `admin_full_messages` (ALL) — `USING is_super_admin()`
- `participant_access_msg` (ALL) — `USING (conversation_id IN ( SELECT conversations.id
   FROM conversations
  WHERE ((conversations.host_id = get_my_host_id()) OR (conversations.host_id = get_my_host_id_as_staff()) OR (conversations.guest_id = auth.uid()))))`

### `notification_categories`

| column | type | null | default |
|---|---|---|---|
| `id` | text | — | — |
| `label` | text | — | — |
| `description` | text | — | — |
| `icon_name` | text | — | — |
| `is_locked` | boolean | — | `false` |
| `default_for_role` | jsonb | — | `'{}'::jsonb` |
| `supports_digest` | boolean | — | `false` |
| `display_order` | integer | — | `0` |
| `created_at` | timestamp with time zone | — | `now()` |

**RLS policies:**
- `notification_categories_read_authenticated` (SELECT) — `USING true`

### `notification_delivery_log`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `user_id` | uuid | — | — |
| `event_kind` | text | — | — |
| `category_id` | text | yes | — |
| `channel` | text | — | — |
| `dedupe_key` | text | yes | — |
| `sent_at` | timestamp with time zone | — | `now()` |
| `read_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE`

**Checks:**
- `CHECK ((channel = ANY (ARRAY['email'::text, 'push'::text, 'in_app'::text])))`

**RLS policies:**
- `notification_delivery_log_admin_select` (SELECT) — `USING is_super_admin()`
- `notification_delivery_log_owner_select` (SELECT) — `USING (user_id = auth.uid())`

### `notification_events`

| column | type | null | default |
|---|---|---|---|
| `kind` | text | — | — |
| `category_id` | text | — | — |
| `feature` | text | — | — |
| `severity` | text | — | `'default'::text` |
| `email_template_key` | text | yes | — |
| `push_supported` | boolean | — | `true` |
| `in_app_supported` | boolean | — | `true` |
| `human_label` | text | — | — |
| `human_description` | text | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (category_id) REFERENCES notification_categories(id)`

**Checks:**
- `CHECK ((severity = ANY (ARRAY['info'::text, 'default'::text, 'high'::text, 'critical'::text])))`

**RLS policies:**
- `notification_events_read_authenticated` (SELECT) — `USING true`

### `notification_queue`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | yes | — |
| `guest_id` | uuid | yes | — |
| `type` | text | — | — |
| `payload` | jsonb | — | `'{}'::jsonb` |
| `sent_at` | timestamp with time zone | yes | — |
| `failed_at` | timestamp with time zone | yes | — |
| `error` | text | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `user_id` | uuid | yes | — |
| `category_id` | text | yes | — |
| `dedupe_key` | text | yes | — |
| `claimed_at` | timestamp with time zone | yes | — |

**Foreign keys:**
- `FOREIGN KEY (guest_id) REFERENCES user_profiles(id) ON DELETE CASCADE`
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`
- `FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE`

### `payments`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `booking_id` | uuid | — | — |
| `amount` | numeric | — | — |
| `currency` | text | — | `'ZAR'::text` |
| `method` | text | — | — |
| `status` | text | — | `'pending'::text` |
| `provider_reference` | text | yes | — |
| `provider_response` | jsonb | yes | — |
| `eft_proof_url` | text | yes | — |
| `authorised_at` | timestamp with time zone | yes | — |
| `captured_at` | timestamp with time zone | yes | — |
| `failed_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `refunded_amount` | numeric | yes | `0` |
| `kind` | text | — | `'payment'::text` |
| `note` | text | yes | — |
| `recorded_by` | uuid | yes | — |
| `receipt_number` | text | yes | — |
| `receipt_token` | text | yes | `gen_url_token()` |
| `voided_at` | timestamp with time zone | yes | — |
| `voided_by` | uuid | yes | — |
| `void_reason` | text | yes | — |

**Foreign keys:**
- `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT`
- `FOREIGN KEY (recorded_by) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (voided_by) REFERENCES user_profiles(id) ON DELETE SET NULL`

**Unique:**
- `UNIQUE (receipt_token)`
- `UNIQUE (provider_reference)`

**Checks:**
- `CHECK ((kind = ANY (ARRAY['deposit'::text, 'balance'::text, 'addon'::text, 'payment'::text, 'refund'::text, 'credit'::text])))`
- `CHECK ((method = ANY (ARRAY['paystack'::text, 'paypal'::text, 'eft'::text, 'credit'::text])))`
- `CHECK ((status = ANY (ARRAY['pending'::text, 'authorised'::text, 'completed'::text, 'failed'::text, 'refunded'::text, 'partially_refunded'::text, 'voided'::text])))`

**Triggers:**
- `set_updated_at` → `update_updated_at()`
- `trg_assign_receipt_number` → `assign_receipt_number()` *(SECURITY DEFINER)*

**RLS policies:**
- `admin_full_payments` (ALL) — `USING is_super_admin()`
- `guest_read_own_payments` (SELECT) — `USING (booking_id IN ( SELECT bookings.id
   FROM bookings
  WHERE (bookings.guest_id = auth.uid())))`
- `host_read_own_payments` (SELECT) — `USING (booking_id IN ( SELECT bookings.id
   FROM bookings
  WHERE (bookings.host_id = get_my_host_id())))`

### `pending_digest_items`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `user_id` | uuid | — | — |
| `category_id` | text | — | — |
| `event_kind` | text | — | — |
| `title` | text | — | — |
| `body` | text | yes | — |
| `link` | text | yes | — |
| `payload` | jsonb | — | `'{}'::jsonb` |
| `sent_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE`

### `pending_push_queue`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `user_id` | uuid | — | — |
| `event_kind` | text | — | — |
| `payload` | jsonb | — | — |
| `release_at` | timestamp with time zone | — | `now()` |
| `sent_at` | timestamp with time zone | yes | — |
| `failed_at` | timestamp with time zone | yes | — |
| `error` | text | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `claimed_at` | timestamp with time zone | yes | — |

**Foreign keys:**
- `FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE`

### `plan_features`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `plan` | text | — | — |
| `feature_key` | text | — | — |
| `is_enabled` | boolean | — | `false` |
| `limit_value` | integer | yes | — |
| `description` | text | yes | — |
| `updated_by` | uuid | yes | — |
| `updated_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (plan) REFERENCES plans(key) ON UPDATE CASCADE`
- `FOREIGN KEY (updated_by) REFERENCES user_profiles(id) ON DELETE SET NULL`

**Unique:**
- `UNIQUE (plan, feature_key)`

**RLS policies:**
- `admin_manage_plan_features` (ALL) — `USING is_super_admin()`
- `authenticated_read_plan_features` (SELECT) — `USING (auth.role() = 'authenticated'::text)`

### `plan_prices`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `plan` | text | — | — |
| `billing_cycle` | text | — | — |
| `price` | numeric | — | `0` |
| `currency` | text | — | `'ZAR'::text` |
| `is_active` | boolean | — | `true` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (plan) REFERENCES plans(key) ON UPDATE CASCADE ON DELETE CASCADE`

**Unique:**
- `UNIQUE (plan, billing_cycle, currency)`

**Checks:**
- `CHECK ((billing_cycle = ANY (ARRAY['monthly'::text, 'annual'::text])))`

**RLS policies:**
- `plan_prices_public_read` (SELECT) — `USING (is_active = true)`

### `plans`

| column | type | null | default |
|---|---|---|---|
| `key` | text | — | — |
| `name` | text | — | — |
| `tagline` | text | yes | — |
| `description` | text | yes | — |
| `currency` | text | — | `'ZAR'::text` |
| `trial_days` | integer | — | `14` |
| `is_free` | boolean | — | `false` |
| `is_active` | boolean | — | `true` |
| `is_recommended` | boolean | — | `false` |
| `bullets` | jsonb | — | `'[]'::jsonb` |
| `sort_order` | integer | — | `0` |
| `vat_inclusive` | boolean | — | `true` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |

**RLS policies:**
- `plans_public_read` (SELECT) — `USING (is_active = true)`

### `platform_counters`  — ⚠️ **NO RLS**

| column | type | null | default |
|---|---|---|---|
| `id` | boolean | — | `true` |
| `last_invoice_number` | integer | — | `0` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `last_credit_note_number` | integer | — | `0` |

**Checks:**
- `CHECK (id)`

### `platform_coupon_redemptions`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `coupon_id` | uuid | — | — |
| `order_id` | uuid | — | — |
| `user_id` | uuid | yes | — |
| `amount_discounted` | numeric | — | — |
| `currency` | text | — | `'ZAR'::text` |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (coupon_id) REFERENCES platform_coupons(id) ON DELETE CASCADE`
- `FOREIGN KEY (order_id) REFERENCES product_orders(id) ON DELETE CASCADE`
- `FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE SET NULL`

**Unique:**
- `UNIQUE (coupon_id, order_id)`

**RLS policies:**
- `admin_full_platform_coupon_redemptions` (ALL) — `USING is_super_admin() CHECK is_super_admin()`

### `platform_coupons`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `code` | text | — | — |
| `description` | text | yes | — |
| `discount_type` | text | — | `'percent'::text` |
| `discount_value` | numeric | — | — |
| `product_id` | uuid | yes | — |
| `product_type` | text | yes | — |
| `currency` | text | — | `'ZAR'::text` |
| `min_spend` | numeric | yes | — |
| `starts_at` | timestamp with time zone | yes | — |
| `ends_at` | timestamp with time zone | yes | — |
| `max_redemptions` | integer | yes | — |
| `per_user_limit` | integer | yes | — |
| `redeemed_count` | integer | — | `0` |
| `is_active` | boolean | — | `true` |
| `created_by` | uuid | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE`

**Checks:**
- `CHECK (((starts_at IS NULL) OR (ends_at IS NULL) OR (ends_at >= starts_at)))`
- `CHECK (((discount_type <> 'percent'::text) OR ((discount_value > (0)::numeric) AND (discount_value <= (100)::numeric))))`
- `CHECK (((product_id IS NULL) OR (product_type IS NULL)))`
- `CHECK ((discount_type = ANY (ARRAY['percent'::text, 'fixed'::text])))`
- `CHECK ((discount_value > (0)::numeric))`
- `CHECK (((max_redemptions IS NULL) OR (max_redemptions > 0)))`
- `CHECK (((min_spend IS NULL) OR (min_spend >= (0)::numeric)))`
- `CHECK (((per_user_limit IS NULL) OR (per_user_limit > 0)))`
- `CHECK ((product_type = ANY (ARRAY['membership'::text, 'service'::text, 'product'::text, 'wielo_credits'::text])))`

**Triggers:**
- `trigger_platform_coupons_touch` → `touch_platform_coupons_updated_at()`

**RLS policies:**
- `admin_full_platform_coupons` (ALL) — `USING is_super_admin() CHECK is_super_admin()`

### `platform_integrations`

| column | type | null | default |
|---|---|---|---|
| `id` | boolean | — | `true` |
| `meta_pixel_id` | text | yes | — |
| `meta_pixel_enabled` | boolean | — | `false` |
| `meta_capi_access_token` | text | yes | — |
| `meta_capi_enabled` | boolean | — | `false` |
| `meta_test_event_code` | text | yes | — |
| `updated_at` | timestamp with time zone | — | `now()` |
| `ga4_measurement_id` | text | yes | — |
| `gtm_container_id` | text | yes | — |
| `tiktok_pixel_id` | text | yes | — |
| `google_ads_id` | text | yes | — |

**Checks:**
- `CHECK (id)`

### `platform_ledger`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `user_id` | uuid | yes | — |
| `host_id` | uuid | yes | — |
| `subscription_id` | uuid | yes | — |
| `service_id` | uuid | yes | — |
| `plan` | text | yes | — |
| `billing_cycle` | text | yes | — |
| `type` | text | — | — |
| `status` | text | — | `'completed'::text` |
| `amount` | numeric | — | — |
| `currency` | text | — | `'ZAR'::text` |
| `vat_amount` | numeric | yes | — |
| `provider` | text | yes | `'paystack'::text` |
| `provider_reference` | text | yes | — |
| `invoice_id` | uuid | yes | — |
| `coupon_id` | uuid | yes | — |
| `reason` | text | yes | — |
| `created_by` | uuid | yes | — |
| `period_start` | timestamp with time zone | yes | — |
| `period_end` | timestamp with time zone | yes | — |
| `paid_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `product_id` | uuid | yes | — |
| `reverses_ledger_id` | uuid | yes | — |
| `environment` | text | — | `'live'::text` |
| `setup_fee_amount` | numeric | — | `0` |
| `affiliate_commission_id` | uuid | yes | — |
| `affiliate_payout_id` | uuid | yes | — |

**Foreign keys:**
- `FOREIGN KEY (affiliate_commission_id) REFERENCES affiliate_commissions(id) ON DELETE SET NULL`
- `FOREIGN KEY (affiliate_payout_id) REFERENCES affiliate_payouts(id) ON DELETE SET NULL`
- `FOREIGN KEY (coupon_id) REFERENCES platform_coupons(id) ON DELETE SET NULL`
- `FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE SET NULL`
- `FOREIGN KEY (plan) REFERENCES plans(key) ON UPDATE CASCADE`
- `FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL`
- `FOREIGN KEY (reverses_ledger_id) REFERENCES platform_ledger(id) ON DELETE SET NULL`
- `FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL`
- `FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE SET NULL`

**Unique:**
- `UNIQUE (provider_reference)`

**Checks:**
- `CHECK ((environment = ANY (ARRAY['test'::text, 'live'::text])))`
- `CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text])))`
- `CHECK ((type = ANY (ARRAY['charge'::text, 'refund'::text, 'credit'::text, 'adjustment'::text, 'commission'::text, 'payout'::text])))`

**Triggers:**
- `affiliate_clawback_on_refund` → `tg_affiliate_clawback_on_refund()` *(SECURITY DEFINER)*
- `trg_mint_wielo_credit_note` → `mint_wielo_credit_note_on_ledger_complete()` *(SECURITY DEFINER)*
- `trg_mint_wielo_invoice` → `mint_wielo_invoice_on_ledger_complete()` *(SECURITY DEFINER)*

**RLS policies:**
- `platform_ledger_own_read` (SELECT) — `USING (user_id = auth.uid())`

### `platform_payment_settings`

| column | type | null | default |
|---|---|---|---|
| `id` | boolean | — | `true` |
| `paystack_enabled` | boolean | — | `false` |
| `paystack_secret_key` | text | yes | — |
| `paystack_public_key` | text | yes | — |
| `eft_enabled` | boolean | — | `false` |
| `eft_bank_name` | text | yes | — |
| `eft_account_name` | text | yes | — |
| `eft_account_number` | text | yes | — |
| `eft_branch_code` | text | yes | — |
| `eft_reference_hint` | text | yes | — |
| `updated_at` | timestamp with time zone | — | `now()` |
| `paystack_mode` | text | — | `'live'::text` |
| `paystack_test_secret_key` | text | yes | — |
| `paystack_test_public_key` | text | yes | — |
| `paypal_enabled` | boolean | — | `false` |
| `paypal_environment` | text | — | `'test'::text` |
| `paypal_client_id` | text | yes | — |
| `paypal_secret_cipher` | text | yes | — |
| `eft_swift_code` | text | yes | — |

**Checks:**
- `CHECK (id)`
- `CHECK ((paypal_environment = ANY (ARRAY['test'::text, 'live'::text])))`
- `CHECK ((paystack_mode = ANY (ARRAY['live'::text, 'test'::text])))`

### `platform_services`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `name` | text | — | — |
| `description` | text | yes | — |
| `billing_type` | text | — | `'one_time'::text` |
| `price` | numeric | — | `0` |
| `currency` | text | — | `'ZAR'::text` |
| `billing_cycle` | text | yes | — |
| `is_active` | boolean | — | `true` |
| `sort_order` | integer | — | `0` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |

**Checks:**
- `CHECK ((billing_cycle = ANY (ARRAY['monthly'::text, 'annual'::text])))`
- `CHECK ((billing_type = ANY (ARRAY['one_time'::text, 'recurring'::text])))`

**RLS policies:**
- `platform_services_public_read` (SELECT) — `USING (is_active = true)`

### `platform_settings`

| column | type | null | default |
|---|---|---|---|
| `key` | text | — | — |
| `value` | jsonb | — | — |
| `description` | text | yes | — |
| `updated_by` | uuid | yes | — |
| `updated_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (updated_by) REFERENCES user_profiles(id) ON DELETE SET NULL`

**RLS policies:**
- `admin_write_settings` (ALL) — `USING is_super_admin()`
- `anyone_read_settings` (SELECT) — `USING (auth.role() = ANY (ARRAY['authenticated'::text, 'anon'::text]))`

### `platform_staff`

| column | type | null | default |
|---|---|---|---|
| `user_id` | uuid | — | — |
| `role_id` | text | — | — |
| `is_active` | boolean | — | `true` |
| `invited_by` | uuid | yes | — |
| `invited_at` | timestamp with time zone | yes | — |
| `accepted_at` | timestamp with time zone | yes | — |
| `last_active_at` | timestamp with time zone | yes | — |
| `mfa_enrolled_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (invited_by) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE RESTRICT`
- `FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE`

**RLS policies:**
- `admin_full_platform_staff` (ALL) — `USING is_super_admin()`
- `staff_read_own_membership` (SELECT) — `USING (user_id = auth.uid())`

### `platform_staff_invites`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `email` | text | — | — |
| `role_id` | text | — | — |
| `token` | text | — | `encode(gen_random_bytes(32), 'hex'::text)` |
| `expires_at` | timestamp with time zone | — | `(now() + '72:00:00'::interval)` |
| `invited_by` | uuid | yes | — |
| `accepted_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (invited_by) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE RESTRICT`

**Unique:**
- `UNIQUE (token)`

**RLS policies:**
- `admin_full_platform_staff_invites` (ALL) — `USING is_super_admin()`

### `policies`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `name` | text | — | — |
| `type` | text | — | — |
| `status` | text | — | `'active'::text` |
| `is_non_refundable` | boolean | — | `false` |
| `preset` | text | yes | — |
| `version` | integer | — | `1` |
| `parent_policy_id` | uuid | yes | — |
| `deleted_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `summary` | text | yes | — |
| `check_in_time` | time without time zone | yes | — |
| `check_out_time` | time without time zone | yes | — |
| `is_default` | boolean | — | `false` |
| `pets_allowed` | boolean | yes | — |
| `smoking_allowed` | boolean | yes | — |
| `parties_allowed` | boolean | yes | — |
| `children_welcome` | boolean | yes | — |
| `quiet_hours_start` | time without time zone | yes | — |
| `quiet_hours_end` | time without time zone | yes | — |
| `check_in_method` | text | yes | — |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`
- `FOREIGN KEY (parent_policy_id) REFERENCES policies(id) ON DELETE SET NULL`

**Checks:**
- `CHECK (((check_in_method IS NULL) OR (check_in_method = ANY (ARRAY['self'::text, 'host'::text, 'reception'::text]))))`
- `CHECK ((preset = ANY (ARRAY['flexible'::text, 'moderate'::text, 'strict'::text, 'non_refundable'::text, 'custom'::text])))`
- `CHECK ((status = ANY (ARRAY['active'::text, 'draft'::text, 'archived'::text])))`
- `CHECK ((type = ANY (ARRAY['cancellation'::text, 'check_in_out'::text, 'house_rules'::text, 'booking_terms'::text, 'privacy'::text])))`

**Triggers:**
- `set_updated_at` → `update_updated_at()`
- `trigger_version_policy` → `version_policy_on_update()`

**RLS policies:**
- `admin_full_access_policies` (ALL) — `USING is_super_admin()`
- `host_manage_policies` (ALL) — `USING (host_id = get_my_host_id())`
- `public_read_active_policies` (SELECT) — `USING ((status = 'active'::text) AND (deleted_at IS NULL) AND (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.is_active = true))))`
- `staff_read_policies` (SELECT) — `USING (host_id = get_my_host_id_as_staff())`

### `policy_cancellation_rules`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `policy_id` | uuid | — | — |
| `days_before` | integer | — | — |
| `refund_percent` | integer | — | — |
| `label` | text | — | — |
| `sort_order` | integer | — | `0` |

**Foreign keys:**
- `FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (policy_id, days_before)`

**Checks:**
- `CHECK ((days_before >= 0))`
- `CHECK (((refund_percent >= 0) AND (refund_percent <= 100)))`

**RLS policies:**
- `admin_full_access_rules` (ALL) — `USING is_super_admin()`
- `host_manage_cancellation_rules` (ALL) — `USING (policy_id IN ( SELECT policies.id
   FROM policies
  WHERE (policies.host_id = get_my_host_id())))`
- `public_read_cancellation_rules` (SELECT) — `USING (policy_id IN ( SELECT policies.id
   FROM policies
  WHERE (policies.status = 'active'::text)))`

### `policy_content`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `policy_id` | uuid | — | — |
| `body_html` | text | — | — |
| `body_plain` | text | yes | — |
| `locale` | text | — | `'en'::text` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (policy_id, locale)`

**Triggers:**
- `set_updated_at` → `update_updated_at()`
- `trigger_policy_plain_text` → `generate_policy_plain_text()`

**RLS policies:**
- `admin_full_access_content` (ALL) — `USING is_super_admin()`
- `host_manage_policy_content` (ALL) — `USING (policy_id IN ( SELECT policies.id
   FROM policies
  WHERE (policies.host_id = get_my_host_id())))`
- `public_read_policy_content` (SELECT) — `USING (policy_id IN ( SELECT policies.id
   FROM policies
  WHERE (policies.status = 'active'::text)))`

### `policy_snapshots`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `booking_id` | uuid | — | — |
| `policy_id` | uuid | — | — |
| `policy_type` | text | — | — |
| `policy_version` | integer | — | — |
| `policy_name` | text | — | — |
| `snapshot_data` | jsonb | — | — |
| `snapshotted_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT`
- `FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE RESTRICT`

**Unique:**
- `UNIQUE (booking_id, policy_type)`

**Checks:**
- `CHECK ((policy_type = ANY (ARRAY['cancellation'::text, 'check_in_out'::text, 'house_rules'::text, 'booking_terms'::text, 'privacy'::text])))`

**Triggers:**
- `trg_policy_snapshots_immutable` → `forbid_policy_snapshot_mutation()`

**RLS policies:**
- `admin_full_access_snapshots` (ALL) — `USING is_super_admin()`
- `guest_read_own_snapshots` (SELECT) — `USING (booking_id IN ( SELECT bookings.id
   FROM bookings
  WHERE (bookings.guest_id = auth.uid())))`
- `host_read_booking_snapshots` (SELECT) — `USING (booking_id IN ( SELECT bookings.id
   FROM bookings
  WHERE (bookings.host_id = get_my_host_id())))`

### `product_features`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `product_id` | uuid | — | — |
| `feature_key` | text | — | — |
| `is_enabled` | boolean | — | `true` |
| `limit_value` | integer | yes | — |
| `updated_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (product_id, feature_key)`

**RLS policies:**
- `product_features_public_read` (SELECT) — `USING true`

### `product_orders`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `product_id` | uuid | yes | — |
| `product_name` | text | — | — |
| `payer_email` | text | — | — |
| `payer_user_id` | uuid | yes | — |
| `amount` | numeric | — | — |
| `currency` | text | — | `'ZAR'::text` |
| `status` | text | — | `'pending'::text` |
| `method` | text | yes | — |
| `pay_token` | text | — | — |
| `provider_reference` | text | yes | — |
| `created_by` | uuid | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `paid_at` | timestamp with time zone | yes | — |
| `environment` | text | — | `'live'::text` |
| `activate_on_pay` | boolean | — | `true` |
| `setup_fee_amount` | numeric | — | `0` |
| `coupon_id` | uuid | yes | — |
| `discount_amount` | numeric | — | `0` |

**Foreign keys:**
- `FOREIGN KEY (coupon_id) REFERENCES platform_coupons(id) ON DELETE SET NULL`
- `FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (payer_user_id) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL`

**Unique:**
- `UNIQUE (pay_token)`
- `UNIQUE (provider_reference)`

**Checks:**
- `CHECK ((discount_amount >= (0)::numeric))`
- `CHECK ((environment = ANY (ARRAY['test'::text, 'live'::text])))`
- `CHECK ((method = ANY (ARRAY['paystack'::text, 'paypal'::text, 'eft'::text])))`
- `CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'cancelled'::text, 'expired'::text])))`

### `products`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `name` | text | — | — |
| `description` | text | yes | — |
| `price` | numeric | — | `0` |
| `currency` | text | — | `'ZAR'::text` |
| `billing_cycle` | text | yes | — |
| `is_active` | boolean | — | `true` |
| `is_recommended` | boolean | — | `false` |
| `sort_order` | integer | — | `0` |
| `affiliate_type` | text | — | `'none'::text` |
| `affiliate_value` | numeric | — | `0` |
| `bullets` | jsonb | — | `'[]'::jsonb` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `payment_methods` | text[] | — | `'{paystack}'::text[]` |
| `trial_days` | integer | — | `0` |
| `is_visible` | boolean | — | `true` |
| `slug` | text | yes | — |
| `setup_fee` | numeric | — | `0` |
| `setup_fee_label` | text | yes | — |
| `setup_fee_affiliate_type` | text | — | `'none'::text` |
| `setup_fee_affiliate_value` | numeric | — | `0` |
| `affiliate_duration` | text | — | `'once'::text` |
| `affiliate_duration_months` | integer | yes | — |
| `plan_key` | text | yes | — |
| `product_type` | text | — | — |
| `credit_quantity` | integer | yes | — |
| `credit_purpose` | text | yes | — |
| `type` | text | yes | `
CASE
    WHEN (product_type = ANY (ARRAY['product'::text, '` |
| `max_quantity` | integer | yes | — |

**Checks:**
- `CHECK ((affiliate_duration = ANY (ARRAY['once'::text, 'months'::text, 'forever'::text])))`
- `CHECK ((affiliate_type = ANY (ARRAY['none'::text, 'amount'::text, 'percent'::text])))`
- `CHECK ((billing_cycle = ANY (ARRAY['weekly'::text, 'monthly'::text, 'quarterly'::text, 'biannual'::text, 'annual'::text])))`
- `CHECK (((max_quantity IS NULL) OR (max_quantity >= 0)))`
- `CHECK ((product_type = ANY (ARRAY['membership'::text, 'service'::text, 'product'::text, 'wielo_credits'::text])))`
- `CHECK ((setup_fee_affiliate_type = ANY (ARRAY['none'::text, 'amount'::text, 'percent'::text])))`

**RLS policies:**
- `products_public_read` (SELECT) — `USING (is_active = true)`

### `properties`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `property_type` | text | — | — |
| `accommodation_type` | text | yes | — |
| `experience_type` | text | yes | — |
| `name` | text | — | — |
| `slug` | text | yes | — |
| `description` | text | yes | — |
| `house_rules` | text | yes | — |
| `what_to_bring` | text | yes | — |
| `address_line1` | text | yes | — |
| `address_line2` | text | yes | — |
| `city` | text | yes | — |
| `province` | text | yes | — |
| `country` | text | — | `'ZA'::text` |
| `postal_code` | text | yes | — |
| `latitude` | numeric | yes | — |
| `longitude` | numeric | yes | — |
| `location` | geometry(Point,4326) | yes | — |
| `bedrooms` | integer | yes | — |
| `bathrooms` | integer | yes | — |
| `max_guests` | integer | yes | — |
| `room_config` | jsonb | yes | — |
| `check_in_time` | time without time zone | yes | — |
| `check_out_time` | time without time zone | yes | — |
| `min_nights` | integer | yes | `1` |
| `max_nights` | integer | yes | — |
| `duration_minutes` | integer | yes | — |
| `max_participants` | integer | yes | — |
| `min_participants` | integer | yes | `1` |
| `meeting_point` | text | yes | — |
| `schedule` | jsonb | yes | — |
| `base_price` | numeric | yes | — |
| `weekend_price` | numeric | yes | — |
| `cleaning_fee` | numeric | yes | — |
| `private_group_price` | numeric | yes | — |
| `currency` | text | — | `'ZAR'::text` |
| `cancellation_policy` | text | — | `'moderate'::text` |
| `instant_booking` | boolean | — | `false` |
| `accepts_paystack` | boolean | — | `false` |
| `accepts_paypal` | boolean | — | `false` |
| `accepts_eft` | boolean | — | `false` |
| `is_published` | boolean | — | `false` |
| `is_featured` | boolean | — | `false` |
| `is_suspended` | boolean | — | `false` |
| `published_at` | timestamp with time zone | yes | — |
| `search_vector` | tsvector | yes | `to_tsvector('english'::regconfig, ((((((((COALESCE(name, '':` |
| `total_bookings` | integer | — | `0` |
| `total_reviews` | integer | — | `0` |
| `avg_rating` | numeric | yes | `0` |
| `deleted_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `cancellation_policy_label` | text | yes | — |
| `is_non_refundable` | boolean | — | `false` |
| `booking_mode` | text | — | `'whole_listing'::text` |
| `category_id` | uuid | yes | — |
| `whole_property_discount_pct` | numeric | yes | — |
| `weekly_discount_pct` | numeric | yes | — |
| `monthly_discount_pct` | numeric | yes | — |
| `child_price` | numeric | — | `0` |
| `infant_price` | numeric | — | `0` |
| `pet_fee` | numeric | — | `0` |
| `infant_max_age` | integer | — | `2` |
| `child_max_age` | integer | — | `12` |
| `allow_children` | boolean | — | `true` |
| `allow_infants` | boolean | — | `true` |
| `allow_pets` | boolean | — | `true` |
| `vat_number` | text | yes | — |
| `vat_rate` | numeric | — | `15` |
| `featured_review_id` | uuid | yes | — |
| `business_id` | uuid | — | — |

**Foreign keys:**
- `FOREIGN KEY (business_id) REFERENCES businesses(id)`
- `FOREIGN KEY (category_id) REFERENCES property_categories(id) ON DELETE SET NULL`
- `FOREIGN KEY (featured_review_id) REFERENCES reviews(id) ON DELETE SET NULL`
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE RESTRICT`

**Unique:**
- `UNIQUE (slug)`

**Checks:**
- `CHECK ((child_max_age >= infant_max_age))`
- `CHECK ((booking_mode = ANY (ARRAY['whole_listing'::text, 'rooms_only'::text, 'flexible'::text])))`
- `CHECK ((cancellation_policy = ANY (ARRAY['flexible'::text, 'moderate'::text, 'strict'::text])))`
- `CHECK (((child_max_age >= 0) AND (child_max_age <= 17)))`
- `CHECK ((child_price >= (0)::numeric))`
- `CHECK (((infant_max_age >= 0) AND (infant_max_age <= 17)))`
- `CHECK ((infant_price >= (0)::numeric))`
- `CHECK ((property_type = ANY (ARRAY['accommodation'::text, 'experience'::text])))`
- `CHECK (((monthly_discount_pct IS NULL) OR ((monthly_discount_pct >= (0)::numeric) AND (monthly_discount_pct <= (90)::numeric))))`
- `CHECK ((pet_fee >= (0)::numeric))`
- `CHECK (((vat_rate >= (0)::numeric) AND (vat_rate <= (100)::numeric)))`
- `CHECK (((weekly_discount_pct IS NULL) OR ((weekly_discount_pct >= (0)::numeric) AND (weekly_discount_pct <= (90)::numeric))))`
- `CHECK (((whole_property_discount_pct IS NULL) OR ((whole_property_discount_pct >= (0)::numeric) AND (whole_property_discount_pct <= (90)::numeric))))`

**Triggers:**
- `set_updated_at` → `update_updated_at()`
- `trg_listing_default_business` → `set_listing_default_business()` *(SECURITY DEFINER)*
- `trg_listing_requires_bank` → `enforce_listing_requires_bank()` *(SECURITY DEFINER)*
- `trigger_listing_slug` → `generate_listing_slug()`
- `trigger_sync_listing_location` → `sync_listing_location()`

**RLS policies:**
- `admin_full_listings` (ALL) — `USING is_super_admin()`
- `host_manage_own_listings` (ALL) — `USING (host_id = get_my_host_id())`
- `public_read_published` (SELECT) — `USING ((is_published = true) AND (is_suspended = false) AND (deleted_at IS NULL))`
- `staff_read_listings` (SELECT) — `USING (host_id = get_my_host_id_as_staff())`
- `staff_update_listings` (UPDATE) — `USING (host_id = get_my_host_id_as_staff())`

### `property_access`

| column | type | null | default |
|---|---|---|---|
| `property_id` | uuid | — | — |
| `check_in_method` | text | yes | — |
| `check_in_instructions` | text | yes | — |
| `door_code` | text | yes | — |
| `wifi_network` | text | yes | — |
| `wifi_password` | text | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `gate_code` | text | yes | — |
| `send_lead_minutes` | integer | — | `60` |

**Foreign keys:**
- `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`

**Checks:**
- `CHECK (((send_lead_minutes >= 15) AND (send_lead_minutes <= 10080)))`

**Triggers:**
- `set_updated_at_listing_access` → `update_updated_at()`

**RLS policies:**
- `listing_access_host_manage` (ALL) — `USING (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.host_id IN ( SELECT hosts.id
           FROM hosts
          WHERE (hosts.user_id = auth.uid()))))) CHECK (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.host_id IN ( SELECT hosts.id
           FROM hosts
          WHERE (hosts.user_id = auth.uid())))))`

### `property_addons`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `property_id` | uuid | — | — |
| `addon_id` | uuid | — | — |
| `room_id` | uuid | yes | — |
| `unit_price_override` | numeric | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (addon_id) REFERENCES addons(id) ON DELETE CASCADE`
- `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`
- `FOREIGN KEY (room_id) REFERENCES property_rooms(id) ON DELETE CASCADE`

**Checks:**
- `CHECK (((unit_price_override IS NULL) OR (unit_price_override >= (0)::numeric)))`

**RLS policies:**
- `admin_full_listing_addons` (ALL) — `USING is_super_admin()`
- `host_manage_own_listing_addons` (ALL) — `USING (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.host_id = get_my_host_id())))`
- `public_read_listing_addons` (SELECT) — `USING (property_id IN ( SELECT properties.id
   FROM properties
  WHERE ((properties.is_published = true) AND (properties.is_suspended = false) AND (properties.deleted_at IS NULL))))`
- `staff_read_listing_addons` (SELECT) — `USING (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.host_id = get_my_host_id_as_staff())))`

### `property_amenities`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `property_id` | uuid | — | — |
| `amenity_key` | text | — | — |
| `amenity_label` | text | yes | — |
| `room_id` | uuid | yes | — |
| `catalog_id` | uuid | yes | — |

**Foreign keys:**
- `FOREIGN KEY (catalog_id) REFERENCES amenity_catalog(id) ON DELETE SET NULL`
- `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`
- `FOREIGN KEY (room_id) REFERENCES property_rooms(id) ON DELETE SET NULL`

**RLS policies:**
- `admin_full_amenities` (ALL) — `USING is_super_admin()`
- `host_manage_amenities` (ALL) — `USING (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.host_id = get_my_host_id())))`
- `public_read_amenities` (SELECT) — `USING (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.is_published = true)))`

### `property_categories`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `parent_id` | uuid | yes | — |
| `kind` | text | — | — |
| `slug` | text | — | — |
| `label` | text | — | — |
| `description` | text | yes | — |
| `icon` | text | — | `'home'::text` |
| `sort_order` | integer | — | `100` |
| `is_published` | boolean | — | `true` |
| `hero_image_url` | text | yes | — |
| `og_image_url` | text | yes | — |
| `meta_title` | text | yes | — |
| `meta_description` | text | yes | — |
| `canonical_url` | text | yes | — |
| `intro_markdown` | text | yes | — |
| `faq` | jsonb | — | `'[]'::jsonb` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |

**Foreign keys:**
- `FOREIGN KEY (parent_id) REFERENCES property_categories(id) ON DELETE RESTRICT`

**Checks:**
- `CHECK ((kind = ANY (ARRAY['accommodation'::text, 'experience'::text])))`
- `CHECK ((parent_id IS DISTINCT FROM id))`

**Triggers:**
- `set_listing_categories_updated_at` → `update_updated_at()`

**RLS policies:**
- `admin_full_listing_categories` (ALL) — `USING (is_super_admin() OR has_admin_permission('taxonomy.manage'::text))`
- `public_read_listing_categories` (SELECT) — `USING ((is_published = true) AND (deleted_at IS NULL))`

### `property_counters`

| column | type | null | default |
|---|---|---|---|
| `property_id` | uuid | — | — |
| `last_booking_number` | integer | — | `0` |
| `updated_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`

### `property_local_picks`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `property_id` | uuid | — | — |
| `category` | text | — | `'do'::text` |
| `title` | text | — | — |
| `blurb` | text | yes | — |
| `image_path` | text | yes | — |
| `distance_label` | text | yes | — |
| `sort_order` | integer | — | `0` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`

**Checks:**
- `CHECK ((category = ANY (ARRAY['eat'::text, 'do'::text, 'see'::text, 'drink'::text, 'shop'::text, 'other'::text])))`

**Triggers:**
- `set_updated_at_listing_local_picks` → `update_updated_at()`

**RLS policies:**
- `listing_local_picks_host_manage` (ALL) — `USING (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.host_id IN ( SELECT hosts.id
           FROM hosts
          WHERE (hosts.user_id = auth.uid()))))) CHECK (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.host_id IN ( SELECT hosts.id
           FROM hosts
          WHERE (hosts.user_id = auth.uid())))))`
- `listing_local_picks_public_read` (SELECT) — `USING true`

### `property_photos`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `property_id` | uuid | — | — |
| `storage_path` | text | — | — |
| `url` | text | — | — |
| `sort_order` | integer | — | `0` |
| `caption` | text | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `room_id` | uuid | yes | — |

**Foreign keys:**
- `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`
- `FOREIGN KEY (room_id) REFERENCES property_rooms(id) ON DELETE SET NULL`

**RLS policies:**
- `admin_full_photos` (ALL) — `USING is_super_admin()`
- `host_manage_photos` (ALL) — `USING (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.host_id = get_my_host_id())))`
- `public_read_photos` (SELECT) — `USING (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.is_published = true)))`

### `property_points_of_interest`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `property_id` | uuid | — | — |
| `category` | text | — | — |
| `name` | text | — | — |
| `travel_time` | text | yes | — |
| `sort_order` | integer | — | `0` |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`

**Checks:**
- `CHECK ((category = ANY (ARRAY['eat'::text, 'do'::text, 'travel'::text])))`

**RLS policies:**
- `admin_full_poi` (ALL) — `USING is_super_admin()`
- `host_manage_poi` (ALL) — `USING (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.host_id = get_my_host_id()))) CHECK (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.host_id = get_my_host_id())))`
- `public_read_poi` (SELECT) — `USING (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.is_published = true)))`

### `property_policies`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `property_id` | uuid | — | — |
| `policy_id` | uuid | — | — |
| `policy_type` | text | — | — |
| `assigned_at` | timestamp with time zone | — | `now()` |
| `assigned_by` | uuid | yes | — |
| `room_id` | uuid | yes | — |

**Foreign keys:**
- `FOREIGN KEY (assigned_by) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`
- `FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE RESTRICT`
- `FOREIGN KEY (room_id) REFERENCES property_rooms(id) ON DELETE CASCADE`

**Checks:**
- `CHECK ((policy_type = ANY (ARRAY['cancellation'::text, 'check_in_out'::text, 'house_rules'::text, 'booking_terms'::text, 'privacy'::text])))`

**Triggers:**
- `trigger_sync_listing_policy_label` → `sync_listing_policy_label()` *(SECURITY DEFINER)*

**RLS policies:**
- `admin_full_access_listing_policies` (ALL) — `USING is_super_admin()`
- `host_manage_listing_policies` (ALL) — `USING (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.host_id = get_my_host_id())))`
- `public_read_listing_policies` (SELECT) — `USING (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.is_published = true)))`
- `staff_read_listing_policies` (SELECT) — `USING (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.host_id = get_my_host_id_as_staff())))`

### `property_rankings`

| column | type | null | default |
|---|---|---|---|
| `property_id` | uuid | — | — |
| `ranking_score` | numeric | — | `0` |
| `component_rating` | numeric | — | `0` |
| `component_reviews` | numeric | — | `0` |
| `component_profile` | numeric | — | `0` |
| `component_response_rate` | numeric | — | `0` |
| `component_plan_boost` | numeric | — | `0` |
| `last_calculated` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`

**RLS policies:**
- `public_read_rankings` (SELECT) — `USING (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.is_published = true)))`

### `property_review_themes`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `property_id` | uuid | — | — |
| `label` | text | — | — |
| `icon_key` | text | — | `'sparkles'::text` |
| `mention_count` | integer | yes | — |
| `sort_order` | integer | — | `0` |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`

**RLS policies:**
- `admin_full_review_themes` (ALL) — `USING is_super_admin()`
- `host_manage_review_themes` (ALL) — `USING (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.host_id = get_my_host_id()))) CHECK (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.host_id = get_my_host_id())))`
- `public_read_review_themes` (SELECT) — `USING (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.is_published = true)))`

### `property_room_access`

| column | type | null | default |
|---|---|---|---|
| `room_id` | uuid | — | — |
| `check_in_method` | text | yes | — |
| `check_in_instructions` | text | yes | — |
| `gate_code` | text | yes | — |
| `door_code` | text | yes | — |
| `wifi_network` | text | yes | — |
| `wifi_password` | text | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (room_id) REFERENCES property_rooms(id) ON DELETE CASCADE`

**Triggers:**
- `set_updated_at_listing_room_access` → `update_updated_at()`

**RLS policies:**
- `listing_room_access_host_manage` (ALL) — `USING (room_id IN ( SELECT lr.id
   FROM (property_rooms lr
     JOIN properties l ON ((l.id = lr.property_id)))
  WHERE (l.host_id IN ( SELECT hosts.id
           FROM hosts
          WHERE (hosts.user_id = auth.uid()))))) CHECK (room_id IN ( SELECT lr.id
   FROM (property_rooms lr
     JOIN properties l ON ((l.id = lr.property_id)))
  WHERE (l.host_id IN ( SELECT hosts.id
           FROM hosts
          WHERE (hosts.user_id = auth.uid())))))`

### `property_rooms`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `property_id` | uuid | — | — |
| `name` | text | — | — |
| `description` | text | yes | — |
| `bedrooms` | integer | yes | `1` |
| `bathrooms` | integer | yes | `0` |
| `max_guests` | integer | — | `2` |
| `base_price` | numeric | — | — |
| `weekend_price` | numeric | yes | — |
| `cleaning_fee` | numeric | — | `0` |
| `currency` | text | — | `'ZAR'::text` |
| `sort_order` | integer | — | `0` |
| `is_active` | boolean | — | `true` |
| `deleted_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `featured_photo_id` | uuid | yes | — |
| `room_size_sqm` | numeric | yes | — |
| `bed_type` | text | yes | — |
| `view_type` | text | yes | — |
| `experiences` | text[] | — | `'{}'::text[]` |
| `has_ensuite_bathroom` | boolean | — | `false` |
| `smoking_allowed` | boolean | — | `false` |
| `pets_allowed` | boolean | — | `false` |
| `wheelchair_accessible` | boolean | — | `false` |
| `private_entrance` | boolean | — | `false` |
| `floor_number` | integer | yes | — |
| `inventory_count` | integer | — | `1` |
| `pricing_mode` | text | — | `'per_room'::text` |
| `price_per_person` | numeric | yes | — |
| `base_occupancy` | integer | yes | — |
| `extra_guest_price` | numeric | yes | — |
| `min_guests` | integer | — | `1` |
| `min_nights` | integer | — | `1` |
| `child_price` | numeric | — | `0` |
| `infant_price` | numeric | — | `0` |
| `pet_fee` | numeric | — | `0` |
| `infant_max_age` | integer | — | `2` |
| `child_max_age` | integer | — | `12` |
| `allow_children` | boolean | — | `true` |
| `allow_infants` | boolean | — | `true` |
| `allow_pets` | boolean | — | `true` |

**Foreign keys:**
- `FOREIGN KEY (featured_photo_id) REFERENCES property_photos(id) ON DELETE SET NULL`
- `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`

**Checks:**
- `CHECK ((child_max_age >= infant_max_age))`
- `CHECK (((child_max_age >= 0) AND (child_max_age <= 17)))`
- `CHECK ((child_price >= (0)::numeric))`
- `CHECK (((floor_number IS NULL) OR ((floor_number >= '-5'::integer) AND (floor_number <= 200))))`
- `CHECK (((infant_max_age >= 0) AND (infant_max_age <= 17)))`
- `CHECK ((infant_price >= (0)::numeric))`
- `CHECK (((inventory_count >= 1) AND (inventory_count <= 99)))`
- `CHECK ((min_guests >= 1))`
- `CHECK ((min_nights >= 1))`
- `CHECK ((pet_fee >= (0)::numeric))`
- `CHECK ((pricing_mode = ANY (ARRAY['per_room'::text, 'per_person'::text, 'per_room_plus_extra'::text])))`
- `CHECK (((char_length(name) >= 1) AND (char_length(name) <= 120)))`

**Triggers:**
- `trigger_listing_rooms_touch` → `touch_listing_rooms_updated_at()`

**RLS policies:**
- `admin_full_rooms` (ALL) — `USING is_super_admin()`
- `host_manage_own_rooms` (ALL) — `USING (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.host_id = get_my_host_id())))`
- `public_read_active_rooms` (SELECT) — `USING ((deleted_at IS NULL) AND (is_active = true) AND (property_id IN ( SELECT properties.id
   FROM properties
  WHERE ((properties.is_published = true) AND (properties.is_suspended = false) AND (properties.deleted_at IS NULL)))))`
- `staff_read_rooms` (SELECT) — `USING (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.host_id = get_my_host_id_as_staff())))`
- `staff_update_rooms` (UPDATE) — `USING (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.host_id = get_my_host_id_as_staff())))`

### `property_seasonal_pricing`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `property_id` | uuid | — | — |
| `label` | text | — | — |
| `start_date` | date | — | — |
| `end_date` | date | — | — |
| `price` | numeric | yes | — |
| `currency` | text | — | `'ZAR'::text` |
| `created_at` | timestamp with time zone | — | `now()` |
| `room_id` | uuid | yes | — |
| `min_nights` | integer | yes | — |
| `priority` | integer | — | `0` |
| `is_active` | boolean | — | `true` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `adjustment_type` | text | — | `'absolute'::text` |
| `adjustment_value` | numeric | — | — |

**Foreign keys:**
- `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`
- `FOREIGN KEY (room_id) REFERENCES property_rooms(id) ON DELETE CASCADE`

**Checks:**
- `CHECK (((min_nights IS NULL) OR (min_nights > 0)))`
- `CHECK ((adjustment_type = ANY (ARRAY['absolute'::text, 'percent'::text])))`
- `CHECK ((((adjustment_type = 'absolute'::text) AND (adjustment_value > (0)::numeric)) OR ((adjustment_type = 'percent'::text) AND (adjustment_value >= ('-100'::integer)::numeric) AND (adjustment_value <= (1000)::numeric))))`
- `CHECK ((end_date >= start_date))`

**Triggers:**
- `trigger_seasonal_pricing_touch` → `touch_seasonal_pricing_updated_at()`

**RLS policies:**
- `admin_full_seasonal` (ALL) — `USING is_super_admin()`
- `host_manage_seasonal_pricing` (ALL) — `USING (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.host_id = get_my_host_id())))`
- `public_read_seasonal_pricing` (SELECT) — `USING (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.is_published = true)))`

### `property_view_events`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `property_id` | uuid | — | — |
| `session_id` | text | — | — |
| `user_id` | uuid | yes | — |
| `duration_seconds` | integer | yes | — |
| `device` | text | yes | — |
| `referrer` | text | yes | — |
| `country` | text | yes | — |
| `viewed_at` | timestamp with time zone | — | `now()` |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`
- `FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE SET NULL`

**Checks:**
- `CHECK ((device = ANY (ARRAY['mobile'::text, 'tablet'::text, 'desktop'::text])))`

**RLS policies:**
- `listing_view_events_admin_read` (SELECT) — `USING (EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'super_admin'::text))))`
- `listing_view_events_host_read` (SELECT) — `USING (property_id IN ( SELECT properties.id
   FROM properties
  WHERE (properties.host_id IN ( SELECT hosts.id
           FROM hosts
          WHERE (hosts.user_id = auth.uid())))))`

### `push_tokens`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `user_id` | uuid | — | — |
| `token` | text | — | — |
| `platform` | text | — | — |
| `device_name` | text | yes | — |
| `is_active` | boolean | — | `true` |
| `last_used_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (token)`

**Checks:**
- `CHECK ((platform = ANY (ARRAY['ios'::text, 'android'::text])))`

**RLS policies:**
- `user_manage_own_tokens` (ALL) — `USING (user_id = auth.uid())`

### `quote_addons`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `quote_id` | uuid | — | — |
| `label` | text | — | — |
| `quantity` | numeric | — | `1` |
| `unit_price` | numeric | — | — |
| `subtotal` | numeric | yes | `(quantity * unit_price)` |
| `sort_order` | integer | — | `0` |
| `created_at` | timestamp with time zone | — | `now()` |
| `addon_id` | uuid | yes | — |
| `kind` | text | — | `'custom'::text` |

**Foreign keys:**
- `FOREIGN KEY (addon_id) REFERENCES addons(id) ON DELETE SET NULL`
- `FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE`

**Checks:**
- `CHECK (((char_length(label) >= 1) AND (char_length(label) <= 200)))`
- `CHECK ((kind = ANY (ARRAY['custom'::text, 'catalog'::text, 'age'::text])))`

**RLS policies:**
- `admin_full_quote_addons` (ALL) — `USING is_super_admin()`
- `guest_read_own_quote_addons` (SELECT) — `USING (quote_id IN ( SELECT quotes.id
   FROM quotes
  WHERE (quotes.guest_id = auth.uid())))`
- `host_manage_own_quote_addons` (ALL) — `USING (quote_id IN ( SELECT quotes.id
   FROM quotes
  WHERE (quotes.host_id = get_my_host_id())))`

### `quote_notes`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `quote_id` | uuid | — | — |
| `author_id` | uuid | yes | — |
| `body` | text | — | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (author_id) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE`

**RLS policies:**
- `quote_notes_host_manage` (ALL) — `USING (quote_id IN ( SELECT quotes.id
   FROM quotes
  WHERE (quotes.host_id IN ( SELECT hosts.id
           FROM hosts
          WHERE (hosts.user_id = auth.uid()))))) CHECK (quote_id IN ( SELECT quotes.id
   FROM quotes
  WHERE (quotes.host_id IN ( SELECT hosts.id
           FROM hosts
          WHERE (hosts.user_id = auth.uid())))))`

### `quote_rooms`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `quote_id` | uuid | — | — |
| `room_id` | uuid | — | — |
| `base_amount` | numeric | — | — |
| `cleaning_fee` | numeric | — | `0` |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE`
- `FOREIGN KEY (room_id) REFERENCES property_rooms(id) ON DELETE RESTRICT`

**Unique:**
- `UNIQUE (quote_id, room_id)`

**RLS policies:**
- `admin_full_quote_rooms` (ALL) — `USING is_super_admin()`
- `guest_read_own_quote_rooms` (SELECT) — `USING (quote_id IN ( SELECT quotes.id
   FROM quotes
  WHERE (quotes.guest_id = auth.uid())))`
- `host_manage_own_quote_rooms` (ALL) — `USING (quote_id IN ( SELECT quotes.id
   FROM quotes
  WHERE (quotes.host_id = get_my_host_id())))`

### `quote_versions`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `quote_id` | uuid | — | — |
| `version_no` | integer | — | — |
| `snapshot` | jsonb | — | — |
| `total_amount` | numeric | — | `0` |
| `currency` | text | — | `'ZAR'::text` |
| `created_at` | timestamp with time zone | — | `now()` |
| `reason` | text | yes | — |

**Foreign keys:**
- `FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (quote_id, version_no)`

**RLS policies:**
- `host_insert_own_quote_versions` (INSERT) — `CHECK (quote_id IN ( SELECT quotes.id
   FROM quotes
  WHERE (quotes.host_id = get_my_host_id())))`
- `host_read_own_quote_versions` (SELECT) — `USING (quote_id IN ( SELECT quotes.id
   FROM quotes
  WHERE (quotes.host_id = get_my_host_id())))`
- `staff_read_quote_versions` (SELECT) — `USING (quote_id IN ( SELECT quotes.id
   FROM quotes
  WHERE (quotes.host_id = get_my_host_id_as_staff())))`

### `quote_view_events`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `quote_id` | uuid | — | — |
| `device` | text | yes | — |
| `opened_at` | timestamp with time zone | — | `now()` |
| `kind` | text | — | `'view'::text` |

**Foreign keys:**
- `FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE`

**Checks:**
- `CHECK ((kind = ANY (ARRAY['view'::text, 'download'::text])))`

**RLS policies:**
- `quote_view_events_host_read` (SELECT) — `USING (quote_id IN ( SELECT quotes.id
   FROM quotes
  WHERE (quotes.host_id IN ( SELECT hosts.id
           FROM hosts
          WHERE (hosts.user_id = auth.uid())))))`

### `quotes`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `property_id` | uuid | yes | — |
| `quote_number` | text | — | — |
| `guest_name` | text | — | — |
| `guest_email` | text | — | — |
| `guest_phone` | text | yes | — |
| `guest_id` | uuid | yes | — |
| `check_in` | date | yes | — |
| `check_out` | date | yes | — |
| `headcount` | integer | — | `1` |
| `scope` | text | — | `'whole_listing'::text` |
| `base_amount` | numeric | — | — |
| `cleaning_fee` | numeric | — | `0` |
| `addons_total` | numeric | — | `0` |
| `total_amount` | numeric | — | — |
| `currency` | text | — | `'ZAR'::text` |
| `notes` | text | yes | — |
| `policy_snapshot` | jsonb | yes | — |
| `status` | text | — | `'draft'::text` |
| `previous_status` | text | yes | — |
| `accept_token` | text | — | `gen_url_token()` |
| `valid_until` | timestamp with time zone | yes | — |
| `sent_at` | timestamp with time zone | yes | — |
| `accepted_at` | timestamp with time zone | yes | — |
| `declined_at` | timestamp with time zone | yes | — |
| `converted_at` | timestamp with time zone | yes | — |
| `converted_booking_id` | uuid | yes | — |
| `deleted_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `version` | integer | — | `1` |
| `guests_breakdown` | jsonb | yes | — |
| `discount_type` | text | yes | — |
| `discount_value` | numeric | — | `0` |
| `discount_reason` | text | yes | — |
| `discount_amount` | numeric | — | `0` |
| `deposit_type` | text | — | `'full'::text` |
| `deposit_pct` | numeric | — | `50` |
| `deposit_amount` | numeric | — | `0` |
| `balance_amount` | numeric | — | `0` |
| `balance_due_days` | integer | — | `7` |
| `conversation_id` | uuid | yes | — |
| `price_mode` | text | — | `'itemised'::text` |
| `looking_for_post_id` | uuid | yes | — |
| `decline_reason` | text | yes | — |
| `decline_note` | text | yes | — |
| `quote_type` | text | — | `'accommodation'::text` |
| `title` | text | yes | — |
| `attachment_path` | text | yes | — |
| `attachment_name` | text | yes | — |
| `brochure_path` | text | yes | — |
| `brochure_name` | text | yes | — |

**Foreign keys:**
- `FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL`
- `FOREIGN KEY (converted_booking_id) REFERENCES bookings(id) ON DELETE SET NULL`
- `FOREIGN KEY (guest_id) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`
- `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT`
- `FOREIGN KEY (looking_for_post_id) REFERENCES looking_for_posts(id)`

**Unique:**
- `UNIQUE (accept_token)`
- `UNIQUE (quote_number)`

**Checks:**
- `CHECK ((check_out > check_in))`
- `CHECK ((balance_amount >= (0)::numeric))`
- `CHECK ((balance_due_days >= 0))`
- `CHECK ((deposit_amount >= (0)::numeric))`
- `CHECK (((deposit_pct >= (0)::numeric) AND (deposit_pct <= (100)::numeric)))`
- `CHECK ((deposit_type = ANY (ARRAY['deposit'::text, 'full'::text, 'reserve'::text])))`
- `CHECK ((discount_amount >= (0)::numeric))`
- `CHECK (((discount_type IS NULL) OR (discount_type = ANY (ARRAY['percent'::text, 'fixed'::text]))))`
- `CHECK ((discount_value >= (0)::numeric))`
- `CHECK ((price_mode = ANY (ARRAY['itemised'::text, 'single'::text])))`
- `CHECK ((quote_type = ANY (ARRAY['accommodation'::text, 'custom'::text, 'upload'::text])))`
- `CHECK ((scope = ANY (ARRAY['whole_listing'::text, 'rooms'::text])))`
- `CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'accepted'::text, 'declined'::text, 'expired'::text, 'converted'::text])))`

**Triggers:**
- `set_updated_at` → `update_updated_at()`
- `trg_refund_lf_quote_credit_on_expire` → `refund_lf_quote_credit_on_expire()` *(SECURITY DEFINER)*
- `trigger_quote_status_change` → `on_quote_status_change()` *(SECURITY DEFINER)*

**RLS policies:**
- `admin_full_quotes` (ALL) — `USING is_super_admin()`
- `guest_read_own_quotes` (SELECT) — `USING (guest_id = auth.uid())`
- `host_manage_own_quotes` (ALL) — `USING (host_id = get_my_host_id())`
- `staff_read_quotes` (SELECT) — `USING (host_id = get_my_host_id_as_staff())`
- `staff_update_quotes` (UPDATE) — `USING (host_id = get_my_host_id_as_staff())`

### `refund_requests`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `booking_id` | uuid | — | — |
| `payment_id` | uuid | — | — |
| `host_id` | uuid | — | — |
| `guest_id` | uuid | — | — |
| `requested_amount` | numeric | — | — |
| `approved_amount` | numeric | yes | — |
| `currency` | text | — | `'ZAR'::text` |
| `reason` | text | — | — |
| `reason_detail` | text | yes | — |
| `supporting_doc_url` | text | yes | — |
| `initiated_by` | text | — | `'guest'::text` |
| `is_auto_refund` | boolean | — | `false` |
| `auto_refund_rule` | text | yes | — |
| `policy_snapshot_id` | uuid | yes | — |
| `policy_entitlement` | numeric | yes | — |
| `policy_name` | text | yes | — |
| `status` | text | — | `'pending'::text` |
| `provider_refund_id` | text | yes | — |
| `provider_response` | jsonb | yes | — |
| `is_manual` | boolean | — | `false` |
| `manual_sent_at` | timestamp with time zone | yes | — |
| `manual_note` | text | yes | — |
| `guest_banking_details` | jsonb | yes | — |
| `host_note` | text | yes | — |
| `decline_reason` | text | yes | — |
| `actioned_by` | uuid | yes | — |
| `actioned_at` | timestamp with time zone | yes | — |
| `escalated_at` | timestamp with time zone | yes | — |
| `escalation_note` | text | yes | — |
| `admin_decision` | text | yes | — |
| `admin_actioned_by` | uuid | yes | — |
| `admin_note` | text | yes | — |
| `admin_actioned_at` | timestamp with time zone | yes | — |
| `deleted_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `refund_method` | text | yes | — |
| `reference` | text | yes | — |
| `refund_number` | text | yes | — |
| `voided_at` | timestamp with time zone | yes | — |
| `voided_by` | uuid | yes | — |
| `void_reason` | text | yes | — |

**Foreign keys:**
- `FOREIGN KEY (actioned_by) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (admin_actioned_by) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT`
- `FOREIGN KEY (guest_id) REFERENCES user_profiles(id) ON DELETE RESTRICT`
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE RESTRICT`
- `FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE RESTRICT`
- `FOREIGN KEY (policy_snapshot_id) REFERENCES policy_snapshots(id) ON DELETE SET NULL`
- `FOREIGN KEY (voided_by) REFERENCES user_profiles(id) ON DELETE SET NULL`

**Checks:**
- `CHECK ((admin_decision = ANY (ARRAY['force_refund'::text, 'uphold_decline'::text])))`
- `CHECK ((approved_amount >= (0)::numeric))`
- `CHECK ((decline_reason = ANY (ARRAY['outside_policy'::text, 'no_show'::text, 'terms_violated'::text, 'services_rendered'::text, 'other'::text])))`
- `CHECK ((initiated_by = ANY (ARRAY['guest'::text, 'host'::text, 'system'::text, 'admin'::text])))`
- `CHECK ((refund_method = ANY (ARRAY['paystack'::text, 'paypal'::text, 'eft'::text, 'manual'::text])))`
- `CHECK ((requested_amount >= (0)::numeric))`
- `CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'disputed'::text, 'cancelled'::text])))`

**Triggers:**
- `set_updated_at` → `update_updated_at()`
- `trg_assign_refund_number` → `assign_refund_number()` *(SECURITY DEFINER)*
- `trigger_gen_refund_reference` → `gen_refund_reference()` *(SECURITY DEFINER)*
- `trigger_log_refund_status_change` → `log_refund_status_change()` *(SECURITY DEFINER)*
- `trigger_sync_booking_refund_flag` → `sync_booking_refund_flag()` *(SECURITY DEFINER)*
- `trigger_update_payment_refunded` → `update_payment_refunded_amount()` *(SECURITY DEFINER)*

**RLS policies:**
- `admin_full_access_refunds` (ALL) — `USING is_super_admin()`
- `guest_create_refund` (INSERT) — `CHECK (guest_id = auth.uid())`
- `guest_own_refunds` (SELECT) — `USING (guest_id = auth.uid())`
- `guest_update_pending_refund` (UPDATE) — `USING ((guest_id = auth.uid()) AND (status = ANY (ARRAY['pending'::text, 'disputed'::text])))`
- `host_action_refunds` (UPDATE) — `USING ((host_id = get_my_host_id()) AND (status = ANY (ARRAY['pending'::text, 'approved'::text, 'processing'::text, 'failed'::text]))) CHECK (host_id = get_my_host_id())`
- `host_create_refund` (INSERT) — `CHECK (host_id = get_my_host_id())`
- `host_view_refunds` (SELECT) — `USING (host_id = get_my_host_id())`
- `staff_action_refunds` (UPDATE) — `USING ((host_id = get_my_host_id_as_staff()) AND (status = ANY (ARRAY['pending'::text, 'approved'::text, 'processing'::text, 'failed'::text]))) CHECK (host_id = get_my_host_id_as_staff())`
- `staff_create_refund` (INSERT) — `CHECK (host_id = get_my_host_id_as_staff())`
- `staff_view_refunds` (SELECT) — `USING (host_id = get_my_host_id_as_staff())`

### `refund_status_history`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `refund_request_id` | uuid | — | — |
| `from_status` | text | yes | — |
| `to_status` | text | — | — |
| `changed_by` | uuid | yes | — |
| `changed_by_role` | text | yes | — |
| `note` | text | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (changed_by) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (refund_request_id) REFERENCES refund_requests(id) ON DELETE CASCADE`

**RLS policies:**
- `admin_read_refund_history` (SELECT) — `USING is_super_admin()`
- `participant_read_refund_history` (SELECT) — `USING (refund_request_id IN ( SELECT refund_requests.id
   FROM refund_requests
  WHERE ((refund_requests.guest_id = auth.uid()) OR (refund_requests.host_id = get_my_host_id()) OR (refund_requests.host_id = get_my_host_id_as_staff()))))`

### `refunds`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `payment_id` | uuid | — | — |
| `booking_id` | uuid | — | — |
| `amount` | numeric | — | — |
| `currency` | text | — | `'ZAR'::text` |
| `reason` | text | yes | — |
| `status` | text | — | `'pending'::text` |
| `provider_reference` | text | yes | — |
| `provider_response` | jsonb | yes | — |
| `is_manual` | boolean | — | `false` |
| `manual_note` | text | yes | — |
| `processed_by` | uuid | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT`
- `FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE RESTRICT`
- `FOREIGN KEY (processed_by) REFERENCES user_profiles(id) ON DELETE SET NULL`

**Checks:**
- `CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))`

**Triggers:**
- `set_updated_at` → `update_updated_at()`

**RLS policies:**
- `admin_full_refunds` (ALL) — `USING is_super_admin()`
- `guest_read_own_refunds` (SELECT) — `USING (booking_id IN ( SELECT bookings.id
   FROM bookings
  WHERE (bookings.guest_id = auth.uid())))`
- `host_manage_refunds` (ALL) — `USING (booking_id IN ( SELECT bookings.id
   FROM bookings
  WHERE (bookings.host_id = get_my_host_id())))`

### `report_runs`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `scheduled_report_id` | uuid | yes | — |
| `host_id` | uuid | — | — |
| `report_type` | text | — | — |
| `scope_filter` | jsonb | — | — |
| `format` | text | — | — |
| `status` | text | — | `'pending'::text` |
| `file_storage_path` | text | yes | — |
| `file_url` | text | yes | — |
| `error_message` | text | yes | — |
| `started_at` | timestamp with time zone | — | `now()` |
| `completed_at` | timestamp with time zone | yes | — |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`
- `FOREIGN KEY (scheduled_report_id) REFERENCES scheduled_reports(id) ON DELETE SET NULL`

**Checks:**
- `CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))`

**RLS policies:**
- `report_runs_admin_read` (SELECT) — `USING (EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'super_admin'::text))))`
- `report_runs_host_read` (SELECT) — `USING (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid())))`

### `review_flags`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `review_id` | uuid | — | — |
| `flagged_by` | uuid | — | — |
| `reason` | text | — | — |
| `details` | text | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (flagged_by) REFERENCES user_profiles(id) ON DELETE CASCADE`
- `FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (review_id, flagged_by)`

**Checks:**
- `CHECK ((reason = ANY (ARRAY['false_information'::text, 'personal_attack'::text, 'booking_never_occurred'::text, 'other'::text])))`

**RLS policies:**
- `host_flag_own_reviews` (INSERT) — `CHECK ((flagged_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM reviews r
  WHERE ((r.id = review_flags.review_id) AND (r.host_id = get_my_host_id())))))`

### `review_helpful_votes`

| column | type | null | default |
|---|---|---|---|
| `review_id` | uuid | — | — |
| `user_id` | uuid | — | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE`
- `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`

**Triggers:**
- `trigger_review_helpful_count` → `sync_review_helpful_count()` *(SECURITY DEFINER)*

**RLS policies:**
- `admin_full_review_votes` (ALL) — `USING is_super_admin()`
- `user_delete_own_vote` (DELETE) — `USING (user_id = auth.uid())`
- `user_insert_own_vote` (INSERT) — `CHECK (user_id = auth.uid())`
- `user_read_own_votes` (SELECT) — `USING (user_id = auth.uid())`

### `review_photos`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `review_id` | uuid | — | — |
| `storage_path` | text | — | — |
| `sort_order` | integer | — | `0` |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE`

**RLS policies:**
- `admin_full_review_photos` (ALL) — `USING is_super_admin()`
- `guest_read_own_review_photos` (SELECT) — `USING (review_id IN ( SELECT reviews.id
   FROM reviews
  WHERE (reviews.guest_id = auth.uid())))`
- `host_read_own_review_photos` (SELECT) — `USING (review_id IN ( SELECT reviews.id
   FROM reviews
  WHERE (reviews.host_id = get_my_host_id())))`
- `public_read_published_review_photos` (SELECT) — `USING (review_id IN ( SELECT reviews.id
   FROM reviews
  WHERE ((reviews.is_published = true) AND (reviews.flagged = false))))`

### `review_request_queue`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `booking_id` | uuid | — | — |
| `guest_id` | uuid | yes | — |
| `sent_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `send_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE`
- `FOREIGN KEY (guest_id) REFERENCES user_profiles(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (booking_id)`

### `reviews`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `booking_id` | uuid | — | — |
| `property_id` | uuid | — | — |
| `host_id` | uuid | — | — |
| `guest_id` | uuid | yes | — |
| `rating` | integer | — | — |
| `body` | text | yes | — |
| `host_response` | text | yes | — |
| `host_responded_at` | timestamp with time zone | yes | — |
| `is_published` | boolean | — | `false` |
| `publish_at` | timestamp with time zone | yes | — |
| `flagged` | boolean | — | `false` |
| `flagged_at` | timestamp with time zone | yes | — |
| `flagged_reason` | text | yes | — |
| `admin_decision` | text | yes | — |
| `admin_actioned_by` | uuid | yes | — |
| `review_token` | text | yes | `encode(gen_random_bytes(16), 'hex'::text)` |
| `token_expires_at` | timestamp with time zone | yes | `(now() + '30 days'::interval)` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `rating_cleanliness` | integer | yes | — |
| `rating_communication` | integer | yes | — |
| `rating_checkin` | integer | yes | — |
| `rating_accuracy` | integer | yes | — |
| `rating_location` | integer | yes | — |
| `rating_value` | integer | yes | — |
| `trip_type` | text | yes | — |
| `helpful_count` | integer | — | `0` |

**Foreign keys:**
- `FOREIGN KEY (admin_actioned_by) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT`
- `FOREIGN KEY (guest_id) REFERENCES user_profiles(id) ON DELETE RESTRICT`
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`
- `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (booking_id)`
- `UNIQUE (review_token)`

**Checks:**
- `CHECK ((admin_decision = ANY (ARRAY['upheld'::text, 'rejected'::text])))`
- `CHECK (((rating_accuracy >= 1) AND (rating_accuracy <= 5)))`
- `CHECK (((rating >= 1) AND (rating <= 5)))`
- `CHECK (((rating_checkin >= 1) AND (rating_checkin <= 5)))`
- `CHECK (((rating_cleanliness >= 1) AND (rating_cleanliness <= 5)))`
- `CHECK (((rating_communication >= 1) AND (rating_communication <= 5)))`
- `CHECK (((rating_location >= 1) AND (rating_location <= 5)))`
- `CHECK (((rating_value >= 1) AND (rating_value <= 5)))`
- `CHECK (((trip_type IS NULL) OR (trip_type = ANY (ARRAY['couples'::text, 'family'::text, 'solo'::text, 'friends'::text, 'business'::text, 'other'::text]))))`

**Triggers:**
- `set_updated_at` → `update_updated_at()`
- `trigger_protect_review_content` → `protect_review_content()`
- `trigger_review_published` → `on_review_published()` *(SECURITY DEFINER)*

**RLS policies:**
- `admin_full_reviews` (ALL) — `USING is_super_admin()`
- `guest_read_own_reviews` (SELECT) — `USING (guest_id = auth.uid())`
- `host_read_own_reviews` (SELECT) — `USING (host_id = get_my_host_id())`
- `host_respond_reviews` (UPDATE) — `USING (host_id = get_my_host_id()) CHECK (host_id = get_my_host_id())`
- `public_read_published_reviews` (SELECT) — `USING ((is_published = true) AND (flagged = false))`

### `room_beds`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `room_id` | uuid | — | — |
| `bed_kind` | text | — | — |
| `quantity` | integer | — | `1` |
| `sort_order` | integer | — | `0` |
| `created_at` | timestamp with time zone | — | `now()` |
| `sleeps` | integer | — | `1` |

**Foreign keys:**
- `FOREIGN KEY (room_id) REFERENCES property_rooms(id) ON DELETE CASCADE`

**Checks:**
- `CHECK ((bed_kind = ANY (ARRAY['king'::text, 'queen'::text, 'double'::text, 'twin'::text, 'single'::text, 'bunk'::text, 'futon'::text, 'sofa_bed'::text, 'cot'::text, 'floor_mattress'::text])))`
- `CHECK (((quantity >= 1) AND (quantity <= 20)))`
- `CHECK (((sleeps >= 1) AND (sleeps <= 30)))`

**RLS policies:**
- `admin_full_room_beds` (ALL) — `USING is_super_admin()`
- `host_manage_own_room_beds` (ALL) — `USING (room_id IN ( SELECT lr.id
   FROM (property_rooms lr
     JOIN properties l ON ((l.id = lr.property_id)))
  WHERE (l.host_id = get_my_host_id())))`
- `public_read_room_beds` (SELECT) — `USING (room_id IN ( SELECT lr.id
   FROM (property_rooms lr
     JOIN properties l ON ((l.id = lr.property_id)))
  WHERE ((l.is_published = true) AND (l.is_suspended = false) AND (l.deleted_at IS NULL))))`
- `staff_read_room_beds` (SELECT) — `USING (room_id IN ( SELECT lr.id
   FROM (property_rooms lr
     JOIN properties l ON ((l.id = lr.property_id)))
  WHERE (l.host_id = get_my_host_id_as_staff())))`

### `scheduled_reports`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `name` | text | — | — |
| `description` | text | yes | — |
| `report_type` | text | — | — |
| `scope_filter` | jsonb | — | `'{}'::jsonb` |
| `schedule_cron` | text | yes | — |
| `schedule_label` | text | yes | — |
| `recipients` | jsonb | — | `'[]'::jsonb` |
| `format` | text | — | `'pdf'::text` |
| `is_active` | boolean | — | `true` |
| `last_run_at` | timestamp with time zone | yes | — |
| `next_run_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`

**Checks:**
- `CHECK ((format = ANY (ARRAY['pdf'::text, 'csv'::text, 'xlsx'::text])))`
- `CHECK ((report_type = ANY (ARRAY['portfolio_summary'::text, 'revenue_detail'::text, 'channel_mix'::text, 'guest_satisfaction'::text, 'refunds_cancellations'::text, 'occupancy_forecast'::text])))`

**Triggers:**
- `set_scheduled_reports_updated_at` → `set_updated_at()`

**RLS policies:**
- `scheduled_reports_admin_read` (SELECT) — `USING (EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'super_admin'::text))))`
- `scheduled_reports_host_all` (ALL) — `USING (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid()))) CHECK (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid())))`

### `signup_rate_limits`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `ip_hash` | text | — | — |
| `created_at` | timestamp with time zone | — | `now()` |

### `site_themes`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `slug` | text | — | — |
| `name` | text | — | — |
| `description` | text | yes | — |
| `preview_image_path` | text | yes | — |
| `base` | jsonb | — | `'{}'::jsonb` |
| `page_templates` | jsonb | — | `'[]'::jsonb` |
| `is_active` | boolean | — | `true` |
| `is_premium` | boolean | — | `false` |
| `price` | numeric | yes | — |
| `currency` | text | — | `'ZAR'::text` |
| `sort_order` | integer | — | `0` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |
| `is_default` | boolean | — | `false` |

**Unique:**
- `UNIQUE (slug)`

**Triggers:**
- `site_themes_updated_at` → `update_updated_at()`

**RLS policies:**
- `site_themes_admin_all` (ALL) — `USING is_super_admin() CHECK is_super_admin()`
- `site_themes_read` (SELECT) — `USING (is_active AND (deleted_at IS NULL))`

### `special_addons`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `special_id` | uuid | — | — |
| `addon_id` | uuid | — | — |
| `is_required` | boolean | — | `false` |
| `unit_price_override` | numeric(12,2) | yes | — |
| `sort_order` | integer | — | `0` |
| `quantity` | integer | — | `1` |

**Foreign keys:**
- `FOREIGN KEY (addon_id) REFERENCES addons(id) ON DELETE CASCADE`
- `FOREIGN KEY (special_id) REFERENCES specials(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (special_id, addon_id)`

**Checks:**
- `CHECK (((quantity >= 1) AND (quantity <= 100)))`

**RLS policies:**
- `special_addons_admin_all` (ALL) — `USING is_super_admin()`
- `special_addons_owner_all` (ALL) — `USING (special_id IN ( SELECT specials.id
   FROM specials
  WHERE (specials.host_id = get_my_host_id()))) CHECK (special_id IN ( SELECT specials.id
   FROM specials
  WHERE (specials.host_id = get_my_host_id())))`
- `special_addons_public_read` (SELECT) — `USING (special_id IN ( SELECT specials.id
   FROM specials
  WHERE ((specials.status = 'active'::text) AND (specials.deleted_at IS NULL))))`

### `special_categories`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `key` | text | — | — |
| `label` | text | — | — |
| `description` | text | yes | — |
| `icon` | text | yes | — |
| `meta_title` | text | yes | — |
| `meta_description` | text | yes | — |
| `og_image_url` | text | yes | — |
| `intro_markdown` | text | yes | — |
| `sort_order` | integer | — | `0` |
| `is_active` | boolean | — | `true` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |

**Unique:**
- `UNIQUE (key)`

**Triggers:**
- `trigger_special_categories_touch` → `set_updated_at()`

**RLS policies:**
- `special_categories_admin_all` (ALL) — `USING is_super_admin()`
- `special_categories_public_read` (SELECT) — `USING ((is_active = true) AND (deleted_at IS NULL))`

### `special_view_events`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `special_id` | uuid | — | — |
| `event` | text | — | `'special_view'::text` |
| `session_id` | text | yes | — |
| `referrer_host` | text | yes | — |
| `device` | text | yes | — |
| `country` | text | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (special_id) REFERENCES specials(id) ON DELETE CASCADE`

**Checks:**
- `CHECK ((device = ANY (ARRAY['desktop'::text, 'mobile'::text])))`
- `CHECK ((event = ANY (ARRAY['special_view'::text, 'special_book_click'::text])))`

**RLS policies:**
- `special_view_events_admin_read` (SELECT) — `USING is_super_admin()`
- `special_view_events_owner_read` (SELECT) — `USING (special_id IN ( SELECT specials.id
   FROM specials
  WHERE (specials.host_id = get_my_host_id())))`

### `specials`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `business_id` | uuid | — | — |
| `property_id` | uuid | — | — |
| `room_id` | uuid | yes | — |
| `slug` | text | — | — |
| `title` | text | — | — |
| `description` | text | yes | — |
| `hero_image_path` | text | yes | — |
| `badge` | text | yes | — |
| `date_mode` | text | — | — |
| `fixed_check_in` | date | yes | — |
| `fixed_check_out` | date | yes | — |
| `window_start` | date | yes | — |
| `window_end` | date | yes | — |
| `min_nights` | integer | yes | — |
| `max_nights` | integer | yes | — |
| `price_mode` | text | — | — |
| `flat_total` | numeric(12,2) | yes | — |
| `per_night_price` | numeric(12,2) | yes | — |
| `currency` | text | — | `'ZAR'::text` |
| `max_guests` | integer | yes | — |
| `was_price` | numeric(12,2) | yes | — |
| `savings_amount` | numeric(12,2) | yes | — |
| `savings_pct` | integer | yes | — |
| `quantity` | integer | — | `1` |
| `redemptions_used` | integer | — | `0` |
| `go_live_at` | date | yes | — |
| `book_by` | date | yes | — |
| `categories` | text[] | — | `'{}'::text[]` |
| `custom_tags` | text[] | — | `'{}'::text[]` |
| `is_featured` | boolean | — | `false` |
| `sort_order` | integer | — | `0` |
| `cancellation_policy_id` | uuid | yes | — |
| `show_in_directory` | boolean | — | `true` |
| `show_on_website` | boolean | — | `true` |
| `status` | text | — | `'draft'::text` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |
| `is_evergreen` | boolean | — | `false` |

**Foreign keys:**
- `FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE`
- `FOREIGN KEY (cancellation_policy_id) REFERENCES policies(id) ON DELETE SET NULL`
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`
- `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`
- `FOREIGN KEY (room_id) REFERENCES property_rooms(id) ON DELETE CASCADE`

**Checks:**
- `CHECK (((NOT is_evergreen) OR ((date_mode = 'flexible'::text) AND (window_end IS NULL) AND (book_by IS NULL))))`
- `CHECK (((date_mode <> 'fixed'::text) OR ((fixed_check_in IS NOT NULL) AND (fixed_check_out IS NOT NULL) AND (fixed_check_out > fixed_check_in))))`
- `CHECK (((price_mode <> 'flat'::text) OR ((flat_total IS NOT NULL) AND (flat_total >= (0)::numeric))))`
- `CHECK (((date_mode <> 'flexible'::text) OR ((window_start IS NOT NULL) AND (min_nights IS NOT NULL) AND (min_nights >= 1) AND ((max_nights IS NULL) OR (max_nights >= min_nights)) AND (is_evergreen OR ((window_end IS NOT NULL) AND (window_end > window_start))))))`
- `CHECK (((price_mode <> 'per_night'::text) OR ((per_night_price IS NOT NULL) AND (per_night_price >= (0)::numeric))))`
- `CHECK ((redemptions_used <= quantity))`
- `CHECK ((date_mode = ANY (ARRAY['fixed'::text, 'flexible'::text])))`
- `CHECK ((price_mode = ANY (ARRAY['flat'::text, 'per_night'::text])))`
- `CHECK ((quantity >= 1))`
- `CHECK ((redemptions_used >= 0))`
- `CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'expired'::text, 'archived'::text])))`

**Triggers:**
- `trigger_special_status_change` → `on_special_status_change()` *(SECURITY DEFINER)*
- `trigger_specials_touch` → `set_updated_at()`

**RLS policies:**
- `specials_admin_all` (ALL) — `USING is_super_admin()`
- `specials_owner_all` (ALL) — `USING (host_id = get_my_host_id()) CHECK (host_id = get_my_host_id())`
- `specials_public_read` (SELECT) — `USING ((status = 'active'::text) AND (deleted_at IS NULL))`

### `staff_invites`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `email` | text | — | — |
| `token` | text | — | `encode(gen_random_bytes(32), 'hex'::text)` |
| `expires_at` | timestamp with time zone | — | `(now() + '7 days'::interval)` |
| `accepted_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `role` | text | — | `'assistant'::text` |
| `invited_by` | uuid | yes | — |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`
- `FOREIGN KEY (invited_by) REFERENCES user_profiles(id) ON DELETE SET NULL`

**Unique:**
- `UNIQUE (token)`

**Checks:**
- `CHECK ((role = ANY (ARRAY['co_host'::text, 'cleaner'::text, 'assistant'::text])))`

**RLS policies:**
- `admin_full_invites` (ALL) — `USING is_super_admin()`
- `host_manage_own_invites` (ALL) — `USING (host_id = get_my_host_id())`

### `staff_members`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `user_id` | uuid | — | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `role` | text | — | `'assistant'::text` |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`
- `FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (host_id, user_id)`

**Checks:**
- `CHECK ((role = ANY (ARRAY['co_host'::text, 'cleaner'::text, 'assistant'::text])))`

**RLS policies:**
- `admin_full_staff` (ALL) — `USING is_super_admin()`
- `host_manage_staff` (ALL) — `USING (host_id = get_my_host_id())`
- `staff_read_own` (SELECT) — `USING (user_id = auth.uid())`

### `subscription_history`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `subscription_id` | uuid | — | — |
| `host_id` | uuid | — | — |
| `event` | text | — | — |
| `from_plan` | text | yes | — |
| `to_plan` | text | yes | — |
| `from_status` | text | yes | — |
| `to_status` | text | yes | — |
| `amount_charged` | numeric | yes | — |
| `currency` | text | yes | — |
| `notes` | text | yes | — |
| `performed_by` | uuid | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`
- `FOREIGN KEY (performed_by) REFERENCES user_profiles(id) ON DELETE SET NULL`
- `FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE`

**RLS policies:**
- `admin_read_sub_history` (SELECT) — `USING is_super_admin()`
- `host_read_sub_history` (SELECT) — `USING (host_id = get_my_host_id())`

### `subscription_scheduled_changes`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `subscription_id` | uuid | — | — |
| `host_id` | uuid | — | — |
| `kind` | text | — | — |
| `target_product_id` | uuid | yes | — |
| `effective_at` | timestamp with time zone | — | — |
| `status` | text | — | `'pending'::text` |
| `note` | text | yes | — |
| `created_by` | uuid | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `applied_at` | timestamp with time zone | yes | — |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`
- `FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE`
- `FOREIGN KEY (target_product_id) REFERENCES products(id)`

**Checks:**
- `CHECK ((((kind = 'switch'::text) AND (target_product_id IS NOT NULL)) OR ((kind = 'cancel'::text) AND (target_product_id IS NULL))))`
- `CHECK ((kind = ANY (ARRAY['cancel'::text, 'switch'::text])))`
- `CHECK ((status = ANY (ARRAY['pending'::text, 'applied'::text, 'superseded'::text, 'cancelled'::text])))`

**RLS policies:**
- `sched_changes_owner_read` (SELECT) — `USING (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid())))`

### `subscriptions`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `plan` | text | — | `'free'::text` |
| `billing_cycle` | text | yes | — |
| `status` | text | — | `'active'::text` |
| `trial_ends_at` | timestamp with time zone | yes | — |
| `current_period_start` | timestamp with time zone | yes | — |
| `current_period_end` | timestamp with time zone | yes | — |
| `grace_period_ends_at` | timestamp with time zone | yes | — |
| `failed_payment_count` | integer | — | `0` |
| `paystack_customer_code` | text | yes | — |
| `paystack_subscription_code` | text | yes | — |
| `paypal_subscription_id` | text | yes | — |
| `paypal_plan_id` | text | yes | — |
| `cancel_at_period_end` | boolean | — | `false` |
| `cancelled_at` | timestamp with time zone | yes | — |
| `cancellation_reason` | text | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `product_id` | uuid | yes | — |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`
- `FOREIGN KEY (plan) REFERENCES plans(key) ON UPDATE CASCADE`
- `FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL`

**Checks:**
- `CHECK ((billing_cycle = ANY (ARRAY['monthly'::text, 'annual'::text])))`
- `CHECK ((status = ANY (ARRAY['trialing'::text, 'active'::text, 'past_due'::text, 'restricted'::text, 'paused'::text, 'cancelled'::text, 'expired'::text])))`

**Triggers:**
- `set_updated_at` → `update_updated_at()`
- `subscription_history_insert_trigger` → `on_subscription_insert()` *(SECURITY DEFINER)*
- `subscription_history_trigger` → `on_subscription_change()` *(SECURITY DEFINER)*
- `trg_one_active_membership` → `forbid_second_active_membership()`

**RLS policies:**
- `admin_full_sub` (ALL) — `USING is_super_admin()`
- `host_manage_own_sub` (ALL) — `USING (host_id = get_my_host_id())`

### `user_notification_preferences`

| column | type | null | default |
|---|---|---|---|
| `user_id` | uuid | — | — |
| `category_id` | text | — | — |
| `email_enabled` | boolean | — | `true` |
| `push_enabled` | boolean | — | `true` |
| `in_app_enabled` | boolean | — | `true` |
| `digest_mode` | text | — | `'off'::text` |
| `updated_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (category_id) REFERENCES notification_categories(id)`
- `FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE`

**Checks:**
- `CHECK ((digest_mode = ANY (ARRAY['off'::text, 'daily'::text, 'weekly'::text])))`

**RLS policies:**
- `user_notification_preferences_owner_all` (ALL) — `USING (user_id = auth.uid()) CHECK (user_id = auth.uid())`
- `user_notification_preferences_service_select` (SELECT) — `USING true`

### `user_notification_settings`

| column | type | null | default |
|---|---|---|---|
| `user_id` | uuid | — | — |
| `quiet_hours_enabled` | boolean | — | `false` |
| `quiet_hours_start` | time without time zone | yes | — |
| `quiet_hours_end` | time without time zone | yes | — |
| `quiet_hours_timezone` | text | — | `'Africa/Johannesburg'::text` |
| `dedupe_enabled` | boolean | — | `true` |
| `digest_send_hour` | smallint | — | `9` |
| `updated_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE`

**Checks:**
- `CHECK (((digest_send_hour >= 0) AND (digest_send_hour <= 23)))`

**RLS policies:**
- `user_notification_settings_owner_all` (ALL) — `USING (user_id = auth.uid()) CHECK (user_id = auth.uid())`

### `user_profiles`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | — |
| `role` | text | — | `'guest'::text` |
| `full_name` | text | yes | — |
| `avatar_url` | text | yes | — |
| `phone` | text | yes | — |
| `email` | text | yes | — |
| `is_active` | boolean | — | `true` |
| `deleted_at` | timestamp with time zone | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `country` | text | yes | — |
| `bio` | text | yes | — |
| `languages` | text[] | — | `'{}'::text[]` |
| `preferred_cities` | text[] | — | `'{}'::text[]` |
| `marketing_opt_in` | boolean | — | `false` |
| `is_lead` | boolean | — | `false` |
| `phone_verified_at` | timestamp with time zone | yes | — |
| `id_verified_at` | timestamp with time zone | yes | — |
| `terms_accepted_at` | timestamp with time zone | yes | — |
| `terms_version` | text | yes | — |
| `email_verified_at` | timestamp with time zone | yes | — |

**Foreign keys:**
- `FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE`

**Checks:**
- `CHECK ((role = ANY (ARRAY['guest'::text, 'host'::text, 'staff'::text, 'super_admin'::text])))`

**Triggers:**
- `set_updated_at` → `update_updated_at()`

**RLS policies:**
- `admin_read_all` (SELECT) — `USING is_super_admin()`
- `admin_update_any` (UPDATE) — `USING is_super_admin()`
- `host_read_guest_profiles` (SELECT) — `USING (id IN ( SELECT conversations.guest_id
   FROM conversations
  WHERE ((conversations.host_id = get_my_host_id()) OR (conversations.host_id = get_my_host_id_as_staff()))
UNION
 SELECT bookings.guest_id
   FROM bookings
  WHERE ((bookings.host_id = get_my_host_id()) OR (bookings.host_id = get_my_host_id_as_staff()))))`
- `system_insert_profile` (INSERT) — `CHECK (id = auth.uid())`
- `users_read_own` (SELECT) — `USING (id = auth.uid())`
- `users_update_own` (UPDATE) — `USING (id = auth.uid()) CHECK ((id = auth.uid()) AND (role = get_my_role()))`

### `website_analytics_events`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `website_id` | uuid | — | — |
| `event` | text | — | `'pageview'::text` |
| `path` | text | — | `'/'::text` |
| `session_id` | text | yes | — |
| `referrer_host` | text | yes | — |
| `device` | text | yes | — |
| `country` | text | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (website_id) REFERENCES host_websites(id) ON DELETE CASCADE`

**Checks:**
- `CHECK ((device = ANY (ARRAY['desktop'::text, 'mobile'::text])))`
- `CHECK ((event = ANY (ARRAY['pageview'::text, 'booking_click'::text, 'outbound'::text])))`

**RLS policies:**
- `website_analytics_admin_read` (SELECT) — `USING is_super_admin()`
- `website_analytics_owner_read` (SELECT) — `USING (website_id IN ( SELECT host_websites.id
   FROM host_websites
  WHERE (host_websites.host_id = get_my_host_id())))`

### `website_blog_authors`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `website_id` | uuid | — | — |
| `name` | text | — | — |
| `avatar_path` | text | yes | — |
| `bio` | text | yes | — |
| `sort_order` | integer | — | `0` |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (website_id) REFERENCES host_websites(id) ON DELETE CASCADE`

**RLS policies:**
- `website_blog_authors_admin_all` (ALL) — `USING is_super_admin()`
- `website_blog_authors_owner_all` (ALL) — `USING (website_id IN ( SELECT host_websites.id
   FROM host_websites
  WHERE (host_websites.host_id = get_my_host_id()))) CHECK (website_id IN ( SELECT host_websites.id
   FROM host_websites
  WHERE (host_websites.host_id = get_my_host_id())))`

### `website_blog_categories`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `website_id` | uuid | — | — |
| `name` | text | — | — |
| `slug` | text | — | — |
| `sort_order` | integer | — | `0` |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (website_id) REFERENCES host_websites(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (website_id, slug)`

**RLS policies:**
- `website_blog_cats_admin_all` (ALL) — `USING is_super_admin()`
- `website_blog_cats_owner_all` (ALL) — `USING (website_id IN ( SELECT host_websites.id
   FROM host_websites
  WHERE (host_websites.host_id = get_my_host_id()))) CHECK (website_id IN ( SELECT host_websites.id
   FROM host_websites
  WHERE (host_websites.host_id = get_my_host_id())))`

### `website_blog_post_tags`

| column | type | null | default |
|---|---|---|---|
| `post_id` | uuid | — | — |
| `tag_id` | uuid | — | — |

**Foreign keys:**
- `FOREIGN KEY (post_id) REFERENCES website_blog_posts(id) ON DELETE CASCADE`
- `FOREIGN KEY (tag_id) REFERENCES website_blog_tags(id) ON DELETE CASCADE`

**RLS policies:**
- `website_blog_post_tags_admin_all` (ALL) — `USING is_super_admin()`
- `website_blog_post_tags_owner_all` (ALL) — `USING (post_id IN ( SELECT p.id
   FROM (website_blog_posts p
     JOIN host_websites w ON ((w.id = p.website_id)))
  WHERE (w.host_id = get_my_host_id()))) CHECK (post_id IN ( SELECT p.id
   FROM (website_blog_posts p
     JOIN host_websites w ON ((w.id = p.website_id)))
  WHERE (w.host_id = get_my_host_id())))`

### `website_blog_posts`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `website_id` | uuid | — | — |
| `category_id` | uuid | yes | — |
| `title` | text | — | — |
| `slug` | text | — | — |
| `status` | text | — | `'draft'::text` |
| `publish_at` | timestamp with time zone | yes | — |
| `cover_path` | text | yes | — |
| `excerpt` | text | yes | — |
| `body_html` | text | yes | — |
| `seo` | jsonb | — | `'{}'::jsonb` |
| `author_name` | text | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |
| `featured` | boolean | — | `false` |
| `author_id` | uuid | yes | — |

**Foreign keys:**
- `FOREIGN KEY (author_id) REFERENCES website_blog_authors(id) ON DELETE SET NULL`
- `FOREIGN KEY (category_id) REFERENCES website_blog_categories(id) ON DELETE SET NULL`
- `FOREIGN KEY (website_id) REFERENCES host_websites(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (website_id, slug)`

**Checks:**
- `CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'scheduled'::text])))`

**Triggers:**
- `set_updated_at_website_blog_posts` → `update_updated_at()`

**RLS policies:**
- `website_blog_posts_admin_all` (ALL) — `USING is_super_admin()`
- `website_blog_posts_owner_all` (ALL) — `USING (website_id IN ( SELECT host_websites.id
   FROM host_websites
  WHERE (host_websites.host_id = get_my_host_id()))) CHECK (website_id IN ( SELECT host_websites.id
   FROM host_websites
  WHERE (host_websites.host_id = get_my_host_id())))`

### `website_blog_tags`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `website_id` | uuid | — | — |
| `name` | text | — | — |
| `slug` | text | — | — |
| `sort_order` | integer | — | `0` |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (website_id) REFERENCES host_websites(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (website_id, slug)`

**RLS policies:**
- `website_blog_tags_admin_all` (ALL) — `USING is_super_admin()`
- `website_blog_tags_owner_all` (ALL) — `USING (website_id IN ( SELECT host_websites.id
   FROM host_websites
  WHERE (host_websites.host_id = get_my_host_id()))) CHECK (website_id IN ( SELECT host_websites.id
   FROM host_websites
  WHERE (host_websites.host_id = get_my_host_id())))`

### `website_domain_events`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `website_id` | uuid | — | — |
| `event` | text | — | — |
| `detail` | jsonb | — | `'{}'::jsonb` |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (website_id) REFERENCES host_websites(id) ON DELETE CASCADE`

**Checks:**
- `CHECK ((event = ANY (ARRAY['domain_added'::text, 'verified'::text, 'ssl_issued'::text, 'verify_failed'::text, 'removed'::text])))`

**RLS policies:**
- `website_domain_events_admin_read` (SELECT) — `USING is_super_admin()`
- `website_domain_events_owner_read` (SELECT) — `USING (website_id IN ( SELECT host_websites.id
   FROM host_websites
  WHERE (host_websites.host_id = get_my_host_id())))`

### `website_form_submissions`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `form_id` | uuid | yes | — |
| `website_id` | uuid | — | — |
| `data` | jsonb | — | `'{}'::jsonb` |
| `conversation_id` | uuid | yes | — |
| `status` | text | — | `'new'::text` |
| `created_at` | timestamp with time zone | — | `now()` |
| `source` | text | — | `'form'::text` |
| `booking_id` | uuid | yes | — |

**Foreign keys:**
- `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL`
- `FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL`
- `FOREIGN KEY (form_id) REFERENCES website_forms(id) ON DELETE CASCADE`
- `FOREIGN KEY (website_id) REFERENCES host_websites(id) ON DELETE CASCADE`

**Checks:**
- `CHECK ((source = ANY (ARRAY['form'::text, 'dock'::text, 'checkout'::text])))`
- `CHECK ((status = ANY (ARRAY['new'::text, 'read'::text, 'archived'::text, 'spam'::text])))`

**RLS policies:**
- `website_form_subs_admin_all` (ALL) — `USING is_super_admin()`
- `website_form_subs_owner_all` (ALL) — `USING (website_id IN ( SELECT host_websites.id
   FROM host_websites
  WHERE (host_websites.host_id = get_my_host_id()))) CHECK (website_id IN ( SELECT host_websites.id
   FROM host_websites
  WHERE (host_websites.host_id = get_my_host_id())))`

### `website_forms`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `website_id` | uuid | — | — |
| `name` | text | — | — |
| `type` | text | — | `'contact'::text` |
| `fields` | jsonb | — | `'[]'::jsonb` |
| `settings` | jsonb | — | `'{}'::jsonb` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |
| `deleted_at` | timestamp with time zone | yes | — |
| `is_default` | boolean | — | `false` |

**Foreign keys:**
- `FOREIGN KEY (website_id) REFERENCES host_websites(id) ON DELETE CASCADE`

**Checks:**
- `CHECK ((type = ANY (ARRAY['contact'::text, 'custom'::text, 'newsletter'::text])))`

**Triggers:**
- `set_updated_at_website_forms` → `update_updated_at()`

**RLS policies:**
- `website_forms_admin_all` (ALL) — `USING is_super_admin()`
- `website_forms_owner_all` (ALL) — `USING (website_id IN ( SELECT host_websites.id
   FROM host_websites
  WHERE (host_websites.host_id = get_my_host_id()))) CHECK (website_id IN ( SELECT host_websites.id
   FROM host_websites
  WHERE (host_websites.host_id = get_my_host_id())))`

### `website_media`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `website_id` | uuid | — | — |
| `path` | text | — | — |
| `alt` | text | yes | — |
| `width` | integer | yes | — |
| `height` | integer | yes | — |
| `size_bytes` | bigint | yes | — |
| `mime` | text | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (website_id) REFERENCES host_websites(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (website_id, path)`

**Triggers:**
- `set_updated_at_website_media` → `update_updated_at()`

**RLS policies:**
- `website_media_admin_all` (ALL) — `USING is_super_admin()`
- `website_media_owner_all` (ALL) — `USING (website_id IN ( SELECT host_websites.id
   FROM host_websites
  WHERE (host_websites.host_id = get_my_host_id()))) CHECK (website_id IN ( SELECT host_websites.id
   FROM host_websites
  WHERE (host_websites.host_id = get_my_host_id())))`

### `website_pages`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `website_id` | uuid | — | — |
| `kind` | text | — | `'custom'::text` |
| `slug` | text | — | — |
| `title` | text | yes | — |
| `nav_label` | text | yes | — |
| `nav_order` | integer | — | `0` |
| `show_in_nav` | boolean | — | `true` |
| `draft_sections` | jsonb | — | `'[]'::jsonb` |
| `published_sections` | jsonb | — | `'[]'::jsonb` |
| `seo_overrides` | jsonb | — | `'{}'::jsonb` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (website_id) REFERENCES host_websites(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (website_id, slug)`

**Checks:**
- `CHECK ((kind = ANY (ARRAY['home'::text, 'about'::text, 'rooms'::text, 'contact'::text, 'custom'::text, 'specials'::text, 'blog'::text, 'checkout'::text, 'thank-you'::text, 'room_detail'::text, 'experiences'::text, 'gallery'::text, 'search_results'::text])))`

**Triggers:**
- `set_updated_at_website_pages` → `update_updated_at()`

**RLS policies:**
- `website_pages_admin_all` (ALL) — `USING is_super_admin()`
- `website_pages_owner_all` (ALL) — `USING (website_id IN ( SELECT host_websites.id
   FROM host_websites
  WHERE (host_websites.host_id = get_my_host_id()))) CHECK (website_id IN ( SELECT host_websites.id
   FROM host_websites
  WHERE (host_websites.host_id = get_my_host_id())))`

### `website_properties`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `website_id` | uuid | — | — |
| `property_id` | uuid | — | — |
| `is_visible` | boolean | — | `true` |
| `sort_order` | integer | — | `0` |
| `display_overrides` | jsonb | — | `'{}'::jsonb` |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`
- `FOREIGN KEY (website_id) REFERENCES host_websites(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (website_id, property_id)`

**RLS policies:**
- `website_properties_admin_all` (ALL) — `USING is_super_admin()`
- `website_properties_owner_all` (ALL) — `USING (website_id IN ( SELECT host_websites.id
   FROM host_websites
  WHERE (host_websites.host_id = get_my_host_id()))) CHECK (website_id IN ( SELECT host_websites.id
   FROM host_websites
  WHERE (host_websites.host_id = get_my_host_id())))`

### `website_restore_points`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `website_id` | uuid | — | — |
| `label` | text | yes | — |
| `theme_slug` | text | yes | — |
| `snapshot` | jsonb | — | — |
| `kind` | text | — | `'manual'::text` |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (website_id) REFERENCES host_websites(id) ON DELETE CASCADE`

**RLS policies:**
- `website_restore_points_admin_all` (ALL) — `USING is_super_admin()`
- `website_restore_points_owner_all` (ALL) — `USING (website_id IN ( SELECT host_websites.id
   FROM host_websites
  WHERE (host_websites.host_id = get_my_host_id()))) CHECK (website_id IN ( SELECT host_websites.id
   FROM host_websites
  WHERE (host_websites.host_id = get_my_host_id())))`

### `website_rooms`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `website_id` | uuid | — | — |
| `room_id` | uuid | — | — |
| `is_visible` | boolean | — | `true` |
| `display_name` | text | yes | — |
| `display_price` | numeric | yes | — |
| `display_currency` | text | yes | — |
| `display_desc` | text | yes | — |
| `sort_order` | integer | — | `0` |
| `created_at` | timestamp with time zone | — | `now()` |
| `featured` | boolean | — | `false` |
| `badge` | text | yes | — |
| `media_overrides` | jsonb | — | `'{}'::jsonb` |
| `detail_overrides` | jsonb | yes | — |

**Foreign keys:**
- `FOREIGN KEY (room_id) REFERENCES property_rooms(id) ON DELETE CASCADE`
- `FOREIGN KEY (website_id) REFERENCES host_websites(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (website_id, room_id)`

**RLS policies:**
- `website_rooms_admin_all` (ALL) — `USING is_super_admin()`
- `website_rooms_owner_all` (ALL) — `USING (website_id IN ( SELECT host_websites.id
   FROM host_websites
  WHERE (host_websites.host_id = get_my_host_id()))) CHECK (website_id IN ( SELECT host_websites.id
   FROM host_websites
  WHERE (host_websites.host_id = get_my_host_id())))`

### `wielo_credit_ledger`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `purpose` | text | — | `'quote'::text` |
| `delta` | integer | — | — |
| `balance_after` | integer | — | — |
| `kind` | text | — | — |
| `reason` | text | yes | — |
| `ref_type` | text | yes | — |
| `ref_id` | text | yes | — |
| `created_by` | uuid | yes | — |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`

**Checks:**
- `CHECK ((kind = ANY (ARRAY['grant'::text, 'purchase'::text, 'debit'::text, 'refund'::text, 'adjustment'::text])))`

**RLS policies:**
- `host reads own credit ledger` (SELECT) — `USING (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid())))`

### `wielo_credit_notes`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `credit_note_number` | text | — | — |
| `kind` | text | — | — |
| `ledger_id` | uuid | yes | — |
| `user_id` | uuid | yes | — |
| `wielo_snapshot` | jsonb | — | — |
| `buyer_snapshot` | jsonb | — | — |
| `line_items` | jsonb | — | `'[]'::jsonb` |
| `subtotal` | numeric | — | `0` |
| `vat_amount` | numeric | — | `0` |
| `total_amount` | numeric | — | `0` |
| `signed_amount` | numeric | — | `0` |
| `currency` | text | — | `'ZAR'::text` |
| `reason` | text | yes | — |
| `status` | text | — | `'issued'::text` |
| `environment` | text | — | `'live'::text` |
| `issued_at` | timestamp with time zone | — | `now()` |
| `pdf_storage_path` | text | yes | — |
| `hosted_token` | text | — | `gen_url_token()` |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (ledger_id) REFERENCES platform_ledger(id) ON DELETE SET NULL`
- `FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE SET NULL`

**Unique:**
- `UNIQUE (credit_note_number)`
- `UNIQUE (hosted_token)`

**Checks:**
- `CHECK ((environment = ANY (ARRAY['test'::text, 'live'::text])))`
- `CHECK ((kind = ANY (ARRAY['refund'::text, 'credit'::text, 'adjustment'::text, 'commission'::text, 'payout'::text])))`
- `CHECK ((status = ANY (ARRAY['issued'::text, 'cancelled'::text])))`

**RLS policies:**
- `wielo_credit_notes_own_read` (SELECT) — `USING (user_id = auth.uid())`

### `wielo_credit_wallet`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `host_id` | uuid | — | — |
| `purpose` | text | — | `'quote'::text` |
| `balance` | integer | — | `0` |
| `created_at` | timestamp with time zone | — | `now()` |
| `updated_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE`

**Unique:**
- `UNIQUE (host_id, purpose)`

**Checks:**
- `CHECK ((balance >= 0))`

**Triggers:**
- `trg_touch_wielo_credit_wallet` → `touch_wielo_credit_wallet()`

**RLS policies:**
- `host reads own credit wallet` (SELECT) — `USING (host_id IN ( SELECT hosts.id
   FROM hosts
  WHERE (hosts.user_id = auth.uid())))`

### `wielo_invoices`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | — | `gen_random_uuid()` |
| `invoice_number` | text | — | — |
| `ledger_id` | uuid | yes | — |
| `order_id` | uuid | yes | — |
| `subscription_id` | uuid | yes | — |
| `user_id` | uuid | yes | — |
| `wielo_snapshot` | jsonb | — | — |
| `buyer_snapshot` | jsonb | — | — |
| `line_items` | jsonb | — | `'[]'::jsonb` |
| `subtotal` | numeric | — | `0` |
| `vat_amount` | numeric | — | `0` |
| `total_amount` | numeric | — | `0` |
| `currency` | text | — | `'ZAR'::text` |
| `status` | text | — | `'paid'::text` |
| `environment` | text | — | `'live'::text` |
| `issued_at` | timestamp with time zone | — | `now()` |
| `paid_at` | timestamp with time zone | yes | — |
| `pdf_storage_path` | text | yes | — |
| `hosted_token` | text | — | `gen_url_token()` |
| `created_at` | timestamp with time zone | — | `now()` |

**Foreign keys:**
- `FOREIGN KEY (ledger_id) REFERENCES platform_ledger(id) ON DELETE SET NULL`
- `FOREIGN KEY (order_id) REFERENCES product_orders(id) ON DELETE SET NULL`
- `FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL`
- `FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE SET NULL`

**Unique:**
- `UNIQUE (hosted_token)`
- `UNIQUE (invoice_number)`

**Checks:**
- `CHECK ((environment = ANY (ARRAY['test'::text, 'live'::text])))`
- `CHECK ((status = ANY (ARRAY['issued'::text, 'paid'::text, 'cancelled'::text])))`

**RLS policies:**
- `wielo_invoices_own_read` (SELECT) — `USING (user_id = auth.uid())`
