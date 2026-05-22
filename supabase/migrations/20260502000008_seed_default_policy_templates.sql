-- Migration: Seed default policy templates into platform_settings (v1.1)
-- Per supabase_database.md "Updated Seed Data (v1.1)"
-- Pre-loaded for new hosts to choose from during onboarding.

INSERT INTO platform_settings (key, value, description)
VALUES (
  'default_policy_templates',
  jsonb_build_object(
    'cancellation_flexible', jsonb_build_object(
      'name',   'Flexible Cancellation',
      'preset', 'flexible',
      'rules',  '[
        {"days_before": 1, "refund_percent": 100, "label": "Full refund"},
        {"days_before": 0, "refund_percent": 0,   "label": "No refund"}
      ]'::jsonb
    ),
    'cancellation_moderate', jsonb_build_object(
      'name',   'Moderate Cancellation',
      'preset', 'moderate',
      'rules',  '[
        {"days_before": 5, "refund_percent": 100, "label": "Full refund"},
        {"days_before": 1, "refund_percent": 50,  "label": "50% refund"},
        {"days_before": 0, "refund_percent": 0,   "label": "No refund"}
      ]'::jsonb
    ),
    'cancellation_strict', jsonb_build_object(
      'name',   'Strict Cancellation',
      'preset', 'strict',
      'rules',  '[
        {"days_before": 7, "refund_percent": 50, "label": "50% refund"},
        {"days_before": 0, "refund_percent": 0,  "label": "No refund"}
      ]'::jsonb
    ),
    'cancellation_non_refundable', jsonb_build_object(
      'name',              'Non-Refundable',
      'preset',            'non_refundable',
      'is_non_refundable', true,
      'rules',             '[
        {"days_before": 0, "refund_percent": 0, "label": "No refund"}
      ]'::jsonb
    ),
    'booking_terms_template', jsonb_build_object(
      'name',       'Standard Booking Terms',
      'body_html',  '<h2>Check-In & Check-Out</h2><p>Check-in from 14:00. Check-out by 10:00. Early/late arrangements subject to availability.</p><h2>House Rules</h2><ul><li>No smoking indoors.</li><li>No parties or events.</li><li>Pets by prior arrangement only.</li><li>Please treat the property with respect.</li></ul><h2>Guest Responsibilities</h2><p>Guests are responsible for any damage caused during their stay. Please report any issues immediately.</p>',
      'body_plain', 'Check-in from 14:00. Check-out by 10:00. No smoking. No parties. Pets by arrangement. Guests are responsible for damages.'
    ),
    'privacy_template', jsonb_build_object(
      'name',       'Guest Privacy Notice',
      'body_html',  '<p>By making a booking, you consent to this property storing your name, email, and phone number for the purpose of managing your reservation. Your details will not be shared with third parties and will be deleted within 12 months of your last stay. To request deletion, contact the host directly.</p>',
      'body_plain', 'Your contact details are stored for booking management only, not shared with third parties, and deleted within 12 months of your last stay.'
    )
  ),
  'Default policy templates pre-loaded into new host accounts during onboarding.'
)
ON CONFLICT (key) DO NOTHING;
