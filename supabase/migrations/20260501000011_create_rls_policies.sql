-- Migration: Row Level Security Policies (v1.0 tables)
-- Per supabase_database.md §15
-- Helper functions from 000010 are referenced throughout.
-- Tables not listed here have RLS enabled with no explicit policy → service_role only access (intentional for audit/queue tables).

-- ─── user_profiles ────────────────────────────────────────────
CREATE POLICY "users_read_own"        ON user_profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "admin_read_all"        ON user_profiles FOR SELECT USING (is_super_admin());
CREATE POLICY "users_update_own"      ON user_profiles FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM user_profiles WHERE id = auth.uid()));
CREATE POLICY "admin_update_any"      ON user_profiles FOR UPDATE USING (is_super_admin());
CREATE POLICY "system_insert_profile" ON user_profiles FOR INSERT WITH CHECK (id = auth.uid());

-- ─── hosts ────────────────────────────────────────────────────
CREATE POLICY "public_read_active_hosts" ON hosts FOR SELECT
  USING (is_active = true AND deleted_at IS NULL);
CREATE POLICY "host_manage_own"          ON hosts FOR ALL
  USING (user_id = auth.uid());
CREATE POLICY "staff_read_host"          ON hosts FOR SELECT
  USING (id = get_my_host_id_as_staff());
CREATE POLICY "admin_full_access_hosts"  ON hosts FOR ALL
  USING (is_super_admin());

-- ─── staff_members ────────────────────────────────────────────
CREATE POLICY "host_manage_staff" ON staff_members FOR ALL
  USING (host_id = get_my_host_id());
CREATE POLICY "staff_read_own"    ON staff_members FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "admin_full_staff"  ON staff_members FOR ALL
  USING (is_super_admin());

-- ─── listings ─────────────────────────────────────────────────
CREATE POLICY "public_read_published" ON listings FOR SELECT
  USING (is_published = true AND is_suspended = false AND deleted_at IS NULL);
CREATE POLICY "host_manage_own_listings" ON listings FOR ALL
  USING (host_id = get_my_host_id());
CREATE POLICY "staff_read_listings"   ON listings FOR SELECT
  USING (host_id = get_my_host_id_as_staff());
CREATE POLICY "staff_update_listings" ON listings FOR UPDATE
  USING (host_id = get_my_host_id_as_staff());
CREATE POLICY "admin_full_listings"   ON listings FOR ALL
  USING (is_super_admin());

-- ─── blocked_dates ────────────────────────────────────────────
CREATE POLICY "public_read_blocked"     ON blocked_dates FOR SELECT
  USING (listing_id IN (SELECT id FROM listings WHERE is_published = true));
CREATE POLICY "host_manage_blocked"     ON blocked_dates FOR ALL
  USING (listing_id IN (SELECT id FROM listings WHERE host_id = get_my_host_id()));
CREATE POLICY "staff_manage_blocked"    ON blocked_dates FOR ALL
  USING (listing_id IN (SELECT id FROM listings WHERE host_id = get_my_host_id_as_staff()));
CREATE POLICY "admin_full_blocked"      ON blocked_dates FOR ALL
  USING (is_super_admin());

-- ─── bookings ─────────────────────────────────────────────────
CREATE POLICY "guest_read_own_bookings"   ON bookings FOR SELECT USING (guest_id = auth.uid());
CREATE POLICY "guest_update_own_bookings" ON bookings FOR UPDATE USING (guest_id = auth.uid())
  WITH CHECK (guest_id = auth.uid());
CREATE POLICY "host_manage_own_bookings"  ON bookings FOR ALL USING (host_id = get_my_host_id());
CREATE POLICY "staff_read_bookings"       ON bookings FOR SELECT
  USING (host_id = get_my_host_id_as_staff());
CREATE POLICY "staff_update_bookings"     ON bookings FOR UPDATE
  USING (host_id = get_my_host_id_as_staff());
