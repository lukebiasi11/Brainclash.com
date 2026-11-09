-- Local field-comparison schema. Created empty by `supabase migration new field_compare`
-- (Supabase CLI 2.72.8), then filled here. Not applied to any remote project.
-- private is not in the exposed schemas in config.toml. public tables have RLS.
-- security definer functions stay in private. The public view is security_invoker.
-- No player name, email, or IP. Collection defaults off. The other-game
-- threshold is null until an operator sets it; this file does not pick a number.

create schema if not exists private;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'app_writer') then create role app_writer nologin; end if;
end $$;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to app_writer;

create table public.field_gate (
  id int primary key check (id = 1),
  collection_enabled boolean not null default false,
  operator_contact text,
  min_other_finishes int check (min_other_finishes is null or min_other_finishes >= 0)
);
insert into public.field_gate (id, collection_enabled) values (1, false);
alter table public.field_gate enable row level security;
revoke all on table public.field_gate from public, anon, authenticated;
grant select on table public.field_gate to anon, authenticated;
create policy field_gate_read on public.field_gate
  for select to anon, authenticated
  using (true);

create view public.collection_status
with (security_invoker = true) as
select collection_enabled, (operator_contact is not null) as contact_configured,
       min_other_finishes is not null as threshold_configured
from public.field_gate
where id = 1;
grant select on public.collection_status to anon, authenticated;

create table private.attempts (
  run_id uuid primary key,
  day_key date not null,
  player_day_hash text not null,
  started_at timestamptz not null default now()
);
alter table private.attempts enable row level security;

create table private.runs (
  run_id uuid primary key,
  day_key date not null,
  player_day_hash text not null,
  scores int[] not null,
  total int not null,
  finished_at timestamptz not null default now(),
  unique (day_key, player_day_hash)
);
alter table private.runs enable row level security;

create table private.dedup (
  run_id uuid primary key,
  day_key date not null,
  player_day_hash text not null,
  finished_at timestamptz not null default now()
);
alter table private.dedup enable row level security;

create table private.day_agg (
  day_key date primary key,
  finishes int not null,
  sum_total bigint not null,
  sum_scores int[] not null,
  hist int[] not null
);
alter table private.day_agg enable row level security;

create table private.technical_event (
  id bigint generated always as identity primary key,
  run_id uuid,
  kind text not null,
  created_at timestamptz not null default now()
);
alter table private.technical_event enable row level security;

create or replace function private.valid_player_hash(p text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is not null
    and char_length(p) between 16 and 128
    and p !~ '@'
    and p ~ '^[A-Za-z0-9_-]+$';
$$;

create or replace function private.valid_scores(p int[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is not null
    and cardinality(p) = 5
    and p[1] between 0 and 1000 and p[2] between 0 and 1000
    and p[3] between 0 and 1000 and p[4] between 0 and 1000
    and p[5] between 0 and 1000;
$$;

create or replace function private.total_bin(p_total int)
returns int
language sql
immutable
set search_path = ''
as $$
  select case
    when p_total < 0 or p_total > 5000 then null
    when p_total = 5000 then 4
    else p_total / 1000
  end;
$$;

create or replace function private.add_bin(p int[], i int)
returns int[]
language sql
immutable
set search_path = ''
as $$
  select p[1:i] || (p[i + 1] + 1) || p[i + 2:5];
$$;

create or replace function private.add_scores(a int[], b int[])
returns int[]
language sql
immutable
set search_path = ''
as $$
  select array[a[1] + b[1], a[2] + b[2], a[3] + b[3], a[4] + b[4], a[5] + b[5]];
$$;

create or replace function private.collection_on()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select collection_enabled from public.field_gate where id = 1), false);
$$;

create or replace function private.start_run(p_run_id uuid, p_day date, p_player_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.collection_on() then
    return jsonb_build_object('ok', false, 'error', 'collection_off');
  end if;
  if p_run_id is null or p_day is null or not private.valid_player_hash(p_player_hash) then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_run_id::text, 0));
  if exists (select 1 from private.attempts where run_id = p_run_id) then
    return jsonb_build_object('ok', true, 'idempotent', true);
  end if;
  insert into private.attempts (run_id, day_key, player_day_hash)
  values (p_run_id, p_day, p_player_hash);
  insert into private.technical_event (run_id, kind) values (p_run_id, 'start');
  return jsonb_build_object('ok', true, 'idempotent', false);
end;
$$;

