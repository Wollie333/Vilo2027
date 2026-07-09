-- Admin transactional notifications ("Latest actions") — a staff-facing feed of
-- FINANCE + SUPPORT events so an admin never misses a payment being initiated, a
-- pending EFT to settle, or a support / cancellation request. Populated by the
-- app (service role) at the moment each event happens; read by platform staff.
create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('finance', 'support')),
  -- Machine kind, e.g. eft_pending | payment_initiated | payment_received |
  -- support_request | cancellation_request | subscription_paused.
  kind text not null,
  title text not null,
  body text,
  -- Who / what it's about (any may be null).
  user_id uuid references public.user_profiles(id) on delete set null,
  host_id uuid references public.hosts(id) on delete set null,
  ledger_id uuid,
  order_id uuid,
  -- Deep link for the admin to jump to (e.g. /admin/users/<id>?tab=finance).
  href text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_notifs_recent
  on public.admin_notifications (created_at desc);
create index if not exists idx_admin_notifs_unread
  on public.admin_notifications (created_at desc)
  where is_read = false;

alter table public.admin_notifications enable row level security;

-- Active platform staff may READ the feed and mark items read. All writes go
-- through the app (service role), which bypasses RLS.
drop policy if exists admin_notifs_staff_read on public.admin_notifications;
create policy admin_notifs_staff_read
  on public.admin_notifications for select
  using (
    exists (
      select 1 from public.platform_staff ps
      where ps.user_id = auth.uid() and ps.is_active
    )
  );

drop policy if exists admin_notifs_staff_update on public.admin_notifications;
create policy admin_notifs_staff_update
  on public.admin_notifications for update
  using (
    exists (
      select 1 from public.platform_staff ps
      where ps.user_id = auth.uid() and ps.is_active
    )
  );
