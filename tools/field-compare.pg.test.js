// Local Postgres only. No Supabase project, secret, or network.
const { execFileSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const root = path.join(__dirname, "..");
const db = "bc_field_compare_local";
const migrations = fs.readdirSync(path.join(root, "supabase/migrations"))
  .filter(name => name.endsWith(".sql"))
  .sort()
  .map(name => path.join(root, "supabase/migrations", name));
let bad = 0;
const t = (name, ok, extra) => { if (!ok) { bad++; console.log("FAIL", name, extra || ""); } };

function psql(args, input) {
  return execFileSync("sudo", ["-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-d", db, ...args], { encoding: "utf8", input });
}
function q(sql) {
  return psql(["-q", "-t", "-A", "-c", sql]).trim().split("\n").filter(Boolean).pop();
}
function psqlAsync(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn("sudo", ["-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-d", db, "-q", "-t", "-A", "-c", sql]);
    let out = "", err = "";
    child.stdout.on("data", d => { out += d; });
    child.stderr.on("data", d => { err += d; });
    child.on("close", code => code === 0 ? resolve(out.trim().split("\n").filter(Boolean).pop()) : reject(new Error(err || out)));
  });
}
function callAs(role, expr) {
  return JSON.parse(q(`
    create or replace function pg_temp.call_as(p_role text, p_expr text) returns jsonb
    language plpgsql as $fn$
    declare v jsonb; state text;
    begin
      perform set_config('role', p_role, true);
      execute 'select (' || p_expr || ')::jsonb' into v;
      reset role;
      return v;
    exception when others then
      state := SQLSTATE;
      reset role;
      return jsonb_build_object('raised', state);
    end $fn$;
    select pg_temp.call_as('${role}', \$e\$${expr}\$e\$);
  `));
}
function writer(expr) { return callAs("app_writer", expr); }
function runtimeCall(expr) {
  return JSON.parse(q(`begin; set local session authorization field_runtime; set local role app_writer; select (${expr})::jsonb; commit;`));
}
function attempt(role, statement) {
  return q(`
    create or replace function pg_temp.attempt(p_role text, p_sql text) returns text
    language plpgsql as $fn$
    declare state text;
    begin
      perform set_config('role', p_role, true);
      execute p_sql;
      reset role;
      return 'allowed';
    exception when others then
      state := SQLSTATE;
      reset role;
      return state;
    end $fn$;
    select pg_temp.attempt('${role}', \$e\$${statement}\$e\$);
  `);
}

function psqlDb(database, args, input) {
  return execFileSync("sudo", ["-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-d", database, ...args], { encoding: "utf8", input });
}
for (const name of [db, "bc_field_hosted", "bc_role_probe"]) {
  psqlDb("postgres", ["-c", `drop database if exists ${name}`]);
}
for (const name of ["field_runtime", "app_writer"]) psqlDb("postgres", ["-c", `drop role if exists ${name}`]);
psqlDb("postgres", ["-c", `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'bc_hosted_admin') then
      create role bc_hosted_admin login createrole nosuperuser nobypassrls nocreatedb;
    end if;
  end $$;
  alter role bc_hosted_admin login createrole nosuperuser nobypassrls nocreatedb;
`]);
psqlDb("postgres", ["-c", "create database bc_field_hosted owner bc_hosted_admin"]);
psqlDb("bc_field_hosted", ["-f", "-"], "set session authorization bc_hosted_admin;\n" + migrations.map(file => fs.readFileSync(file, "utf8")).join("\n"));
const runtimeFlags = psqlDb("bc_field_hosted", ["-tAc", "select rolcanlogin::text || ',' || rolsuper::text || ',' || rolinherit::text || ',' || rolcreaterole::text || ',' || rolcreatedb::text || ',' || rolreplication::text || ',' || rolbypassrls::text from pg_roles where rolname = 'field_runtime'"]).trim();
const runtimeMember = psqlDb("bc_field_hosted", ["-tAc", "select pg_has_role('field_runtime', 'app_writer', 'member')"]).trim();
const adminIsSuper = psqlDb("bc_field_hosted", ["-tAc", "select rolsuper::text from pg_roles where rolname = 'bc_hosted_admin'"]).trim();
const createdByAdmin = psqlDb("bc_field_hosted", ["-tAc", "select admin_option::text from pg_auth_members m join pg_roles granted on granted.oid = m.roleid join pg_roles member on member.oid = m.member where granted.rolname = 'field_runtime' and member.rolname = 'bc_hosted_admin'"]).trim();
const migration3 = fs.readFileSync(migrations.find(file => file.endsWith("own_exclusion_runtime.sql")), "utf8");
t("non-superuser can apply the role migration", adminIsSuper === "false" && createdByAdmin === "true" && runtimeFlags === "true,false,false,false,false,false,false" && runtimeMember === "t" && !/^\s*(create|alter)\s+role\b[^\n]*(superuser|bypassrls|replication)/im.test(migration3));
psqlDb("postgres", ["-c", "drop database if exists bc_field_hosted"]);

