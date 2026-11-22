-- Mark completed vehicle handovers without showing them in the active job list.
alter table public.job_cards drop constraint if exists job_cards_status_check;
alter table public.job_cards add constraint job_cards_status_check
  check (status in ('Baru', 'Diagnos', 'Tunggu Parts', 'Sedang Repair', 'Siap', 'Collected'));

alter table public.job_status_history drop constraint if exists job_status_history_new_status_check;
alter table public.job_status_history add constraint job_status_history_new_status_check
  check (new_status in ('Baru', 'Diagnos', 'Tunggu Parts', 'Sedang Repair', 'Siap', 'Collected'));
