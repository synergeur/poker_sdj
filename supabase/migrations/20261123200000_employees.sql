-- Employee records are separate from account creation.
-- The main account keeps this scope. An employee edits their own details.
-- Evaluations and comments stay hidden from the employee until the toggle is on.

insert into public.scopes (key, description)
values (
  'employees',
  'See employees, their availability, evaluations, and comments.'
)
on conflict (key) do update
set description = excluded.description;

insert into public.role_scopes (role_id, scope_key)
select role.id, 'employees'
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
      p_scope_key in ('scope_manager', 'accounts', 'employees')
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

create table if not exists public.employee_profiles (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  phone text not null default '',
  address text not null default '',
  emergency_name text not null default '',
  emergency_phone text not null default '',
  other text not null default '',
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id),
  constraint employee_profiles_phone_len check (char_length(phone) <= 40),
  constraint employee_profiles_address_len check (char_length(address) <= 200),
  constraint employee_profiles_emergency_name_len check (char_length(emergency_name) <= 80),
  constraint employee_profiles_emergency_phone_len check (char_length(emergency_phone) <= 40),
  constraint employee_profiles_other_len check (char_length(other) <= 2000)
);

create table if not exists public.employee_weekdays (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  weekday smallint not null,
  available boolean not null,
  starts_at time,
  ends_at time,
  primary key (organization_id, user_id, weekday),
  constraint employee_weekdays_day check (weekday between 1 and 7),
  constraint employee_weekdays_times check (
    (available and starts_at is not null and ends_at is not null and starts_at < ends_at)
    or (not available and starts_at is null and ends_at is null)
  )
);

create table if not exists public.employee_exceptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  work_date date not null,
  available boolean not null,
  starts_at time,
  ends_at time,
  unique (organization_id, user_id, work_date),
  constraint employee_exceptions_times check (
    (available and starts_at is not null and ends_at is not null and starts_at < ends_at)
    or (not available and starts_at is null and ends_at is null)
  )
);

create table if not exists public.employee_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  kind text not null,
  body text not null,
  visible_to_employee boolean not null default false,
  created_at timestamptz not null default now(),
  constraint employee_notes_kind check (kind in ('evaluation', 'comment')),
  constraint employee_notes_body_len check (char_length(btrim(body)) between 1 and 2000)
);

create index if not exists employee_notes_subject_idx
  on public.employee_notes (organization_id, user_id, created_at desc);

alter table public.employee_profiles enable row level security;
alter table public.employee_weekdays enable row level security;
alter table public.employee_exceptions enable row level security;
alter table public.employee_notes enable row level security;

drop policy if exists employee_profiles_select on public.employee_profiles;
create policy employee_profiles_select
on public.employee_profiles
for select
to authenticated
using (
  public.is_platform_admin()
  or user_id = auth.uid()
  or public.has_scope(organization_id, 'employees')
);

drop policy if exists employee_weekdays_select on public.employee_weekdays;
create policy employee_weekdays_select
on public.employee_weekdays
for select
to authenticated
using (
  public.is_platform_admin()
  or user_id = auth.uid()
  or public.has_scope(organization_id, 'employees')
);

drop policy if exists employee_exceptions_select on public.employee_exceptions;
create policy employee_exceptions_select
on public.employee_exceptions
for select
to authenticated
using (
  public.is_platform_admin()
  or user_id = auth.uid()
  or public.has_scope(organization_id, 'employees')
);

drop policy if exists employee_notes_select on public.employee_notes;
create policy employee_notes_select
on public.employee_notes
for select
to authenticated
using (
  public.has_scope(organization_id, 'employees')
  or (user_id = auth.uid() and visible_to_employee)
);

grant select on public.employee_profiles to authenticated;
grant select on public.employee_weekdays to authenticated;
grant select on public.employee_exceptions to authenticated;
grant select on public.employee_notes to authenticated;

