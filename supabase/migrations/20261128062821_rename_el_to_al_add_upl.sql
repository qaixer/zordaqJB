-- Rename Emergency Leave to Annual Leave and add admin-created Unpaid Leave.
alter type public.leave_type rename value 'EL' to 'AL';
alter type public.leave_type add value if not exists 'UPL';

-- Staff can request MC/AL, while UPL remains an admin-only record.
drop policy if exists "leave own create" on public.leave_requests;
create policy "leave own create" on public.leave_requests for insert to authenticated
with check (
  staff_id = auth.uid()
  and status = 'Pending'
  and type in ('MC', 'AL')
);

drop policy if exists "leave own cancel pending" on public.leave_requests;
create policy "leave own cancel pending" on public.leave_requests for update to authenticated
using (staff_id = auth.uid() and status = 'Pending')
with check (
  staff_id = auth.uid()
  and status = 'Pending'
  and type in ('MC', 'AL')
);