execFileSync("sudo", ["-u", "postgres", "psql", "-d", "postgres", "-c", `drop database if exists ${db}`]);
execFileSync("sudo", ["-u", "postgres", "psql", "-d", "postgres", "-c", `create database ${db}`]);
for (const file of migrations) psql(["-f", file]);

const uidA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const uidB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const uidC = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const uidD = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const runA = "11111111-1111-4111-8111-111111111111";
const runA2 = "22222222-2222-4222-8222-222222222222";
const runB = "33333333-3333-4333-8333-333333333333";
const scoresA = "{200,200,200,200,200}";
const scoresB = "{100,100,100,100,100}";

const off = writer(`private.finish_run('${runA}'::uuid, '2026-11-07'::date, '${uidA}'::uuid, '${scoresA}'::int[])`);
t("collection off writes nothing", off.error === "collection_off" && q("select count(*) from private.runs") === "0");
t("anon cannot read runs", callAs("anon", "(select count(*) from private.runs)").raised === "42501");
t("anon cannot select gate", callAs("anon", "(select operator_contact from private.field_gate)").raised === "42501");
t("authenticated cannot select gate", callAs("authenticated", "(select operator_contact from private.field_gate)").raised === "42501");
t("public gate table is gone", callAs("anon", "(select operator_contact from public.field_gate)").raised === "42P01");
q("update private.field_gate set operator_contact = 'ops@example.com' where id = 1");
const projected = callAs("anon", "(select to_jsonb(s) from public.collection_status s)");
const projectedAuth = callAs("authenticated", "(select to_jsonb(s) from public.collection_status s)");
t("anon projection omits contact", projected.collection_enabled === false && projected.contact_configured === true && !JSON.stringify(projected).includes("ops@example.com") && !Object.prototype.hasOwnProperty.call(projected, "operator_contact"));
t("authenticated projection omits contact", projectedAuth.contact_configured === true && !JSON.stringify(projectedAuth).includes("ops@example.com"));
t("status columns are the boolean projection", q("select string_agg(attname, ',' order by attnum) from pg_attribute where attrelid = 'public.collection_status'::regclass and attnum > 0 and not attisdropped") === "collection_enabled,contact_configured,threshold_configured");
q("update private.field_gate set operator_contact = null where id = 1");
t("anon cannot enable collection", attempt("anon", "update private.field_gate set collection_enabled = true where id = 1") === "42501" && q("select collection_enabled::text from private.field_gate") === "false");
t("app writer cannot read contact", callAs("app_writer", "(select operator_contact from private.field_gate)").raised === "42501");
t("app writer cannot delete", writer(`private.deletion_request('${uidA}'::uuid, '${runA}'::uuid)`).raised === "42501");

