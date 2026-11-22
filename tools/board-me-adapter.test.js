// The real handler, through the SQL dispatch written in index.ts, against local Postgres.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const root = path.join(__dirname, "..");
const db = "bc_board_rank";
let bad = 0;
const t = (name, ok, extra) => { if (!ok) { bad++; console.log("FAIL", name, extra || ""); } else console.log("ok", name); };
function psql(database, args, input) {
  return execFileSync("sudo", ["-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-d", database, ...args], { encoding: "utf8", input, maxBuffer: 20 * 1024 * 1024 });
}
function q(sql) { return psql(db, ["-q", "-t", "-A", "-c", sql]).trim(); }

function adapter(src) {
  const listed = src.match(/const NAMES = new Set\(\[([^\]]+)\]\)/);
  const names = new Set(listed ? [...listed[1].matchAll(/"([^"]+)"/g)].map(m => m[1]) : []);
  function statement(name) {
    const found = src.match(new RegExp("if \\(name === \"" + name + "\"\\) return await tx`([^`]+)`"));
    return found ? found[1] : "";
  }
  return async function call(name, args) {
    const template = statement(name);
    if (!names.has(name) || !template) return { ok: false, error: "db_unavailable" };
    const sql = template.replace(/\$\{args\[(\d+)\]\}::(date|text|uuid|int\[\])/g, (_, index, type) => {
      const value = args[Number(index)];
      if (value == null) return "null::" + type;
      const text = String(value).replace(/'/g, "''");
      if (type === "int[]") return "'{" + value.join(",") + "}'::int[]";
      return "'" + text + "'::" + type;
    });
    return JSON.parse(q("select (" + sql + ")"));
  };
}

(async () => {
  const src = fs.readFileSync(path.join(root, "supabase/functions/leaderboard/index.ts"), "utf8");
  t("index dispatches board_me", src.includes('"board_me"') && src.includes("select private.board_me(${args[0]}::date, ${args[1]}::text, ${args[2]}::uuid) as result"));
  const migrations = fs.readdirSync(path.join(root, "supabase/migrations")).filter(name => name.endsWith(".sql")).sort().map(name => path.join(root, "supabase/migrations", name));
  psql("postgres", ["-c", "drop database if exists " + db]);
  psql("postgres", ["-c", "create database " + db]);
  for (const file of migrations) psql(db, ["-f", file]);
  const day = q("select (timezone('America/New_York', now()))::date::text");
  q(`
    insert into private.board_post (day_key, auth_uid, display_name, scores, total)
    select '${day}'::date, gen_random_uuid(), 'Ace ' || lpad(g::text, 3, '0'),
           array[1000, 1000 - g, 0, 0, 0]::int[], 2000 - g
    from generate_series(1, 180) g
  `);
  const token = q(`
    select id::text from (
      select id, rank() over (order by total desc, display_name asc, id asc) as place
      from private.board_post where day_key = '${day}'
    ) ranked where place = 140
  `);
  const { createBoardHandler, PUBLIC_ORIGINS } = await import(pathToFileURL(path.join(root, "supabase/functions/leaderboard/handler.js")).href);
  const handle = createBoardHandler({
    publicBoard: "on",
    operatorKey: "",
    allowedOrigins: PUBLIC_ORIGINS,
    db: { call: adapter(src) }
  });
  const res = await handle(new Request("http://local/leaderboard/board?day=" + day + "&section=overall&token=" + token, {
    method: "GET",
    headers: { origin: "https://dailydosetrivia.com" }
  }));
  const body = await res.json();
  t("production path returns rank 140 of 180", res.status === 200 && body.me && body.me.rank === 140 && body.me.total === 180 && body.me.found === true && body.total === 180 && Array.isArray(body.rows) && body.rows.length === 100 && body.me.token === token, JSON.stringify({ status: res.status, me: body.me, total: body.total, rows: body.rows && body.rows.length }));
  psql("postgres", ["-c", "drop database if exists " + db]);
  console.log(bad ? bad + " failures" : "board-me-adapter.test.js: all pass");
  process.exit(bad ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
