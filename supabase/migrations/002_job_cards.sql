-- Zordaq Motorsports JB · Job Cards
-- Semua tarikh/waktu dipaparkan sebagai Asia/Kuala_Lumpur di app.

create or replace function public.normalize_plate_no(value text)
returns text
language sql
immutable
as $$
  select regexp_replace(upper(coalesce(value, '')), '[^A-Z0-9]', '', 'g');
$$;

create table public.vehicles (
  plate_no text primary key,
  car_model text not null default '',
  created_at timestamptz not null default now(),
  constraint vehicles_plate_not_empty check (length(public.normalize_plate_no(plate_no)) > 0)
);

create or replace function public.normalise_vehicle_plate()
returns trigger
language plpgsql
as $$
begin
  new.plate_no = public.normalize_plate_no(new.plate_no);
  if new.plate_no = '' then raise exception 'Nombor pendaftaran diperlukan.'; end if;
  return new;
end;
$$;

create trigger vehicles_normalise_plate
before insert or update of plate_no on public.vehicles
for each row execute procedure public.normalise_vehicle_plate();

create table public.job_cards (
  id uuid primary key default gen_random_uuid(),
  plate_no text not null references public.vehicles(plate_no) on update cascade on delete restrict,
  customer_complaint text not null check (length(trim(customer_complaint)) > 0),
  check_in_date date not null default ((now() at time zone 'Asia/Kuala_Lumpur')::date),
  status text not null default 'Baru' check (status in ('Baru', 'Diagnos', 'Tunggu Parts', 'Sedang Repair', 'Siap')),
  notes text,
  assigned_staff uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index job_cards_plate_check_in_idx on public.job_cards (plate_no, check_in_date desc);
create index job_cards_status_idx on public.job_cards (status);
create index job_cards_assigned_staff_idx on public.job_cards (assigned_staff);

create or replace function public.normalise_job_card_plate()
returns trigger
language plpgsql
as $$
begin
  new.plate_no = public.normalize_plate_no(new.plate_no);
  if new.plate_no = '' then raise exception 'Nombor pendaftaran diperlukan.'; end if;
  return new;
end;
$$;

create trigger job_cards_normalise_plate
before insert or update of plate_no on public.job_cards
for each row execute procedure public.normalise_job_card_plate();

create table public.job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_cards(id) on delete cascade,
  description text not null check (length(trim(description)) > 0),
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

create index job_items_job_idx on public.job_items (job_id);

create table public.job_parts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_cards(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  qty integer not null default 1 check (qty > 0),
  created_at timestamptz not null default now()
);

create index job_parts_job_idx on public.job_parts (job_id);

create table public.job_status_history (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_cards(id) on delete cascade,
  old_status text,
  new_status text not null check (new_status in ('Baru', 'Diagnos', 'Tunggu Parts', 'Sedang Repair', 'Siap')),
  changed_by uuid not null references public.profiles(id) on delete restrict,
  changed_at timestamptz not null default now()
);

create index job_status_history_job_idx on public.job_status_history (job_id, changed_at desc);

create or replace function public.record_job_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.job_status_history (job_id, old_status, new_status, changed_by)
    values (new.id, null, new.status, coalesce(auth.uid(), new.created_by));
  elsif old.status is distinct from new.status then
    insert into public.job_status_history (job_id, old_status, new_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger job_cards_status_history
after insert or update of status on public.job_cards
for each row execute procedure public.record_job_status_change();

create or replace function public.prevent_staff_job_card_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and (
    new.plate_no is distinct from old.plate_no or
    new.customer_complaint is distinct from old.customer_complaint or
    new.check_in_date is distinct from old.check_in_date or
    new.assigned_staff is distinct from old.assigned_staff or
    new.created_by is distinct from old.created_by or
    new.created_at is distinct from old.created_at
  ) then
    raise exception 'Staff hanya boleh ubah status dan nota job yang ditugaskan.';
  end if;
  return new;
end;
$$;

create trigger job_cards_staff_fields
before update on public.job_cards
for each row execute procedure public.prevent_staff_job_card_edit();

create table public.job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_cards(id) on delete cascade,
  file_path text not null unique,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  uploaded_at timestamptz not null default now(),
  caption text
);

create index job_photos_job_idx on public.job_photos (job_id, uploaded_at desc);

alter table public.vehicles enable row level security;
alter table public.job_cards enable row level security;
alter table public.job_items enable row level security;
alter table public.job_parts enable row level security;
alter table public.job_status_history enable row level security;
alter table public.job_photos enable row level security;

create policy "vehicles authenticated read" on public.vehicles for select to authenticated
using (auth.uid() is not null);
create policy "vehicles admin manage" on public.vehicles for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "job cards authenticated read" on public.job_cards for select to authenticated
using (auth.uid() is not null);
create policy "job cards admin manage" on public.job_cards for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "job cards assigned staff update" on public.job_cards for update to authenticated
using (assigned_staff = auth.uid()) with check (assigned_staff = auth.uid());

create policy "job items authenticated read" on public.job_items for select to authenticated
using (auth.uid() is not null);
create policy "job items admin manage" on public.job_items for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "job items assigned staff manage" on public.job_items for all to authenticated
using (exists (select 1 from public.job_cards where id = job_items.job_id and assigned_staff = auth.uid()))
with check (exists (select 1 from public.job_cards where id = job_items.job_id and assigned_staff = auth.uid()));

create policy "job parts authenticated read" on public.job_parts for select to authenticated
using (auth.uid() is not null);
create policy "job parts admin manage" on public.job_parts for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "job history authenticated read" on public.job_status_history for select to authenticated
using (auth.uid() is not null);

create policy "job photos authenticated read" on public.job_photos for select to authenticated
using (auth.uid() is not null);
create policy "job photos assigned upload" on public.job_photos for insert to authenticated
with check (public.is_admin() or exists (select 1 from public.job_cards where id = job_photos.job_id and assigned_staff = auth.uid()));
create policy "job photos own or admin delete" on public.job_photos for delete to authenticated
using (public.is_admin() or uploaded_by = auth.uid());

insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', false)
on conflict (id) do nothing;

create policy "job photo files authenticated read" on storage.objects for select to authenticated
using (bucket_id = 'job-photos' and auth.uid() is not null);
create policy "job photo files assigned upload" on storage.objects for insert to authenticated
with check (
  bucket_id = 'job-photos' and
  (public.is_admin() or exists (
    select 1 from public.job_cards
    where id = split_part(name, '/', 1)::uuid and assigned_staff = auth.uid()
  ))
);
create policy "job photo files own or admin delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'job-photos' and
  (public.is_admin() or exists (
    select 1 from public.job_photos
    where file_path = storage.objects.name and uploaded_by = auth.uid()
  ))
);