q("update private.field_gate set collection_enabled = true where id = 1");
t("start required", writer(`private.finish_run('${runA}'::uuid, '2026-11-07'::date, '${uidA}'::uuid, '${scoresA}'::int[])`).error === "start_required");
const started = writer(`private.start_run('${runA}'::uuid, '2026-11-07'::date, '${uidA}'::uuid)`);
const startedAgain = writer(`private.start_run('${runA}'::uuid, '2026-11-07'::date, '${uidA}'::uuid)`);
t("start idempotent", started.ok === true && started.idempotent === false && startedAgain.idempotent === true && q("select count(*) from private.technical_event where kind = 'start'") === "1");
const finished = writer(`private.finish_run('${runA}'::uuid, '2026-11-07'::date, '${uidA}'::uuid, '${scoresA}'::int[])`);
const finishedAgain = writer(`private.finish_run('${runA}'::uuid, '2026-11-07'::date, '${uidA}'::uuid, '${scoresA}'::int[])`);
t("finish once", finished.ok === true && finished.idempotent === false && finished.total === 1000 && finished.bin === 1 && finished.scores_are_client_reports === true);
t("finish replay", finishedAgain.idempotent === true && q("select finishes from private.day_agg where day_key = '2026-11-07'") === "1");
writer(`private.start_run('${runA2}'::uuid, '2026-11-07'::date, '${uidA}'::uuid)`);
t("one identity-day", writer(`private.finish_run('${runA2}'::uuid, '2026-11-07'::date, '${uidA}'::uuid, '${scoresA}'::int[])`).error === "player_day_exists");
t("other identity cannot finish this run", writer(`private.finish_run('${runA}'::uuid, '2026-11-07'::date, '${uidB}'::uuid, '${scoresB}'::int[])`).error === "not_found");
writer(`private.start_run('${runB}'::uuid, '2026-11-07'::date, '${uidB}'::uuid)`);
writer(`private.finish_run('${runB}'::uuid, '2026-11-07'::date, '${uidB}'::uuid, '${scoresB}'::int[])`);
const unresolved = writer(`private.day_snapshot('2026-11-07'::date, '${runA}'::uuid, '${uidA}'::uuid)`);
t("threshold unresolved hides comparison", unresolved.comparison_available === false && unresolved.reason === "threshold_unresolved" && unresolved.histogram === null && unresolved.own_total === 1000 && unresolved.own_included === true && unresolved.rest_finishes === 1);
q("update private.field_gate set min_other_finishes = 1 where id = 1");
const snap = writer(`private.day_snapshot('2026-11-07'::date, '${runA}'::uuid, '${uidA}'::uuid)`);
t("own identity is excluded", snap.comparison_available === true && Number(snap.rest_average) === 500 && snap.histogram.join(",") === "1,0,0,0,0" && snap.rest_category_average.every(n => Number(n) === 100));
const stolen = writer(`private.day_snapshot('2026-11-07'::date, '${runA}'::uuid, '${uidB}'::uuid)`);
t("passing another run id still excludes the caller", stolen.own_included === true && stolen.own_total === 500 && stolen.rest_finishes === 1 && Number(stolen.rest_average) === 1000 && stolen.histogram.join(",") === "0,1,0,0,0" && stolen.rest_category_average.every(n => Number(n) === 200));
q("update private.field_gate set min_other_finishes = 5 where id = 1");
const below = writer(`private.day_snapshot('2026-11-07'::date, '${runA}'::uuid, '${uidA}'::uuid)`);
t("below an operator threshold", below.comparison_available === false && below.reason === "below_threshold" && below.histogram === null);
q("update private.field_gate set min_other_finishes = null where id = 1");

