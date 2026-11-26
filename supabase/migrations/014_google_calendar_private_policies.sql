-- These tables are intentionally server-only. The Edge Function uses the service role.
-- Explicit deny policies document that authenticated clients must not access OAuth data.

create policy "google calendar connections server only"
on public.google_calendar_connections
for all to authenticated
using (false)
with check (false);

create policy "google calendar oauth states server only"
on public.google_calendar_oauth_states
for all to authenticated
using (false)
with check (false);
