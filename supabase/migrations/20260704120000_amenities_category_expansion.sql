-- Category-based amenities — comprehensive taxonomy expansion.
--
-- Re-seeds amenity_groups + amenity_catalog into a Booking.com-style, category-
-- first set (16 categories, ~95 amenities) in a Vilo-appropriate order. Admin can
-- rename / reorder / add / remove any of it via /admin/platform/amenities.
--
-- SAFE to wipe + re-seed:
--   • property_amenities.catalog_id is ON DELETE SET NULL, and a listing's
--     amenities are keyed by SLUG (amenity_key) — not by catalog_id — so clearing
--     the catalog never drops a host's selection.
--   • Every slug that existed in the original seed (wifi, kitchen, parking, aircon,
--     heating, tv, washer, dryer, workspace, self_checkin, host_onsite, pool,
--     hot_tub, fireplace, braai, family_friendly, pet_friendly, smoke_alarm,
--     first_aid, wheelchair) is RETAINED below, so existing rows keep resolving.
-- Pre-MVP policy (CLAUDE.md) explicitly allows this reshape.

DELETE FROM public.amenity_catalog;
DELETE FROM public.amenity_groups;

WITH g AS (
  INSERT INTO public.amenity_groups (slug, label, icon, sort_order) VALUES
    ('general',       'General facilities',    'circle-check',     10),
    ('internet',      'Internet',              'wifi',             20),
    ('parking',       'Parking & transport',   'square-parking',   30),
    ('rooms',         'In the rooms',          'bed-double',       40),
    ('bathroom',      'In the bathroom',       'shower-head',      50),
    ('kitchen',       'In the kitchen',        'utensils',         60),
    ('dining',        'Dining',                'utensils-crossed', 70),
    ('wellness',      'Recreation & wellness', 'waves',            80),
    ('activities',    'Activities',            'bike',             90),
    ('outdoors',      'Outdoors & view',       'tree-pine',       100),
    ('family',        'Family & kids',         'baby',            110),
    ('business',      'Business',              'briefcase',       120),
    ('services',      'Property services',     'concierge-bell',  130),
    ('safety',        'Safety',                'shield-check',    140),
    ('accessibility', 'Accessibility',         'accessibility',   150),
    ('pets',          'Pets',                  'paw-print',       160)
  RETURNING id, slug
)
INSERT INTO public.amenity_catalog (group_id, slug, label, icon, sort_order)
SELECT g.id, v.slug, v.label, v.icon, v.sort_order
FROM (VALUES
  -- General facilities
  ('general',      'no_smoking',         'No smoking on site',        'cigarette-off',    1010),
  ('general',      'coffee_shop',        'Coffee shop',               'coffee',           1020),
  ('general',      'fireplace',          'Fireplace',                 'flame',            1030),
  ('general',      'key_access',         'Key access',                'key-round',        1040),
  ('general',      'front_desk_24h',     '24-hour front desk',        'concierge-bell',   1050),
  ('general',      'lift',               'Lift / elevator',           'building-2',       1060),
  ('general',      'non_smoking_rooms',  'Non-smoking rooms',         'cigarette-off',    1070),
  -- Internet
  ('internet',     'wifi',               'Free WiFi in public areas', 'wifi',             2010),
  ('internet',     'wifi_rooms',         'WiFi in the rooms',         'wifi',             2020),
  -- Parking & transport
  ('parking',      'parking',            'Free parking',              'square-parking',   3010),
  ('parking',      'secure_parking',     'Secure parking',            'lock',             3020),
  ('parking',      'street_parking',     'Street parking',            'car',              3030),
  ('parking',      'shuttle_paid',       'Airport shuttle (paid)',    'bus',              3040),
  ('parking',      'shuttle_free',       'Airport shuttle (free)',    'bus',              3050),
  ('parking',      'car_hire',           'Car hire',                  'car',              3060),
  -- In the rooms
  ('rooms',        'sitting_area',       'Sitting area',              'sofa',             4010),
  ('rooms',        'patio',              'Patio',                     'sun',              4020),
  ('rooms',        'terrace',            'Terrace',                   'sun',              4030),
  ('rooms',        'garden_furniture',   'Garden furniture',          'armchair',         4040),
  ('rooms',        'tea_coffee',         'Tea/coffee facilities',     'coffee',           4050),
  ('rooms',        'dining_table',       'Dining table',              'utensils',         4060),
  ('rooms',        'balcony',            'Balcony',                   'building',         4070),
  ('rooms',        'wardrobe',           'Wardrobe',                  'door-open',        4080),
  ('rooms',        'safe',               'In-room safe',              'lock',             4090),
  ('rooms',        'aircon',             'Air conditioning',          'wind',             4100),
  ('rooms',        'heating',            'Heating',                   'flame',            4110),
  ('rooms',        'tv',                 'TV',                        'tv',               4120),
  ('rooms',        'workspace',          'Workspace',                 'laptop',           4130),
  -- In the bathroom
  ('bathroom',     'free_toiletries',    'Free toiletries',           'sparkles',         5010),
  ('bathroom',     'hairdryer',          'Hairdryer',                 'fan',              5020),
  ('bathroom',     'bath',               'Bath',                      'bath',             5030),
  ('bathroom',     'shower',             'Shower',                    'shower-head',      5040),
  ('bathroom',     'towels',             'Towels',                    'waves',            5050),
  -- In the kitchen
  ('kitchen',      'electric_kettle',    'Electric kettle',           'coffee',           6010),
  ('kitchen',      'cookware',           'Cookware / kitchen utensils','cooking-pot',     6020),
  ('kitchen',      'fridge',             'Fridge',                    'refrigerator',     6030),
  ('kitchen',      'microwave',          'Microwave',                 'microwave',        6040),
  ('kitchen',      'stovetop',           'Stovetop',                  'flame',            6050),
  ('kitchen',      'oven',               'Oven',                      'cooking-pot',      6060),
  ('kitchen',      'dishwasher',         'Dishwasher',                'washing-machine',  6070),
  ('kitchen',      'kitchen',            'Full kitchen',              'utensils',         6080),
  -- Dining
  ('dining',       'breakfast_room',     'In-room breakfast',         'croissant',        7010),
  ('dining',       'restaurant',         'Restaurant',                'utensils',         7020),
  ('dining',       'bar_lounge',         'Bar / lounge',              'wine',             7030),
  ('dining',       'outdoor_dining',     'Outdoor dining area',       'utensils-crossed', 7040),
  ('dining',       'picnic_area',        'Picnic area / tables',      'salad',            7050),
  ('dining',       'packed_lunches',     'Packed lunches',            'hand-platter',     7060),
  ('dining',       'special_diets',      'Special diet menus',        'salad',            7070),
  ('dining',       'breakfast_included', 'Breakfast included',        'croissant',        7080),
  -- Recreation & wellness
  ('wellness',     'pool',               'Pool',                      'waves',            8010),
  ('wellness',     'hot_tub',            'Hot tub',                   'bath',             8020),
  ('wellness',     'spa',                'Spa & wellness centre',     'sparkles',         8030),
  ('wellness',     'sun_terrace',        'Sun terrace',               'sun',              8040),
  ('wellness',     'sauna',              'Sauna',                     'thermometer',      8050),
  ('wellness',     'massage',            'Massage',                   'heart',            8060),
  ('wellness',     'fitness_centre',     'Fitness centre',            'dumbbell',         8070),
  -- Activities
  ('activities',   'hiking',             'Hiking',                    'footprints',       9010),
  ('activities',   'canoeing',           'Canoeing',                  'sailboat',         9020),
  ('activities',   'horse_riding',       'Horseback riding',          'footprints',       9030),
  ('activities',   'tennis',             'Tennis court',              'trophy',           9040),
  ('activities',   'fishing',            'Fishing',                   'fish',             9050),
  ('activities',   'cycling',            'Cycling',                   'bike',             9060),
  ('activities',   'wine_tasting',       'Wine tasting',              'wine',             9070),
  -- Outdoors & view
  ('outdoors',     'braai',              'Braai / BBQ facilities',    'utensils-crossed',10010),
  ('outdoors',     'garden',             'Garden',                    'trees',           10020),
  ('outdoors',     'fire_pit',           'Fire pit',                  'flame',           10030),
  ('outdoors',     'outdoor_furniture',  'Outdoor furniture',         'armchair',        10040),
  ('outdoors',     'beachfront',         'Beachfront',                'umbrella',        10050),
  ('outdoors',     'mountain_view',      'Mountain view',             'mountain',        10060),
  ('outdoors',     'sea_view',           'Sea view',                  'waves',           10070),
  -- Family & kids
  ('family',       'family_friendly',    'Family friendly',           'users',           11010),
  ('family',       'babysitting',        'Babysitting / child services','baby',          11020),
  ('family',       'kids_play_area',     'Children''s play area',      'gamepad-2',       11030),
  ('family',       'kids_buffet',        'Children''s buffet',         'cake',            11040),
  ('family',       'cot',                'Cot available',             'bed',             11050),
  ('family',       'high_chair',         'High chair',                'armchair',        11060),
  -- Business
  ('business',     'meeting_facilities', 'Meeting / banquet facilities','briefcase',     12010),
  ('business',     'business_workspace', 'Workspace',                 'laptop',          12020),
  ('business',     'printing',           'Fax / photocopying',        'newspaper',       12030),
  ('business',     'business_centre',    'Business centre',           'building-2',      12040),
  -- Property services
  ('services',     'vip_checkin',        'VIP check-in / out',        'star',            13010),
  ('services',     'security_24h',       '24-hour security',          'shield-check',    13020),
  ('services',     'luggage_storage',    'Luggage storage',           'luggage',         13030),
  ('services',     'currency_exchange',  'Currency exchange',         'wallet',          13040),
  ('services',     'room_service',       'Room service',              'concierge-bell',  13050),
  ('services',     'housekeeping',       'Housekeeping',              'sparkles',        13060),
  ('services',     'laundry',            'Laundry',                   'washing-machine', 13070),
  ('services',     'tours_assistance',   'Tours / ticket assistance', 'map',             13080),
  ('services',     'welcome_drink',      'Welcome drink',             'martini',         13090),
  ('services',     'self_checkin',       'Self check-in',             'key-round',       13100),
  ('services',     'host_onsite',        'Host on-site',              'user-check',      13110),
  -- Safety
  ('safety',       'smoke_alarm',        'Smoke alarm',               'bell-ring',       14010),
  ('safety',       'first_aid',          'First-aid kit',             'cross',           14020),
  ('safety',       'co_alarm',           'Carbon monoxide alarm',     'bell-ring',       14030),
  ('safety',       'security_cameras',   'Security cameras',          'cctv',            14040),
  ('safety',       'fire_extinguisher',  'Fire extinguisher',         'flame',           14050),
  -- Accessibility
  ('accessibility','wheelchair',         'Wheelchair accessible',     'accessibility',   15010),
  ('accessibility','ground_floor',       'Ground-floor access',       'building',        15020),
  ('accessibility','accessible_bathroom','Accessible bathroom',       'accessibility',   15030),
  -- Pets
  ('pets',         'pet_friendly',       'Pets allowed',              'paw-print',       16010),
  ('pets',         'pet_bowls',          'Pet bowls',                 'dog',             16020),
  ('pets',         'pet_basket',         'Pet basket',                'dog',             16030)
) AS v(group_slug, slug, label, icon, sort_order)
JOIN g ON g.slug = v.group_slug;
