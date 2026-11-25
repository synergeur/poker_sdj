-- Saved lines return when they were entered, so the log can put the latest one first.

create or replace function public.add_badbeat_entry(
  p_organization_id uuid,
  p_entered_on date,
  p_entered_at time,
  p_customers integer,
  p_won boolean,
  p_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comment text := btrim(coalesce(p_comment, ''));
  v_id uuid;
  v_won boolean := coalesce(p_won, false);
  v_created timestamptz;
begin
  if auth.uid() is null or not public.has_scope(p_organization_id, 'badbeat_entry') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_entered_on is null
    or p_entered_at is null
    or p_customers is null
    or p_customers < 0
    or p_customers > 100000
    or char_length(v_comment) > 500
  then
    raise exception 'invalid' using errcode = '22023';
  end if;

  insert into public.badbeat_entries (organization_id, entered_on, entered_at, customers, won, comment)
  values (p_organization_id, p_entered_on, p_entered_at, p_customers, v_won, v_comment)
  returning id, created_at into v_id, v_created;

  return jsonb_build_object(
    'id', v_id,
    'entered_on', p_entered_on,
    'entered_at', to_char(p_entered_at, 'HH24:MI'),
    'customers', p_customers,
    'won', v_won,
    'comment', v_comment,
    'created_at', v_created
  );
end;
$$;

create or replace function public.update_badbeat_entry(
  p_organization_id uuid,
  p_id uuid,
  p_entered_on date,
  p_entered_at time,
  p_customers integer,
  p_won boolean,
  p_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comment text := btrim(coalesce(p_comment, ''));
  v_won boolean := coalesce(p_won, false);
  v_created timestamptz;
begin
  if auth.uid() is null or not public.has_scope(p_organization_id, 'badbeat_entry') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_entered_on is null
    or p_entered_at is null
    or p_customers is null
    or p_customers < 0
    or p_customers > 100000
    or char_length(v_comment) > 500
  then
    raise exception 'invalid' using errcode = '22023';
  end if;

  update public.badbeat_entries
  set entered_on = p_entered_on,
      entered_at = p_entered_at,
      customers = p_customers,
      won = v_won,
      comment = v_comment,
      updated_at = now()
  where id = p_id
    and organization_id = p_organization_id
  returning created_at into v_created;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', p_id,
    'entered_on', p_entered_on,
    'entered_at', to_char(p_entered_at, 'HH24:MI'),
    'customers', p_customers,
    'won', v_won,
    'comment', v_comment,
    'created_at', v_created
  );
end;
$$;
