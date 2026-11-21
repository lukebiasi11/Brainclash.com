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
t("public board is names and scores", rows.served === true && rows.rows.length === 2 && rows.rows.every(r => r.name && typeof r.score === "number" && !r.id && !r.auth_uid && typeof r.token === "string" && r.token.length > 10));
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
const Filter = require(path.join(root, "name-filter.js"));
const quote = s => "'" + String(s).replace(/'/g, "''") + "'";
const parity = ["Luna", "Nico", "José", "O'Brien", "Ana Maria", "Max", "Ashley", "Lucas", "Al", "Daily Dose", "mod1", "hello.com", "hello .com", "f u c k", "a55", "xxx", "n i g g e r", "xnigger", "nigger99", "pussy99", "a s s h o l e", "j i z z", "f a g g o t", "support99", "staffer", "modteam", "Modesto", "Essex", "Peacock", "Dickens", "Titan", "Scunthorpe", "Nigel", "Night", "Tito", "Stafford", "Sexton", "Esperanza", "Analía", "nigel nigger", "nigelnigger", "n i g e l", "Niggel", "ni Nigel ger", "Dick", "cock", "player4821", "PLAYER 4821", "Player  4821", "Jugador  0001", "JUGADOR0001", "jugador 1234", "Player", "player 482", "player48210"].concat(Filter.ALLOW, ["Knight", "Nigella", "Niger", "Petit", "Cumbria", "Annalise", "Conor", "Zora", "Fagan", "Grape", "Drapes", "Badminton", "Moderna", "Commodore", "Yoshito", "Hoshitani", "Pornchai", "Swank", "Mammon", "Pola", "Shitake", "Therapeutic", "Pitot", "Dick Van Dyke", "Ana Luz", "Ana-Luz", "Diana Lopez", "Hana Lee", "Juana Lima", "Matt Ito", "Cassie", "Bass", "Van Dyke", "nіgger", "fuсk", "nıgger", "ｎｉｇｇｅｒ", "ｆｕｃｋ", "𝐟𝐮𝐜𝐤𝐞𝐫", "Ⓕⓤⓒⓚ", "Nigel nіgger", "Nigel ｎｉｇｇｅｒ", "niqqer", "nlgger", "fæggot", "Titan fuck", "fu Titan ck", "sh Night it", "cu Nigel nt", "Peacock cock", "Nigel n1gg3r", "ass", "a s s", "ass99", "tits", "s3x", "p0rn", "cum shot", "cocksucker", "wanker", "hijo de puta", "coño", "maricón", "coon", "tranny", "kike", "spic", "chink", "gook", "beaner", "wetback", "dyke", "paki", "raghead", "kkk", "nazi", "hitler", "1488", "Heil Hitler", "c o o n", "t r a n n y", "bollocks", "culo", "chinga", "mamaguevo", "pinga", "pr0n", "boobs", "semen", "Player-1234", "Player'1234", "Pl4yer 1234", "Player １２３４", "Plаyer 1234", "Nigel Player1234", "Titan player 1234", "Player 1234 Nigel", "Player 1234", "Player_1234", "staff", "admin", "mod", "sex", "tit", "DailyDose", "d4ily d0se", "sh1t", "f-u-c-k"]);
let parityBad = 0;
parity.forEach(name => {
  const js = Filter.checkName(name);
  const sql = JSON.parse(q("select private.board_name_status(" + quote(name) + ")::text"));
  const jsReason = js.skip ? "skip" : js.ok ? "ok" : js.reason;
  const sqlReason = sql.skip ? "skip" : sql.ok ? "ok" : sql.reason;
  if (jsReason !== sqlReason) { parityBad++; console.log("FAIL parity", name, jsReason, sqlReason); }
});
t("client and sql verdicts match", parityBad === 0, String(parityBad));
const uidC = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const anonPost = JSON.parse(q(`select private.board_post('${uidC}'::uuid, '${today}'::date, null, ${scores})::text`));
const anonTag = Number(q(`select player_tag::text from private.board_post where auth_uid = '${uidC}' and day_key = '${today}'`));
t("anonymous insert skips the filter", anonPost.ok === true && anonPost.token && q(`select display_name is null from private.board_post where auth_uid = '${uidC}' and day_key = '${today}'`) === "t" && anonTag >= 1000 && anonTag <= 9999);
const uidD = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const anonTwo = JSON.parse(q(`select private.board_post('${uidD}'::uuid, '${today}'::date, null, ${scores})::text`));
const tagTwo = Number(q(`select player_tag::text from private.board_post where auth_uid = '${uidD}' and day_key = '${today}'`));
t("tags are unique within a day", anonTwo.ok === true && tagTwo !== anonTag && tagTwo >= 1000 && tagTwo <= 9999);
t("tag is not on the aggregate", q("select count(*) from information_schema.columns where table_schema = 'private' and column_name = 'player_tag' and table_name <> 'board_post'") === "0");
t("tag picker ignores the user id", !q("select pg_get_functiondef('private.board_pick_tag(date)'::regprocedure)").includes("auth_uid"));
const dupTag = q(`
  create or replace function pg_temp.dup_tag() returns text language plpgsql as $fn$
  begin
    insert into private.board_post (day_key, auth_uid, display_name, player_tag, scores, total)
    values ('${today}', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', null, ${anonTag}, '{1,1,1,1,1}', 5);
    return 'allowed';
  exception when unique_violation then
    return 'unique';
  end $fn$;
  select pg_temp.dup_tag();
`);
t("same day and tag is rejected", dupTag === "unique", dupTag);
const blankPost = JSON.parse(q(`select private.board_post('${uidC}'::uuid, '${today}'::date, '', ${scores})::text`));
t("blank name stays one anonymous row", blankPost.idempotent === true && q(`select count(*) from private.board_post where auth_uid = '${uidC}' and day_key = '${today}'`) === "1");
const anonBoard = board(today, "overall");
const anonRow = anonBoard.rows.find(r => r.name == null);
t("anonymous rows are ranked", anonBoard.rows.length >= 1 && anonRow && anonRow.rank >= 1 && anonRow.score === 1050 && !anonRow.id);
const named = post(uidC, today, "Nico");
t("later name replaces anonymous", named.ok === true && named.idempotent === true && q(`select count(*)::text || ',' || display_name || ',' || (player_tag is null)::text from private.board_post where auth_uid = '${uidC}' and day_key = '${today}' group by display_name, player_tag`) === "1,Nico,true");
const anonId = q(`select id::text from private.board_post where auth_uid = '${uidC}' and day_key = '${today}'`);
q(`update private.board_post set display_name = null where id = '${anonId}'`);
const renamedAnon = JSON.parse(q(`select private.board_rename('${anonId}'::uuid, 'Sol')::text`));
t("admin can rename an anonymous row", renamedAnon.ok === true && renamedAnon.name === "Sol");
q(`update private.board_post set display_name = null where id = '${anonId}'`);
const removedAnon = JSON.parse(q(`select private.board_remove('${anonId}'::uuid)::text`));
t("admin can remove an anonymous row", removedAnon.removed === true && !board(today, "overall").rows.some(r => r.token === anonId));
const crowdDay = q(`select ('${today}'::date - 2)::text`);
q(`insert into private.board_post (day_key, auth_uid, display_name, scores, total)
  select '${crowdDay}'::date, gen_random_uuid(), 'Row' || i, array[i, 0, 0, 0, 0], i
  from generate_series(1, 105) as i`);
const crowd = board(crowdDay, "overall");
const lowId = q(`select id::text from private.board_post where day_key = '${crowdDay}' and total = 1`);
const low = JSON.parse(q(`select private.board_me('${crowdDay}'::date, 'overall', '${lowId}'::uuid)::text`));
t("board serves 100 of the true total", crowd.served === true && crowd.rows.length === 100 && crowd.total === 105);
t("a player below 100 still has a rank", low.found === true && low.rank === 105 && low.total === 105 && low.name === "Row1" && low.score === 1 && low.token === lowId);
psqlDb("postgres", ["-c", `drop database if exists ${db}`]);
console.log(bad ? bad + " failures" : "leaderboard.pg.test.js: all pass");
process.exit(bad ? 1 : 0);