q("delete from private.rate_window");
let limited = 0;
for (let i = 0; i < 25; i++) if (writer(`private.consume_rate('${uidC}'::uuid)`).error === "rate_limited") limited++;
t("identity ceiling survives rotated calls", limited === 5 && q("select count(*) from private.rate_window") === "2");
q("delete from private.rate_window");
let globalLimited = 0;
for (let i = 0; i < 55; i++) {
  const uid = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
  if (writer(`private.consume_rate('${uid}'::uuid)`).error === "rate_limited") globalLimited++;
}
t("global request ceiling", globalLimited === 5);
q("delete from private.rate_window");
let creates = 0;
for (let day = 1; day <= 9; day++) {
  const id = `99999999-9999-4999-8999-${String(day).padStart(12, "0")}`;
  const result = writer(`private.start_run('${id}'::uuid, '2026-03-${String(day).padStart(2, "0")}'::date, '${uidD}'::uuid)`);
  if (result.error === "rate_limited") creates++;
}
t("identity create ceiling", creates === 1 && q("select count(*) from private.attempts where auth_uid = '" + uidD + "'") === "8");

q("insert into private.technical_event (run_id, kind, created_at) values ('" + runA + "', 'old', now() - interval '8 days')");
q("insert into private.rate_window (bucket, window_start, n) values ('old-window', now() - interval '8 days', 1)");
const removed = q("select private.retain_technical()");
t("seven day technical expiry", Number(removed) === 2 && q("select count(*) from private.technical_event where kind = 'old'") === "0" && q("select count(*) from private.rate_window where bucket = 'old-window'") === "0" && q("select count(*) from private.dedup") === "2" && q("select finishes from private.day_agg where day_key = '2026-11-07'") === "2");
const runsBefore = q("select count(*) from private.runs");
const erasure = JSON.parse(q(`select private.deletion_request('${uidA}'::uuid, '${runA}'::uuid)`));
t("deletion stays closed without contact", erasure.error === "operator_contact_unconfigured" && q("select count(*) from private.runs") === runsBefore);
const foreign = JSON.parse(q(`select private.deletion_request('${uidB}'::uuid, '${runA}'::uuid)`));
t("deletion rejects another identity", foreign.error === "not_found" && q("select count(*) from private.runs") === runsBefore);
q("update private.field_gate set operator_contact = 'ops@example.com' where id = 1");
const stillThere = JSON.parse(q(`select private.deletion_request('${uidA}'::uuid, '${runA}'::uuid)`));
t("configured contact still does not erase", stillThere.error === "erasure_not_enabled" && q("select count(*) from private.runs") === runsBefore && q("select count(*) from private.dedup") === "2");
q("update private.field_gate set operator_contact = null where id = 1");

