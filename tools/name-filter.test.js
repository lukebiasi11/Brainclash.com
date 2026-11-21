// node tools/name-filter.test.js — client name rules, age flag, and the SQL term list.
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const root = path.join(__dirname, "..");
const Filter = require(path.join(root, "name-filter.js"));
const Board = require(path.join(root, "leaderboard.js"));

let bad = 0;
const t = (name, ok, extra) => { if (!ok) { bad++; console.log("FAIL", name, extra == null ? "" : extra); } else console.log("ok", name); };

const okNames = ["Luna", "Nico", "José", "O'Brien", "Ana Maria", "Ana-Maria", "Max", "Player1", "Modesto", "Essex", "Titan", "Peacock", "Dickens", "Sol", "Paz", "Niño"];
const blocked = [
  ["Al", "length"],
  ["thisnameistoolongnowx", "length"],
  ["Daily Dose", "impersonation"],
  ["DailyDose", "impersonation"],
  ["d4ily d0se", "impersonation"],
  ["admin", "impersonation"],
  ["cooladmin", "impersonation"],
  ["mod", "impersonation"],
  ["mod1", "impersonation"],
  ["official", "impersonation"],
  ["staff", "impersonation"],
  ["support", "impersonation"],
  ["hello.com", "contact"],
  ["user@name", "contact"],
  ["555-123-4567", "contact"],
  ["call 5551234", "contact"],
  ["https://x.test", "contact"],
  ["f u c k", "profanity"],
  ["f-u-c-k", "profanity"],
  ["sh1t", "profanity"],
  ["a55", "profanity"],
  ["púta", "profanity"],
  ["pendejo", "profanity"],
  ["xxx", "profanity"]
];
okNames.forEach(name => {
  const got = Filter.checkName(name);
  t("allow " + name, got.ok === true && got.skip !== true && got.name === name.replace(/\s+/g, " ").trim(), JSON.stringify(got));
});
t("blank skips", Filter.checkName("   ").skip === true && Filter.checkName("").ok === true);
blocked.forEach(([name, reason]) => {
  const got = Filter.checkName(name);
  t("block " + name, got.ok === false && got.reason === reason && !got.name, JSON.stringify(got));
});
const dumped = JSON.stringify(Filter.checkName("Daily Dose"));
t("rejected result hides the text", dumped.indexOf("Daily") < 0);

const sql = fs.readFileSync(path.join(root, "supabase/migrations/20261121180000_display_name_board.sql"), "utf8");
const terms = { imp: [], impword: [], sub: [], word: [] };
for (const m of sql.matchAll(/\('(imp|impword|sub|word)', '([a-z0-9]+)'\)/g)) terms[m[1]].push(m[2]);
const same = (a, b) => a.slice().sort().join(",") === b.slice().sort().join(",");
t("imp list matches sql", same(Filter.TERMS.imp, terms.imp));
t("impWord list matches sql", same(Filter.TERMS.impWord, terms.impword));
t("sub list matches sql", same(Filter.TERMS.sub, terms.sub));
t("word list matches sql", same(Filter.TERMS.word, terms.word));

const bag = {};
global.localStorage = {
  getItem: k => (k in bag ? bag[k] : null),
  setItem: (k, v) => { bag[k] = String(v); },
  removeItem: k => { delete bag[k]; }
};
const young = Board.lockYear("2014", "2026-11-21");
t("under 13 locks no", young.ok === true && young.eligible === false && bag["bc-board-eligible"] === "no");
t("year is not stored", !JSON.stringify(bag).includes("2014"));
const again = Board.lockYear("1990", "2026-11-21");
t("a later year does not unlock", again.locked === true && again.eligible === false && bag["bc-board-eligible"] === "no" && !JSON.stringify(bag).includes("1990"));
delete bag["bc-board-eligible"];
const adult = Board.lockYear("2000", "2026-11-21");
t("13 or older locks yes", adult.eligible === true && bag["bc-board-eligible"] === "yes" && !JSON.stringify(bag).includes("2000"));
const badYear = Board.lockYear("20", "2026-11-21");
t("short year does not replace the flag", badYear.locked === true && bag["bc-board-eligible"] === "yes");
delete bag["bc-board-eligible"];
const freshShort = Board.lockYear("20", "2026-11-21");
t("short year does not lock", freshShort.ok === false && !bag["bc-board-eligible"]);
delete bag["bc-board-eligible"];
const edge = Board.lockYear("2013", "2026-11-21");
t("turns 13 this calendar year", edge.eligible === true && bag["bc-board-eligible"] === "yes" && !JSON.stringify(bag).includes("2013"));

global.location = { pathname: "/index.html", search: "?dgtest=1" };
t("dgtest is a tester run", Board.isTester({ practice: false, key: "2026-11-21" }) === true);
global.location = { pathname: "/index.html", search: "?preview=2026-11-01" };
t("preview is a tester run", Board.isTester({ key: "2026-11-01" }) === true);
global.location = { pathname: "/admin.html", search: "" };
t("admin is a tester run", Board.isTester(null) === true);
global.BC_NO_BOOT = true;
global.location = { pathname: "/index.html", search: "" };
t("admin boot is a tester run", Board.isTester(null) === true);
global.BC_NO_BOOT = false;
global.location = { pathname: "/index.html", search: "" };
t("practice is a tester run", Board.isTester({ practice: true, key: "2026-11-20" }) === true);
t("a daily run is not a tester run", Board.isTester({ practice: false, key: "2026-11-21" }) === false);

let fetched = 0;
global.fetch = () => { fetched++; return Promise.reject(new Error("no")); };
bag["bc-board-eligible"] = "yes";
bag["bc-board-pending"] = JSON.stringify({ day: "2026-11-21", name: "Luna" });
Board.noteFinish({ key: "2026-11-21", practice: true, scores: [100, 100, 100, 100, 100] });
t("practice does not post", fetched === 0 && bag["bc-board-pending"] == null);

const i18n = fs.readFileSync(path.join(root, "i18n.js"), "utf8");
[
  "This name is shown publicly. Use a nickname, not your full name.",
  "Este nombre se muestra públicamente. Usa un apodo, no tu nombre completo.",
  "Rankings are for fun, with no prizes.",
  "Las clasificaciones son para divertirse, sin premios.",
  "What year were you born?",
  "¿En qué año naciste?",
  "Players under 13 can't post a nickname or appear on a leaderboard."
].forEach(s => t("copy " + s.slice(0, 24), i18n.includes(s)));

assert.ok;
console.log(bad ? bad + " failures" : "name-filter.test.js: all pass");
process.exit(bad ? 1 : 0);
