-- Move a current-day appointment into a Job Card atomically.
-- This is intentionally a dedicated function so staff do not need general appointment delete access.

create or replace function public.move_appointment_to_job_card(
  p_appointment_id uuid,
  p_assigned_staff uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  appointment_row public.appointments%rowtype;
  normalized_plate text;
  job_id uuid;
  notes_text text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select * into appointment_row
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'Appointment could not be found.';
  end if;

  if appointment_row.appointment_date <> (now() at time zone 'Asia/Kuala_Lumpur')::date then
    raise exception 'Only today''s appointments can be moved to a Job Card.';
  end if;

  normalized_plate := public.normalize_plate_no(appointment_row.plate_no);
  if normalized_plate = '' then
    raise exception 'A registration number is required.';
  end if;

  notes_text := concat_ws(
    E'\n',
    'Customer: ' || appointment_row.customer_name,
    case when nullif(trim(coalesce(appointment_row.customer_phone, '')), '') is not null
      then 'Phone: ' || trim(appointment_row.customer_phone)
      else null
    end
  );

  insert into public.vehicles (plate_no, car_model)
  values (normalized_plate, coalesce(appointment_row.car_model, ''))
  on conflict (plate_no) do update set car_model = excluded.car_model;

  insert into public.job_cards (
    plate_no,
    customer_complaint,
    check_in_date,
    status,
    notes,
    assigned_staff,
    created_by
  ) values (
    normalized_plate,
    appointment_row.job_description,
    appointment_row.appointment_date,
    'Baru',
    notes_text,
    case
      when p_assigned_staff is null or p_assigned_staff = auth.uid() or public.is_admin()
        then coalesce(p_assigned_staff, auth.uid())
      else auth.uid()
    end,
    auth.uid()
  ) returning id into job_id;

  insert into public.job_items (job_id, description, is_done)
  values (job_id, appointment_row.job_description, false);

  delete from public.appointments where id = appointment_row.id;

  return job_id;
end;
$$;

revoke all on function public.move_appointment_to_job_card(uuid, uuid) from public, anon;
grant execute on function public.move_appointment_to_job_card(uuid, uuid) to authenticated;