const uidRA = "a1111111-1111-4111-8111-111111111111";
const uidRB = "b2222222-2222-4222-8222-222222222222";
const uidRV = "c3333333-3333-4333-8333-333333333333";
const runHonest = "15151515-1515-4151-8151-151515151515";
const runRandom = "16161616-1616-4161-8161-161616161616";
const runOther = "17171717-1717-4171-8171-171717171717";
const runStale = "18181818-1818-4181-8181-181818181818";
const runWide = "19191919-1919-4191-8191-191919191919";
const scoresWide = "{100,200,300,400,500}";
const scoresNarrow = "{10,20,30,40,50}";
function shot(day, run, uid) {
  const id = run == null ? "null::uuid" : `'${run}'::uuid`;
  return writer(`private.day_snapshot('${day}'::date, ${id}, '${uid}'::uuid)`);
}
function hidden(row, own, rest, included) {
  return row.comparison_available === false && row.reason === "below_threshold" && row.histogram == null && row.rest_average == null && row.rest_category_average == null && row.own_included === included && row.own_total === own && row.rest_finishes === rest;
}
q("delete from private.rate_window");
q("update private.field_gate set min_other_finishes = 1 where id = 1");
writer(`private.start_run('${runStale}'::uuid, '2026-11-19'::date, '${uidRA}'::uuid)`);
writer(`private.finish_run('${runStale}'::uuid, '2026-11-19'::date, '${uidRA}'::uuid, '{1,1,1,1,1}'::int[])`);
writer(`private.start_run('${runHonest}'::uuid, '2026-11-20'::date, '${uidRA}'::uuid)`);
writer(`private.finish_run('${runHonest}'::uuid, '2026-11-20'::date, '${uidRA}'::uuid, '${scoresWide}'::int[])`);
const reproIds = [runHonest, runRandom, runOther, runStale, null];
t("review repro 1 stays below threshold for every run id", reproIds.every(id => hidden(shot("2026-11-20", id, uidRA), 1500, 0, true)));
writer(`private.start_run('${runWide}'::uuid, '2026-11-21'::date, '${uidRA}'::uuid)`);
writer(`private.finish_run('${runWide}'::uuid, '2026-11-21'::date, '${uidRA}'::uuid, '${scoresWide}'::int[])`);
writer(`private.start_run('${runOther}'::uuid, '2026-11-21'::date, '${uidRB}'::uuid)`);
writer(`private.finish_run('${runOther}'::uuid, '2026-11-21'::date, '${uidRB}'::uuid, '${scoresNarrow}'::int[])`);
q("update private.field_gate set min_other_finishes = 2 where id = 1");
const repro2 = [runOther, runRandom, runHonest, runStale, null].map(id => shot("2026-11-21", id, uidRB));
t("review repro 2 does not publish the other score", repro2.every(row => hidden(row, 150, 1, true)) && repro2.every(row => row.rest_finishes !== 2 && Number(row.rest_average) !== 825));
t("caller A is closed for a random id at threshold 2", hidden(shot("2026-11-21", runRandom, uidRA), 1500, 1, true));
q("update private.field_gate set min_other_finishes = 1 where id = 1");
const openA = shot("2026-11-21", runRandom, uidRA);
const openB = shot("2026-11-21", runHonest, uidRB);
t("random id still excludes caller categories", openA.comparison_available === true && openA.rest_finishes === 1 && Number(openA.rest_average) === 150 && openA.histogram.join(",") === "1,0,0,0,0" && openA.rest_category_average.map(Number).join(",") === "10,20,30,40,50" && openA.own_bin === 1);
t("other user id still excludes caller histogram", openB.comparison_available === true && openB.rest_finishes === 1 && Number(openB.rest_average) === 1500 && openB.histogram.join(",") === "0,1,0,0,0" && openB.rest_category_average.map(Number).join(",") === "100,200,300,400,500" && openB.own_bin === 0);
const visitorHonest = shot("2026-11-21", runHonest, uidRV);
const visitorRandom = shot("2026-11-21", runRandom, uidRV);
t("unsubmitted visitor is not opted into an exclusion", visitorHonest.own_included === false && visitorHonest.rest_finishes === 2 && Number(visitorHonest.rest_average) === 825 && visitorHonest.histogram.join(",") === "1,1,0,0,0" && JSON.stringify(visitorHonest.rest_category_average) === JSON.stringify(visitorRandom.rest_category_average));
q("update private.field_gate set min_other_finishes = 3 where id = 1");
const visitorClosed = shot("2026-11-21", runOther, uidRV);
t("visitor sample stays hidden under the threshold", visitorClosed.comparison_available === false && visitorClosed.histogram == null && visitorClosed.rest_average == null && visitorClosed.own_included === false && visitorClosed.rest_finishes === 2);
q("update private.field_gate set min_other_finishes = 1 where id = 1");
const wrongDay = shot("2026-11-19", runHonest, uidRA);
t("wrong-day run id does not select that day's score", hidden(wrongDay, 5, 0, true));
const body = psql(["-q", "-t", "-A", "-c", "select pg_get_functiondef('private.day_snapshot(date,uuid,uuid)'::regprocedure)"]);
t("snapshot definition ignores the client run id", /auth_uid = p_uid/.test(body) && !/run_id\s*=\s*p_run_id/.test(body));

