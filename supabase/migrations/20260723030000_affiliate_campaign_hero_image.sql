-- Campaign hero image. The admin assigns an image from the Wielo media library
-- (marketing-assets bucket); it renders as the background of the public
-- competition leaderboard hero. NULL = the plain dark hero.
alter table public.affiliate_campaigns
  add column if not exists hero_image_url text;

comment on column public.affiliate_campaigns.hero_image_url is
  'Public leaderboard hero background — a URL assigned from the Wielo media library. NULL = plain dark hero.';
