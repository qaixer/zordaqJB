-- Telegram appointment ingestion support.
-- Telegram messages do not have an authenticated profiles.id creator.

alter table public.appointments
  alter column created_by drop not null;

alter table public.appointments
  add column if not exists source_chat_id text,
  add column if not exists source_update_id bigint;

create unique index if not exists appointments_telegram_message_uidx
on public.appointments (source, source_chat_id, source_message_id)
where source = 'telegram' and source_chat_id is not null and source_message_id is not null;

create table if not exists public.telegram_appointment_staging (
  id uuid primary key default gen_random_uuid(),
  chat_id text not null,
  sender_id text not null default '',
  contact_name text not null,
  received_at timestamptz not null default now(),
  unique (chat_id, sender_id)
);

create index if not exists telegram_appointment_staging_received_idx
on public.telegram_appointment_staging (received_at);

alter table public.telegram_appointment_staging enable row level security;

revoke all on table public.telegram_appointment_staging from anon, authenticated;
