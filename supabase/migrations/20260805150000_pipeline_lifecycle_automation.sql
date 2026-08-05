-- Pipeline lifecycle automation — make host cards move on EVERY real lifecycle
-- transition, not just forward ones.
--
-- Before: cards climbed (host created → Signed up, trialing → Trial, paid → Won)
-- but nothing reacted to churn. A lapsed trial sat in Trial forever; a cancelled
-- customer stayed in Won.
--
-- After:
--   • trial lapses (no upgrade)      → Lost
--   • paying customer cancels/expires → Churned  (new terminal column)
--   • past_due / paused / dunning     → card flagged at_risk (no stage move)
--   • recovers (active/trialing)      → at_risk cleared; a lost/churned card is
--                                       reopened to Trial on a fresh trial
--   • host created already on a trial → lands in Trial (not Signed up)
--
-- Trial + Won + Churned are SYSTEM-MANAGED — the sales team can't drop a card
-- into them by hand; the human-judgment middle stages stay fully manual.

-- ── 1. status gains 'churned' ───────────────────────────────────────────────
do $$
declare c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.pipeline_leads'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%';
  if c is not null then
    execute format('alter table public.pipeline_leads drop constraint %I', c);
  end if;
end $$;

alter table public.pipeline_leads
  add constraint pipeline_leads_status_check
  check (status = any (array['open', 'won', 'lost', 'churned']));

-- ── 2. at_risk flag on the card (dunning / payment trouble) ─────────────────
alter table public.pipeline_leads
  add column if not exists at_risk boolean not null default false;

