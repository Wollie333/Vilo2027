-- Migration: seed two sample add-ons per host so the checkout add-ons section
-- is populated for testing. Idempotent — skips a host that already has an
-- add-on by the same name, and links listing-wide (room_id NULL) to each of
-- the host's published accommodation listings (ON CONFLICT DO NOTHING dedupes
-- against uq_listing_addons_listingwide).
--
-- Pre-MVP seed (CLAUDE.md): sample data, safe to drop/re-run.
--
-- DOWN: DELETE FROM addons WHERE name IN ('Breakfast hamper','Airport transfer · return');
--       (listing_addons rows cascade on addon delete).

DO $$
DECLARE
  h          record;
  v_breakfast uuid;
  v_transfer  uuid;
BEGIN
  FOR h IN SELECT id FROM public.hosts WHERE deleted_at IS NULL LOOP
    -- Breakfast hamper — per guest, per night.
    SELECT id INTO v_breakfast
      FROM public.addons
      WHERE host_id = h.id AND name = 'Breakfast hamper'
      LIMIT 1;
    IF v_breakfast IS NULL THEN
      INSERT INTO public.addons
        (host_id, name, description, pricing_model, unit_price, currency,
         min_quantity, max_quantity, is_required, is_active, lead_time_days, sort_order)
      VALUES
        (h.id, 'Breakfast hamper',
         'Locally-baked rusks, farm yoghurt, seasonal fruit and freshly-ground coffee — delivered to your door each morning.',
         'per_guest_per_night', 180, 'ZAR', 1, 10, false, true, 0, 0)
      RETURNING id INTO v_breakfast;
    END IF;

    -- Airport transfer — once-off per stay.
    SELECT id INTO v_transfer
      FROM public.addons
      WHERE host_id = h.id AND name = 'Airport transfer · return'
      LIMIT 1;
    IF v_transfer IS NULL THEN
      INSERT INTO public.addons
        (host_id, name, description, pricing_model, unit_price, currency,
         min_quantity, max_quantity, is_required, is_active, lead_time_days, sort_order)
      VALUES
        (h.id, 'Airport transfer · return',
         'Door-to-door return transfer from the nearest airport. Up to 4 passengers with luggage.',
         'per_stay', 850, 'ZAR', 1, 1, false, true, 0, 1)
      RETURNING id INTO v_transfer;
    END IF;

    -- Link both, listing-wide, to every published accommodation listing.
    INSERT INTO public.listing_addons (listing_id, addon_id, room_id)
      SELECT l.id, v_breakfast, NULL
        FROM public.listings l
        WHERE l.host_id = h.id
          AND l.is_published = true
          AND l.listing_type = 'accommodation'
          AND l.deleted_at IS NULL
      ON CONFLICT DO NOTHING;

    INSERT INTO public.listing_addons (listing_id, addon_id, room_id)
      SELECT l.id, v_transfer, NULL
        FROM public.listings l
        WHERE l.host_id = h.id
          AND l.is_published = true
          AND l.listing_type = 'accommodation'
          AND l.deleted_at IS NULL
      ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
