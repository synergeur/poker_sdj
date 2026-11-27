-- Best hand of the day. The night supervisor either pays the player on the spot
-- or leaves a name and phone for the morning supervisor to call.

alter table public.promotions drop constraint if exists promotions_kind;
alter table public.promotions
  add constraint promotions_kind check (kind in ('instant', 'cumulative', 'besthand'));

alter table public.promotions drop constraint if exists promotions_climb;
alter table public.promotions
  add constraint promotions_climb check (
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
    or (
      kind = 'besthand'
      and climb_mode is null
      and start_amount is null
      and climb_amount is null
    )
  );

alter table public.promotion_entries
  add column if not exists player_name text not null default '',
  add column if not exists player_phone text not null default '',
  add column if not exists hand text not null default '',
  add column if not exists settle text;

alter table public.promotion_entries drop constraint if exists promotion_entries_player_len;
alter table public.promotion_entries
  add constraint promotion_entries_player_len check (char_length(player_name) <= 80);

alter table public.promotion_entries drop constraint if exists promotion_entries_phone_len;
alter table public.promotion_entries
  add constraint promotion_entries_phone_len check (char_length(player_phone) <= 40);

alter table public.promotion_entries drop constraint if exists promotion_entries_hand_len;
alter table public.promotion_entries
  add constraint promotion_entries_hand_len check (char_length(hand) <= 120);

alter table public.promotion_entries drop constraint if exists promotion_entries_settle;
alter table public.promotion_entries
  add constraint promotion_entries_settle check (settle is null or settle in ('tonight', 'call', 'settled'));

create unique index if not exists promotion_entries_besthand_day_idx
  on public.promotion_entries (promotion_id, entered_on)
  where settle is not null;

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
    or p_kind not in ('instant', 'cumulative', 'besthand')
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
  elsif p_kind = 'besthand' then
    if p_climb_mode is not null or p_start_amount is not null or p_climb_amount is not null or v_count <> 1 then
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

    if p_kind in ('instant', 'besthand') then
      if coalesce(v_item->>'applies_on', '') <> ''
        or coalesce(v_item->>'payout', '') !~ '^[0-9]+(\.[0-9]{1,2})?$'
      then
        raise exception 'invalid' using errcode = '22023';
      end if;
      v_payout := round((v_item->>'payout')::numeric, 2);
      if v_payout < 0 or v_payout > 999999.99 then
        raise exception 'invalid' using errcode = '22023';
      end if;
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

drop function if exists public.add_promotion_entry(uuid, uuid, date, time, uuid, boolean, text);
drop function if exists public.update_promotion_entry(uuid, uuid, uuid, date, time, uuid, boolean, text);

