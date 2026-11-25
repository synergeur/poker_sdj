-- Working shifts drawn on the schedule. Cash and tournament cannot overlap for one employee on one day.

create table if not exists public.schedule_shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  work_date date not null,
  kind text not null,
  start_minutes integer not null,
  end_minutes integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_shifts_kind check (kind in ('cash', 'tournament')),
  constraint schedule_shifts_range check (
    start_minutes >= 0
    and end_minutes <= 1080
    and end_minutes - start_minutes >= 30
    and start_minutes % 15 = 0
    and end_minutes % 15 = 0
  )
);

create index if not exists schedule_shifts_org_day_idx
  on public.schedule_shifts (organization_id, work_date, user_id);

alter table public.schedule_shifts enable row level security;

drop policy if exists schedule_shifts_select on public.schedule_shifts;
create policy schedule_shifts_select
on public.schedule_shifts
for select
to authenticated
using (public.has_scope(organization_id, 'schedule'));

grant select on public.schedule_shifts to authenticated;

create or replace function public.add_schedule_shift(
  p_organization_id uuid,
  p_id uuid,
  p_user_id uuid,
  p_work_date date,
  p_kind text,
  p_start_minutes integer,
  p_end_minutes integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := coalesce(p_id, gen_random_uuid());
begin
  if auth.uid() is null or not public.has_scope(p_organization_id, 'schedule') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not public.schedule_shift_fits(p_organization_id, v_id, p_user_id, p_work_date, p_kind, p_start_minutes, p_end_minutes) then
    return null;
  end if;

  insert into public.schedule_shifts (
    id, organization_id, user_id, work_date, kind, start_minutes, end_minutes
  )
  values (
    v_id, p_organization_id, p_user_id, p_work_date, p_kind, p_start_minutes, p_end_minutes
  );

  return public.schedule_shift_json(v_id, p_user_id, p_work_date, p_kind, p_start_minutes, p_end_minutes);
end;
$$;

create or replace function public.move_schedule_shift(
  p_organization_id uuid,
  p_id uuid,
  p_user_id uuid,
  p_work_date date,
  p_kind text,
  p_start_minutes integer,
  p_end_minutes integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_scope(p_organization_id, 'schedule') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.schedule_shifts
    where id = p_id and organization_id = p_organization_id
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not public.schedule_shift_fits(p_organization_id, p_id, p_user_id, p_work_date, p_kind, p_start_minutes, p_end_minutes) then
    return null;
  end if;

  update public.schedule_shifts
  set user_id = p_user_id,
      work_date = p_work_date,
      kind = p_kind,
      start_minutes = p_start_minutes,
      end_minutes = p_end_minutes,
      updated_at = now()
  where id = p_id
    and organization_id = p_organization_id;

  return public.schedule_shift_json(p_id, p_user_id, p_work_date, p_kind, p_start_minutes, p_end_minutes);
end;
$$;

create or replace function public.delete_schedule_shift(
  p_organization_id uuid,
  p_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_scope(p_organization_id, 'schedule') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  delete from public.schedule_shifts
  where id = p_id
    and organization_id = p_organization_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.schedule_shift_fits(
  p_organization_id uuid,
  p_id uuid,
  p_user_id uuid,
  p_work_date date,
  p_kind text,
  p_start_minutes integer,
  p_end_minutes integer
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_work_date is null
    or p_kind not in ('cash', 'tournament')
    or p_start_minutes is null
    or p_end_minutes is null
    or p_start_minutes < 0
    or p_end_minutes > 1080
    or p_end_minutes - p_start_minutes < 30
    or p_start_minutes % 15 <> 0
    or p_end_minutes % 15 <> 0
    or not exists (
      select 1
      from public.organization_members
      where organization_id = p_organization_id
        and user_id = p_user_id
        and status = 'active'
    )
  then
    raise exception 'range' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.schedule_shifts
    where organization_id = p_organization_id
      and user_id = p_user_id
      and work_date = p_work_date
      and id is distinct from p_id
      and start_minutes < p_end_minutes
      and end_minutes > p_start_minutes
  ) then
    raise exception 'overlap' using errcode = '22023';
  end if;

  return true;
end;
$$;

create or replace function public.schedule_shift_json(
  p_id uuid,
  p_user_id uuid,
  p_work_date date,
  p_kind text,
  p_start_minutes integer,
  p_end_minutes integer
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'id', p_id,
    'user_id', p_user_id,
    'work_date', p_work_date,
    'kind', p_kind,
    'start_minutes', p_start_minutes,
    'end_minutes', p_end_minutes
  );
$$;

revoke all on function public.add_schedule_shift(uuid, uuid, uuid, date, text, integer, integer) from public;
revoke all on function public.move_schedule_shift(uuid, uuid, uuid, date, text, integer, integer) from public;
revoke all on function public.delete_schedule_shift(uuid, uuid) from public;
revoke all on function public.schedule_shift_fits(uuid, uuid, uuid, date, text, integer, integer) from public;
revoke all on function public.schedule_shift_json(uuid, uuid, date, text, integer, integer) from public;

grant execute on function public.add_schedule_shift(uuid, uuid, uuid, date, text, integer, integer) to authenticated;
grant execute on function public.move_schedule_shift(uuid, uuid, uuid, date, text, integer, integer) to authenticated;
grant execute on function public.delete_schedule_shift(uuid, uuid) to authenticated;