CREATE POLICY "admin_full_bookings"       ON bookings FOR ALL USING (is_super_admin());

-- ─── payments ─────────────────────────────────────────────────
CREATE POLICY "guest_read_own_payments" ON payments FOR SELECT USING (
  booking_id IN (SELECT id FROM bookings WHERE guest_id = auth.uid()));
CREATE POLICY "host_read_own_payments"  ON payments FOR SELECT USING (
  booking_id IN (SELECT id FROM bookings WHERE host_id = get_my_host_id()));
CREATE POLICY "admin_full_payments"     ON payments FOR ALL USING (is_super_admin());

-- ─── subscriptions ────────────────────────────────────────────
CREATE POLICY "host_manage_own_sub" ON subscriptions FOR ALL USING (host_id = get_my_host_id());
CREATE POLICY "admin_full_sub"      ON subscriptions FOR ALL USING (is_super_admin());

-- ─── plan_features ────────────────────────────────────────────
CREATE POLICY "authenticated_read_plan_features" ON plan_features FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "admin_manage_plan_features"       ON plan_features FOR ALL USING (is_super_admin());

-- ─── host_feature_overrides ───────────────────────────────────
CREATE POLICY "host_read_own_overrides" ON host_feature_overrides FOR SELECT
  USING (host_id = get_my_host_id());
CREATE POLICY "admin_manage_overrides"  ON host_feature_overrides FOR ALL USING (is_super_admin());

-- ─── conversations ────────────────────────────────────────────
CREATE POLICY "host_manage_conv"     ON conversations FOR ALL USING (host_id = get_my_host_id());
CREATE POLICY "staff_manage_conv"    ON conversations FOR ALL
  USING (host_id = get_my_host_id_as_staff());
CREATE POLICY "guest_manage_conv"    ON conversations FOR ALL USING (guest_id = auth.uid());
CREATE POLICY "admin_full_conv"      ON conversations FOR ALL USING (is_super_admin());

-- ─── messages ─────────────────────────────────────────────────
CREATE POLICY "participant_access_msg" ON messages FOR ALL USING (
  conversation_id IN (
    SELECT id FROM conversations
    WHERE host_id = get_my_host_id()
       OR host_id = get_my_host_id_as_staff()
       OR guest_id = auth.uid()
  )
);
CREATE POLICY "admin_full_messages" ON messages FOR ALL USING (is_super_admin());

-- ─── reviews ──────────────────────────────────────────────────
CREATE POLICY "public_read_published_reviews" ON reviews FOR SELECT
  USING (is_published = true AND flagged = false);
CREATE POLICY "guest_read_own_reviews"        ON reviews FOR SELECT USING (guest_id = auth.uid());
CREATE POLICY "host_read_own_reviews"         ON reviews FOR SELECT USING (host_id = get_my_host_id());
CREATE POLICY "host_respond_reviews"          ON reviews FOR UPDATE USING (host_id = get_my_host_id())
  WITH CHECK (host_id = get_my_host_id());
CREATE POLICY "admin_full_reviews"            ON reviews FOR ALL USING (is_super_admin());

-- ─── platform_settings ────────────────────────────────────────
CREATE POLICY "anyone_read_settings" ON platform_settings FOR SELECT
  USING (auth.role() IN ('authenticated','anon'));
CREATE POLICY "admin_write_settings"  ON platform_settings FOR ALL USING (is_super_admin());

-- ─── admin_audit_log ──────────────────────────────────────────
CREATE POLICY "admin_read_audit" ON admin_audit_log FOR SELECT USING (is_super_admin());
-- INSERT only via service_role in Edge Functions. No UPDATE or DELETE policies.

-- ─── eft_banking_details ──────────────────────────────────────
-- Only exposed to guests with a confirmed EFT booking — enforced via Edge Function
CREATE POLICY "host_manage_eft" ON eft_banking_details FOR ALL
  USING (host_id = get_my_host_id());
