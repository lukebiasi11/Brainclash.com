// Local Postgres only. No Supabase project, secret, or network.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const db = "bc_board_local";
const migrations = fs.readdirSync(path.join(root, "supabase/migrations")).filter(name => name.endsWith(".sql")).sort().map(name => path.join(root, "supabase/migrations", name));
let bad = 0;
const t = (name, ok, extra) => { if (!ok) { bad++; console.log("FAIL", name, extra || ""); } else console.log("ok", name); };
function psqlDb(database, args, input) {
  return execFileSync("sudo", ["-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-d", database, ...args], { encoding: "utf8", input, maxBuffer: 8 * 1024 * 1024 });
}
function q(sql) {
  return psqlDb(db, ["-q", "-t", "-A", "-c", sql]).trim().split("\n").filter(Boolean).pop();
}
const uidA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const uidB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const scores = "'{400,300,200,100,50}'::int[]";

psqlDb("postgres", ["-c", `drop database if exists ${db}`]);
psqlDb("postgres", ["-c", `create database ${db}`]);
for (const file of migrations) psqlDb(db, ["-f", file]);

const before = q("select (select count(*) from private.attempts)::text || ',' || (select count(*) from private.runs) || ',' || (select count(*) from private.dedup) || ',' || (select count(*) from private.day_agg)");
t("field tables start empty", before === "0,0,0,0", before);

function post(uid, day, name, sc) {
  return JSON.parse(q(`select private.board_post('${uid}'::uuid, '${day}'::date, '${name.replace(/'/g, "''")}', ${sc || scores})::text`));
}
function board(day, section) {
  return JSON.parse(q(`select private.board_public('${day}'::date, '${section}')::text`));
}
const today = q("select (timezone('America/New_York', now()))::date::text");
t("luna posts", post(uidA, today, "Luna").ok === true);
t("daily dose rejected", post(uidB, today, "Daily Dose").error === "name_rejected" && post(uidB, today, "Daily Dose").reason === "impersonation");
t("phone rejected", post(uidB, today, "555-010-1234").reason === "contact");
t("leet profanity rejected", post(uidB, today, "sh1t").reason === "profanity");
t("spaced profanity rejected", post(uidB, today, "f u c k").reason === "profanity");
const jose = post(uidB, today, "José");
t("accented nickname posts", jose.ok === true, JSON.stringify(jose));
const rows = board(today, "overall");
t("public board is names and scores", rows.served === true && rows.rows.length === 2 && rows.rows.every(r => r.name && typeof r.score === "number" && !r.id && !r.auth_uid));
t("section score is that category", board(today, "world").rows.find(r => r.name === "Luna").score === 400);
const oldDay = q(`select ('${today}'::date - 31)::text`);
const edgeDay = q(`select ('${today}'::date - 30)::text`);
q(`insert into private.board_post (day_key, auth_uid, display_name, scores, total, posted_at) values ('${oldDay}', '${uidA}', 'Oldie', '{1,1,1,1,1}', 5, now())`);
q(`insert into private.board_post (day_key, auth_uid, display_name, scores, total, posted_at) values ('${edgeDay}', '${uidB}', 'Edge', '{2,2,2,2,2}', 10, now())`);
t("older than 30 days is not served", board(oldDay, "overall").served === false && board(oldDay, "overall").rows.length === 0);
t("30 day edge is served", board(edgeDay, "overall").served === true && board(edgeDay, "overall").rows[0].name === "Edge");
const id = q(`select id::text from private.board_post where display_name = 'Luna' and day_key = '${today}'`);
const renamed = JSON.parse(q(`select private.board_rename('${id}'::uuid, 'Nico')::text`));
t("rename", renamed.ok === true && renamed.name === "Nico" && board(today, "overall").rows.some(r => r.name === "Nico"));
const blockedRename = JSON.parse(q(`select private.board_rename('${id}'::uuid, 'admin')::text`));
t("rename uses the filter", blockedRename.error === "name_rejected" && board(today, "overall").rows.some(r => r.name === "Nico"));
const removed = JSON.parse(q(`select private.board_remove('${id}'::uuid)::text`));
t("remove drops the name", removed.removed === true && !board(today, "overall").rows.some(r => r.name === "Nico" || r.name === "Luna"));
const agg = q(`select n::text || ',' || sum_total::text from private.board_agg where day_key = '${today}'`);
t("anonymous total remains after removal", agg && agg.startsWith("2,"), agg);
q(`update private.board_post set posted_at = now() - interval '91 days' where display_name = 'José'`);
const cleared = q("select private.retain_board_names()");
t("90 day job clears the name", Number(cleared) >= 1 && q(`select display_name is null from private.board_post where auth_uid = '${uidB}' and day_key = '${today}'`) === "t");
t("90 day job keeps the aggregate", q(`select count(*) from private.board_agg where day_key = '${today}'`) === "1");
const again = post(uidB, today, "José");
t("cleared name is not restored", again.hidden === true && q(`select display_name is null from private.board_post where auth_uid = '${uidB}' and day_key = '${today}'`) === "t");
const def = q("select pg_get_functiondef('private.retain_board_names()'::regprocedure)");
t("retention does not name field score tables", !/attempts|runs|dedup|day_agg|technical_event|collection_status/.test(def));
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
t("runtime cannot read the board table", attempt("anon", "select display_name from private.board_post") === "42501");
t("field runtime cannot post a nickname", attempt("field_runtime", `select private.board_post('${uidA}'::uuid, '${today}'::date, 'Luna', '{1,1,1,1,1}'::int[])`) === "42501");
t("retention role cannot select posts", attempt("board_retention", "select display_name from private.board_post") === "42501");
t("board runtime can read the public board", attempt("board_runtime", `select private.board_public('${today}'::date, 'overall')`) === "allowed");
const checked = JSON.parse(q("select private.board_check_name('Luna')::text"));
t("check accepts a nickname", checked.ok === true && checked.name === "Luna" && !checked.year);
const checkedBad = JSON.parse(q("select private.board_check_name('Daily Dose')::text"));
t("check rejects on the server", checkedBad.ok === false && checkedBad.reason === "impersonation" && !JSON.stringify(checkedBad).includes("Daily"));
t("runtime can check a name", attempt("board_runtime", "select private.board_check_name('Luna')") === "allowed");
t("anon cannot check a name", attempt("anon", "select private.board_check_name('Luna')") === "42501");
t("no cron and no field rows touched", q("select count(*) from pg_extension where extname = 'pg_cron'") === "0" && q("select (select count(*) from private.attempts)::text || ',' || (select count(*) from private.runs) || ',' || (select count(*) from private.dedup) || ',' || (select count(*) from private.day_agg)") === before);
const sql = migrations.map(file => fs.readFileSync(file, "utf8")).join("\n");
t("migrations do not schedule cron", !/cron\.schedule/.test(sql));
psqlDb("postgres", ["-c", `drop database if exists ${db}`]);
console.log(bad ? bad + " failures" : "leaderboard.pg.test.js: all pass");
process.exit(bad ? 1 : 0);
