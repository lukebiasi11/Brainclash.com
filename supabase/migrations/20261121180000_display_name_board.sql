-- Public daily display-name board. Separate from the field comparison.
-- This file does not read or write attempts, runs, dedup, day_agg,
-- technical_event, rate_window, field_gate, or collection_status.
-- It does not enable pg_cron, does not schedule a job, and does not set a password.
-- Public boards are served for 30 days. retain_board_names() drops the
-- name on rows older than 90 days and leaves private.board_agg in place.
-- That function is not scheduled here.

create schema if not exists private;

do $$
declare
  v_super boolean;
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  select rolsuper into v_super from pg_roles where rolname = current_user;
  if not exists (select 1 from pg_roles where rolname = 'board_runtime') then
    create role board_runtime login noinherit;
  elsif v_super or pg_has_role(current_user, 'board_runtime', 'member') then
    alter role board_runtime login noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'board_retention') then
    create role board_retention login noinherit connection limit 2;
  elsif v_super or pg_has_role(current_user, 'board_retention', 'member') then
    alter role board_retention login noinherit connection limit 2;
  end if;
end $$;

grant usage on schema private to board_runtime, board_retention;

create table private.board_term (
  kind text not null check (kind in ('imp', 'impword', 'sub', 'word')),
  term text not null,
  primary key (kind, term)
);
alter table private.board_term enable row level security;

insert into private.board_term (kind, term) values
  ('imp', 'admin'),
  ('imp', 'dailydose'),
  ('imp', 'moderator'),
  ('imp', 'oficial'),
  ('imp', 'official'),
  ('imp', 'soporte'),
  ('imp', 'staff'),
  ('imp', 'support'),
  ('impword', 'mod'),
  ('impword', 'mods'),
  ('sub', 'asshole'),
  ('sub', 'badass'),
  ('sub', 'bastard'),
  ('sub', 'bitch'),
  ('sub', 'blowjob'),
  ('sub', 'cabron'),
  ('sub', 'cabrona'),
  ('sub', 'capullo'),
  ('sub', 'chingada'),
  ('sub', 'chingado'),
  ('sub', 'chingar'),
  ('sub', 'cojones'),
  ('sub', 'culero'),
  ('sub', 'cunt'),
  ('sub', 'dickhead'),
  ('sub', 'dildo'),
  ('sub', 'dumbass'),
  ('sub', 'faggot'),
  ('sub', 'fock'),
  ('sub', 'fuck'),
  ('sub', 'fvck'),
  ('sub', 'gilipollas'),
  ('sub', 'handjob'),
  ('sub', 'hentai'),
  ('sub', 'horny'),
  ('sub', 'hostia'),
  ('sub', 'jackass'),
  ('sub', 'jizz'),
  ('sub', 'joder'),
  ('sub', 'mamon'),
  ('sub', 'mamona'),
  ('sub', 'maricon'),
  ('sub', 'mierda'),
  ('sub', 'nigga'),
  ('sub', 'nigg'),
  ('sub', 'nigger'),
  ('sub', 'nude'),
  ('sub', 'orgasm'),
  ('sub', 'pendeja'),
  ('sub', 'pendejo'),
  ('sub', 'penis'),
  ('sub', 'phuck'),
  ('sub', 'phuk'),
  ('sub', 'pinche'),
  ('sub', 'polla'),
  ('sub', 'porn'),
  ('sub', 'pussy'),
  ('sub', 'rape'),
  ('sub', 'rapist'),
  ('sub', 'retard'),
  ('sub', 'sexual'),
  ('sub', 'sexy'),
  ('sub', 'shit'),
  ('sub', 'slut'),
  ('sub', 'twat'),
  ('sub', 'vagina'),
  ('sub', 'wank'),
  ('sub', 'whore'),
  ('sub', 'xxx'),
  ('word', 'anal'),
  ('word', 'ass'),
  ('word', 'cock'),
  ('word', 'cono'),
  ('word', 'cum'),
  ('word', 'dick'),
  ('word', 'fag'),
  ('word', 'marica'),
  ('word', 'perra'),
  ('word', 'pito'),
  ('word', 'puta'),
  ('word', 'puto'),
  ('word', 'sex'),
  ('word', 'sexo'),
  ('word', 'tit'),
  ('word', 'verga'),
  ('word', 'zorra');

