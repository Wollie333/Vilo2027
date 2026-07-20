-- Phase C (theme differentiation): give the Safari theme its OWN display face.
--
-- Founder flagged Safari + Sabela ("hotel") "feel like the same theme." A live
-- side-by-side audit found the root cause: both theme bases used the `elegant`
-- font role, so both warm-earth lodges rendered their display headings in the
-- IDENTICAL Cormorant Garamond serif — the strongest shared-DNA signal.
--
-- The `site_themes.base` JSON is the SSOT the public render reads: buildSiteVars
-- resolves the font as `type.headingFont ?? theme.font ?? theme.base.font`, so the
-- catalog `base.font` wins over the code preset (SITE_PRESETS is only a fallback
-- when the row is missing). Switching the code preset alone therefore does NOT
-- change the rendered font — this row is what matters.
--
-- Switch Safari's catalog base to the new `fraunces` role (Fraunces — a warm,
-- characterful editorial soft-serif, wired in code: FONT_STACKS + SiteFontLinks +
-- the builder font enums). Sabela ("hotel") deliberately KEEPS `elegant`
-- (Cormorant), so the two lodges no longer share a display typeface.
--
-- Only the `font` key is rewritten; palette/radius/label and all other base fields
-- are preserved. Idempotent (safe to re-run). Existing host sites that already
-- applied Safari keep their copied font until the theme is re-applied (pre-MVP:
-- no real users, so acceptable; a re-pick in Brand Studio refreshes it).
update public.site_themes
set base = jsonb_set(base, '{font}', '"fraunces"'::jsonb, true)
where slug = 'safari'
  and deleted_at is null;
