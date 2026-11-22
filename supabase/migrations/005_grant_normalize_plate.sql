-- The plate normaliser is called by INSERT/UPDATE triggers and by table checks.
-- Authenticated clients need EXECUTE permission for those database expressions.
grant execute on function public.normalize_plate_no(text) to authenticated;