CREATE POLICY "admin_full_eft"  ON eft_banking_details FOR ALL USING (is_super_admin());

-- ─── listing_amenities / listing_photos (read public if listing is) ───
CREATE POLICY "public_read_amenities" ON listing_amenities FOR SELECT
  USING (listing_id IN (SELECT id FROM listings WHERE is_published = true));
CREATE POLICY "host_manage_amenities" ON listing_amenities FOR ALL
  USING (listing_id IN (SELECT id FROM listings WHERE host_id = get_my_host_id()));
CREATE POLICY "admin_full_amenities"  ON listing_amenities FOR ALL USING (is_super_admin());

CREATE POLICY "public_read_photos"    ON listing_photos FOR SELECT
  USING (listing_id IN (SELECT id FROM listings WHERE is_published = true));
CREATE POLICY "host_manage_photos"    ON listing_photos FOR ALL
  USING (listing_id IN (SELECT id FROM listings WHERE host_id = get_my_host_id()));
CREATE POLICY "admin_full_photos"     ON listing_photos FOR ALL USING (is_super_admin());

-- ─── featured_listings ────────────────────────────────────────
CREATE POLICY "public_read_featured" ON featured_listings FOR SELECT USING (true);
CREATE POLICY "admin_manage_featured" ON featured_listings FOR ALL USING (is_super_admin());

-- ─── message_templates ────────────────────────────────────────
CREATE POLICY "host_manage_templates" ON message_templates FOR ALL
  USING (host_id = get_my_host_id());
CREATE POLICY "admin_full_templates"  ON message_templates FOR ALL USING (is_super_admin());

-- ─── push_tokens ──────────────────────────────────────────────
CREATE POLICY "user_manage_own_tokens" ON push_tokens FOR ALL USING (user_id = auth.uid());

-- ─── booking_notes ────────────────────────────────────────────
CREATE POLICY "host_manage_booking_notes" ON booking_notes FOR ALL USING (
  booking_id IN (SELECT id FROM bookings WHERE host_id = get_my_host_id())
);
CREATE POLICY "staff_manage_booking_notes" ON booking_notes FOR ALL USING (
  booking_id IN (SELECT id FROM bookings WHERE host_id = get_my_host_id_as_staff())
);
CREATE POLICY "admin_full_booking_notes" ON booking_notes FOR ALL USING (is_super_admin());

-- ─── refunds (v1.0 simple table) ──────────────────────────────
CREATE POLICY "guest_read_own_refunds" ON refunds FOR SELECT USING (
  booking_id IN (SELECT id FROM bookings WHERE guest_id = auth.uid()));
CREATE POLICY "host_manage_refunds"    ON refunds FOR ALL USING (
  booking_id IN (SELECT id FROM bookings WHERE host_id = get_my_host_id()));
CREATE POLICY "admin_full_refunds"     ON refunds FOR ALL USING (is_super_admin());

-- ─── subscription_history ─────────────────────────────────────
CREATE POLICY "host_read_sub_history" ON subscription_history FOR SELECT
  USING (host_id = get_my_host_id());
CREATE POLICY "admin_read_sub_history" ON subscription_history FOR SELECT USING (is_super_admin());

-- ─── seasonal pricing / listing rankings (public read for published listings) ───
CREATE POLICY "public_read_seasonal_pricing" ON listing_seasonal_pricing FOR SELECT
  USING (listing_id IN (SELECT id FROM listings WHERE is_published = true));
CREATE POLICY "host_manage_seasonal_pricing" ON listing_seasonal_pricing FOR ALL
  USING (listing_id IN (SELECT id FROM listings WHERE host_id = get_my_host_id()));
CREATE POLICY "admin_full_seasonal" ON listing_seasonal_pricing FOR ALL USING (is_super_admin());

CREATE POLICY "public_read_rankings" ON listing_rankings FOR SELECT
  USING (listing_id IN (SELECT id FROM listings WHERE is_published = true));
-- listing_rankings updates only via service_role (pg_cron job)
