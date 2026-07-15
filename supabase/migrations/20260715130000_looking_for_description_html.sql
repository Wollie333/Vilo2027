-- =============================================================================
-- Looking-For — rich-text (WYSIWYG) request details
-- =============================================================================
-- The guest "details" field becomes rich HTML (Tiptap editor). Markup inflates
-- the length, so relax the 2000-char cap. Content is sanitised on write
-- (sanitiseListingHtml — allowlisted tag set only), so no script/style/unsafe
-- attributes are ever stored; the cap is just a size guard.
-- -----------------------------------------------------------------------------

ALTER TABLE looking_for_posts
  DROP CONSTRAINT IF EXISTS looking_for_posts_description_check;

ALTER TABLE looking_for_posts
  ADD CONSTRAINT looking_for_posts_description_check
  CHECK (description IS NULL OR char_length(description) <= 20000);