create or replace function public.save_employee_profile(
  p_organization_id uuid,
  p_phone text,
  p_address text,
  p_emergency_name text,
  p_emergency_phone text,
  p_other text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := btrim(coalesce(p_phone, ''));
  v_address text := btrim(coalesce(p_address, ''));
  v_emergency_name text := btrim(coalesce(p_emergency_name, ''));
  v_emergency_phone text := btrim(coalesce(p_emergency_phone, ''));
  v_other text := btrim(coalesce(p_other, ''));
begin
  if auth.uid() is null or not public.is_org_member(p_organization_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if char_length(v_phone) > 40
    or char_length(v_address) > 200
    or char_length(v_emergency_name) > 80
    or char_length(v_emergency_phone) > 40
    or char_length(v_other) > 2000 then
    raise exception 'invalid' using errcode = '22023';
  end if;

  insert into public.employee_profiles (
    organization_id, user_id, phone, address, emergency_name, emergency_phone, other
  )
  values (
    p_organization_id, auth.uid(), v_phone, v_address, v_emergency_name, v_emergency_phone, v_other
  )
  on conflict (organization_id, user_id) do update
  set phone = excluded.phone,
      address = excluded.address,
      emergency_name = excluded.emergency_name,
      emergency_phone = excluded.emergency_phone,
      other = excluded.other,
      updated_at = now();
end;
$$;

create or replace function public.save_employee_week(p_organization_id uuid, p_days jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  v_weekday int;
  v_available boolean;
  v_start time;
  v_end time;
  seen boolean[] := array[false, false, false, false, false, false, false];
  v_rows int := 0;
begin
  if auth.uid() is null or not public.is_org_member(p_organization_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_days) is distinct from 'array' then
    raise exception 'invalid' using errcode = '22023';
  end if;

  delete from public.employee_weekdays
  where organization_id = p_organization_id and user_id = auth.uid();

  for item in select value from jsonb_array_elements(p_days)
  loop
    v_weekday := (item->>'weekday')::int;
    v_available := coalesce((item->>'available')::boolean, false);
    if v_weekday < 1 or v_weekday > 7 or seen[v_weekday] then
      raise exception 'invalid' using errcode = '22023';
    end if;
    seen[v_weekday] := true;
    if v_available then
      v_start := nullif(item->>'starts_at', '')::time;
      v_end := nullif(item->>'ends_at', '')::time;
      if v_start is null or v_end is null or v_start >= v_end then
        raise exception 'invalid' using errcode = '22023';
      end if;
    else
      v_start := null;
      v_end := null;
    end if;
    insert into public.employee_weekdays (organization_id, user_id, weekday, available, starts_at, ends_at)
    values (p_organization_id, auth.uid(), v_weekday, v_available, v_start, v_end);
    v_rows := v_rows + 1;
  end loop;

  if v_rows <> 7 then
    raise exception 'invalid' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.save_employee_exception(
  p_organization_id uuid,
  p_work_date date,
  p_available boolean,
  p_starts_at time,
  p_ends_at time
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start time := case when p_available then p_starts_at else null end;
  v_end time := case when p_available then p_ends_at else null end;
begin
  if auth.uid() is null or not public.is_org_member(p_organization_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_work_date is null
    or (p_available and (v_start is null or v_end is null or v_start >= v_end)) then
    raise exception 'invalid' using errcode = '22023';
  end if;

  insert into public.employee_exceptions (organization_id, user_id, work_date, available, starts_at, ends_at)
  values (p_organization_id, auth.uid(), p_work_date, p_available, v_start, v_end)
  on conflict (organization_id, user_id, work_date) do update
  set available = excluded.available,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at;
end;
$$;

create or replace function public.delete_employee_exception(p_organization_id uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_org_member(p_organization_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.employee_exceptions
  where id = p_id
    and organization_id = p_organization_id
    and user_id = auth.uid();
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.add_employee_note(
  p_organization_id uuid,
  p_user_id uuid,
  p_kind text,
  p_body text,
  p_visible boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
begin
  if auth.uid() is null or not public.has_scope(p_organization_id, 'employees') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_kind not in ('evaluation', 'comment') or char_length(v_body) < 1 or char_length(v_body) > 2000 then
    raise exception 'invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.organization_members
    where organization_id = p_organization_id
      and user_id = p_user_id
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  insert into public.employee_notes (organization_id, user_id, author_id, kind, body, visible_to_employee)
  values (p_organization_id, p_user_id, auth.uid(), p_kind, v_body, coalesce(p_visible, false));
end;
$$;

create or replace function public.set_employee_note_visible(
  p_organization_id uuid,
  p_note_id uuid,
  p_visible boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_scope(p_organization_id, 'employees') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.employee_notes
  set visible_to_employee = coalesce(p_visible, false)
  where id = p_note_id
    and organization_id = p_organization_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.delete_employee_note(p_organization_id uuid, p_note_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_scope(p_organization_id, 'employees') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.employee_notes
  where id = p_note_id
    and organization_id = p_organization_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.save_employee_profile(uuid, text, text, text, text, text) from public;
revoke all on function public.save_employee_week(uuid, jsonb) from public;
revoke all on function public.save_employee_exception(uuid, date, boolean, time, time) from public;
revoke all on function public.delete_employee_exception(uuid, uuid) from public;
revoke all on function public.add_employee_note(uuid, uuid, text, text, boolean) from public;
revoke all on function public.set_employee_note_visible(uuid, uuid, boolean) from public;
revoke all on function public.delete_employee_note(uuid, uuid) from public;

grant execute on function public.save_employee_profile(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.save_employee_week(uuid, jsonb) to authenticated;
grant execute on function public.save_employee_exception(uuid, date, boolean, time, time) to authenticated;
grant execute on function public.delete_employee_exception(uuid, uuid) to authenticated;
grant execute on function public.add_employee_note(uuid, uuid, text, text, boolean) to authenticated;
grant execute on function public.set_employee_note_visible(uuid, uuid, boolean) to authenticated;
grant execute on function public.delete_employee_note(uuid, uuid) to authenticated;
