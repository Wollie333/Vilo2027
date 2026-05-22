-- Migration: RLS policies for v1.1 (Refund Manager + Policy Manager)
-- Per supabase_database.md §13.4 and §14.7

-- ═══ Refund Manager ════════════════════════════════════════════

-- refund_requests
CREATE POLICY "guest_own_refunds" ON refund_requests
  FOR SELECT USING (guest_id = auth.uid());
CREATE POLICY "guest_create_refund" ON refund_requests
  FOR INSERT WITH CHECK (guest_id = auth.uid());
CREATE POLICY "guest_update_pending_refund" ON refund_requests
  FOR UPDATE USING (guest_id = auth.uid() AND status IN ('pending','disputed'));

CREATE POLICY "host_view_refunds" ON refund_requests
  FOR SELECT USING (host_id = get_my_host_id());
CREATE POLICY "host_action_refunds" ON refund_requests
  FOR UPDATE USING (host_id = get_my_host_id() AND status IN ('pending','failed'));

CREATE POLICY "staff_view_refunds" ON refund_requests
  FOR SELECT USING (host_id = get_my_host_id_as_staff());
CREATE POLICY "staff_action_refunds" ON refund_requests
  FOR UPDATE USING (host_id = get_my_host_id_as_staff() AND status IN ('pending','failed'));

CREATE POLICY "admin_full_access_refunds" ON refund_requests
  FOR ALL USING (is_super_admin());

-- refund_status_history
CREATE POLICY "participant_read_refund_history" ON refund_status_history
  FOR SELECT USING (
    refund_request_id IN (
      SELECT id FROM refund_requests
      WHERE guest_id = auth.uid()
         OR host_id = get_my_host_id()
         OR host_id = get_my_host_id_as_staff()
    )
  );
CREATE POLICY "admin_read_refund_history" ON refund_status_history
  FOR SELECT USING (is_super_admin());

-- ═══ Policy Manager ═══════════════════════════════════════════

-- policies
CREATE POLICY "public_read_active_policies" ON policies FOR SELECT USING (
  status = 'active' AND deleted_at IS NULL AND
  host_id IN (SELECT id FROM hosts WHERE is_active = true)
);
CREATE POLICY "host_manage_policies"        ON policies FOR ALL USING (host_id = get_my_host_id());
CREATE POLICY "staff_read_policies"         ON policies FOR SELECT USING (host_id = get_my_host_id_as_staff());
CREATE POLICY "admin_full_access_policies"  ON policies FOR ALL USING (is_super_admin());

-- policy_cancellation_rules
CREATE POLICY "public_read_cancellation_rules" ON policy_cancellation_rules FOR SELECT USING (
  policy_id IN (SELECT id FROM policies WHERE status = 'active')
);
CREATE POLICY "host_manage_cancellation_rules" ON policy_cancellation_rules FOR ALL USING (
  policy_id IN (SELECT id FROM policies WHERE host_id = get_my_host_id())
);
CREATE POLICY "admin_full_access_rules" ON policy_cancellation_rules FOR ALL USING (is_super_admin());

-- policy_content
CREATE POLICY "public_read_policy_content" ON policy_content FOR SELECT USING (
  policy_id IN (SELECT id FROM policies WHERE status = 'active')
);
CREATE POLICY "host_manage_policy_content" ON policy_content FOR ALL USING (
  policy_id IN (SELECT id FROM policies WHERE host_id = get_my_host_id())
);
CREATE POLICY "admin_full_access_content" ON policy_content FOR ALL USING (is_super_admin());

-- listing_policies
CREATE POLICY "public_read_listing_policies" ON listing_policies FOR SELECT USING (
  listing_id IN (SELECT id FROM listings WHERE is_published = true)
);
CREATE POLICY "host_manage_listing_policies" ON listing_policies FOR ALL USING (
  listing_id IN (SELECT id FROM listings WHERE host_id = get_my_host_id())
);
CREATE POLICY "staff_read_listing_policies" ON listing_policies FOR SELECT USING (
  listing_id IN (SELECT id FROM listings WHERE host_id = get_my_host_id_as_staff())
);
CREATE POLICY "admin_full_access_listing_policies" ON listing_policies FOR ALL USING (is_super_admin());

-- policy_snapshots (read-only for participants — no UPDATE/DELETE policies)
CREATE POLICY "guest_read_own_snapshots" ON policy_snapshots FOR SELECT USING (
  booking_id IN (SELECT id FROM bookings WHERE guest_id = auth.uid())
);
CREATE POLICY "host_read_booking_snapshots" ON policy_snapshots FOR SELECT USING (
  booking_id IN (SELECT id FROM bookings WHERE host_id = get_my_host_id())
);
CREATE POLICY "admin_full_access_snapshots" ON policy_snapshots FOR ALL USING (is_super_admin());
