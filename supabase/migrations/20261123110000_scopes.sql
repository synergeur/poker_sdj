-- Scopes are the permissions of one establishment.
-- A role is a named list of scopes. A member can also hold extra scopes.
-- The main account is the organization owner and always keeps scope_manager and accounts.

alter table public.organization_members
  add column is_owner boolean not null default false;

update public.organization_members as member
set is_owner = true
where member.id in (
  select distinct on (candidate.organization_id) candidate.id
  from public.organization_members as candidate
  join public.roles as role on role.id = candidate.role_id
  where role.name = 'organization_admin'
    and role.is_system_role
    and role.organization_id is null
  order by candidate.organization_id, candidate.created_at
);

create unique index organization_members_one_owner
  on public.organization_members (organization_id)
  where is_owner;

insert into public.roles (name, description, is_system_role)
select
  'staff',
  'Employee. Scopes come from another role or from extra scopes.',
  true
where not exists (
  select 1
  from public.roles
  where name = 'staff'
    and is_system_role
    and organization_id is null
);

create table public.scopes (
  key text primary key,
  description text not null,
  constraint scopes_key_format check (key ~ '^[a-z][a-z0-9_]{1,40}$')
);

insert into public.scopes (key, description)
values
  (
    'scope_manager',
    'Open the scope manager and assign roles and scopes.'
  ),
  (
    'accounts',
    'Create accounts for this establishment.'
  );

create table public.role_scopes (
  role_id uuid not null references public.roles (id) on delete cascade,
  scope_key text not null references public.scopes (key) on delete cascade,
  primary key (role_id, scope_key)
);

create table public.member_scopes (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  scope_key text not null references public.scopes (key) on delete cascade,
  primary key (organization_id, user_id, scope_key)
);

insert into public.role_scopes (role_id, scope_key)
select role.id, scope.key
from public.roles as role
cross join public.scopes as scope
where role.name = 'organization_admin'
  and role.is_system_role
  and role.organization_id is null
  and scope.key in ('scope_manager', 'accounts')
on conflict do nothing;

create or replace function public.create_organization_with_admin(
  p_name text,
  p_slug text,
  p_status text,
  p_contact_email text,
  p_address text,
  p_admin_user_id uuid,
  p_admin_account_id text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid;
  v_role_id uuid;
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select id
  into v_role_id
  from public.roles
  where name = 'organization_admin'
    and is_system_role
    and organization_id is null;

  if v_role_id is null then
    raise exception 'missing_role' using errcode = 'P0001';
  end if;

  insert into public.organizations (name, slug, status, contact_email, address)
  values (
    btrim(p_name),
    p_slug,
    p_status,
    nullif(btrim(coalesce(p_contact_email, '')), ''),
    nullif(btrim(coalesce(p_address, '')), '')
  )
  returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role_id, status, is_owner)
  values (v_org_id, p_admin_user_id, v_role_id, 'active', true);

  insert into public.audit_logs (actor_id, organization_id, action, metadata)
  values (
    auth.uid(),
    v_org_id,
    'organization.create',
    jsonb_build_object(
      'slug', p_slug,
      'admin_account_id', p_admin_account_id
    )
  );

  return v_org_id;
end;
$$;

create or replace function public.is_organization_owner(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = p_organization_id
      and user_id = auth.uid()
      and is_owner
      and status = 'active'
  );
$$;

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

