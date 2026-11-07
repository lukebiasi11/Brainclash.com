// Local Postgres only. No Supabase project, secret, or network.
const { execFileSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const db = "bc_field_compare_local";
const migration = path.join(root, "supabase/migrations/20261107032646_field_compare.sql");
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
    const child = spawn("sudo", ["-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-d", db, "-t", "-A", "-c", sql]);
    let out = "", err = "";
    child.stdout.on("data", d => { out += d; });
    child.stderr.on("data", d => { err += d; });
    child.on("close", code => code === 0 ? resolve(out.trim()) : reject(new Error(err || out)));
  });
}

execFileSync("sudo", ["-u", "postgres", "psql", "-d", "postgres", "-c", `drop database if exists ${db}`]);
execFileSync("sudo", ["-u", "postgres", "psql", "-d", "postgres", "-c", `create database ${db}`]);
psql(["-f", migration]);

const off = JSON.parse(q(`select private.finish_run('11111111-1111-4111-8111-111111111111', '2026-11-07', 'player-a-isolated-1', '{200,200,200,200,200}')`));
t("collection off writes nothing", off.error === "collection_off" && q("select count(*) from private.runs") === "0");
t("anon cannot read runs", q(`
  create or replace function pg_temp.anon_read() returns text language plpgsql as $fn$
  begin
    set local role anon;
    perform 1 from private.runs;
    reset role;
    return 'allowed';
  exception when insufficient_privilege then
    reset role;
    return 'denied';
  end $fn$;
  select pg_temp.anon_read();
`) === "denied");
t("anon status is off", q("set role anon; select collection_enabled::text from public.collection_status; reset role;") === "false");
t("anon cannot enable collection", q(`
  create or replace function pg_temp.anon_on() returns text language plpgsql as $fn$
  begin
    set local role anon;
    update public.field_gate set collection_enabled = true where id = 1;
    reset role;
    return 'allowed';
  exception when insufficient_privilege then
    reset role;
    return 'denied';
  end $fn$;
  select pg_temp.anon_on();
`) === "denied");

q("update public.field_gate set collection_enabled = true where id = 1");
const badHash = JSON.parse(q(`select private.start_run('11111111-1111-4111-8111-111111111111', '2026-11-07', 'player@email.test')`));
t("rejects email-shaped hash", badHash.error === "invalid_input" && q("select count(*) from private.attempts") === "0");

const runA = "11111111-1111-4111-8111-111111111111";
const runA2 = "22222222-2222-4222-8222-222222222222";
const runB = "33333333-3333-4333-8333-333333333333";
const hashA = "player-a-isolated-1";
const hashB = "player-b-isolated-2";
const scoresA = "{200,200,200,200,200}";
const scoresB = "{100,100,100,100,100}";
t("start required", JSON.parse(q(`select private.finish_run('${runA}', '2026-11-07', '${hashA}', '${scoresA}')`)).error === "start_required");
const started = JSON.parse(q(`select private.start_run('${runA}', '2026-11-07', '${hashA}')`));
const startedAgain = JSON.parse(q(`select private.start_run('${runA}', '2026-11-07', '${hashA}')`));
t("start idempotent", started.ok === true && started.idempotent === false && startedAgain.idempotent === true && q("select count(*) from private.technical_event where kind = 'start'") === "1");
const finished = JSON.parse(q(`select private.finish_run('${runA}', '2026-11-07', '${hashA}', '${scoresA}')`));
const finishedAgain = JSON.parse(q(`select private.finish_run('${runA}', '2026-11-07', '${hashA}', '${scoresA}')`));
t("finish once", finished.ok === true && finished.idempotent === false && finished.total === 1000 && finished.bin === 1);
t("finish replay", finishedAgain.idempotent === true && q("select finishes from private.day_agg where day_key = '2026-11-07'") === "1");
q(`select private.start_run('${runA2}', '2026-11-07', '${hashA}')`);
t("one player-day", JSON.parse(q(`select private.finish_run('${runA2}', '2026-11-07', '${hashA}', '${scoresA}')`)).error === "player_day_exists");
q(`select private.start_run('${runB}', '2026-11-07', '${hashB}')`);
q(`select private.finish_run('${runB}', '2026-11-07', '${hashB}', '${scoresB}')`);
const unresolved = JSON.parse(q(`select private.day_snapshot('2026-11-07', '${runA}')`));
t("threshold unresolved hides comparison", unresolved.comparison_available === false && unresolved.reason === "threshold_unresolved" && unresolved.histogram === null && unresolved.own_total === 1000 && unresolved.own_included === true && unresolved.rest_finishes === 1);
q("update public.field_gate set min_other_finishes = 1 where id = 1");
const snap = JSON.parse(q(`select private.day_snapshot('2026-11-07', '${runA}')`));
t("excludes own score", snap.comparison_available === true && Number(snap.rest_average) === 500 && snap.own_bin === 1 && snap.histogram.join(",") === "1,0,0,0,0" && snap.rest_category_average.every(n => Number(n) === 100));
q("update public.field_gate set min_other_finishes = 5 where id = 1");
const below = JSON.parse(q(`select private.day_snapshot('2026-11-07', '${runA}')`));
t("below an operator threshold", below.comparison_available === false && below.reason === "below_threshold" && below.histogram === null);
q("update public.field_gate set min_other_finishes = null where id = 1");

