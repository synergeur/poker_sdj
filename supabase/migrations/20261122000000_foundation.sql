-- Casino Room foundation.
-- One organization is one establishment. There is no establishment table and no billing data.
-- Public sign-up must also be disabled in the Supabase dashboard. This migration cannot do that
-- for a hosted project.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  status text not null default 'active',
  contact_email text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_length check (char_length(btrim(name)) between 2 and 120),
  constraint organizations_slug_length check (char_length(slug) between 2 and 40),
  constraint organizations_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint organizations_slug_reserved check (
    slug not in ('www', 'admin', 'api', 'app', 'auth', 'mail')
  ),
  constraint organizations_status_check check (status in ('active', 'suspended')),
  constraint organizations_contact_email_format check (
    contact_email is null or contact_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  )
);

create unique index organizations_slug_key on public.organizations (slug);
create index organizations_status_idx on public.organizations (status);

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

comment on table public.organizations is
  'One row is one establishment. Do not add an establishments table.';

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  account_id text not null,
  first_name text not null default '',
  last_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_account_id_format check (account_id ~ '^[a-z][a-z0-9_]{2,31}$')
);

create unique index profiles_account_id_key on public.profiles (account_id);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  name text not null,
  description text,
  is_system_role boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index roles_system_name_key
  on public.roles (name)
  where organization_id is null;

create unique index roles_organization_name_key
  on public.roles (organization_id, name)
  where organization_id is not null;

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint organization_members_status_check check (status in ('active', 'disabled')),
  constraint organization_members_unique unique (organization_id, user_id)
);

create index organization_members_user_id_idx on public.organization_members (user_id);
create index organization_members_organization_id_idx on public.organization_members (organization_id);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_organization_created_idx
  on public.audit_logs (organization_id, created_at desc);

insert into public.roles (name, description, is_system_role)
values (
  'organization_admin',
  'Initial administrator of one organization.',
  true
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id text;
begin
  v_account_id := lower(btrim(coalesce(new.raw_user_meta_data ->> 'account_id', '')));
  if v_account_id = '' then
    v_account_id := lower(split_part(coalesce(new.email, ''), '@', 1));
  end if;

  insert into public.profiles (id, account_id, first_name, last_name)
  values (
    new.id,
    v_account_id,
    btrim(coalesce(new.raw_user_meta_data ->> 'first_name', '')),
    btrim(coalesce(new.raw_user_meta_data ->> 'last_name', ''))
  );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins
    where user_id = auth.uid()
  );
$$;

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

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

  insert into public.organization_members (organization_id, user_id, role_id, status)
  values (v_org_id, p_admin_user_id, v_role_id, 'active');

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

create or replace function public.set_organization_status(
  p_organization_id uuid,
  p_status text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_status not in ('active', 'suspended') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  update public.organizations
  set status = p_status
  where id = p_organization_id;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  insert into public.audit_logs (actor_id, organization_id, action, metadata)
  values (
    auth.uid(),
    p_organization_id,
    'organization.status',
    jsonb_build_object('status', p_status)
  );
end;
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.roles enable row level security;
alter table public.organization_members enable row level security;
alter table public.audit_logs enable row level security;

revoke all on table public.organizations from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.platform_admins from anon, authenticated;
revoke all on table public.roles from anon, authenticated;
revoke all on table public.organization_members from anon, authenticated;
revoke all on table public.audit_logs from anon, authenticated;

grant select, insert, update on public.organizations to authenticated;
grant select on public.profiles to authenticated;
grant select on public.platform_admins to authenticated;
grant select on public.roles to authenticated;
grant select, insert on public.organization_members to authenticated;
grant select, insert on public.audit_logs to authenticated;

create policy organizations_select
on public.organizations
for select
to authenticated
using (
  public.is_platform_admin()
  or (status = 'active' and public.is_org_member(id))
);

create policy organizations_insert
on public.organizations
for insert
to authenticated
with check (public.is_platform_admin());

create policy organizations_update
on public.organizations
for update
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy profiles_select
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_platform_admin()
  or exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs
      on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid()
      and mine.status = 'active'
      and theirs.user_id = profiles.id
  )
);

create policy platform_admins_select_own
on public.platform_admins
for select
to authenticated
using (user_id = auth.uid());

create policy roles_select
on public.roles
for select
to authenticated
using (
  is_system_role
  or public.is_platform_admin()
  or (organization_id is not null and public.is_org_member(organization_id))
);

create policy organization_members_select
on public.organization_members
for select
to authenticated
using (
  public.is_platform_admin()
  or user_id = auth.uid()
  or public.is_org_member(organization_id)
);

create policy organization_members_insert
on public.organization_members
for insert
to authenticated
with check (public.is_platform_admin());

create policy audit_logs_select
on public.audit_logs
for select
to authenticated
using (public.is_platform_admin());

create policy audit_logs_insert
on public.audit_logs
for insert
to authenticated
with check (
  public.is_platform_admin()
  and actor_id = auth.uid()
);

-- The profiles policy above joins organization_members, and that table's own
-- policy calls is_org_member(), which is security definer. That avoids a
-- recursive RLS loop while still hiding other organizations.

revoke all on function public.create_organization_with_admin(text, text, text, text, text, uuid, text) from public;
revoke all on function public.set_organization_status(uuid, text) from public;
revoke all on function public.is_platform_admin() from public;
revoke all on function public.is_org_member(uuid) from public;

grant execute on function public.create_organization_with_admin(text, text, text, text, text, uuid, text) to authenticated;
grant execute on function public.set_organization_status(uuid, text) to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
