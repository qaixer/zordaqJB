-- Zordaq Motorsports JB · Supabase migration
-- Semua timestamp disimpan UTC (timestamptz) dan dipaparkan sebagai Asia/Kuala_Lumpur di app.

create extension if not exists pgcrypto;

create type public.user_role as enum ('staff', 'admin');
create type public.attendance_type as enum ('in', 'out');
create type public.leave_type as enum ('MC', 'EL');
create type public.leave_status as enum ('Pending', 'Approved', 'Rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  nickname text not null,
  role public.user_role not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.settings (
  id integer primary key default 1 check (id = 1),
  workshop_lat double precision not null,
  workshop_lng double precision not null,
  radius_m integer not null default 100 check (radius_m > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete cascade,
  type public.attendance_type not null,
  timestamp timestamptz not null default now(),
  lat double precision not null,
  lng double precision not null,
  distance_m integer not null check (distance_m >= 0),
  edited_by_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create index attendance_staff_timestamp_idx on public.attendance (staff_id, timestamp desc);

create or replace function public.prevent_duplicate_attendance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare last_type public.attendance_type;
begin
  if public.is_admin() then return new; end if;
  select type into last_type from public.attendance
  where staff_id = new.staff_id order by timestamp desc limit 1;
  if new.type = 'in' and last_type = 'in' then
    raise exception 'Staff masih clock in. Sila clock out dahulu.';
  end if;
  if new.type = 'out' and last_type is distinct from 'in'::public.attendance_type then
    raise exception 'Staff belum clock in.';
  end if;
  return new;
end;
$$;

create trigger attendance_sequence_check before insert on public.attendance
for each row execute procedure public.prevent_duplicate_attendance();

create table public.attendance_audit_log (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid,
  edited_by uuid not null references public.profiles(id),
  edited_at timestamptz not null default now(),
  old_value jsonb,
  new_value jsonb,
  reason text not null check (length(trim(reason)) > 0)
);

create table public.leave_balances (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete cascade,
  year integer not null,
  type public.leave_type not null,
  limit_days integer not null default 0 check (limit_days >= 0),
  unique (staff_id, year, type)
);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete cascade,
  type public.leave_type not null,
  start_date date not null,
  end_date date not null,
  reason text not null,
  attachment_path text,
  status public.leave_status not null default 'Pending',
  admin_remark text,
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint leave_dates_valid check (end_date >= start_date)
);

create index leave_requests_staff_date_idx on public.leave_requests (staff_id, start_date desc);

insert into public.settings (id, workshop_lat, workshop_lng, radius_m)
values (1, 1.4927, 103.7414, 100)
on conflict (id) do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, nickname)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create or replace function public.touch_settings_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); new.updated_by = auth.uid(); return new; end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

drop trigger if exists settings_updated on public.settings;
create trigger settings_updated before update on public.settings
for each row execute procedure public.touch_settings_updated_at();

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.attendance enable row level security;
alter table public.attendance_audit_log enable row level security;
alter table public.leave_balances enable row level security;
alter table public.leave_requests enable row level security;

create policy "profiles own read or admin" on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());
create policy "profiles admin update" on public.profiles for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "settings read authenticated" on public.settings for select to authenticated
using (auth.uid() is not null);
create policy "settings admin manage" on public.settings for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "attendance own read or admin" on public.attendance for select to authenticated
using (staff_id = auth.uid() or public.is_admin());
create policy "attendance own insert" on public.attendance for insert to authenticated
with check (staff_id = auth.uid() and not public.is_admin());
create policy "attendance admin manage" on public.attendance for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "audit admin read" on public.attendance_audit_log for select to authenticated
using (public.is_admin());
create policy "audit admin insert" on public.attendance_audit_log for insert to authenticated
with check (public.is_admin() and edited_by = auth.uid());

create policy "balances own read or admin" on public.leave_balances for select to authenticated
using (staff_id = auth.uid() or public.is_admin());
create policy "balances admin manage" on public.leave_balances for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "leave own read or admin" on public.leave_requests for select to authenticated
using (staff_id = auth.uid() or public.is_admin());
create policy "leave own create" on public.leave_requests for insert to authenticated
with check (staff_id = auth.uid() and status = 'Pending');
create policy "leave own cancel pending" on public.leave_requests for update to authenticated
using (staff_id = auth.uid() and status = 'Pending')
with check (staff_id = auth.uid() and status = 'Pending');
create policy "leave admin manage" on public.leave_requests for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Jalankan sekali selepas migration untuk jadikan user pertama sebagai admin:
-- update public.profiles set role = 'admin' where email = 'paan@zordaq.my';

insert into storage.buckets (id, name, public)
values ('leave-attachments', 'leave-attachments', false)
on conflict (id) do nothing;

create policy "leave files own read" on storage.objects for select to authenticated
using (bucket_id = 'leave-attachments' and (owner_id = auth.uid()::text or public.is_admin()));
create policy "leave files own upload" on storage.objects for insert to authenticated
with check (bucket_id = 'leave-attachments' and (name like auth.uid()::text || '/%' or public.is_admin()));
create policy "leave files admin delete" on storage.objects for delete to authenticated
using (bucket_id = 'leave-attachments' and public.is_admin());
