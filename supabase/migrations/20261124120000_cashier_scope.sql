-- Cashier is a catalog scope with no page of its own.
-- A cashier shift can only be given to someone who holds it.

insert into public.scopes (key, description)
values ('cashier', 'Can be scheduled as a cashier.')
on conflict (key) do update
set description = excluded.description;

alter table public.schedule_shifts drop constraint if exists schedule_shifts_kind;
alter table public.schedule_shifts
  add constraint schedule_shifts_kind check (kind in ('cash', 'tournament', 'cashier'));

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
    or p_kind not in ('cash', 'tournament', 'cashier')
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

  if p_kind = 'cashier' and not exists (
    select 1
    from public.organization_members as member
    where member.organization_id = p_organization_id
      and member.user_id = p_user_id
      and member.status = 'active'
      and (
        member.is_owner
        or exists (
          select 1
          from public.role_scopes as granted
          where granted.role_id = member.role_id
            and granted.scope_key = 'cashier'
        )
        or exists (
          select 1
          from public.member_scopes as extra
          where extra.organization_id = member.organization_id
            and extra.user_id = member.user_id
            and extra.scope_key = 'cashier'
        )
      )
  ) then
    raise exception 'cashier' using errcode = '22023';
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
