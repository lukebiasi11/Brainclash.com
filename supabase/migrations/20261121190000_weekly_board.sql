-- Weekly nickname board. Adds a nullable device id and a Monday–Sunday
-- read. It does not update existing board rows, and it does not read or
-- write the field score tables or the collection view.
-- The week uses the same New York day as the daily board. Days are linked
-- by device_id, not by the nickname text. retain_board_names() also clears
-- device_id after 90 days. This file does not enable pg_cron and does not
-- schedule that job.

alter table private.board_post add column if not exists device_id uuid;

create unique index if not exists board_post_day_device_uidx
  on private.board_post (day_key, device_id)
  where device_id is not null;

create index if not exists board_post_device_idx
  on private.board_post (device_id)
  where device_id is not null and display_name is not null;

create or replace function private.board_ny_day(p_at timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select (timezone('America/New_York', p_at))::date;
$$;

create or replace function private.board_week_bounds(p_day date)
returns table (week_start date, week_end date)
language sql
immutable
set search_path = ''
as $$
  select (p_day - (extract(isodow from p_day)::int - 1)),
         (p_day - (extract(isodow from p_day)::int - 1) + 6);
$$;

drop function if exists private.board_post(uuid, date, text, int[]);

create or replace function private.board_post(p_uid uuid, p_day date, p_name text, p_scores int[], p_device uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name jsonb;
  v_clean text;
  v_total int;
  v_row private.board_post%rowtype;
  v_delta int[];
  v_device uuid := p_device;
begin
  if p_uid is null or p_day is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;
  if not private.board_scores_ok(p_scores) then
    return jsonb_build_object('ok', false, 'error', 'scores');
  end if;
  v_name := private.board_name_status(p_name);
  if coalesce((v_name ->> 'ok')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'error', 'name_rejected', 'reason', v_name ->> 'reason');
  end if;
  if coalesce((v_name ->> 'skip')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'name_required');
  end if;
  v_clean := v_name ->> 'name';
  v_total := p_scores[1] + p_scores[2] + p_scores[3] + p_scores[4] + p_scores[5];
  if v_device is not null and exists (
    select 1 from private.board_post
    where day_key = p_day and device_id = v_device and auth_uid is distinct from p_uid
  ) then
    v_device := null;
  end if;
  select * into v_row from private.board_post where day_key = p_day and auth_uid = p_uid;
  if v_row.id is not null then
    if v_row.display_name is null or v_row.removed_at is not null or v_row.name_hidden_at is not null then
      return jsonb_build_object('ok', true, 'hidden', true);
    end if;
    v_delta := array[
      p_scores[1] - v_row.scores[1],
      p_scores[2] - v_row.scores[2],
      p_scores[3] - v_row.scores[3],
      p_scores[4] - v_row.scores[4],
      p_scores[5] - v_row.scores[5]
    ];
    update private.board_post
      set display_name = v_clean,
          scores = p_scores,
          total = v_total,
          device_id = coalesce(device_id, v_device)
      where id = v_row.id;
    perform private.board_add_agg(p_day, 0, v_total - v_row.total, v_delta);
    return jsonb_build_object('ok', true, 'idempotent', true, 'total', v_total);
  end if;
  insert into private.board_post (day_key, auth_uid, display_name, scores, total, device_id)
  values (p_day, p_uid, v_clean, p_scores, v_total, v_device);
  perform private.board_add_agg(p_day, 1, v_total, p_scores);
  return jsonb_build_object('ok', true, 'idempotent', false, 'total', v_total);
end;
$$;

create or replace function private.board_week_public(p_today date, p_section text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_section text := coalesce(p_section, '');
  v_start date;
  v_end date;
  v_rows jsonb;
begin
  if v_section not in ('overall', 'world', 'history', 'sports', 'word', 'think') then
    return jsonb_build_object('ok', false, 'error', 'invalid_section', 'served', false, 'span', 'week', 'rows', '[]'::jsonb);
  end if;
  if p_today is null then
    return jsonb_build_object('ok', true, 'served', false, 'span', 'week', 'section', v_section, 'rows', '[]'::jsonb);
  end if;
  select b.week_start, b.week_end into v_start, v_end
  from private.board_week_bounds(p_today) as b;
  -- Current week is inside the 30-day window. The predicate stays so a day
  -- older than 30 days cannot be summed even if the bounds ever widen.
  -- think is category slot 5, so a week that spans Think Fast and Eagle Eye
  -- still adds that slot. The list is the full board, capped at 100 like
  -- the daily board, not a top 10.
  if v_end < p_today - 30 then
    return jsonb_build_object('ok', true, 'served', false, 'span', 'week', 'section', v_section, 'from', v_start, 'to', v_end, 'rows', '[]'::jsonb);
  end if;
  with visible as (
    select p.id, p.device_id, p.display_name, p.day_key, p.posted_at, p.scores, p.total
    from private.board_post p
    where p.device_id is not null
      and p.display_name is not null
      and p.removed_at is null
      and p.name_hidden_at is null
      and p.day_key >= v_start
      and p.day_key <= least(v_end, p_today)
      and p.day_key >= p_today - 30
  ),
  named as (
    select distinct on (v.device_id) v.device_id, v.display_name
    from visible v
    order by v.device_id, v.day_key desc, v.posted_at desc, v.id desc
  ),
  scored as (
    select n.device_id, n.display_name,
      sum(
        case v_section
          when 'world' then v.scores[1]
          when 'history' then v.scores[2]
          when 'sports' then v.scores[3]
          when 'word' then v.scores[4]
          when 'think' then v.scores[5]
          else v.total
        end
      )::int as score
    from visible v
    join named n on n.device_id = v.device_id
    group by n.device_id, n.display_name
  )
  select coalesce(jsonb_agg(jsonb_build_object('rank', place, 'name', display_name, 'score', score) order by place), '[]'::jsonb)
    into v_rows
  from (
    select display_name, score,
      rank() over (order by score desc, display_name asc, device_id asc) as place
    from scored
    order by score desc, display_name asc, device_id asc
    limit 100
  ) ranked;
  return jsonb_build_object(
    'ok', true,
    'served', true,
    'span', 'week',
    'from', v_start,
    'to', v_end,
    'section', v_section,
    'rows', v_rows
  );
end;
$$;

create or replace function private.board_week(p_section text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.board_week_public((timezone('America/New_York', now()))::date, p_section);
$$;

create or replace function private.board_rename(p_id uuid, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name jsonb;
  v_clean text;
  v_device uuid;
  v_n int;
begin
  if p_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;
  v_name := private.board_name_status(p_name);
  if coalesce((v_name ->> 'ok')::boolean, false) is not true or coalesce((v_name ->> 'skip')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'name_rejected', 'reason', coalesce(v_name ->> 'reason', 'length'));
  end if;
  v_clean := v_name ->> 'name';
  select device_id into v_device
  from private.board_post
  where id = p_id and display_name is not null and removed_at is null and name_hidden_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_device is null then
    update private.board_post
      set display_name = v_clean
      where id = p_id and display_name is not null and removed_at is null and name_hidden_at is null;
  else
    update private.board_post
      set display_name = v_clean
      where device_id = v_device
        and display_name is not null
        and removed_at is null
        and name_hidden_at is null;
  end if;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return jsonb_build_object('ok', true, 'name', v_clean);
end;
$$;

create or replace function private.retain_board_names()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  update private.board_post
    set display_name = null,
        device_id = null,
        name_hidden_at = coalesce(name_hidden_at, now())
    where posted_at < now() - interval '90 days'
      and (display_name is not null or device_id is not null);
  get diagnostics v_n = row_count;
  delete from private.board_rate where window_start < now() - interval '7 days';
  return v_n;
end;
$$;

revoke all on function
  private.board_ny_day(timestamptz),
  private.board_week_bounds(date),
  private.board_week_public(date, text),
  private.board_week(text),
  private.board_post(uuid, date, text, int[], uuid)
  from public, anon, authenticated, app_writer, field_runtime, board_retention;
revoke all on function
  private.board_ny_day(timestamptz),
  private.board_week_bounds(date),
  private.board_week_public(date, text)
  from board_runtime;
grant execute on function
  private.board_week(text),
  private.board_post(uuid, date, text, int[], uuid)
  to board_runtime;
