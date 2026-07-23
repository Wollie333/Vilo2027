-- Campaign-scoped marketing assets. NULL campaign_id = the default-programme
-- library every affiliate sees; a set campaign_id = assets that belong to that
-- one campaign and show only in its context. Cascade-delete with the campaign.
alter table public.marketing_assets
  add column if not exists campaign_id uuid
    references public.affiliate_campaigns(id) on delete cascade;

create index if not exists marketing_assets_campaign_id_idx
  on public.marketing_assets (campaign_id);

comment on column public.marketing_assets.campaign_id is
  'NULL = default-programme asset (shown to every affiliate). Set = belongs to that campaign only.';
