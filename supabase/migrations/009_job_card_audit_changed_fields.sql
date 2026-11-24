-- Store the exact fields changed in each Job Card audit entry.

create or replace function public.record_job_card_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  job_uuid uuid;
  editor_uuid uuid;
  old_json jsonb;
  new_json jsonb;
  changed jsonb;
begin
  if tg_table_name = 'job_cards' then
    job_uuid := case when tg_op = 'DELETE' then old.id else new.id end;
  else
    job_uuid := case when tg_op = 'DELETE' then old.job_id else new.job_id end;
  end if;
  editor_uuid := auth.uid();
  if editor_uuid is null then return coalesce(new, old); end if;

  old_json := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  new_json := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(key, jsonb_build_object('old', old_json -> key, 'new', new_json -> key)), '{}'::jsonb)
    into changed
    from jsonb_object_keys(new_json) as fields(key)
    where old_json -> key is distinct from new_json -> key;
  else
    changed := case
      when tg_op = 'INSERT' then jsonb_build_object('created', true)
      else jsonb_build_object('deleted', true)
    end;
  end if;

  insert into public.job_card_audit_log (job_id, edited_by, action, changed_fields, old_value, new_value)
  values (
    job_uuid,
    editor_uuid,
    case
      when tg_op = 'INSERT' then tg_table_name || '_created'
      when tg_op = 'DELETE' then tg_table_name || '_deleted'
      else tg_table_name || '_updated'
    end,
    changed,
    old_json,
    new_json
  );
  return coalesce(new, old);
end;
$$;
