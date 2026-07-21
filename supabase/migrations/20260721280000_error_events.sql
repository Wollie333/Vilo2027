-- Runtime error capture.
--
-- There was no error monitoring of any kind: no Sentry, no error boundary, no
-- log sink. A crash in production showed Next's default error page and was
-- recorded nowhere, so the only way to learn that something broke was for a
-- host or guest to complain — and most people don't complain, they leave.
--
-- Deliberately self-hosted rather than a third-party service: it works the
-- moment this migration lands, costs nothing, needs no signup or DSN, and keeps
-- error text (which routinely contains customer data) inside our own database.
-- A hosted service can be layered on later; NEXT_PUBLIC_SENTRY_DSN is already
-- carried through the build for that.
create table if not exists public.error_events (
  id uuid primary key default gen_random_uuid(),
  -- "server" | "client" | "worker"
  source text not null default 'server',
  -- Short stable grouping key so repeats collapse instead of flooding the list.
  fingerprint text not null,
  message text not null,
  stack text,
  url text,
  user_id uuid references auth.users(id) on delete set null,
  context jsonb not null default '{}'::jsonb,
  -- Repeat count for this fingerprint, incremented rather than inserting again.
  occurrences integer not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  resolved_at timestamptz
);

-- The list view: unresolved, most recently seen first.
create index if not exists error_events_open_idx
  on public.error_events (last_seen desc)
  where resolved_at is null;

-- One row per distinct problem; repeats bump occurrences.
create unique index if not exists error_events_fingerprint_idx
  on public.error_events (fingerprint);

alter table public.error_events enable row level security;
-- No policies: written by the server (service role) and read by the admin panel
-- through the same. Error text can quote customer data, so it must never be
-- readable by an ordinary signed-in user.

comment on table public.error_events is
  'Runtime errors captured from server, client and workers. Grouped by fingerprint; repeats increment occurrences rather than inserting. Service-role only.';

-- Record an error, collapsing repeats. SECURITY DEFINER so the ingest path can
-- call it without handing out table rights.
create or replace function public.record_error_event(
  p_source text,
  p_fingerprint text,
  p_message text,
  p_stack text default null,
  p_url text default null,
  p_user_id uuid default null,
  p_context jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
BEGIN
  INSERT INTO error_events (source, fingerprint, message, stack, url, user_id, context)
  VALUES (
    COALESCE(NULLIF(p_source, ''), 'server'),
    left(p_fingerprint, 200),
    left(p_message, 2000),
    left(p_stack, 8000),
    left(p_url, 500),
    p_user_id,
    COALESCE(p_context, '{}'::jsonb)
  )
  ON CONFLICT (fingerprint) DO UPDATE SET
    occurrences = error_events.occurrences + 1,
    last_seen   = now(),
    -- A recurrence reopens a problem that was marked resolved.
    resolved_at = NULL,
    message     = EXCLUDED.message,
    stack       = COALESCE(EXCLUDED.stack, error_events.stack),
    url         = COALESCE(EXCLUDED.url, error_events.url);
END;
$fn$;

-- CREATE FUNCTION grants EXECUTE to PUBLIC; revoke and grant back deliberately.
revoke execute on function public.record_error_event(text, text, text, text, text, uuid, jsonb) from public;
grant execute on function public.record_error_event(text, text, text, text, text, uuid, jsonb) to service_role;
