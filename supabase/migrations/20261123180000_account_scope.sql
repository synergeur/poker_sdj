-- Account creation is its own scope. The scope manager no longer includes it.
-- The main account keeps both, and neither can be taken away.

insert into public.scopes (key, description)
values (
  'accounts',
  'Create accounts for this establishment.'
)
on conflict (key) do update
set description = excluded.description;

update public.scopes
set description = 'Open the scope manager and assign roles and scopes.'
where key = 'scope_manager';

insert into public.role_scopes (role_id, scope_key)
select role.id, 'accounts'
from public.roles as role
where role.name = 'organization_admin'
  and role.is_system_role
  and role.organization_id is null
on conflict do nothing;

create or replace function public.has_scope(p_organization_id uuid, p_scope_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_platform_admin()
    or (
      p_scope_key in ('scope_manager', 'accounts')
      and public.is_organization_owner(p_organization_id)
    )
    or exists (
      select 1
      from public.organization_members as member
      join public.role_scopes as granted on granted.role_id = member.role_id
      where member.organization_id = p_organization_id
        and member.user_id = auth.uid()
        and member.status = 'active'
        and granted.scope_key = p_scope_key
    )
    or exists (
      select 1
      from public.organization_members as member
      join public.member_scopes as extra
        on extra.organization_id = member.organization_id
       and extra.user_id = member.user_id
      where member.organization_id = p_organization_id
        and member.user_id = auth.uid()
        and member.status = 'active'
        and extra.scope_key = p_scope_key
    );
$$;

create or replace function public.create_organization_member(
  p_organization_id uuid,
  p_user_id uuid,
  p_role_id uuid,
  p_scopes text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_scope(p_organization_id, 'accounts') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform public.assert_known_scopes(p_scopes);

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if not public.assignable_role(p_organization_id, p_role_id) then
    raise exception 'role_invalid' using errcode = '22023';
  end if;

  insert into public.organization_members (organization_id, user_id, role_id, status, is_owner)
  values (p_organization_id, p_user_id, p_role_id, 'active', false);

  insert into public.member_scopes (organization_id, user_id, scope_key)
  select distinct p_organization_id, p_user_id, incoming.scope_key
  from unnest(coalesce(p_scopes, array[]::text[])) as incoming(scope_key);

  insert into public.audit_logs (actor_id, organization_id, action, metadata)
  values (
    auth.uid(),
    p_organization_id,
    'member.create',
    jsonb_build_object('user_id', p_user_id, 'role_id', p_role_id, 'scopes', coalesce(p_scopes, array[]::text[]))
  );
end;
$$;
