-- Zordaq Motorsports JB · Appointments
-- Semua user yang login boleh tambah/edit appointment; admin sahaja boleh delete.

create type public.appointment_status as enum (
  'Pending Review',
  'Confirmed',
  'Completed',
  'Cancelled'
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  appointment_date date not null,
  customer_name text not null check (length(trim(customer_name)) > 0),
  plate_no text not null check (length(trim(plate_no)) > 0),
  car_model text not null default '',
  job_description text not null check (length(trim(job_description)) > 0),
  status public.appointment_status not null default 'Pending Review',
  source text not null default 'manual' check (source in ('manual', 'telegram')),
  source_message_id text,
  raw_message text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointments_date_idx on public.appointments (appointment_date, status);
create index appointments_plate_idx on public.appointments (plate_no, appointment_date desc);

create or replace function public.touch_appointment_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists appointments_updated on public.appointments;
create trigger appointments_updated
before update on public.appointments
for each row execute function public.touch_appointment_updated_at();

alter table public.appointments enable row level security;

create policy "appointments authenticated read"
on public.appointments for select to authenticated
using (auth.uid() is not null);

create policy "appointments authenticated create"
on public.appointments for insert to authenticated
with check (created_by = auth.uid());

create policy "appointments authenticated update"
on public.appointments for update to authenticated
using (auth.uid() is not null)
with check (updated_by = auth.uid());

create policy "appointments admin delete"
on public.appointments for delete to authenticated
using (public.is_admin());

revoke all on function public.touch_appointment_updated_at() from public, anon, authenticated;
