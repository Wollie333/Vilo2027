-- Migration (Phase 6): maintain guest_business_links as guests are materialised.
--
-- _materialize_booking_party already upserts host_contacts for a booking's lead
-- booker + named party members. Extend it to also tag each of those contacts
-- with the business that owns the booking's listing (guest_business_links), so a
-- guest is associated with every business they've engaged. Idempotent
-- (ON CONFLICT DO NOTHING); the link is best-effort and never blocks the party
-- materialisation. Phase 1 backfilled historical bookings; this keeps new ones
-- current.

CREATE OR REPLACE FUNCTION public._materialize_booking_party(p_booking_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_host        uuid;
  v_listing     uuid;
  v_business_id uuid;
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
  SELECT host_id, listing_id, guest_id, lower(nullif(trim(guest_email), '')),
         guest_name, guest_phone, additional_guests
    INTO v_host, v_listing, v_lead_guest, v_lead_email, v_lead_name,
         v_lead_phone, v_addl
    FROM public.bookings WHERE id = p_booking_id;
  IF v_host IS NULL THEN RETURN; END IF;

  -- The business that owns the booking's listing (tags the guest links).
  SELECT business_id INTO v_business_id
    FROM public.listings WHERE id = v_listing;

  -- Lead booker contact (needed as the anchor for every relationship).
  IF v_lead_email IS NOT NULL THEN
    INSERT INTO public.host_contacts (host_id, guest_id, email, name, phone)
      VALUES (v_host, v_lead_guest, v_lead_email, v_lead_name, v_lead_phone)
    ON CONFLICT (host_id, lower(email)) DO UPDATE
      SET name     = COALESCE(public.host_contacts.name,  EXCLUDED.name),
          phone    = COALESCE(public.host_contacts.phone, EXCLUDED.phone),
          guest_id = COALESCE(public.host_contacts.guest_id, EXCLUDED.guest_id)
      RETURNING id INTO v_lead_cid;

    IF v_lead_cid IS NOT NULL AND v_business_id IS NOT NULL THEN
      INSERT INTO public.guest_business_links
        (host_id, contact_id, business_id, source_booking_id)
      VALUES (v_host, v_lead_cid, v_business_id, p_booking_id)
      ON CONFLICT (contact_id, business_id) DO NOTHING;
    END IF;
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

    IF v_pcid IS NOT NULL AND v_business_id IS NOT NULL THEN
      INSERT INTO public.guest_business_links
        (host_id, contact_id, business_id, source_booking_id)
      VALUES (v_host, v_pcid, v_business_id, p_booking_id)
      ON CONFLICT (contact_id, business_id) DO NOTHING;
    END IF;

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