create or replace function public.add_promotion_entry(
  p_organization_id uuid,
  p_promotion_id uuid,
  p_entered_on date,
  p_entered_at time,
  p_requirement_id uuid,
  p_won boolean,
  p_comment text,
  p_player_name text,
  p_player_phone text,
  p_hand text,
  p_settle text
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
  v_player text := btrim(coalesce(p_player_name, ''));
  v_phone text := btrim(coalesce(p_player_phone, ''));
  v_hand text := btrim(coalesce(p_hand, ''));
  v_settle text := nullif(btrim(coalesce(p_settle, '')), '');
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

  if v_promotion.kind = 'besthand' then
    if v_requirement.payout is null
      or v_settle not in ('tonight', 'call')
      or char_length(v_player) < 1
      or char_length(v_player) > 80
      or char_length(v_hand) < 1
      or char_length(v_hand) > 120
      or char_length(v_phone) > 40
      or (v_settle = 'call' and char_length(v_phone) < 1)
    then
      raise exception 'invalid' using errcode = '22023';
    end if;
    if exists (
      select 1
      from public.promotion_entries
      where promotion_id = v_promotion.id
        and entered_on = p_entered_on
    ) then
      raise exception 'taken' using errcode = 'P0001';
    end if;
    v_won := v_settle = 'tonight';
  elsif v_promotion.kind = 'instant' then
    if v_requirement.payout is null then
      raise exception 'invalid' using errcode = '22023';
    end if;
    v_won := true;
    v_player := '';
    v_phone := '';
    v_hand := '';
    v_settle := null;
  elsif v_promotion.climb_mode = 'daily' then
    if v_requirement.applies_on is distinct from p_entered_on then
      raise exception 'invalid' using errcode = '22023';
    end if;
    v_won := coalesce(p_won, false);
    v_player := '';
    v_phone := '';
    v_hand := '';
    v_settle := null;
  else
    if v_requirement.applies_on is not null then
      raise exception 'invalid' using errcode = '22023';
    end if;
    v_won := coalesce(p_won, false);
    v_player := '';
    v_phone := '';
    v_hand := '';
    v_settle := null;
  end if;

  insert into public.promotion_entries (
    promotion_id, organization_id, requirement_id, entered_on, entered_at, won, comment, player_name, player_phone, hand, settle
  )
  values (
    v_promotion.id, p_organization_id, v_requirement.id, p_entered_on, p_entered_at, v_won, v_comment, v_player, v_phone, v_hand, v_settle
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
    'player_name', v_player,
    'player_phone', v_phone,
    'hand', v_hand,
    'settle', v_settle,
    'created_at', v_created
  );
exception
  when unique_violation then
    raise exception 'taken' using errcode = 'P0001';
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
  p_comment text,
  p_player_name text,
  p_player_phone text,
  p_hand text,
  p_settle text
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
  v_player text := btrim(coalesce(p_player_name, ''));
  v_phone text := btrim(coalesce(p_player_phone, ''));
  v_hand text := btrim(coalesce(p_hand, ''));
  v_settle text := nullif(btrim(coalesce(p_settle, '')), '');
  v_won boolean;
  v_created timestamptz;
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

  if v_promotion.kind = 'besthand' then
    if v_requirement.payout is null
      or v_settle not in ('tonight', 'call', 'settled')
      or char_length(v_player) < 1
      or char_length(v_player) > 80
      or char_length(v_hand) < 1
      or char_length(v_hand) > 120
      or char_length(v_phone) > 40
      or (v_settle = 'call' and char_length(v_phone) < 1)
    then
      raise exception 'invalid' using errcode = '22023';
    end if;
    if exists (
      select 1
      from public.promotion_entries
      where promotion_id = v_promotion.id
        and entered_on = p_entered_on
        and id <> p_id
    ) then
      raise exception 'taken' using errcode = 'P0001';
    end if;
    v_won := v_settle in ('tonight', 'settled');
  elsif v_promotion.kind = 'instant' then
    if v_requirement.payout is null then
      raise exception 'invalid' using errcode = '22023';
    end if;
    v_won := true;
    v_player := '';
    v_phone := '';
    v_hand := '';
    v_settle := null;
  elsif v_promotion.climb_mode = 'daily' then
    if v_requirement.applies_on is distinct from p_entered_on then
      raise exception 'invalid' using errcode = '22023';
    end if;
    v_won := coalesce(p_won, false);
    v_player := '';
    v_phone := '';
    v_hand := '';
    v_settle := null;
  else
    v_won := coalesce(p_won, false);
    v_player := '';
    v_phone := '';
    v_hand := '';
    v_settle := null;
  end if;

  update public.promotion_entries
  set requirement_id = v_requirement.id,
      entered_on = p_entered_on,
      entered_at = p_entered_at,
      won = v_won,
      comment = v_comment,
      player_name = v_player,
      player_phone = v_phone,
      hand = v_hand,
      settle = v_settle,
      updated_at = now()
  where id = p_id
  returning created_at into v_created;

  return jsonb_build_object(
    'id', p_id,
    'promotion_id', v_promotion.id,
    'requirement_id', v_requirement.id,
    'entered_on', p_entered_on,
    'entered_at', to_char(p_entered_at, 'HH24:MI'),
    'won', v_won,
    'comment', v_comment,
    'player_name', v_player,
    'player_phone', v_phone,
    'hand', v_hand,
    'settle', v_settle,
    'created_at', v_created
  );
exception
  when unique_violation then
    raise exception 'taken' using errcode = 'P0001';
end;
$$;

revoke all on function public.add_promotion_entry(uuid, uuid, date, time, uuid, boolean, text, text, text, text, text) from public;
revoke all on function public.update_promotion_entry(uuid, uuid, uuid, date, time, uuid, boolean, text, text, text, text, text) from public;
grant execute on function public.add_promotion_entry(uuid, uuid, date, time, uuid, boolean, text, text, text, text, text) to authenticated;
grant execute on function public.update_promotion_entry(uuid, uuid, uuid, date, time, uuid, boolean, text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
