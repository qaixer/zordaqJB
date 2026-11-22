-- Security hardening for trigger-only functions.
-- Keep is_admin available to signed-in RLS policies, but not to anon clients.

alter function public.normalize_plate_no(text) set search_path = public;
alter function public.normalise_vehicle_plate() set search_path = public;
alter function public.normalise_job_card_plate() set search_path = public;
alter function public.touch_settings_updated_at() set search_path = public;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.prevent_duplicate_attendance() from public, anon, authenticated;
revoke all on function public.prevent_staff_job_card_edit() from public, anon, authenticated;
revoke all on function public.record_job_status_change() from public, anon, authenticated;
revoke all on function public.normalize_plate_no(text) from public, anon, authenticated;
revoke all on function public.normalise_vehicle_plate() from public, anon, authenticated;
revoke all on function public.normalise_job_card_plate() from public, anon, authenticated;
revoke all on function public.touch_settings_updated_at() from public, anon, authenticated;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
