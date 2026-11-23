-- Host edits one establishment and its administrator.
-- Profiles have no update grant for authenticated, so this runs as the owner.

create or replace function public.update_organization_and_admin(
  p_organization_id uuid,
  p_name text,
  p_slug text,
  p_contact_email text,
  p_address text,
  p_admin_user_id uuid,
  p_first_name text,
  p_last_name text,
  p_account_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_admin_user_id = auth.uid()
    or exists (
      select 1
      from public.platform_admins
      where user_id = p_admin_user_id
    )
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.organization_members as member
    join public.roles as role on role.id = member.role_id
    where member.organization_id = p_organization_id
      and member.user_id = p_admin_user_id
      and role.name = 'organization_admin'
      and role.is_system_role
      and role.organization_id is null
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  update public.organizations
  set
    name = btrim(p_name),
    slug = p_slug,
    contact_email = nullif(btrim(coalesce(p_contact_email, '')), ''),
    address = nullif(btrim(coalesce(p_address, '')), '')
  where id = p_organization_id;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  update public.profiles
  set
    account_id = p_account_id,
    first_name = btrim(p_first_name),
    last_name = btrim(p_last_name)
  where id = p_admin_user_id;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  insert into public.audit_logs (actor_id, organization_id, action, metadata)
  values (
    auth.uid(),
    p_organization_id,
    'organization.update',
    jsonb_build_object(
      'slug', p_slug,
      'admin_user_id', p_admin_user_id,
      'admin_account_id', p_account_id
    )
  );
end;
$$;

revoke all on function public.update_organization_and_admin(uuid, text, text, text, text, uuid, text, text, text) from public;
grant execute on function public.update_organization_and_admin(uuid, text, text, text, text, uuid, text, text, text) to authenticated;
