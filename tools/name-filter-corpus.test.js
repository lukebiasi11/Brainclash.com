// node tools/name-filter-corpus.test.js — Tester corpus on the client, and on local Postgres when psql is available.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const Filter = require(path.join(root, "name-filter.js"));
const corpus = require(path.join(__dirname, "name-filter-corpus.js"));

let bad = 0;
const t = (name, ok, extra) => { if (!ok) { bad++; console.log("FAIL", name, extra || ""); } else console.log("ok", name); };
function verdict(name) {
  const got = Filter.checkName(name);
  return got.skip ? 2 : got.ok ? 1 : 0;
}
const acceptAnyway = { Dykes: 1, Nazir: 1, Nazia: 1, Ashkenazi: 1, Semenov: 1, Therapist: 1, Penistone: 1 };
const rejectAnyway = { xcoonx: 0 };

function report(label, decide) {
  const summary = {};
  let mismatches = 0;
  Object.entries(corpus).forEach(([group, rows]) => {
    const counts = { reject: 0, accept: 0, skip: 0, bad: 0 };
    rows.forEach(([name, want]) => {
      const got = decide(name);
      if (got === 0) counts.reject += 1;
      else if (got === 1) counts.accept += 1;
      else if (got === 2) counts.skip += 1;
      const expected = Object.prototype.hasOwnProperty.call(rejectAnyway, name) ? rejectAnyway[name]
        : Object.prototype.hasOwnProperty.call(acceptAnyway, name) ? acceptAnyway[name]
        : want;
      if (expected != null && got !== expected) {
        counts.bad += 1;
        mismatches += 1;
        if (mismatches <= 20) console.log("FAIL", label, group, JSON.stringify(name), "got", got, "want", expected);
      }
    });
    summary[group] = counts;
    console.log(label, group, "n=" + rows.length, "reject=" + counts.reject, "accept=" + counts.accept, "skip=" + counts.skip, "bad=" + counts.bad);
    t(label + " " + group, counts.bad === 0);
  });
  return summary;
}

report("client", verdict);
const total = Object.values(corpus).reduce((n, rows) => n + rows.length, 0);
console.log("corpus cases", total);

function psql(database, args, input) {
  return execFileSync("sudo", ["-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-d", database, ...args], { encoding: "utf8", input, maxBuffer: 20 * 1024 * 1024 });
}
let pg = true;
try { execFileSync("sudo", ["-u", "postgres", "psql", "-d", "postgres", "-c", "select 1"], { encoding: "utf8" }); }
catch (e) { pg = false; console.log("sql skipped: local postgres is not available"); }

if (pg) {
  const db = "bc_board_corpus";
  const migrations = fs.readdirSync(path.join(root, "supabase/migrations")).filter(name => name.endsWith(".sql")).sort().map(name => path.join(root, "supabase/migrations", name));
  psql("postgres", ["-c", "drop database if exists " + db]);
  psql("postgres", ["-c", "create database " + db]);
  for (const file of migrations) psql(db, ["-f", file]);
  const names = [];
  Object.values(corpus).forEach(rows => rows.forEach(([name]) => names.push(name)));
  const values = names.map((name, i) => "(" + i + ",$n$" + String(name).replace(/\$n\$/g, "$nn$") + "$n$)").join(",");
  const out = psql(db, ["-q", "-t", "-A", "-c", `
    with input(ord, name) as (values ${values})
    select ord::text || '|' || case
      when coalesce((private.board_name_status(i.name)->>'skip')::boolean, false) then '2'
      when (private.board_name_status(i.name)->>'ok')::boolean then '1'
      else '0' end
    from input i order by ord
  `]);
  const sqlV = out.trim().split("\n").map(line => Number(line.split("|")[1]));
  let i = 0;
  report("sql", () => sqlV[i++]);
  let differ = 0;
  names.forEach((name, n) => { if (verdict(name) !== sqlV[n]) { differ += 1; if (differ <= 10) console.log("FAIL parity", JSON.stringify(name), verdict(name), sqlV[n]); } });
  t("sql matches the client", differ === 0, String(differ));
  psql("postgres", ["-c", "drop database if exists " + db]);
}

console.log(bad ? bad + " failures" : "name-filter-corpus.test.js: all pass");
process.exit(bad ? 1 : 0);
