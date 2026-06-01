-- Migration: Feature-based Help Centre categories
--
-- Make each product feature its own help category and file the real articles
-- under them, so the Help & Docs page reflects actual features + activity.
-- Empty categories are hidden in the UI, so these light up as articles land.

INSERT INTO help_categories (slug, name, description, icon, audience, sort_order) VALUES
  ('rooms',            'Rooms',            'Per-room setup, occupancy & pricing modes.',          'bed-double',     'host', 31),
  ('seasonal-pricing', 'Seasonal pricing', 'Festive peaks, weekend rates & percentage rules.',    'calendar-range', 'host', 32),
  ('add-ons',          'Add-ons',          'Optional extras guests can add to a booking.',        'package-plus',   'host', 33),
  ('coupons',          'Coupons',          'Discount codes, targeting & redemption limits.',      'ticket',         'both', 34),
  ('listing-extras',   'Listing extras',   'Nearby spots & review themes on your listing.',       'map-pin',        'host', 36),
  ('policies',         'Policies',         'Cancellation policies & house rules.',                'file-text',      'both', 38)
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      icon = EXCLUDED.icon,
      audience = EXCLUDED.audience,
      sort_order = EXCLUDED.sort_order,
      is_published = true,
      deleted_at = null,
      updated_at = now();

-- File existing articles under their feature category.
UPDATE help_articles a
SET category_id = c.id, updated_at = now()
FROM help_categories c
WHERE c.slug = 'seasonal-pricing'
  AND a.slug IN ('how-seasonal-pricing-works', 'smart-pricing-rules');

UPDATE help_articles a
SET category_id = c.id, updated_at = now()
FROM help_categories c
WHERE c.slug = 'coupons' AND a.slug = 'discount-coupons';

UPDATE help_articles a
SET category_id = c.id, updated_at = now()
FROM help_categories c
WHERE c.slug = 'listing-extras' AND a.slug = 'listing-extras';

UPDATE help_articles a
SET category_id = c.id, updated_at = now()
FROM help_categories c
WHERE c.slug = 'policies' AND a.slug = 'cancellation-policies-explained';
