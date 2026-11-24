-- Allow every authenticated user to create a Job Card.
-- Staff-created cards are owned by the authenticated creator through created_by.

drop policy if exists "vehicles authenticated insert" on public.vehicles;
create policy "vehicles authenticated insert" on public.vehicles
for insert to authenticated
with check (auth.uid() is not null);

drop policy if exists "vehicles authenticated update" on public.vehicles;
create policy "vehicles authenticated update" on public.vehicles
for update to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "job cards authenticated create" on public.job_cards;
create policy "job cards authenticated create" on public.job_cards
for insert to authenticated
with check (created_by = auth.uid());

drop policy if exists "job items creator manage" on public.job_items;
create policy "job items creator manage" on public.job_items
for all to authenticated
using (exists (
  select 1 from public.job_cards
  where id = job_items.job_id and created_by = auth.uid()
))
with check (exists (
  select 1 from public.job_cards
  where id = job_items.job_id and created_by = auth.uid()
));
