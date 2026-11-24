-- Prevent clock-in during approved leave and overlapping leave requests.

create or replace function public.prevent_duplicate_attendance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  last_type public.attendance_type;
begin
  if public.is_admin() then
    return new;
  end if;

  if new.type = 'in'
     and exists (
       select 1
       from public.leave_requests
       where staff_id = new.staff_id
         and status = 'Approved'
         and (new.timestamp at time zone 'Asia/Kuala_Lumpur')::date between start_date and end_date
     ) then
    raise exception 'Staff has approved leave on this date and cannot clock in.';
  end if;

  select type into last_type
  from public.attendance
  where staff_id = new.staff_id
  order by timestamp desc
  limit 1;

  if new.type = 'in' and last_type = 'in' then
    raise exception 'Staff is already clocked in. Please clock out first.';
  end if;

  if new.type = 'out' and last_type is distinct from 'in'::public.attendance_type then
    raise exception 'Staff has not clocked in.';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_duplicate_attendance() from public;
grant execute on function public.prevent_duplicate_attendance() to authenticated;

create or replace function public.prevent_overlapping_leave_requests()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('Pending', 'Approved')
     and exists (
       select 1
       from public.leave_requests existing
       where existing.staff_id = new.staff_id
         and existing.id is distinct from new.id
         and existing.status in ('Pending', 'Approved')
         and existing.start_date <= new.end_date
         and existing.end_date >= new.start_date
     ) then
    raise exception 'Staff already has a pending or approved leave request covering one or more of these dates.';
  end if;

  return new;
end;
$$;

drop trigger if exists leave_overlap_check on public.leave_requests;
create trigger leave_overlap_check
before insert or update on public.leave_requests
for each row execute function public.prevent_overlapping_leave_requests();

-- Rejected leave records are not retained in the application.
delete from public.leave_requests
where status = 'Rejected';