create or replace function private.finish_run(p_run_id uuid, p_day date, p_player_hash text, p_scores int[])
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
  if p_run_id is null or p_day is null or not private.valid_player_hash(p_player_hash) or not private.valid_scores(p_scores) then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;
  v_total := p_scores[1] + p_scores[2] + p_scores[3] + p_scores[4] + p_scores[5];
  v_bin := private.total_bin(v_total);
  if v_bin is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_total');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_day::text || ':' || p_player_hash, 0));
  select * into v_existing from private.runs where run_id = p_run_id;
  if found then
    return jsonb_build_object('ok', true, 'idempotent', true, 'total', v_existing.total);
  end if;
  if exists (select 1 from private.runs where day_key = p_day and player_day_hash = p_player_hash) then
    return jsonb_build_object('ok', false, 'error', 'player_day_exists');
  end if;
  select * into v_attempt from private.attempts where run_id = p_run_id;
  if not found or v_attempt.day_key is distinct from p_day or v_attempt.player_day_hash is distinct from p_player_hash then
    return jsonb_build_object('ok', false, 'error', 'start_required');
  end if;
  insert into private.runs (run_id, day_key, player_day_hash, scores, total)
  values (p_run_id, p_day, p_player_hash, p_scores, v_total);
  insert into private.dedup (run_id, day_key, player_day_hash)
  values (p_run_id, p_day, p_player_hash);
  insert into private.day_agg (day_key, finishes, sum_total, sum_scores, hist)
  values (p_day, 1, v_total, p_scores, private.add_bin(array[0,0,0,0,0], v_bin))
  on conflict (day_key) do update set
    finishes = private.day_agg.finishes + 1,
    sum_total = private.day_agg.sum_total + excluded.sum_total,
    sum_scores = private.add_scores(private.day_agg.sum_scores, excluded.sum_scores),
    hist = private.add_bin(private.day_agg.hist, v_bin);
  insert into private.technical_event (run_id, kind) values (p_run_id, 'finish');
  return jsonb_build_object('ok', true, 'idempotent', false, 'total', v_total, 'bin', v_bin);
end;
$$;

create or replace function private.day_snapshot(p_day date, p_run_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_finishes int;
  v_sum bigint;
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
  if not private.collection_on() then
    return jsonb_build_object('ok', false, 'error', 'collection_off', 'comparison_available', false);
  end if;
  select finishes, sum_total, sum_scores, hist
    into v_finishes, v_sum, v_scores, v_hist
  from private.day_agg where day_key = p_day;
  select * into v_own from private.runs where run_id = p_run_id and day_key = p_day;
  select min_other_finishes into v_min from public.field_gate where id = 1;
  if v_finishes is null then
    v_finishes := 0; v_sum := 0;
  end if;
  if v_own.run_id is not null then
    v_rest := v_finishes - 1;
  else
    v_rest := v_finishes;
  end if;
  if v_min is null then
    v_reason := 'threshold_unresolved';
  elsif v_rest < v_min then
    v_reason := 'below_threshold';
  else
    v_available := true;
    v_reason := 'ok';
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
    'own_total', v_own.total,
    'rest_finishes', v_rest,
    'rest_average', case when v_available and v_rest > 0 then (v_sum - coalesce(v_own.total, 0))::numeric / v_rest else null end,
    'rest_category_average', v_cat,
    'histogram', v_hist_out,
    'own_bin', case when v_available and v_own.run_id is not null then private.total_bin(v_own.total) else null end
  );
end;
$$;

create or replace function private.add_bin_minus(p int[], i int)
returns int[]
language sql
immutable
set search_path = ''
as $$
  select p[1:i] || greatest(p[i + 1] - 1, 0) || p[i + 2:5];
$$;

create or replace function private.retain_technical()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  delete from private.technical_event where created_at < now() - interval '7 days';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function private.deletion_request(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_runs int;
  v_dedup int;
begin
  if (select operator_contact from public.field_gate where id = 1) is null then
    return jsonb_build_object('ok', false, 'error', 'operator_contact_unconfigured');
  end if;
  select count(*) into v_runs from private.runs where run_id = p_run_id;
  select count(*) into v_dedup from private.dedup where run_id = p_run_id;
  return jsonb_build_object('ok', false, 'error', 'erasure_not_enabled', 'runs_left', v_runs, 'dedup_left', v_dedup);
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.start_run(uuid, date, text),
  private.finish_run(uuid, date, text, int[]),
  private.day_snapshot(date, uuid)
to app_writer;
grant execute on function private.retain_technical(), private.deletion_request(uuid) to app_writer;
