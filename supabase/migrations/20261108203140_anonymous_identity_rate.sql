-- Identity is the verified auth uid passed by the Edge function after getClaims.
-- Config moves to private. The public view projects only booleans, not the contact.
-- Rate rows are technical and expire after 7 days. Scores, dedup, and aggregates do not.
-- Abuse ceilings are not a claim that a score was earned or that a person is unique.

drop function if exists private.start_run(uuid, date, text);
drop function if exists private.finish_run(uuid, date, text, int[]);
drop function if exists private.day_snapshot(date, uuid);
drop function if exists private.deletion_request(uuid);
drop function if exists private.collection_on();

drop view if exists public.collection_status;
create table private.field_gate (
  id int primary key check (id = 1),
  collection_enabled boolean not null default false,
  operator_contact text,
  min_other_finishes int check (min_other_finishes is null or min_other_finishes >= 0)
);
insert into private.field_gate (id, collection_enabled, operator_contact, min_other_finishes)
select id, collection_enabled, operator_contact, min_other_finishes from public.field_gate;
drop table public.field_gate;
alter table private.field_gate enable row level security;
revoke all on table private.field_gate from public, anon, authenticated, app_writer;

create view public.collection_status
with (security_invoker = false) as
select collection_enabled,
       (operator_contact is not null) as contact_configured,
       (min_other_finishes is not null) as threshold_configured
from private.field_gate
where id = 1;
grant select on public.collection_status to anon, authenticated;

alter table private.attempts drop column player_day_hash;
alter table private.attempts add column auth_uid uuid not null;
alter table private.runs drop column player_day_hash;
alter table private.runs add column auth_uid uuid not null;
alter table private.runs add constraint runs_day_uid unique (day_key, auth_uid);
alter table private.dedup drop column player_day_hash;
alter table private.dedup add column auth_uid uuid not null;

create table private.rate_window (
  bucket text primary key,
  window_start timestamptz not null,
  n int not null
);
alter table private.rate_window enable row level security;
revoke all on table private.rate_window from public, anon, authenticated, app_writer;

create or replace function private.collection_on()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select collection_enabled from private.field_gate where id = 1), false);
$$;

create or replace function private.bump_bucket(p_bucket text, p_window interval, p_max int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  insert into private.rate_window (bucket, window_start, n)
  values (p_bucket, now(), 1)
  on conflict (bucket) do update set
    window_start = case
      when private.rate_window.window_start <= now() - p_window then now()
      else private.rate_window.window_start
    end,
    n = case
      when private.rate_window.window_start <= now() - p_window then 1
      else private.rate_window.n + 1
    end
  returning n into v_n;
  return v_n <= p_max;
end;
$$;

create or replace function private.consume_rate(p_uid uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_uid is null then
    return jsonb_build_object('ok', false, 'error', 'identity_required');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('rate', 0));
  if not private.bump_bucket('global', interval '60 seconds', 50) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  if not private.bump_bucket('uid:' || p_uid::text, interval '60 seconds', 20) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function private.consume_create(p_uid uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('create', 0));
  if not private.bump_bucket('create-global', interval '1 hour', 30) then
    return false;
  end if;
  return private.bump_bucket('create:' || p_uid::text, interval '1 day', 8);
end;
$$;

create or replace function private.start_run(p_run_id uuid, p_day date, p_uid uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.collection_on() then
    return jsonb_build_object('ok', false, 'error', 'collection_off');
  end if;
  if p_run_id is null or p_day is null or p_uid is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;
  if not private.consume_create(p_uid) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_run_id::text, 0));
  if exists (select 1 from private.attempts where run_id = p_run_id and auth_uid = p_uid) then
    return jsonb_build_object('ok', true, 'idempotent', true);
  end if;
  if exists (select 1 from private.attempts where run_id = p_run_id) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  insert into private.attempts (run_id, day_key, auth_uid) values (p_run_id, p_day, p_uid);
  insert into private.technical_event (run_id, kind) values (p_run_id, 'start');
  return jsonb_build_object('ok', true, 'idempotent', false);
end;
$$;

