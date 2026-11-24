-- Allow every authenticated user to edit Job Cards and record every change.

create table if not exists public.job_card_audit_log (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_cards(id) on delete cascade,
  edited_by uuid not null references public.profiles(id),
  edited_at timestamptz not null default now(),
  action text not null,
  changed_fields jsonb not null default '{}'::jsonb,
  old_value jsonb,
  new_value jsonb
);

create index if not exists job_card_audit_job_idx on public.job_card_audit_log (job_id, edited_at desc);

alter table public.job_card_audit_log enable row level security;

drop policy if exists "job card audit authenticated read" on public.job_card_audit_log;
create policy "job card audit authenticated read" on public.job_card_audit_log
for select to authenticated
using (auth.uid() is not null);

drop policy if exists "job cards authenticated update" on public.job_cards;
create policy "job cards authenticated update" on public.job_cards
for update to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "job items authenticated manage" on public.job_items;
create policy "job items authenticated manage" on public.job_items
for all to authenticated
using (auth.uid() is not null and exists (
  select 1 from public.job_cards where id = job_items.job_id
))
with check (auth.uid() is not null and exists (
  select 1 from public.job_cards where id = job_items.job_id
));

drop policy if exists "job parts authenticated manage" on public.job_parts;
create policy "job parts authenticated manage" on public.job_parts
for all to authenticated
using (auth.uid() is not null and exists (
  select 1 from public.job_cards where id = job_parts.job_id
))
with check (auth.uid() is not null and exists (
  select 1 from public.job_cards where id = job_parts.job_id
));

drop policy if exists "job photos authenticated upload" on public.job_photos;
create policy "job photos authenticated upload" on public.job_photos
for insert to authenticated
with check (auth.uid() is not null and exists (
  select 1 from public.job_cards where id = job_photos.job_id
));

drop policy if exists "job photos authenticated delete" on public.job_photos;
create policy "job photos authenticated delete" on public.job_photos
for delete to authenticated
using (auth.uid() is not null);

drop policy if exists "job photo files assigned upload" on storage.objects;
drop policy if exists "job photo files authenticated upload" on storage.objects;
create policy "job photo files authenticated upload" on storage.objects
for insert to authenticated
with check (bucket_id = 'job-photos' and auth.uid() is not null);

drop policy if exists "job photo files own or admin delete" on storage.objects;
drop policy if exists "job photo files authenticated delete" on storage.objects;
create policy "job photo files authenticated delete" on storage.objects
for delete to authenticated
using (bucket_id = 'job-photos' and auth.uid() is not null);

create or replace function public.record_job_card_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  job_uuid uuid;
  editor_uuid uuid;
  old_json jsonb;
  new_json jsonb;
  changed jsonb;
begin
  if tg_table_name = 'job_cards' then
    job_uuid := case when tg_op = 'DELETE' then old.id else new.id end;
  else
    job_uuid := case when tg_op = 'DELETE' then old.job_id else new.job_id end;
  end if;
  editor_uuid := auth.uid();
  if editor_uuid is null then return coalesce(new, old); end if;

  old_json := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  new_json := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  changed := case
    when tg_op = 'INSERT' then jsonb_build_object('created', true)
    when tg_op = 'DELETE' then jsonb_build_object('deleted', true)
    else jsonb_build_object('changed', true)
  end;

  insert into public.job_card_audit_log (job_id, edited_by, action, changed_fields, old_value, new_value)
  values (
    job_uuid,
    editor_uuid,
    case
      when tg_op = 'INSERT' then tg_table_name || '_created'
      when tg_op = 'DELETE' then tg_table_name || '_deleted'
      else tg_table_name || '_updated'
    end,
    changed,
    old_json,
    new_json
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists job_cards_audit on public.job_cards;
create trigger job_cards_audit
after insert or update or delete on public.job_cards
for each row execute procedure public.record_job_card_audit();

drop trigger if exists job_items_audit on public.job_items;
create trigger job_items_audit
after insert or update or delete on public.job_items
for each row execute procedure public.record_job_card_audit();

drop trigger if exists job_parts_audit on public.job_parts;
create trigger job_parts_audit
after insert or update or delete on public.job_parts
for each row execute procedure public.record_job_card_audit();

drop trigger if exists job_photos_audit on public.job_photos;
create trigger job_photos_audit
after insert or update or delete on public.job_photos
for each row execute procedure public.record_job_card_audit();
