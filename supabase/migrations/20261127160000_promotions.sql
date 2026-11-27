-- Promotions are separate from each other. A month keeps its own rules and its own log.

insert into public.scopes (key, description)
values (
  'promotions',
  'Create promotions and log their payouts.'
)
on conflict (key) do update
set description = excluded.description;

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  kind text not null,
  starts_on date not null,
  ends_on date not null,
  climb_mode text,
  start_amount numeric(12, 2),
  climb_amount numeric(12, 2),
  created_at timestamptz not null default now(),
  constraint promotions_name_len check (char_length(name) between 1 and 80),
  constraint promotions_kind check (kind in ('instant', 'cumulative')),
  constraint promotions_dates check (ends_on >= starts_on and ends_on - starts_on <= 61),
  constraint promotions_climb check (
    (
      kind = 'instant'
      and climb_mode is null
      and start_amount is null
      and climb_amount is null
    )
    or (
      kind = 'cumulative'
      and climb_mode in ('steady', 'daily')
      and start_amount is not null
      and climb_amount is not null
      and start_amount >= 0
      and start_amount <= 999999.99
      and climb_amount >= 0
      and climb_amount <= 999999.99
    )
  )
);

create table if not exists public.promotion_requirements (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  position integer not null,
  label text not null,
  payout numeric(12, 2),
  applies_on date,
  constraint promotion_requirements_label_len check (char_length(label) between 1 and 80),
  constraint promotion_requirements_position check (position >= 0 and position < 62),
  constraint promotion_requirements_payout check (payout is null or (payout >= 0 and payout <= 999999.99)),
  unique (promotion_id, position)
);

create unique index if not exists promotion_requirements_day_idx
  on public.promotion_requirements (promotion_id, applies_on)
  where applies_on is not null;

create table if not exists public.promotion_entries (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  requirement_id uuid references public.promotion_requirements (id) on delete restrict,
  entered_on date not null,
  entered_at time not null,
  won boolean not null default false,
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotion_entries_comment_len check (char_length(comment) <= 500)
);

create index if not exists promotions_org_idx
  on public.promotions (organization_id, starts_on desc);

create index if not exists promotion_entries_promo_idx
  on public.promotion_entries (promotion_id, entered_on desc, entered_at desc);

alter table public.promotions enable row level security;
alter table public.promotion_requirements enable row level security;
alter table public.promotion_entries enable row level security;

drop policy if exists promotions_select on public.promotions;
create policy promotions_select
on public.promotions
for select
to authenticated
using (public.has_scope(organization_id, 'promotions'));

drop policy if exists promotion_requirements_select on public.promotion_requirements;
create policy promotion_requirements_select
on public.promotion_requirements
for select
to authenticated
using (public.has_scope(organization_id, 'promotions'));

drop policy if exists promotion_entries_select on public.promotion_entries;
create policy promotion_entries_select
on public.promotion_entries
for select
to authenticated
using (public.has_scope(organization_id, 'promotions'));

grant select on public.promotions to authenticated;
grant select on public.promotion_requirements to authenticated;
grant select on public.promotion_entries to authenticated;

insert into public.role_scopes (role_id, scope_key)
select role.id, 'promotions'
from public.roles as role
where role.name = 'Poker superviseur'
  and role.organization_id is not null
on conflict do nothing;

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
    (v_role_id, 'badbeat_stats'),
    (v_role_id, 'promotions')
  on conflict do nothing;

  return v_role_id;
end;
$$;

create or replace function public.promotion_payload(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', promotion.id,
    'name', promotion.name,
    'kind', promotion.kind,
    'starts_on', promotion.starts_on,
    'ends_on', promotion.ends_on,
    'climb_mode', promotion.climb_mode,
    'start_amount', promotion.start_amount,
    'climb_amount', promotion.climb_amount,
    'requirements', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', requirement.id,
          'label', requirement.label,
          'payout', requirement.payout,
          'applies_on', requirement.applies_on,
          'position', requirement.position
        )
        order by requirement.position
      )
      from public.promotion_requirements as requirement
      where requirement.promotion_id = promotion.id
    ), '[]'::jsonb)
  )
  from public.promotions as promotion
  where promotion.id = p_id;
$$;