create or replace function public.assert_scope_manager(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_scope(p_organization_id, 'scope_manager') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.assert_known_scopes(p_scopes text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from unnest(coalesce(p_scopes, array[]::text[])) as incoming(scope_key)
    where not exists (
      select 1 from public.scopes where key = incoming.scope_key
    )
  ) then
    raise exception 'invalid_scope' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.create_organization_role(
  p_organization_id uuid,
  p_name text,
  p_description text,
  p_scopes text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_id uuid;
  v_name text := btrim(p_name);
begin
  perform public.assert_scope_manager(p_organization_id);
  perform public.assert_known_scopes(p_scopes);

  if char_length(v_name) < 2 or char_length(v_name) > 40
    or lower(v_name) in ('organization_admin', 'staff')
  then
    raise exception 'role_invalid' using errcode = '22023';
  end if;

  insert into public.roles (organization_id, name, description, is_system_role)
  values (
    p_organization_id,
    v_name,
    nullif(btrim(coalesce(p_description, '')), ''),
    false
  )
  returning id into v_role_id;

  insert into public.role_scopes (role_id, scope_key)
  select distinct v_role_id, incoming.scope_key
  from unnest(coalesce(p_scopes, array[]::text[])) as incoming(scope_key);

  insert into public.audit_logs (actor_id, organization_id, action, metadata)
  values (
    auth.uid(),
    p_organization_id,
    'role.create',
    jsonb_build_object('role_id', v_role_id, 'name', v_name, 'scopes', coalesce(p_scopes, array[]::text[]))
  );

  return v_role_id;
end;
$$;

create or replace function public.update_organization_role(
  p_organization_id uuid,
  p_role_id uuid,
  p_name text,
  p_description text,
  p_scopes text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(p_name);
begin
  perform public.assert_scope_manager(p_organization_id);
  perform public.assert_known_scopes(p_scopes);

  if char_length(v_name) < 2 or char_length(v_name) > 40
    or lower(v_name) in ('organization_admin', 'staff')
  then
    raise exception 'role_invalid' using errcode = '22023';
  end if;

  update public.roles
  set
    name = v_name,
    description = nullif(btrim(coalesce(p_description, '')), '')
  where id = p_role_id
    and organization_id = p_organization_id
    and not is_system_role;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  delete from public.role_scopes where role_id = p_role_id;
  insert into public.role_scopes (role_id, scope_key)
  select distinct p_role_id, incoming.scope_key
  from unnest(coalesce(p_scopes, array[]::text[])) as incoming(scope_key);

  insert into public.audit_logs (actor_id, organization_id, action, metadata)
  values (
    auth.uid(),
    p_organization_id,
    'role.update',
    jsonb_build_object('role_id', p_role_id, 'name', v_name, 'scopes', coalesce(p_scopes, array[]::text[]))
  );
end;
$$;

create or replace function public.delete_organization_role(
  p_organization_id uuid,
  p_role_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_scope_manager(p_organization_id);

  if not exists (
    select 1
    from public.roles
    where id = p_role_id
      and organization_id = p_organization_id
      and not is_system_role
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.organization_members where role_id = p_role_id
  ) then
    raise exception 'role_in_use' using errcode = 'P0001';
  end if;

  delete from public.roles where id = p_role_id;

  insert into public.audit_logs (actor_id, organization_id, action, metadata)
  values (
    auth.uid(),
    p_organization_id,
    'role.delete',
    jsonb_build_object('role_id', p_role_id)
  );
end;
$$;

create or replace function public.assignable_role(p_organization_id uuid, p_role_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.roles
    where id = p_role_id
      and (
        (name = 'staff' and is_system_role and organization_id is null)
        or (organization_id = p_organization_id and not is_system_role)
      )
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

create or replace function public.set_member_access(
  p_organization_id uuid,
  p_user_id uuid,
  p_role_id uuid,
  p_status text,
  p_scopes text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner boolean;
begin
  perform public.assert_scope_manager(p_organization_id);
  perform public.assert_known_scopes(p_scopes);

  if p_status not in ('active', 'disabled') then
    raise exception 'invalid' using errcode = '22023';
  end if;

  select is_owner
  into v_owner
  from public.organization_members
  where organization_id = p_organization_id
    and user_id = p_user_id;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if v_owner then
    raise exception 'owner_locked' using errcode = 'P0001';
  end if;

  if not public.assignable_role(p_organization_id, p_role_id) then
    raise exception 'role_invalid' using errcode = '22023';
  end if;

  update public.organization_members
  set role_id = p_role_id, status = p_status
  where organization_id = p_organization_id
    and user_id = p_user_id;

  delete from public.member_scopes
  where organization_id = p_organization_id
    and user_id = p_user_id;

  insert into public.member_scopes (organization_id, user_id, scope_key)
  select distinct p_organization_id, p_user_id, incoming.scope_key
  from unnest(coalesce(p_scopes, array[]::text[])) as incoming(scope_key);

  insert into public.audit_logs (actor_id, organization_id, action, metadata)
  values (
    auth.uid(),
    p_organization_id,
    'member.access',
    jsonb_build_object(
      'user_id', p_user_id,
      'role_id', p_role_id,
      'status', p_status,
      'scopes', coalesce(p_scopes, array[]::text[])
    )
  );
end;
$$;

alter table public.scopes enable row level security;
alter table public.role_scopes enable row level security;
alter table public.member_scopes enable row level security;

revoke all on table public.scopes from anon, authenticated;
revoke all on table public.role_scopes from anon, authenticated;
revoke all on table public.member_scopes from anon, authenticated;

grant select on public.scopes to authenticated;
grant select on public.role_scopes to authenticated;
grant select on public.member_scopes to authenticated;

create policy scopes_select
on public.scopes
for select
to authenticated
using (true);

create policy role_scopes_select
on public.role_scopes
for select
to authenticated
using (
  exists (
    select 1
    from public.roles as role
    where role.id = role_scopes.role_id
      and (
        role.is_system_role
        or public.is_platform_admin()
        or (role.organization_id is not null and public.is_org_member(role.organization_id))
      )
  )
);

create policy member_scopes_select
on public.member_scopes
for select
to authenticated
using (
  public.is_platform_admin()
  or public.is_org_member(organization_id)
);

revoke all on function public.is_organization_owner(uuid) from public;
revoke all on function public.has_scope(uuid, text) from public;
revoke all on function public.assert_scope_manager(uuid) from public;
revoke all on function public.assert_known_scopes(text[]) from public;
revoke all on function public.assignable_role(uuid, uuid) from public;
revoke all on function public.create_organization_role(uuid, text, text, text[]) from public;
revoke all on function public.update_organization_role(uuid, uuid, text, text, text[]) from public;
revoke all on function public.delete_organization_role(uuid, uuid) from public;
revoke all on function public.create_organization_member(uuid, uuid, uuid, text[]) from public;
revoke all on function public.set_member_access(uuid, uuid, uuid, text, text[]) from public;

grant execute on function public.is_organization_owner(uuid) to authenticated;
grant execute on function public.has_scope(uuid, text) to authenticated;
grant execute on function public.create_organization_role(uuid, text, text, text[]) to authenticated;
grant execute on function public.update_organization_role(uuid, uuid, text, text, text[]) to authenticated;
grant execute on function public.delete_organization_role(uuid, uuid) to authenticated;
grant execute on function public.create_organization_member(uuid, uuid, uuid, text[]) to authenticated;
grant execute on function public.set_member_access(uuid, uuid, uuid, text, text[]) to authenticated;
