-- A promotion that already has a log line stays. An empty promotion can still be removed.

create or replace function public.delete_promotion(
  p_organization_id uuid,
  p_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_scope(p_organization_id, 'promotions') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.promotion_entries
    where promotion_id = p_id
      and organization_id = p_organization_id
  ) then
    raise exception 'has_log' using errcode = 'P0001';
  end if;

  delete from public.promotions
  where id = p_id
    and organization_id = p_organization_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.delete_promotion(uuid, uuid) from public;
grant execute on function public.delete_promotion(uuid, uuid) to authenticated;