t("runtime login has no inherited power and no password", q("select rolcanlogin::text || ',' || rolsuper::text || ',' || rolinherit::text || ',' || rolbypassrls::text from pg_roles where rolname = 'field_runtime'") === "true,false,false,false" && q("select rolpassword is null from pg_authid where rolname = 'field_runtime'") === "t" && q("select pg_has_role('field_runtime', 'app_writer', 'member')") === "t");
t("runtime cannot call the snapshot until it sets the writer role", attempt("field_runtime", "select private.day_snapshot('2026-11-21'::date, null::uuid, '" + uidRA + "'::uuid)") === "42501");
const viaRuntime = runtimeCall(`private.day_snapshot('2026-11-21'::date, '${runRandom}'::uuid, '${uidRA}'::uuid)`);
t("runtime writer path matches the direct writer path", viaRuntime.rest_finishes === 1 && Number(viaRuntime.rest_average) === 150 && viaRuntime.histogram.join(",") === "1,0,0,0,0");
t("runtime cannot read the contact or schedule retention", attempt("field_runtime", "select operator_contact from private.field_gate") === "42501" && attempt("app_writer", "select private.retain_technical()") === "42501" && attempt("field_runtime", "select private.deletion_request('" + uidRA + "'::uuid, '" + runHonest + "'::uuid)") === "42501" && q("select count(*) from pg_extension where extname = 'pg_cron'") === "0");

