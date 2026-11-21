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

function post(uid, day, name, sc, device) {
  const dev = device ? `'${device}'::uuid` : "null";
  return JSON.parse(q(`select private.board_post('${uid}'::uuid, '${day}'::date, '${name.replace(/'/g, "''")}', ${sc || scores}, ${dev})::text`));
}
function week(day, section) {
  return JSON.parse(q(`select private.board_week_public('${day}'::date, '${section}')::text`));
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
t("retention clears the device id too", q("select position('device_id = null' in pg_get_functiondef('private.retain_board_names()'::regprocedure)) > 0") === "t");

const devA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const devB = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const devC = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const uidC = "cccccccc-cccc-4ccc-8ccc-cccccccccc01";
const uidD = "dddddddd-dddd-4ddd-8ddd-dddddddddd02";
const uidE = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee03";
const mon = "2026-11-23";
const tue = "2026-11-24";
const sun = "2026-11-22";
const monScores = "'{100,10,0,0,5}'::int[]";
const tueScores = "'{40,0,0,0,7}'::int[]";
t("sunday night is still the old new york day", q("select private.board_ny_day('2026-11-23 04:59:00+00')::text") === sun);
t("monday midnight new york starts the new day", q("select private.board_ny_day('2026-11-23 05:00:00+00')::text") === mon);
t("july midnight uses eastern daylight, not a fixed offset", q("select private.board_ny_day('2026-07-06 03:30:00+00')::text") === "2026-07-05" && q("select private.board_ny_day('2026-07-06 04:00:00+00')::text") === "2026-07-06");
const nyNow = q("select private.board_ny_day(now())::text");
const liveWeek = JSON.parse(q("select private.board_week('overall')::text"));
const viaWeek = week(nyNow, "overall");
t("live week uses the daily new york day", liveWeek.from === viaWeek.from && liveWeek.to === viaWeek.to && liveWeek.served === true);
function defines(signature, snippet) {
  return q(`select position('${snippet}' in pg_get_functiondef('${signature}'::regprocedure)) > 0`) === "t";
}
t("daily and weekly name the same new york clock", defines("private.board_public(date, text)", "timezone(''America/New_York'', now())") && defines("private.board_week(text)", "timezone(''America/New_York'', now())"));
t("monday opens a new week", week(sun, "overall").from === "2026-11-16" && week(sun, "overall").to === "2026-11-22" && week(mon, "overall").from === "2026-11-23" && week(mon, "overall").to === "2026-11-29");
t("week label crosses months", week("2026-11-30", "overall").from === "2026-11-30" && week("2026-11-30", "overall").to === "2026-12-06");
t("luna's monday posts", post(uidC, mon, "Luna", monScores, devA).ok === true);
t("same device tuesday keeps the id and the new name", post(uidC, tue, "Nico", tueScores, devA).ok === true);
const summed = week(tue, "overall");
const nico = summed.rows.find(r => r.name === "Nico");
t("weekly total adds the days under the current name", summed.served === true && summed.rows.filter(r => r.name === "Nico" || r.name === "Luna").length === 1 && nico && nico.score === 162, JSON.stringify(summed));
t("think slot adds category 5 across the week", week(tue, "think").rows.find(r => r.name === "Nico").score === 12);
t("world slot adds category 1 across the week", week(tue, "world").rows.find(r => r.name === "Nico").score === 140);
t("sunday is not in monday's week", !week(mon, "overall").rows.some(r => r.name === "Edge" || r.name === "Oldie"));
post(uidD, sun, "Luna", "'{9,0,0,0,0}'::int[]", devB);
post(uidD, mon, "Luna", "'{8,0,0,0,0}'::int[]", devB);
const sunLuna = week(sun, "overall").rows.filter(r => r.name === "Luna");
const monLuna = week(mon, "overall").rows.filter(r => r.name === "Luna");
t("monday reset drops sunday's points", sunLuna.length === 1 && sunLuna[0].score === 9 && monLuna.some(r => r.score === 8) && monLuna.every(r => r.score !== 9));
post(uidE, tue, "Luna", "'{300,0,0,0,0}'::int[]", devC);
const twins = week(tue, "overall").rows.filter(r => r.name === "Luna" || r.name === "Nico");
t("two players with the same name stay separate", week(tue, "overall").rows.filter(r => r.name === "Luna").length === 2, JSON.stringify(twins));
t("weekly rows hide the device id", !JSON.stringify(week(tue, "overall")).includes(devA) && !JSON.stringify(week(tue, "overall")).includes(uidC));
const blankDev = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const blank = post(uidE, mon, "   ", "'{1,1,1,1,1}'::int[]", blankDev);
t("unnamed post is rejected and stores no device", blank.error === "name_required" && q(`select count(*) from private.board_post where device_id = '${blankDev}'`) === "0");
const idMon = q(`select id::text from private.board_post where day_key = '${mon}' and device_id = '${devA}'`);
const renamedWeek = JSON.parse(q(`select private.board_rename('${idMon}'::uuid, 'Sol')::text`));
t("rename applies to both days and the week", renamedWeek.ok === true && renamedWeek.name === "Sol" && q(`select count(*) from private.board_post where device_id = '${devA}' and display_name = 'Sol'`) === "2" && week(tue, "overall").rows.some(r => r.name === "Sol" && r.score === 162));
const removedMon = JSON.parse(q(`select private.board_remove('${idMon}'::uuid)::text`));
const afterRemove = week(tue, "overall").rows.find(r => r.name === "Sol");
t("remove drops that day from the weekly sum", removedMon.removed === true && afterRemove && afterRemove.score === 47, JSON.stringify(afterRemove));
const idTue = q(`select id::text from private.board_post where day_key = '${tue}' and device_id = '${devA}'`);
JSON.parse(q(`select private.board_remove('${idTue}'::uuid)::text`));
t("removing the last day drops the player", !week(tue, "overall").rows.some(r => r.name === "Sol"));
const full = [];
for (let i = 1; i <= 11; i++) {
  const id = i.toString(16).padStart(12, "0");
  const uid = `10000000-0000-4000-8000-${id}`;
  const dev = `20000000-0000-4000-8000-${id}`;
  full.push(post(uid, tue, "P" + String(i).padStart(2, "0"), `'{${i},0,0,0,0}'::int[]`, dev).ok);
}
const listed = week(tue, "overall");
t("full list is not capped at 10", full.every(Boolean) && listed.rows.length >= 11 && listed.rows.length > 10, String(listed.rows.length));
const oldNamed = post("abababab-abab-4bab-8bab-abababababab", "2026-10-01", "OldWeek", "'{3,0,0,0,0}'::int[]", "babababa-baba-4aba-8aba-babababababa");
t("a week older than 30 days is not the served week", oldNamed.ok === true && !week("2026-11-21", "overall").rows.some(r => r.name === "OldWeek"));
t("weekly read keeps the 30 day window", defines("private.board_week_public(date, text)", "p_today - 30"));
const freshDev = "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd";
post("cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd01", today, "Kept", "'{4,0,0,0,0}'::int[]", freshDev);
q(`update private.board_post set posted_at = now() - interval '10 days' where device_id = '${freshDev}'`);
q("select private.retain_board_names()");
t("a recent device id stays linked", q(`select device_id::text from private.board_post where display_name = 'Kept'`) === freshDev);
q(`update private.board_post set posted_at = now() - interval '91 days' where device_id = '${freshDev}'`);
const unlinked = q("select private.retain_board_names()");
t("90 day job unlinks the device id and keeps the aggregate", Number(unlinked) >= 1 && q(`select device_id is null and display_name is null from private.board_post where auth_uid = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd01'`) === "t" && q(`select count(*) from private.board_agg where day_key = '${today}'`) === "1");
const weeklySql = fs.readFileSync(path.join(root, "supabase/migrations/20261121190000_weekly_board.sql"), "utf8");
t("weekly migration does not touch field tables", !/collection_status|private\.attempts|private\.runs|private\.dedup|private\.day_agg|cron\.schedule/.test(weeklySql));
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
t("board runtime can read the week", attempt("board_runtime", "select private.board_week('overall')") === "allowed");
t("board runtime cannot call the week helper", attempt("board_runtime", "select private.board_week_public('2026-11-23'::date, 'overall')") === "42501");
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