-- ── 3. system_managed stages (can't be set by a manual drag) ────────────────
alter table public.pipeline_stages
  add column if not exists system_managed boolean not null default false;

-- ── 4. new terminal "Churned" stage for hosts (paid then left) ──────────────
-- Distinct from Lost (never converted) so win-back reporting stays clean.
update public.pipeline_stages set sort_order = 9
  where audience = 'host' and key = 'lost';

insert into public.pipeline_stages
  (audience, key, label, sort_order, is_won, is_lost, is_customer, system_managed)
values
  ('host', 'churned', 'Churned', 8, false, false, false, true)
on conflict (audience, key) do nothing;

-- Trial + Won are system-managed too (they were is_customer-locked already).
update public.pipeline_stages
  set system_managed = true
  where (audience = 'host' and key in ('trial', 'won', 'churned'))
     or (audience = 'affiliate' and key = 'won');

-- ── 5. Helper: has this user ever actually PAID? ────────────────────────────
-- A completed positive charge means they were a real customer → churn (not a
-- never-converted trial → lost).
create or replace function public.pipeline_user_has_paid(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.platform_ledger
    where user_id = p_user_id
      and type = 'charge'
      and status = 'completed'
      and coalesce(amount, 0) > 0
  );
$$;

-- ── 6. Enrich on_host_created: land on Trial if a trial is already active ────
create or replace function public.on_host_created()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_signed_stage uuid;
  v_signed_sort  int;
  v_trial_stage  uuid;
  v_target_stage uuid;
  v_target_sort  int;
  v_on_trial     boolean;
  v_lead_id      uuid;
  v_slug         text;
  v_camp_id      uuid;
  v_camp_name    text;
  v_source_kind  text;
  v_source_label text;
  v_suppress     boolean := false;
begin
  if NEW.user_id is null then
    return NEW;
  end if;

  select id, sort_order into v_signed_stage, v_signed_sort
  from public.pipeline_stages
  where audience = 'host' and key = 'signed_up';
  if v_signed_stage is null then
    return NEW;
  end if;

  -- Does this brand-new host already hold an active trial? If so, the pipeline
  -- should reflect where they REALLY are — Trial, not Signed up.
  select exists (
    select 1 from public.subscriptions
    where host_id = NEW.id and status = 'trialing'
  ) into v_on_trial;

  if v_on_trial then
    select id into v_trial_stage
    from public.pipeline_stages where audience = 'host' and key = 'trial';
  end if;
  v_target_stage := coalesce(v_trial_stage, v_signed_stage);

  -- (a) Advance an OPEN card sitting before the target stage.
  select sort_order into v_target_sort
  from public.pipeline_stages where id = v_target_stage;

  update public.pipeline_leads as pl
     set stage_id = v_target_stage, last_activity_at = now()
    from public.pipeline_stages as ps
   where pl.user_id = NEW.user_id
     and pl.audience = 'host'
     and pl.status = 'open'
     and pl.stage_id = ps.id
     and ps.sort_order < v_target_sort
  returning pl.id into v_lead_id;

  if v_lead_id is not null then
    insert into public.pipeline_activities (lead_id, staff_id, kind, body, meta)
    values (v_lead_id, null, 'stage_moved',
            case when v_on_trial then 'Completed host signup on a trial — moved to Trial.'
                 else 'Completed host signup — moved to Signed up.' end,
            jsonb_build_object('stage_id', v_target_stage, 'host_id', NEW.id, 'system', true));
    return NEW;
  end if;

  -- (b) Card already at/after the target → leave it.
  if exists (
    select 1 from public.pipeline_leads
    where user_id = NEW.user_id and audience = 'host'
  ) then
    return NEW;
  end if;

  -- (c) No card → host made outside the start flow. Create one, recording source.
  select aa.slug, ar.campaign_id, ac.name
    into v_slug, v_camp_id, v_camp_name
  from public.affiliate_referrals ar
  left join public.affiliate_accounts  aa on aa.id = ar.affiliate_id
  left join public.affiliate_campaigns ac on ac.id = ar.campaign_id
  where ar.referred_user_id = NEW.user_id;

  if v_camp_id is not null then
    v_source_kind  := 'competition';
    v_source_label := coalesce(v_camp_name, 'Competition');
    v_suppress     := true;
  elsif v_slug is not null then
    v_source_kind  := 'affiliate_referral';
    v_source_label := v_slug;
  else
    v_source_kind  := 'direct';
    v_source_label := null;
  end if;

  insert into public.pipeline_leads
    (user_id, audience, stage_id, source_kind, source_label, affiliate_ref,
     suppress_default_nurture, last_activity_at)
  values
    (NEW.user_id, 'host', v_target_stage, v_source_kind, v_source_label, v_slug,
     v_suppress, now())
  on conflict (user_id, audience) do nothing
  returning id into v_lead_id;

  if v_lead_id is not null then
    insert into public.pipeline_activities (lead_id, staff_id, kind, body, meta)
    values (v_lead_id, null, 'created',
            case when v_on_trial then 'Became a host on a trial — added to the pipeline at Trial.'
                 else 'Became a host — added to the pipeline.' end,
            jsonb_build_object('stage_id', v_target_stage, 'host_id', NEW.id,
                               'source_kind', v_source_kind, 'system', true));
  end if;

  return NEW;
end;
$function$;

-- ── 7. on_subscription_trialing: also REOPEN a lost/churned card ────────────
create or replace function public.on_subscription_trialing()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id  uuid;
  v_stage_id uuid;
  v_lead_id  uuid;
begin
  if NEW.status is distinct from 'trialing' then
    return NEW;
  end if;
  if TG_OP = 'UPDATE' and OLD.status = 'trialing' then
    return NEW;
  end if;

  select user_id into v_user_id from public.hosts where id = NEW.host_id;
  if v_user_id is null then
    return NEW;
  end if;

  select id into v_stage_id
  from public.pipeline_stages where audience = 'host' and key = 'trial';

  if v_stage_id is not null then
    -- Move ANY non-won card into Trial — including reopening a lost/churned
    -- one (win-back) — and set it back to open (Trial is an open, live stage).
    update public.pipeline_leads
       set stage_id = v_stage_id, status = 'open',
           at_risk = false, last_activity_at = now()
     where user_id = v_user_id
       and audience = 'host'
       and status <> 'won'
       and (stage_id <> v_stage_id or status <> 'open')
    returning id into v_lead_id;

    if v_lead_id is not null then
      insert into public.pipeline_activities (lead_id, staff_id, kind, body, meta)
      values (v_lead_id, null, 'stage_moved', 'Started a trial — moved to Trial.',
              jsonb_build_object('stage_id', v_stage_id, 'subscription_id', NEW.id, 'system', true));
    end if;
  end if;

  insert into public.meta_conversion_events
    (event_name, user_id, lead_id, event_id, source_ref, action_source)
  values
    ('StartTrial', v_user_id, v_lead_id,
     'sub:' || NEW.id || ':StartTrial', 'sub:' || NEW.id, 'system_generated')
  on conflict (event_id) do nothing;

  return NEW;
end;
$function$;

-- ── 8. NEW: on_subscription_churned — the downward transitions ──────────────
create or replace function public.on_subscription_churned()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id     uuid;
  v_paid        boolean;
  v_other_live  boolean;
  v_stage_id    uuid;
  v_stage_key   text;
  v_lead_id     uuid;
  v_body        text;
begin
  -- Nothing to do unless status actually changed.
  if TG_OP = 'UPDATE' and NEW.status is not distinct from OLD.status then
    return NEW;
  end if;

  select user_id into v_user_id from public.hosts where id = NEW.host_id;
  if v_user_id is null then
    return NEW;  -- guest / non-host subscription
  end if;

  -- ── Recovery: back on an active/trialing plan → clear the at-risk flag.
  --    (A fresh trial's stage move is handled by on_subscription_trialing.)
  if NEW.status in ('active', 'trialing') then
    update public.pipeline_leads
       set at_risk = false, last_activity_at = now()
     where user_id = v_user_id and audience = 'host' and at_risk = true;
    return NEW;
  end if;

  -- ── At-risk (still a customer, but payment is faltering): flag, don't move.
  if NEW.status in ('past_due', 'paused') then
    update public.pipeline_leads
       set at_risk = true, last_activity_at = now()
     where user_id = v_user_id and audience = 'host'
       and status in ('won', 'open') and at_risk = false;
    return NEW;
  end if;

  -- ── Terminal-ish states: cancelled / expired / restricted.
  if NEW.status not in ('cancelled', 'expired', 'restricted') then
    return NEW;
  end if;

  -- Still a customer via ANOTHER live subscription? Then don't churn the card.
  select exists (
    select 1 from public.subscriptions
    where host_id in (select id from public.hosts where user_id = v_user_id)
      and id <> NEW.id
      and status in ('active', 'trialing')
  ) into v_other_live;
  if v_other_live then
    return NEW;
  end if;

  v_paid := public.pipeline_user_has_paid(v_user_id);

  -- restricted + never paid = a lapsed trial (Lost). restricted + paid =
  -- dunning/overdue, not a hard end yet → flag at-risk and wait for cancel/expire.
  if NEW.status = 'restricted' and v_paid then
    update public.pipeline_leads
       set at_risk = true, last_activity_at = now()
     where user_id = v_user_id and audience = 'host'
       and status in ('won', 'open') and at_risk = false;
    return NEW;
  end if;

  -- Paid customer who cancelled/expired → Churned. Never paid → Lost.
  v_stage_key := case when v_paid then 'churned' else 'lost' end;
  select id into v_stage_id
  from public.pipeline_stages where audience = 'host' and key = v_stage_key;
  if v_stage_id is null then
    return NEW;
  end if;

  v_body := case
    when v_paid then 'Subscription ended — customer churned. Moved to Churned.'
    else 'Trial ended without upgrading. Moved to Lost.'
  end;

  -- Only move a card that isn't already sitting in a terminal end state.
  update public.pipeline_leads
     set stage_id = v_stage_id,
         status = case when v_paid then 'churned' else 'lost' end,
         at_risk = false,
         last_activity_at = now()
   where user_id = v_user_id and audience = 'host'
     and status not in ('churned', 'lost')
  returning id into v_lead_id;

  if v_lead_id is not null then
    insert into public.pipeline_activities (lead_id, staff_id, kind, body, meta)
    values (v_lead_id, null, 'stage_moved', v_body,
            jsonb_build_object('stage_id', v_stage_id, 'subscription_id', NEW.id,
                               'from_status', case when TG_OP = 'UPDATE' then OLD.status else null end,
                               'to_status', NEW.status, 'paid', v_paid, 'system', true));
  end if;

  return NEW;
end;
$function$;

drop trigger if exists trg_subscription_churned on public.subscriptions;
create trigger trg_subscription_churned
  after update of status on public.subscriptions
  for each row execute function public.on_subscription_churned();