create or replace function public.create_promotion(
  p_organization_id uuid,
  p_name text,
  p_kind text,
  p_starts_on date,
  p_ends_on date,
  p_climb_mode text,
  p_start_amount numeric,
  p_climb_amount numeric,
  p_requirements jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
  v_item jsonb;
  v_label text;
  v_payout numeric;
  v_day date;
  v_position integer := 0;
  v_count integer;
  v_days integer;
  v_seen date[] := '{}';
begin
  if auth.uid() is null or not public.has_scope(p_organization_id, 'promotions') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_starts_on is null
    or p_ends_on is null
    or p_ends_on < p_starts_on
    or p_ends_on - p_starts_on > 61
    or char_length(v_name) < 1
    or char_length(v_name) > 80
    or p_kind not in ('instant', 'cumulative')
    or jsonb_typeof(p_requirements) is distinct from 'array'
  then
    raise exception 'invalid' using errcode = '22023';
  end if;

  v_count := jsonb_array_length(p_requirements);
  v_days := (p_ends_on - p_starts_on) + 1;

  if p_kind = 'instant' then
    if p_climb_mode is not null or p_start_amount is not null or p_climb_amount is not null or v_count < 1 or v_count > 20 then
      raise exception 'invalid' using errcode = '22023';
    end if;
  elsif p_climb_mode not in ('steady', 'daily')
    or p_start_amount is null
    or p_climb_amount is null
    or p_start_amount < 0
    or p_start_amount > 999999.99
    or p_climb_amount < 0
    or p_climb_amount > 999999.99
    or (p_climb_mode = 'steady' and v_count <> 1)
    or (p_climb_mode = 'daily' and v_count <> v_days)
  then
    raise exception 'invalid' using errcode = '22023';
  end if;

  insert into public.promotions (
    organization_id, name, kind, starts_on, ends_on, climb_mode, start_amount, climb_amount
  )
  values (
    p_organization_id,
    v_name,
    p_kind,
    p_starts_on,
    p_ends_on,
    case when p_kind = 'cumulative' then p_climb_mode else null end,
    case when p_kind = 'cumulative' then round(p_start_amount, 2) else null end,
    case when p_kind = 'cumulative' then round(p_climb_amount, 2) else null end
  )
  returning id into v_id;

  for v_item in select value from jsonb_array_elements(p_requirements)
  loop
    v_label := btrim(coalesce(v_item->>'label', ''));
    if char_length(v_label) < 1 or char_length(v_label) > 80 then
      raise exception 'invalid' using errcode = '22023';
    end if;

    if p_kind = 'instant' then
      if coalesce(v_item->>'applies_on', '') <> ''
        or coalesce(v_item->>'payout', '') !~ '^[0-9]+(\.[0-9]{1,2})?$'
      then
        raise exception 'invalid' using errcode = '22023';
      end if;
      v_payout := round((v_item->>'payout')::numeric, 2);
      v_day := null;
    else
      if coalesce(v_item->>'payout', '') <> '' then
        raise exception 'invalid' using errcode = '22023';
      end if;
      v_payout := null;
      if p_climb_mode = 'daily' then
        if coalesce(v_item->>'applies_on', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
          raise exception 'invalid' using errcode = '22023';
        end if;
        v_day := (v_item->>'applies_on')::date;
        if v_day < p_starts_on or v_day > p_ends_on or v_day = any(v_seen) then
          raise exception 'invalid' using errcode = '22023';
        end if;
        v_seen := v_seen || v_day;
      else
        if coalesce(v_item->>'applies_on', '') <> '' then
          raise exception 'invalid' using errcode = '22023';
        end if;
        v_day := null;
      end if;
    end if;

    insert into public.promotion_requirements (promotion_id, organization_id, position, label, payout, applies_on)
    values (v_id, p_organization_id, v_position, v_label, v_payout, v_day);
    v_position := v_position + 1;
  end loop;

  if p_kind = 'cumulative' and p_climb_mode = 'daily' and coalesce(array_length(v_seen, 1), 0) <> v_days then
    raise exception 'invalid' using errcode = '22023';
  end if;

  return public.promotion_payload(v_id);
end;
$$;

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

create or replace function public.add_promotion_entry(
  p_organization_id uuid,
  p_promotion_id uuid,
  p_entered_on date,
  p_entered_at time,
  p_requirement_id uuid,
  p_won boolean,
  p_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promotion public.promotions%rowtype;
  v_requirement public.promotion_requirements%rowtype;
  v_comment text := btrim(coalesce(p_comment, ''));
  v_won boolean;
  v_id uuid;
  v_created timestamptz;
begin
  if auth.uid() is null or not public.has_scope(p_organization_id, 'promotions') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_promotion
  from public.promotions
  where id = p_promotion_id
    and organization_id = p_organization_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select * into v_requirement
  from public.promotion_requirements
  where id = p_requirement_id
    and promotion_id = v_promotion.id;
  if not found
    or p_entered_on is null
    or p_entered_at is null
    or p_entered_on < v_promotion.starts_on
    or p_entered_on > v_promotion.ends_on
    or char_length(v_comment) > 500
  then
    raise exception 'invalid' using errcode = '22023';
  end if;

  if v_promotion.kind = 'instant' then
    if v_requirement.payout is null then
      raise exception 'invalid' using errcode = '22023';
    end if;
    v_won := true;
  elsif v_promotion.climb_mode = 'daily' then
    if v_requirement.applies_on is distinct from p_entered_on then
      raise exception 'invalid' using errcode = '22023';
    end if;
    v_won := coalesce(p_won, false);
  else
    if v_requirement.applies_on is not null then
      raise exception 'invalid' using errcode = '22023';
    end if;
    v_won := coalesce(p_won, false);
  end if;

  insert into public.promotion_entries (
    promotion_id, organization_id, requirement_id, entered_on, entered_at, won, comment
  )
  values (
    v_promotion.id, p_organization_id, v_requirement.id, p_entered_on, p_entered_at, v_won, v_comment
  )
  returning id, created_at into v_id, v_created;

  return jsonb_build_object(
    'id', v_id,
    'promotion_id', v_promotion.id,
    'requirement_id', v_requirement.id,
    'entered_on', p_entered_on,
    'entered_at', to_char(p_entered_at, 'HH24:MI'),
    'won', v_won,
    'comment', v_comment,
    'created_at', v_created
  );
end;
$$;

create or replace function public.update_promotion_entry(
  p_organization_id uuid,
  p_id uuid,
  p_promotion_id uuid,
  p_entered_on date,
  p_entered_at time,
  p_requirement_id uuid,
  p_won boolean,
  p_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promotion public.promotions%rowtype;
  v_requirement public.promotion_requirements%rowtype;
  v_comment text := btrim(coalesce(p_comment, ''));
  v_won boolean;
begin
  if auth.uid() is null or not public.has_scope(p_organization_id, 'promotions') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.promotion_entries
    where id = p_id
      and promotion_id = p_promotion_id
      and organization_id = p_organization_id
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select * into v_promotion
  from public.promotions
  where id = p_promotion_id
    and organization_id = p_organization_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select * into v_requirement
  from public.promotion_requirements
  where id = p_requirement_id
    and promotion_id = v_promotion.id;
  if not found
    or p_entered_on is null
    or p_entered_at is null
    or p_entered_on < v_promotion.starts_on
    or p_entered_on > v_promotion.ends_on
    or char_length(v_comment) > 500
  then
    raise exception 'invalid' using errcode = '22023';
  end if;

  if v_promotion.kind = 'instant' then
    if v_requirement.payout is null then
      raise exception 'invalid' using errcode = '22023';
    end if;
    v_won := true;
  elsif v_promotion.climb_mode = 'daily' then
    if v_requirement.applies_on is distinct from p_entered_on then
      raise exception 'invalid' using errcode = '22023';
    end if;
    v_won := coalesce(p_won, false);
  else
    v_won := coalesce(p_won, false);
  end if;

  update public.promotion_entries
  set requirement_id = v_requirement.id,
      entered_on = p_entered_on,
      entered_at = p_entered_at,
      won = v_won,
      comment = v_comment,
      updated_at = now()
  where id = p_id;

  return jsonb_build_object(
    'id', p_id,
    'promotion_id', v_promotion.id,
    'requirement_id', v_requirement.id,
    'entered_on', p_entered_on,
    'entered_at', to_char(p_entered_at, 'HH24:MI'),
    'won', v_won,
    'comment', v_comment,
    'created_at', (select created_at from public.promotion_entries where id = p_id)
  );
end;
$$;

create or replace function public.delete_promotion_entry(
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

  delete from public.promotion_entries
  where id = p_id
    and organization_id = p_organization_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.ensure_poker_supervisor_role(uuid) from public;
revoke all on function public.promotion_payload(uuid) from public;
revoke all on function public.create_promotion(uuid, text, text, date, date, text, numeric, numeric, jsonb) from public;
revoke all on function public.delete_promotion(uuid, uuid) from public;
revoke all on function public.add_promotion_entry(uuid, uuid, date, time, uuid, boolean, text) from public;
revoke all on function public.update_promotion_entry(uuid, uuid, uuid, date, time, uuid, boolean, text) from public;
revoke all on function public.delete_promotion_entry(uuid, uuid) from public;

grant execute on function public.ensure_poker_supervisor_role(uuid) to authenticated;
grant execute on function public.create_promotion(uuid, text, text, date, date, text, numeric, numeric, jsonb) to authenticated;
grant execute on function public.delete_promotion(uuid, uuid) to authenticated;
grant execute on function public.add_promotion_entry(uuid, uuid, date, time, uuid, boolean, text) to authenticated;
grant execute on function public.update_promotion_entry(uuid, uuid, uuid, date, time, uuid, boolean, text) to authenticated;
grant execute on function public.delete_promotion_entry(uuid, uuid) to authenticated;