q("insert into private.technical_event (run_id, kind, created_at) values ('" + runA + "', 'old', now() - interval '8 days')");
const removed = q("select private.retain_technical()");
t("seven day technical expiry", removed === "1" && q("select count(*) from private.technical_event where kind = 'old'") === "0" && q("select count(*) from private.dedup") === "2" && q("select finishes from private.day_agg") === "2");
const erasure = JSON.parse(q(`select private.deletion_request('${runA}')`));
t("deletion fail closed", erasure.error === "operator_contact_unconfigured" && q("select count(*) from private.runs") === "2" && q("select count(*) from private.dedup") === "2");

const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const api = fs.readFileSync(path.join(root, "supabase/field-api.js"), "utf8");
const sql = fs.readFileSync(migration, "utf8");
t("frontend collection stays off", /const G1_COLLECTION_OFF = true;/.test(app) && !app.includes("field-api") && !app.includes("sb_secret"));
t("adapter has no secret or url", !/sb_secret|service_role|supabase\.co/.test(api));
t("definer functions are private", !/create (or replace )?function public\./i.test(sql) && /security_invoker = true/.test(sql) && /enable row level security/.test(sql));
const { validateFinish } = require(path.join(root, "supabase/field-api.js"));
t("adapter rejects bad body", validateFinish({ runId: runA, day: "2026-11-07", playerDayHash: "short", scores: [1, 1, 1, 1, 1] }).ok === false);
t("adapter accepts synthetic body", validateFinish({ runId: runA, day: "2026-11-07", playerDayHash: hashA, scores: [200, 200, 200, 200, 200] }).ok === true);

(async () => {
  q("update public.field_gate set collection_enabled = true, min_other_finishes = null where id = 1");
  const runC = "44444444-4444-4444-8444-444444444444";
  const runD = "55555555-5555-4555-8555-555555555555";
  q(`select private.start_run('${runC}', '2026-11-08', 'player-c-isolated-3')`);
  q(`select private.start_run('${runD}', '2026-11-08', 'player-d-isolated-4')`);
  const both = await Promise.all([
    psqlAsync(`select private.finish_run('${runC}', '2026-11-08', 'player-c-isolated-3', '{100,0,0,0,0}')`),
    psqlAsync(`select private.finish_run('${runD}', '2026-11-08', 'player-d-isolated-4', '{0,100,0,0,0}')`)
  ]);
  t("concurrent different players", both.every(s => JSON.parse(s).ok === true) && q("select finishes from private.day_agg where day_key = '2026-11-08'") === "2");
  console.log(bad ? bad + " failures" : "field-compare.pg.test.js: all pass");
  process.exit(bad ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });

function psqlAsync(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn("sudo", ["-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-d", db, "-t", "-A", "-c", sql]);
    let out = "", err = "";
    child.stdout.on("data", d => { out += d; });
    child.stderr.on("data", d => { err += d; });
    child.on("close", code => code === 0 ? resolve(out.trim()) : reject(new Error(err || out)));
  });
}
