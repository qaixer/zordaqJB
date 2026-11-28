-- Allow staff to cancel (delete) their own leave request while it is still Pending.
drop policy if exists "leave own delete pending" on public.leave_requests;
create policy "leave own delete pending" on public.leave_requests for delete to authenticated
using (staff_id = auth.uid() and status = 'Pending');