create or replace function private.finish_run(p_run_id uuid, p_day date, p_uid uuid, p_scores int[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total int;
  v_bin int;
  v_attempt private.attempts%rowtype;
  v_existing private.runs%rowtype;
begin
  if not private.collection_on() then
    return jsonb_build_object('ok', false, 'error', 'collection_off');
  end if;
  if p_run_id is null or p_day is null or p_uid is null or not private.valid_scores(p_scores) then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;
  v_total := p_scores[1] + p_scores[2] + p_scores[3] + p_scores[4] + p_scores[5];
  v_bin := private.total_bin(v_total);
  if v_bin is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_total');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_day::text || ':' || p_uid::text, 0));
  select * into v_existing from private.runs where run_id = p_run_id;
  if found and v_existing.auth_uid = p_uid then
    return jsonb_build_object('ok', true, 'idempotent', true, 'total', v_existing.total);
  end if;
  if found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if exists (select 1 from private.runs where day_key = p_day and auth_uid = p_uid) then
    return jsonb_build_object('ok', false, 'error', 'player_day_exists');
  end if;
  select * into v_attempt from private.attempts where run_id = p_run_id;
  if not found or v_attempt.auth_uid is distinct from p_uid or v_attempt.day_key is distinct from p_day then
    return jsonb_build_object('ok', false, 'error', 'start_required');
  end if;
  insert into private.runs (run_id, day_key, auth_uid, scores, total)
  values (p_run_id, p_day, p_uid, p_scores, v_total);
  insert into private.dedup (run_id, day_key, auth_uid) values (p_run_id, p_day, p_uid);
  insert into private.day_agg (day_key, finishes, sum_total, sum_scores, hist)
  values (p_day, 1, v_total, p_scores, private.add_bin(array[0,0,0,0,0], v_bin))
  on conflict (day_key) do update set
    finishes = private.day_agg.finishes + 1,
    sum_total = private.day_agg.sum_total + excluded.sum_total,
    sum_scores = private.add_scores(private.day_agg.sum_scores, excluded.sum_scores),
    hist = private.add_bin(private.day_agg.hist, v_bin);
  insert into private.technical_event (run_id, kind) values (p_run_id, 'finish');
  return jsonb_build_object('ok', true, 'idempotent', false, 'total', v_total, 'bin', v_bin, 'scores_are_client_reports', true);
end;
$$;

create or replace function private.day_snapshot(p_day date, p_run_id uuid, p_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_finishes int := 0;
  v_sum bigint := 0;
  v_scores int[];
  v_hist int[];
  v_own private.runs%rowtype;
  v_min int;
  v_rest int;
  v_hist_out int[];
  v_cat numeric[];
  v_available boolean := false;
  v_reason text;
begin
  if p_uid is null then
    return jsonb_build_object('ok', false, 'error', 'identity_required', 'comparison_available', false);
  end if;
  if not private.collection_on() then
    return jsonb_build_object('ok', false, 'error', 'collection_off', 'comparison_available', false);
  end if;
  select finishes, sum_total, sum_scores, hist into v_finishes, v_sum, v_scores, v_hist
  from private.day_agg where day_key = p_day;
  if v_finishes is null then v_finishes := 0; v_sum := 0; end if;
  select * into v_own from private.runs
  where run_id = p_run_id and day_key = p_day and auth_uid = p_uid;
  select min_other_finishes into v_min from private.field_gate where id = 1;
  v_rest := case when v_own.run_id is not null then v_finishes - 1 else v_finishes end;
  if v_min is null then v_reason := 'threshold_unresolved';
  elsif v_rest < v_min then v_reason := 'below_threshold';
  else v_available := true; v_reason := 'ok';
  end if;
  if v_available and v_rest > 0 then
    if v_own.run_id is not null then
      v_hist_out := private.add_bin_minus(v_hist, private.total_bin(v_own.total));
      v_cat := array[
        (v_scores[1] - v_own.scores[1])::numeric / v_rest,
        (v_scores[2] - v_own.scores[2])::numeric / v_rest,
        (v_scores[3] - v_own.scores[3])::numeric / v_rest,
        (v_scores[4] - v_own.scores[4])::numeric / v_rest,
        (v_scores[5] - v_own.scores[5])::numeric / v_rest
      ];
    else
      v_hist_out := v_hist;
      v_cat := array[
        v_scores[1]::numeric / v_rest, v_scores[2]::numeric / v_rest, v_scores[3]::numeric / v_rest,
        v_scores[4]::numeric / v_rest, v_scores[5]::numeric / v_rest
      ];
    end if;
  end if;
  return jsonb_build_object(
    'ok', true,
    'comparison_available', v_available,
    'reason', v_reason,
    'own_included', v_own.run_id is not null,
    'own_total', case when v_own.run_id is not null then v_own.total else null end,
    'rest_finishes', v_rest,
    'rest_average', case when v_available and v_rest > 0 then (v_sum - coalesce(v_own.total, 0))::numeric / v_rest else null end,
    'rest_category_average', v_cat,
    'histogram', v_hist_out,
    'own_bin', case when v_available and v_own.run_id is not null then private.total_bin(v_own.total) else null end,
    'scores_are_client_reports', true
  );
end;
$$;

create or replace function private.deletion_request(p_uid uuid, p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_left int;
begin
  select count(*) into v_left from private.runs;
  select auth_uid into v_owner from private.runs where run_id = p_run_id;
  if p_uid is null or v_owner is null or v_owner is distinct from p_uid then
    return jsonb_build_object('ok', false, 'error', 'not_found', 'runs_left', v_left);
  end if;
  if (select operator_contact from private.field_gate where id = 1) is null then
    return jsonb_build_object('ok', false, 'error', 'operator_contact_unconfigured', 'runs_left', v_left);
  end if;
  return jsonb_build_object('ok', false, 'error', 'erasure_not_enabled', 'runs_left', v_left);
end;
$$;

create or replace function private.retain_technical()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int := 0;
  v_part int;
begin
  delete from private.technical_event where created_at < now() - interval '7 days';
  get diagnostics v_part = row_count;
  v_n := v_n + v_part;
  delete from private.rate_window where window_start < now() - interval '7 days';
  get diagnostics v_part = row_count;
  return v_n + v_part;
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated, app_writer;
grant execute on function
  private.consume_rate(uuid),
  private.start_run(uuid, date, uuid),
  private.finish_run(uuid, date, uuid, int[]),
  private.day_snapshot(date, uuid, uuid)
to app_writer;
