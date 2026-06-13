-- Migration: Guest Reputation — hosts rate guests (cross-host)
-- See host_review_guest.md. Companion to reviews (guest → listing); this is the
-- reverse: host → guest, keyed on the guest's global Vilo identity
-- (user_profiles.id). Unlike every other host-private table, a host's rating of a
-- guest is readable by ALL active hosts (shared reputation network), while each
-- host may only add/edit/delete their OWN row. Guests never see it.

-- ─── guest_ratings ────────────────────────────────────────────
CREATE TABLE public.guest_ratings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id      uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  host_id       uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,

  rating        integer NOT NULL CHECK (rating BETWEEN 1 AND 5),        -- overall (required)
  summary       text,                                                   -- overall write-up

  rating_payments      integer CHECK (rating_payments BETWEEN 1 AND 5),
  rating_communication integer CHECK (rating_communication BETWEEN 1 AND 5),
  rating_cleanliness   integer CHECK (rating_cleanliness BETWEEN 1 AND 5),
  rating_house_rules   integer CHECK (rating_house_rules BETWEEN 1 AND 5),
  rating_integrity     integer CHECK (rating_integrity BETWEEN 1 AND 5),

  note_payments        text,
  note_communication   text,
  note_cleanliness     text,
  note_house_rules     text,
  note_integrity       text,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (host_id, guest_id)                                            -- one living review per host per guest
);

CREATE INDEX idx_guest_ratings_guest ON guest_ratings(guest_id);
CREATE INDEX idx_guest_ratings_host  ON guest_ratings(host_id);

ALTER TABLE guest_ratings ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE guest_ratings IS
  'Host → guest reputation. Cross-host readable by any active host; each host writes only its own row. Internal — never exposed to guests.';

-- ─── updated_at touch ─────────────────────────────────────────
-- update_updated_at() is the repo-standard touch fn (see 20260501000013_create_triggers.sql).
CREATE TRIGGER set_updated_at BEFORE UPDATE ON guest_ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────
-- Cross-host READ: any active (non-deleted) host may read every host's rating of
-- a guest. This is the deliberate shared-reputation sharing. No guest policy →
-- guests can never read it.
CREATE POLICY "host_read_all_guest_ratings" ON guest_ratings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM hosts h
      WHERE h.user_id = auth.uid() AND h.deleted_at IS NULL
    )
  );

-- WRITE only your own row.
CREATE POLICY "host_insert_own_guest_rating" ON guest_ratings FOR INSERT
  WITH CHECK (host_id = get_my_host_id());
CREATE POLICY "host_update_own_guest_rating" ON guest_ratings FOR UPDATE
  USING (host_id = get_my_host_id())
  WITH CHECK (host_id = get_my_host_id());
CREATE POLICY "host_delete_own_guest_rating" ON guest_ratings FOR DELETE
  USING (host_id = get_my_host_id());

-- Super admin oversight (mirror admin_full_reviews).
CREATE POLICY "admin_full_guest_ratings" ON guest_ratings FOR ALL
  USING (is_super_admin());
