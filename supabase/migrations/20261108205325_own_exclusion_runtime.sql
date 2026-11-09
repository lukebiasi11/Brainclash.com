-- Own exclusion follows the verified uid and the requested day.
-- The client run id is ignored, so a missing, random, stale, or other-day id
-- cannot leave the caller's finish inside the comparison sample.
-- A uid with no finish on that day is an unsubmitted visitor: nothing is
-- subtracted, and a sample under the operator threshold stays hidden.
-- field_runtime is the dedicated FIELD_DB_URL login. It has no password here.
-- An operator sets that password outside this repository when a staging
-- database exists. The login is NOINHERIT, so it must SET ROLE app_writer.
-- This file does not schedule retain_technical and does not enable pg_cron.

-- Hosted migrations run as postgres, which is not a superuser. Do not name
-- SUPERUSER, REPLICATION, or BYPASSRLS here. A new role already defaults to
-- none of those. LOGIN and NOINHERIT are attributes this role may set.
-- On PostgreSQL 17 a non-superuser can GRANT a role only with ADMIN OPTION
-- on it. The same user created app_writer, so it has that option.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'field_runtime') then
    create role field_runtime login noinherit;
  end if;
end $$;

alter role field_runtime login noinherit;

do $$
begin
  if not exists (
    select 1
    from pg_auth_members m
    join pg_roles granted on granted.oid = m.roleid
    join pg_roles member on member.oid = m.member
    where granted.rolname = 'app_writer'
      and member.rolname = 'field_runtime'
  ) then
    grant app_writer to field_runtime;
  end if;
end $$;

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
  -- p_run_id is accepted and discarded. Ownership is only (day, uid).
  select finishes, sum_total, sum_scores, hist into v_finishes, v_sum, v_scores, v_hist
  from private.day_agg where day_key = p_day;
  if v_finishes is null then v_finishes := 0; v_sum := 0; end if;
  select * into v_own from private.runs
  where day_key = p_day and auth_uid = p_uid;
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

revoke all on all functions in schema private from public, anon, authenticated, app_writer, field_runtime;
grant execute on function
  private.consume_rate(uuid),
  private.start_run(uuid, date, uuid),
  private.finish_run(uuid, date, uuid, int[]),
  private.day_snapshot(date, uuid, uuid)
to app_writer;
