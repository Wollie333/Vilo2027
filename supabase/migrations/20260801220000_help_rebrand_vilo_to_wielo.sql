-- Rebrand seeded help content: "Vilo" -> "Wielo".
--
-- The ~58 help-article seed migrations (20260601–20260607) and the base seed
-- (20260525000010) were authored in the platform's old "Vilo" brand voice
-- ("Vilo takes no cut", "When does Vilo pay me out?"). The live brand is Wielo,
-- so any DB rebuilt from those migrations would publish "Vilo" all over the
-- public help centre. This runs after them and corrects the brand in place.
--
-- Idempotent: case-sensitive replace of the exact token 'Vilo' — running twice
-- (or on an already-clean DB) matches nothing. Won't touch 'VILLA', lowercase
-- 'vilo' in URLs, etc.

UPDATE help_articles SET
  title     = replace(title, 'Vilo', 'Wielo'),
  excerpt   = replace(excerpt, 'Vilo', 'Wielo'),
  body_html = replace(body_html, 'Vilo', 'Wielo')
WHERE title LIKE '%Vilo%' OR excerpt LIKE '%Vilo%' OR body_html LIKE '%Vilo%';

UPDATE help_faqs SET
  question    = replace(question, 'Vilo', 'Wielo'),
  answer_html = replace(answer_html, 'Vilo', 'Wielo')
WHERE question LIKE '%Vilo%' OR answer_html LIKE '%Vilo%';

UPDATE help_videos SET
  title       = replace(title, 'Vilo', 'Wielo'),
  description = replace(description, 'Vilo', 'Wielo')
WHERE title LIKE '%Vilo%' OR description LIKE '%Vilo%';

UPDATE help_categories SET
  name        = replace(name, 'Vilo', 'Wielo'),
  description = replace(description, 'Vilo', 'Wielo')
WHERE name LIKE '%Vilo%' OR description LIKE '%Vilo%';
