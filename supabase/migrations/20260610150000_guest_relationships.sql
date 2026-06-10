-- Migration: party guests → standalone guest records + relationships
--
-- Checkout already captures an optional party manifest on
-- bookings.additional_guests ([{ name, email, phone? }]). This migration turns
-- each named party member into a first-class CRM contact and records the link
-- back to the lead booker, so the host can contact every guest individually and
-- see "who travelled with whom".
--
--   1. guest_relationships — directional links between two host_contacts (one row
--      per direction) tagged with the booking they came from.
--   2. _materialize_booking_party(booking) — idempotent: upserts a host_contacts
--      row for the lead + each named party member (deduped by lower(email)), then
--      links each party member ↔ the lead. Pure SQL; no gkey needed (the Guests
--      directory derives gkeys from host_contacts on read — see _host_guest_rows).
--   3. materialize_booking_party(booking) — ownership-checked RPC wrapper for the
--      app (lazy fallback on the booking record + host "add guest to booking").
--   4. AFTER UPDATE OF status trigger → materialize when a booking is confirmed.
--      (Matches the established confirm-trigger pattern: AFTER UPDATE OF status,
--      never INSERT — bookings are inserted pending then UPDATEd to confirmed.)
--
-- host_contacts requires a (name +) email per guest, so the booking form +
-- "add guest" flows make email required. Party rows without an email are skipped.

-- ─── 1. guest_relationships ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guest_relationships (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id            uuid NOT NULL REFERENCES public.hosts(id)         ON DELETE CASCADE,
  contact_id         uuid NOT NULL REFERENCES public.host_contacts(id) ON DELETE CASCADE,
  related_contact_id uuid NOT NULL REFERENCES public.host_contacts(id) ON DELETE CASCADE,
  source_booking_id  uuid REFERENCES public.bookings(id)              ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guest_relationships_no_self CHECK (contact_id <> related_contact_id),
  CONSTRAINT guest_relationships_unique
    UNIQUE (host_id, contact_id, related_contact_id, source_booking_id)
);

CREATE INDEX IF NOT EXISTS idx_guest_relationships_contact
  ON public.guest_relationships(host_id, contact_id);

ALTER TABLE public.guest_relationships ENABLE ROW LEVEL SECURITY;

-- Same host-ownership pattern as host_contacts.
DROP POLICY IF EXISTS guest_relationships_owner_all ON public.guest_relationships;
CREATE POLICY guest_relationships_owner_all ON public.guest_relationships
  FOR ALL TO authenticated
  USING (host_id IN (SELECT id FROM public.hosts WHERE user_id = auth.uid()))
  WITH CHECK (host_id IN (SELECT id FROM public.hosts WHERE user_id = auth.uid()));

COMMENT ON TABLE public.guest_relationships IS
  'Directional links between two of a host''s contacts, materialised from a booking''s party manifest (lead booker ↔ each named party member). One row per direction; tagged with the source booking. Surfaced on the guest record Relationships tab.';

-- ─── 2. Materialiser (internal, definer — bypasses RLS) ─────────────────
CREATE OR REPLACE FUNCTION public._materialize_booking_party(p_booking_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_host        uuid;
  v_lead_guest  uuid;
  v_lead_email  text;
  v_lead_name   text;
  v_lead_phone  text;
  v_addl        jsonb;
  v_lead_cid    uuid;
  v_pcid        uuid;
  v_pguest      uuid;
  g             jsonb;
  v_pname       text;
  v_pemail      text;
  v_pphone      text;
BEGIN
  SELECT host_id, guest_id, lower(nullif(trim(guest_email), '')),
         guest_name, guest_phone, additional_guests
    INTO v_host, v_lead_guest, v_lead_email, v_lead_name, v_lead_phone, v_addl
    FROM public.bookings WHERE id = p_booking_id;
  IF v_host IS NULL THEN RETURN; END IF;

  -- Lead booker contact (needed as the anchor for every relationship).
  IF v_lead_email IS NOT NULL THEN
    INSERT INTO public.host_contacts (host_id, guest_id, email, name, phone)
      VALUES (v_host, v_lead_guest, v_lead_email, v_lead_name, v_lead_phone)
    ON CONFLICT (host_id, lower(email)) DO UPDATE
      SET name     = COALESCE(public.host_contacts.name,  EXCLUDED.name),
          phone    = COALESCE(public.host_contacts.phone, EXCLUDED.phone),
          guest_id = COALESCE(public.host_contacts.guest_id, EXCLUDED.guest_id)
      RETURNING id INTO v_lead_cid;
  END IF;

  -- Each named party member with an email → its own contact + link to the lead.
  FOR g IN SELECT jsonb_array_elements(COALESCE(v_addl, '[]'::jsonb)) LOOP
    v_pname  := trim(COALESCE(g->>'name', ''));
    v_pemail := lower(trim(COALESCE(g->>'email', '')));
    v_pphone := nullif(trim(COALESCE(g->>'phone', '')), '');
    CONTINUE WHEN v_pname = '' OR v_pemail = '';

    SELECT id INTO v_pguest FROM public.user_profiles
      WHERE lower(email) = v_pemail LIMIT 1;

    INSERT INTO public.host_contacts (host_id, guest_id, email, name, phone)
      VALUES (v_host, v_pguest, v_pemail, v_pname, v_pphone)
    ON CONFLICT (host_id, lower(email)) DO UPDATE
      SET name     = COALESCE(public.host_contacts.name,  EXCLUDED.name),
          phone    = COALESCE(public.host_contacts.phone, EXCLUDED.phone),
          guest_id = COALESCE(public.host_contacts.guest_id, EXCLUDED.guest_id)
      RETURNING id INTO v_pcid;

    IF v_lead_cid IS NOT NULL AND v_pcid IS NOT NULL AND v_lead_cid <> v_pcid THEN
      INSERT INTO public.guest_relationships
        (host_id, contact_id, related_contact_id, source_booking_id)
      VALUES
        (v_host, v_lead_cid, v_pcid, p_booking_id),
        (v_host, v_pcid, v_lead_cid, p_booking_id)
      ON CONFLICT ON CONSTRAINT guest_relationships_unique DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._materialize_booking_party(uuid) FROM PUBLIC;

COMMENT ON FUNCTION public._materialize_booking_party IS
  'Internal: idempotently upsert host_contacts for a booking''s lead + party members and link each party member to the lead. SECURITY DEFINER; called by the confirm trigger and the ownership-checked materialize_booking_party() wrapper.';

-- ─── 3. Public RPC wrapper (ownership-checked) ──────────────────────────
CREATE OR REPLACE FUNCTION public.materialize_booking_party(p_booking_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_host uuid;
BEGIN
  SELECT host_id INTO v_host FROM public.bookings WHERE id = p_booking_id;
  IF v_host IS NULL OR NOT _can_read_host(v_host) THEN RETURN; END IF;
  PERFORM public._materialize_booking_party(p_booking_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.materialize_booking_party(uuid) TO authenticated;

COMMENT ON FUNCTION public.materialize_booking_party IS
  'Ownership-checked entry point: materialise a booking''s party into host_contacts + guest_relationships. Used as a lazy fallback on the booking record and by the host "add guest to booking" action.';

-- ─── 4. Confirm trigger ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._trg_materialize_booking_party()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public._materialize_booking_party(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_materialize_booking_party ON public.bookings;
CREATE TRIGGER trg_materialize_booking_party
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed')
  EXECUTE FUNCTION public._trg_materialize_booking_party();
