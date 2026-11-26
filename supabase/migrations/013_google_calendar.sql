-- Google Calendar integration for appointments.
-- OAuth credentials are kept in a server-only table and are never exposed through the Data API.

alter table public.appointments
  add column if not exists customer_phone text not null default '',
  add column if not exists appointment_time time not null default '09:00:00',
  add column if not exists duration_minutes smallint not null default 60,
  add column if not exists google_event_id text,
  add column if not exists google_sync_status text not null default 'not_synced',
  add column if not exists google_sync_error text,
  add column if not exists google_synced_at timestamptz;

alter table public.appointments
  drop constraint if exists appointments_duration_minutes_check;

alter table public.appointments
  add constraint appointments_duration_minutes_check
  check (duration_minutes between 15 and 1440);

alter table public.appointments
  drop constraint if exists appointments_google_sync_status_check;

alter table public.appointments
  add constraint appointments_google_sync_status_check
  check (google_sync_status in ('not_synced', 'synced', 'error'));

create unique index if not exists appointments_google_event_uidx
on public.appointments (google_event_id)
where google_event_id is not null;

create table if not exists public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  connected_by uuid not null references public.profiles(id) on delete restrict,
  calendar_id text not null default 'primary',
  calendar_name text,
  google_account_email text,
  refresh_token_encrypted text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists google_calendar_connections_connected_by_uidx
on public.google_calendar_connections (connected_by);

create table if not exists public.google_calendar_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists google_calendar_oauth_states_expiry_idx
on public.google_calendar_oauth_states (expires_at);

alter table public.google_calendar_connections enable row level security;
alter table public.google_calendar_oauth_states enable row level security;

revoke all on table public.google_calendar_connections from anon, authenticated;
revoke all on table public.google_calendar_oauth_states from anon, authenticated;

create or replace function public.touch_google_calendar_connection_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists google_calendar_connections_updated on public.google_calendar_connections;
create trigger google_calendar_connections_updated
before update on public.google_calendar_connections
for each row execute function public.touch_google_calendar_connection_updated_at();

revoke all on function public.touch_google_calendar_connection_updated_at() from public, anon, authenticated;
