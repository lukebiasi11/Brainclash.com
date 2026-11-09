-- Score-range counts for the daily chart.
-- The existing 5-bin histogram stays as it is. These extra fields are
-- 10 bins computed from private.runs, excluding the caller, and they are
-- null until the other-game threshold is met.

create or replace function private.range_bin(p_score int, p_width int, p_bins int)
returns int
language sql
immutable
set search_path = ''
as $$
  select case
    when p_score is null or p_score < 0 or p_width is null or p_width < 1 or p_bins is null or p_bins < 1 then null
    else least(p_bins - 1, greatest(0, p_score / p_width))
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
  v_bins int[] := array[0,0,0,0,0,0,0,0,0,0];
  v_cat_bins jsonb := '[[0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0]]'::jsonb;
  v_above int := 0;
  v_cat_above int[] := array[0,0,0,0,0];
  v_row record;
  v_i int;
  v_n int;
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
      select count(*)::int into v_above
      from private.runs
      where day_key = p_day and auth_uid is distinct from p_uid and total >= v_own.total;
      for v_i in 1..5 loop
        select count(*)::int into v_n
        from private.runs
        where day_key = p_day and auth_uid is distinct from p_uid and scores[v_i] >= v_own.scores[v_i];
        v_cat_above[v_i] := v_n;
      end loop;
    else
      v_hist_out := v_hist;
      v_cat := array[
        v_scores[1]::numeric / v_rest, v_scores[2]::numeric / v_rest, v_scores[3]::numeric / v_rest,
        v_scores[4]::numeric / v_rest, v_scores[5]::numeric / v_rest
      ];
    end if;
    for v_row in
      select private.range_bin(total, 500, 10) as b, count(*)::int as n
      from private.runs
      where day_key = p_day and auth_uid is distinct from p_uid
      group by 1
    loop
      if v_row.b is not null then v_bins[v_row.b + 1] := v_row.n; end if;
    end loop;
    for v_i in 1..5 loop
      for v_row in
        select private.range_bin(scores[v_i], 100, 10) as b, count(*)::int as n
        from private.runs
        where day_key = p_day and auth_uid is distinct from p_uid
        group by 1
      loop
        if v_row.b is not null then
          v_cat_bins := jsonb_set(v_cat_bins, array[(v_i - 1)::text, v_row.b::text], to_jsonb(v_row.n), false);
        end if;
      end loop;
    end loop;
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
    'score_bins', case when v_available and v_rest > 0 then to_jsonb(v_bins) else null end,
    'own_score_bin', case when v_available and v_own.run_id is not null then private.range_bin(v_own.total, 500, 10) else null end,
    'others_at_or_above', case when v_available and v_own.run_id is not null then v_above else null end,
    'category_bins', case when v_available and v_rest > 0 then v_cat_bins else null end,
    'category_at_or_above', case when v_available and v_own.run_id is not null then to_jsonb(v_cat_above) else null end,
    'scores_are_client_reports', true
  );
end;
$$;

revoke all on function private.day_snapshot(date, uuid, uuid) from public, anon, authenticated, app_writer, field_runtime;
grant execute on function private.day_snapshot(date, uuid, uuid) to app_writer;
