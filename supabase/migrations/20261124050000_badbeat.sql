-- Bad beat log. Entry and stats are separate scopes, both held by Poker superviseur.

insert into public.scopes (key, description)
values
  (
    'badbeat_entry',
    'Log and edit bad beat lines.'
  ),
  (
    'badbeat_stats',
    'See bad beat stats beside the log.'
  )
on conflict (key) do update
set description = excluded.description;

create table if not exists public.badbeat_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entered_on date not null,
  entered_at time not null,
  amount numeric(12, 2) not null,
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint badbeat_entries_amount_range check (amount >= 0 and amount <= 999999999.99),
  constraint badbeat_entries_comment_len check (char_length(comment) <= 500)
);

create index if not exists badbeat_entries_org_when_idx
  on public.badbeat_entries (organization_id, entered_on desc, entered_at desc);

alter table public.badbeat_entries enable row level security;

drop policy if exists badbeat_entries_select on public.badbeat_entries;
create policy badbeat_entries_select
on public.badbeat_entries
for select
to authenticated
using (
  public.has_scope(organization_id, 'badbeat_entry')
  or public.has_scope(organization_id, 'badbeat_stats')
);

grant select on public.badbeat_entries to authenticated;

create or replace function public.ensure_poker_supervisor_role(p_organization_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_id uuid;
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select id
  into v_role_id
  from public.roles
  where organization_id = p_organization_id
    and name = 'Poker superviseur';

  if v_role_id is null then
    insert into public.roles (organization_id, name, description, is_system_role)
    values (
      p_organization_id,
      'Poker superviseur',
      'Logs the bad beat and reads its stats.',
      false
    )
    returning id into v_role_id;
  end if;

  insert into public.role_scopes (role_id, scope_key)
  values
    (v_role_id, 'badbeat_entry'),
    (v_role_id, 'badbeat_stats')
  on conflict do nothing;

  return v_role_id;
end;
$$;

insert into public.roles (organization_id, name, description, is_system_role)
select organization.id, 'Poker superviseur', 'Logs the bad beat and reads its stats.', false
from public.organizations as organization
where not exists (
  select 1
  from public.roles as role
  where role.organization_id = organization.id
    and role.name = 'Poker superviseur'
);

insert into public.role_scopes (role_id, scope_key)
select role.id, scope.key
from public.roles as role
cross join public.scopes as scope
where role.name = 'Poker superviseur'
  and role.organization_id is not null
  and scope.key in ('badbeat_entry', 'badbeat_stats')
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

  perform public.ensure_poker_supervisor_role(v_org_id);

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

create or replace function public.add_badbeat_entry(
  p_organization_id uuid,
  p_entered_on date,
  p_entered_at time,
  p_amount numeric,
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
begin
  if auth.uid() is null or not public.has_scope(p_organization_id, 'badbeat_entry') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_entered_on is null
    or p_entered_at is null
    or p_amount is null
    or p_amount < 0
    or p_amount > 999999999.99
    or char_length(v_comment) > 500
  then
    raise exception 'invalid' using errcode = '22023';
  end if;

  insert into public.badbeat_entries (organization_id, entered_on, entered_at, amount, comment)
  values (p_organization_id, p_entered_on, p_entered_at, round(p_amount, 2), v_comment)
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'entered_on', p_entered_on,
    'entered_at', to_char(p_entered_at, 'HH24:MI'),
    'amount', round(p_amount, 2),
    'comment', v_comment
  );
end;
$$;

create or replace function public.update_badbeat_entry(
  p_organization_id uuid,
  p_id uuid,
  p_entered_on date,
  p_entered_at time,
  p_amount numeric,
  p_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comment text := btrim(coalesce(p_comment, ''));
begin
  if auth.uid() is null or not public.has_scope(p_organization_id, 'badbeat_entry') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_entered_on is null
    or p_entered_at is null
    or p_amount is null
    or p_amount < 0
    or p_amount > 999999999.99
    or char_length(v_comment) > 500
  then
    raise exception 'invalid' using errcode = '22023';
  end if;

  update public.badbeat_entries
  set entered_on = p_entered_on,
      entered_at = p_entered_at,
      amount = round(p_amount, 2),
      comment = v_comment,
      updated_at = now()
  where id = p_id
    and organization_id = p_organization_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', p_id,
    'entered_on', p_entered_on,
    'entered_at', to_char(p_entered_at, 'HH24:MI'),
    'amount', round(p_amount, 2),
    'comment', v_comment
  );
end;
$$;

revoke all on function public.ensure_poker_supervisor_role(uuid) from public;
revoke all on function public.add_badbeat_entry(uuid, date, time, numeric, text) from public;
revoke all on function public.update_badbeat_entry(uuid, uuid, date, time, numeric, text) from public;

grant execute on function public.ensure_poker_supervisor_role(uuid) to authenticated;
grant execute on function public.add_badbeat_entry(uuid, date, time, numeric, text) to authenticated;
grant execute on function public.update_badbeat_entry(uuid, uuid, date, time, numeric, text) to authenticated;