const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const handler = fs.readFileSync(path.join(root, "supabase/functions/field-compare/handler.js"), "utf8");
const entry = fs.readFileSync(path.join(root, "supabase/functions/field-compare/index.ts"), "utf8");
const plan = fs.readFileSync(path.join(root, "supabase/staging-retention-plan.md"), "utf8");
const sql = migrations.map(file => fs.readFileSync(file, "utf8")).join("\n");
t("frontend collection stays off", /const G1_COLLECTION_OFF = true;/.test(app) && !app.includes("field-api") && !app.includes("sb_secret"));
t("deploy path requires the runtime login and a verified session", entry.includes("Deno.serve") && entry.includes("session_user") && entry.includes("field_runtime") && entry.includes("set_config('role', 'app_writer', true)") && entry.includes("getClaims") && !entry.includes("SERVICE_ROLE") && !entry.includes("deletion_request") && !/password\s*=/i.test(entry));
t("retention plan is explicit and not scheduled", /not enabled/i.test(plan) && /not executed by this repository/.test(plan) && /retain_technical/.test(plan) && /7 days/.test(plan) && !/cron\.schedule/.test(sql) && !/password\s+'/i.test(sql));
t("handler has no memory counter or delete route", !handler.includes("new Map") && !handler.includes("request.text(") && !handler.includes("deletion_request"));
t("definer functions stay private", !/create (or replace )?function public\./i.test(sql) && /enable row level security/.test(sql));

(async () => {
  const { validateFinish } = await import(pathToFileURL(path.join(root, "supabase/functions/field-compare/field-api.js")).href);
  t("adapter rejects a client identity field", validateFinish({ runId: runA, day: "2026-11-07", playerDayHash: "player-a-isolated-1", scores: [200, 200, 200, 200, 200] }).ok === false);
  t("adapter accepts scores without an identity field", validateFinish({ runId: runA, day: "2026-11-07", scores: [200, 200, 200, 200, 200] }).ok === true);
  const [left, right] = await Promise.all([
    psqlAsync(`begin; set local role app_writer; select private.day_snapshot('2026-11-21'::date, '${runRandom}'::uuid, '${uidRA}'::uuid); commit;`),
    psqlAsync(`begin; set local session authorization field_runtime; set local role app_writer; select private.day_snapshot('2026-11-21'::date, '${runHonest}'::uuid, '${uidRB}'::uuid); commit;`)
  ]);
  const sideA = JSON.parse(left);
  const sideB = JSON.parse(right);
  t("concurrent snapshots keep each caller's categories", sideA.histogram.join(",") === "1,0,0,0,0" && sideA.rest_category_average.map(Number).join(",") === "10,20,30,40,50" && sideB.histogram.join(",") === "0,1,0,0,0" && sideB.rest_category_average.map(Number).join(",") === "100,200,300,400,500" && sideB.own_total === 150);
  q("update private.field_gate set min_other_finishes = null where id = 1");
  q("delete from private.rate_window");
  const runC = "44444444-4444-4444-8444-444444444444";
  const runD = "55555555-5555-4555-8555-555555555555";
  const sqlFor = (name, args) => {
    if (name === "consume_rate") return `private.consume_rate('${args[0]}'::uuid)`;
    if (name === "start_run") return `private.start_run('${args[0]}'::uuid, '${args[1]}'::date, '${args[2]}'::uuid)`;
    if (name === "finish_run") return `private.finish_run('${args[0]}'::uuid, '${args[1]}'::date, '${args[2]}'::uuid, '{${args[3].join(",")}}'::int[])`;
    return `private.day_snapshot('${args[0]}'::date, '${args[1]}'::uuid, '${args[2]}'::uuid)`;
  };
  writer(`private.start_run('${runC}'::uuid, '2026-11-08'::date, '${uidC}'::uuid)`);
  writer(`private.start_run('${runD}'::uuid, '2026-11-08'::date, '${uidD}'::uuid)`);
  const both = await Promise.all([
    psqlAsync(`begin; set local role app_writer; select private.finish_run('${runC}'::uuid, '2026-11-08'::date, '${uidC}'::uuid, '{100,0,0,0,0}'::int[]); commit;`),
    psqlAsync(`begin; set local role app_writer; select private.finish_run('${runD}'::uuid, '2026-11-08'::date, '${uidD}'::uuid, '{0,100,0,0,0}'::int[]); commit;`)
  ]);
  t("concurrent different identities", both.every(s => JSON.parse(s).ok === true) && q("select finishes from private.day_agg where day_key = '2026-11-08'") === "2");
  const { createFieldHandler } = await import(pathToFileURL(path.join(root, "supabase/functions/field-compare/handler.js")).href);
  const uidE = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const httpDb = { async call(name, args) { return writer(sqlFor(name, args)); } };
  const handle = createFieldHandler({
    collection: "on",
    allowedOrigins: ["https://lukebiasi11.github.io"],
    db: httpDb,
    getClaims: async () => ({ data: { claims: { role: "authenticated", is_anonymous: true, sub: uidE } } })
  });
  const runE = "66666666-6666-4666-8666-666666666666";
  const headers = { origin: "https://lukebiasi11.github.io", "content-type": "application/json", authorization: "Bearer session" };
  const startRes = await handle(new Request("http://local/field-compare/start", { method: "POST", headers, body: JSON.stringify({ runId: runE, day: "2026-11-09" }) }));
  const finishRes = await handle(new Request("http://local/field-compare/finish", { method: "POST", headers, body: JSON.stringify({ runId: runE, day: "2026-11-09", scores: [400, 0, 0, 0, 0] }) }));
  const dayRes = await handle(new Request("http://local/field-compare/day?day=2026-11-09&runId=" + runE, { method: "GET", headers }));
  const day = await dayRes.json();
  t("http adapter writes as app_writer", (await startRes.json()).ok === true && (await finishRes.json()).total === 400 && day.comparison_available === false && day.reason === "threshold_unresolved" && day.own_included === true && day.histogram === null && q("select auth_uid::text from private.runs where run_id = '" + runE + "'") === uidE);
  console.log(bad ? bad + " failures" : "field-compare.pg.test.js: all pass");
  process.exit(bad ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
