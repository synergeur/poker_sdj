-- Removing a line is limited to accounts that can enter the bad beat.

create or replace function public.delete_badbeat_entry(
  p_organization_id uuid,
  p_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_scope(p_organization_id, 'badbeat_entry') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_id is null then
    raise exception 'invalid' using errcode = '22023';
  end if;

  delete from public.badbeat_entries
  where id = p_id
    and organization_id = p_organization_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.delete_badbeat_entry(uuid, uuid) from public;
grant execute on function public.delete_badbeat_entry(uuid, uuid) to authenticated;