create table private.board_post (
  id uuid primary key default gen_random_uuid(),
  day_key date not null,
  auth_uid uuid not null,
  display_name text,
  scores int[] not null,
  total int not null,
  posted_at timestamptz not null default now(),
  removed_at timestamptz,
  name_hidden_at timestamptz,
  unique (day_key, auth_uid),
  check (display_name is null or char_length(display_name) between 3 and 20),
  check (cardinality(scores) = 5),
  check (scores[1] between 0 and 1000 and scores[2] between 0 and 1000 and scores[3] between 0 and 1000 and scores[4] between 0 and 1000 and scores[5] between 0 and 1000),
  check (total = scores[1] + scores[2] + scores[3] + scores[4] + scores[5])
);
alter table private.board_post enable row level security;
create index board_post_day_idx on private.board_post (day_key) where display_name is not null;

create table private.board_agg (
  day_key date primary key,
  n int not null,
  sum_total bigint not null,
  sum_scores int[] not null
);
alter table private.board_agg enable row level security;

create table private.board_rate (
  bucket text primary key,
  window_start timestamptz not null,
  n int not null
);
alter table private.board_rate enable row level security;

create or replace function private.board_name_status(p_name text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v text := coalesce(p_name, '');
  v_fold text;
  v_sq text;
  v_toks text[];
  v_digits text;
begin
  v := translate(v, chr(8203) || chr(8204) || chr(8205) || chr(65279), '');
  v := btrim(regexp_replace(v, '[[:space:]]+', ' ', 'g'));
  if v = '' then
    return jsonb_build_object('ok', true, 'skip', true);
  end if;
  if char_length(v) < 3 or char_length(v) > 20 then
    return jsonb_build_object('ok', false, 'reason', 'length');
  end if;
  if position('@' in v) > 0 or v ~* 'https?:|www\.|//' then
    return jsonb_build_object('ok', false, 'reason', 'contact');
  end if;
  if v ~* '(^|[^[:alnum:]])[[:alnum:]-]+\.(com|net|org|io|gg|co|me|tv|app|dev|xyz|info|ly|link|site|us|uk|mx|es|gl)([^[:alnum:]]|$)' then
    return jsonb_build_object('ok', false, 'reason', 'contact');
  end if;
  v_digits := regexp_replace(v, '\D', '', 'g');
  if char_length(v_digits) >= 7 then
    return jsonb_build_object('ok', false, 'reason', 'contact');
  end if;
  if v !~ '^[[:alnum:]]([[:alnum:]''’ -]*[[:alnum:]])?$' then
    return jsonb_build_object('ok', false, 'reason', 'chars');
  end if;
  v_fold := translate(v, 'ÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÑÇÝŸ', 'aaaaaaeeeeiiiiooooouuuuncyy');
  v_fold := lower(v_fold);
  v_fold := translate(v_fold, 'àáâãäåèéêëìíîïòóôõöùúûüñçýÿ', 'aaaaaaeeeeiiiiooooouuuuncyy');
  v_fold := replace(v_fold, 'ß', 'ss');
  v_fold := translate(v_fold, '@$+|!', 'asati');
  v_digits := regexp_replace(regexp_replace(v_fold, '[^a-z0-9]', '', 'g'), '(.)\1+', '\1', 'g');
  v_fold := translate(v_fold, '01345789', 'oieastbg');
  v_sq := regexp_replace(regexp_replace(v_fold, '[^a-z0-9]', '', 'g'), '(.)\1+', '\1', 'g');
  v_toks := regexp_split_to_array(btrim(regexp_replace(v_fold, '[^a-z0-9]+', ' ', 'g')), ' ');
  if v_toks is null or v_toks = array['']::text[] then
    v_toks := array[]::text[];
  end if;
  if exists (
    select 1 from private.board_term t
    where t.kind = 'imp'
      and char_length(t.term) >= 3
      and (
        v_sq = t.term
        or t.term = any(v_toks)
        or (position(t.term in v_digits) = 1 and substring(v_digits from char_length(t.term) + 1) ~ '^[0-9]+$')
        or position(t.term in v_sq) > 0
      )
  ) or exists (
    select 1 from private.board_term t
    where t.kind = 'impword'
      and (
        v_sq = t.term
        or t.term = any(v_toks)
        or (position(t.term in v_digits) = 1 and substring(v_digits from char_length(t.term) + 1) ~ '^[0-9]+$')
      )
  ) then
    return jsonb_build_object('ok', false, 'reason', 'impersonation');
  end if;
  if exists (
    select 1 from private.board_term t
    where t.kind = 'sub'
      and char_length(t.term) >= 3
      and (
        v_sq = t.term
        or t.term = any(v_toks)
        or (position(t.term in v_digits) = 1 and substring(v_digits from char_length(t.term) + 1) ~ '^[0-9]+$')
        or position(t.term in v_sq) > 0
      )
  ) or exists (
    select 1 from private.board_term t
    where t.kind = 'word'
      and (
        v_sq = t.term
        or t.term = any(v_toks)
        or (position(t.term in v_digits) = 1 and substring(v_digits from char_length(t.term) + 1) ~ '^[0-9]+$')
      )
  ) then
    return jsonb_build_object('ok', false, 'reason', 'profanity');
  end if;
  return jsonb_build_object('ok', true, 'skip', false, 'name', v);
end;
$$;

create or replace function private.board_scores_ok(p_scores int[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_scores is not null
    and cardinality(p_scores) = 5
    and p_scores[1] between 0 and 1000
    and p_scores[2] between 0 and 1000
    and p_scores[3] between 0 and 1000
    and p_scores[4] between 0 and 1000
    and p_scores[5] between 0 and 1000;
$$;

create or replace function private.board_add_agg(p_day date, p_n int, p_total int, p_scores int[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.board_agg (day_key, n, sum_total, sum_scores)
  values (p_day, p_n, p_total, p_scores)
  on conflict (day_key) do update set
    n = private.board_agg.n + excluded.n,
    sum_total = private.board_agg.sum_total + excluded.sum_total,
    sum_scores = array[
      private.board_agg.sum_scores[1] + excluded.sum_scores[1],
      private.board_agg.sum_scores[2] + excluded.sum_scores[2],
      private.board_agg.sum_scores[3] + excluded.sum_scores[3],
      private.board_agg.sum_scores[4] + excluded.sum_scores[4],
      private.board_agg.sum_scores[5] + excluded.sum_scores[5]
    ];
end;
$$;

create or replace function private.board_post(p_uid uuid, p_day date, p_name text, p_scores int[])
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
      set display_name = v_clean, scores = p_scores, total = v_total
      where id = v_row.id;
    perform private.board_add_agg(p_day, 0, v_total - v_row.total, v_delta);
    return jsonb_build_object('ok', true, 'idempotent', true, 'total', v_total);
  end if;
  insert into private.board_post (day_key, auth_uid, display_name, scores, total)
  values (p_day, p_uid, v_clean, p_scores, v_total);
  perform private.board_add_agg(p_day, 1, v_total, p_scores);
  return jsonb_build_object('ok', true, 'idempotent', false, 'total', v_total);
end;
$$;

create or replace function private.board_public(p_day date, p_section text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (timezone('America/New_York', now()))::date;
  v_section text := coalesce(p_section, '');
  v_rows jsonb;
begin
  if v_section not in ('overall', 'world', 'history', 'sports', 'word', 'think') then
    return jsonb_build_object('ok', false, 'error', 'invalid_section', 'served', false, 'rows', '[]'::jsonb);
  end if;
  if p_day is null or p_day > v_today or p_day < v_today - 30 then
    return jsonb_build_object('ok', true, 'served', false, 'day', p_day, 'section', v_section, 'rows', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('rank', place, 'name', display_name, 'score', score) order by place), '[]'::jsonb)
    into v_rows
  from (
    select display_name,
      case v_section
        when 'world' then scores[1]
        when 'history' then scores[2]
        when 'sports' then scores[3]
        when 'word' then scores[4]
        when 'think' then scores[5]
        else total
      end as score,
      rank() over (
        order by
          case v_section
            when 'world' then scores[1]
            when 'history' then scores[2]
            when 'sports' then scores[3]
            when 'word' then scores[4]
            when 'think' then scores[5]
            else total
          end desc,
          display_name asc,
          id asc
      ) as place
    from private.board_post
    where day_key = p_day
      and display_name is not null
      and removed_at is null
      and name_hidden_at is null
    order by 2 desc, display_name asc, id asc
    limit 100
  ) q;
  return jsonb_build_object('ok', true, 'served', true, 'day', p_day, 'section', v_section, 'rows', v_rows);
end;
$$;

create or replace function private.board_admin_list(p_day date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
  if p_day is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_input', 'rows', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'name', display_name, 'score', total, 'scores', scores
  ) order by total desc, display_name asc), '[]'::jsonb)
    into v_rows
  from private.board_post
  where day_key = p_day and display_name is not null and removed_at is null and name_hidden_at is null;
  return jsonb_build_object('ok', true, 'day', p_day, 'rows', v_rows);
end;
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
begin
  if p_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;
  v_name := private.board_name_status(p_name);
  if coalesce((v_name ->> 'ok')::boolean, false) is not true or coalesce((v_name ->> 'skip')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'name_rejected', 'reason', coalesce(v_name ->> 'reason', 'length'));
  end if;
  v_clean := v_name ->> 'name';
  update private.board_post
    set display_name = v_clean
    where id = p_id and display_name is not null and removed_at is null and name_hidden_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return jsonb_build_object('ok', true, 'name', v_clean);
end;
$$;

create or replace function private.board_remove(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;
  update private.board_post
    set display_name = null, removed_at = now()
    where id = p_id and display_name is not null and removed_at is null and name_hidden_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return jsonb_build_object('ok', true, 'removed', true);
end;
$$;

create or replace function private.board_bump(p_bucket text, p_window interval, p_max int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  insert into private.board_rate (bucket, window_start, n)
  values (p_bucket, now(), 1)
  on conflict (bucket) do update set
    window_start = case
      when private.board_rate.window_start <= now() - p_window then now()
      else private.board_rate.window_start
    end,
    n = case
      when private.board_rate.window_start <= now() - p_window then 1
      else private.board_rate.n + 1
    end
  returning n into v_n;
  return v_n <= p_max;
end;
$$;

create or replace function private.board_consume_rate(p_uid uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('board-rate', 0));
  if not private.board_bump('global', interval '60 seconds', 120) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  if p_uid is not null and not private.board_bump('uid:' || p_uid::text, interval '60 seconds', 20) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  return jsonb_build_object('ok', true);
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
    set display_name = null, name_hidden_at = now()
    where display_name is not null
      and posted_at < now() - interval '90 days';
  get diagnostics v_n = row_count;
  delete from private.board_rate where window_start < now() - interval '7 days';
  return v_n;
end;
$$;

revoke all on table private.board_term, private.board_post, private.board_agg, private.board_rate
  from public, anon, authenticated, app_writer, field_runtime, board_runtime, board_retention;
revoke all on function
  private.board_name_status(text),
  private.board_scores_ok(int[]),
  private.board_add_agg(date, int, int, int[]),
  private.board_post(uuid, date, text, int[]),
  private.board_public(date, text),
  private.board_admin_list(date),
  private.board_rename(uuid, text),
  private.board_remove(uuid),
  private.board_bump(text, interval, int),
  private.board_consume_rate(uuid),
  private.retain_board_names()
  from public, anon, authenticated, app_writer, field_runtime;
revoke all on function private.retain_board_names() from board_runtime;
grant execute on function
  private.board_post(uuid, date, text, int[]),
  private.board_public(date, text),
  private.board_admin_list(date),
  private.board_rename(uuid, text),
  private.board_remove(uuid),
  private.board_consume_rate(uuid)
  to board_runtime;
grant execute on function private.retain_board_names() to board_retention;
