// node tools/graph-history.test.js — Graph 2 local history math, exclusion, and storage safety.
const H = require("../graph-history.js");
const fs = require("fs");
const path = require("path");
let bad = 0;
const t = (name, got, exp) => {
  const same = JSON.stringify(got) === JSON.stringify(exp);
  if (!same) { bad++; console.log("FAIL", name, "\n  got ", JSON.stringify(got), "\n  exp ", JSON.stringify(exp)); }
};
const ok = (name, cond) => { if (!cond) { bad++; console.log("FAIL", name); } };

const day = (d, scores, extra) => ({ day: d, record: Object.assign({ practice: false, scores: scores.slice(), details: [] }, extra || {}) });

const oct28 = [100, 200, 300, 400, 500]; // 1500
const oct31 = [1000, 0, 0, 0, 0]; // 1000
const nov6 = [800, 700, 600, 500, 760]; // 3360
const entries = [
  day("2026-11-06", nov6),
  day("2026-10-31", oct31),
  day("2026-10-28", oct28),
  day("2026-10-30", [1, 2, 3]), // unfinished
  day("2026-10-29", [9, 9, 9, 9, 9], { practice: true }),
  { day: "2026-02-31", record: { scores: [1, 1, 1, 1, 1] } },
  { day: "2026-11-07", record: { scores: [5, 5, 5, 5, 5] } }, // after the pinned day
  { key: "dg-stats", record: { played: 99, best: 5000, streak: 4, last: "2026-11-06" } },
  { day: "2026-10-28", record: { scores: [1, 1, 1, 1, 1] } }, // duplicate day; first valid wins
  { day: "2026-11-02", record: { scores: [1, 2, 3, 4, "5"] } }, // no coercion
  { day: "2026-11-03", record: { scores: [1, 2, 3, 4, NaN] } },
  { day: "2026-11-04", record: { scores: [1, 2, 3, 4, 1000.1] } },
  { day: "2026-11-04", record: { scores: [-1, 2, 3, 4, 5] } },
  { day: "not-a-day", record: { scores: [1, 1, 1, 1, 1] } },
  { day: "2026-09-01", record: null },
  null,
  { day: "2026-09-02" }
];

const view = H.completedGames(entries, "2026-11-06", null);
t("order and members", view.games.map(g => g.day), ["2026-10-28", "2026-10-31", "2026-11-06"]);
t("later not mixed", view.later, 1);
t("totals", view.games.map(g => g.total), [1500, 1000, 3360]);
t("oct28 scores kept", view.games[0].scores, oct28);
ok("inputs not mutated", entries[2].record.scores.join() === "100,200,300,400,500" && entries[2].record.scores.length === 5);

const overall = H.summarize(view.games, "overall", "2026-11-06");
t("overall prior excludes viewed", overall.priorCount, 2);
t("overall prior mean", overall.priorMean, 1250);
t("overall all count includes viewed", overall.allCount, 3);
t("overall all sum", overall.allSum, 5860);
t("overall all mean", H.roundTenths(overall.allMean), 1953.3);
t("viewed point", overall.viewed, { day: "2026-11-06", value: 3360 });
ok("prior days are only earlier", overall.points.filter(p => p.day < "2026-11-06").length === 2);
ok("viewed day is not inside the prior set", overall.points.filter(p => p.day < "2026-11-06").every(p => p.day !== "2026-11-06"));

const cat0 = H.summarize(view.games, 0, "2026-11-06");
t("cat0 prior", cat0.priorMean, 550);
t("cat0 all mean", H.roundTenths(cat0.allMean), 633.3);
t("cat0 viewed", cat0.viewed.value, 800);
t("cat0 sum", cat0.allSum, 1900);
const cat4 = H.summarize(view.games, 4, "2026-11-06");
t("cat4 values", cat4.points.map(p => p.value), [500, 0, 760]);
t("cat4 prior", cat4.priorMean, 250);
t("scale overall", H.scaleFor("overall"), 5000);
t("scale category", H.scaleFor(2), 1000);

// One completed game: prior is empty, all-time is that game.
const one = H.completedGames([day("2026-11-06", nov6)], "2026-11-06", null);
const oneSum = H.summarize(one.games, "overall", "2026-11-06");
t("one game prior", [oneSum.priorCount, oneSum.priorMean], [0, null]);
t("one game all", [oneSum.allCount, oneSum.allSum, oneSum.allMean], [1, 3360, 3360]);

// No history.
const none = H.completedGames([], "2026-11-06", null);
t("no history", [none.games.length, none.later], [0, 0]);
const noneSum = H.summarize(none.games, "overall", "2026-11-06");
t("no history summary", [noneSum.allCount, noneSum.allMean, noneSum.priorMean, noneSum.viewed], [0, null, null, null]);

// Pinned day across midnight: Nov 7 must not enter the Nov 6 view, and Nov 6 stays in all-time.
const midnight = H.completedGames([
  day("2026-11-05", [10, 10, 10, 10, 10]),
  day("2026-11-06", nov6),
  day("2026-11-07", [50, 50, 50, 50, 50])
], "2026-11-06", null);
t("midnight days", midnight.games.map(g => g.day), ["2026-11-05", "2026-11-06"]);
t("midnight later", midnight.later, 1);
const midSum = H.summarize(midnight.games, "overall", "2026-11-06");
t("midnight prior is only Nov 5", midSum.priorMean, 50);
t("midnight all includes Nov 6", midSum.allSum, 50 + 3360);

// Display-only memory fills a missing viewed day and does not duplicate a stored one.
const mem = H.completedGames([day("2026-10-28", oct28)], "2026-11-06", { day: "2026-11-06", scores: nov6, practice: false });
t("memory fills gap", mem.games.map(g => g.total), [1500, 3360]);
const memDup = H.completedGames([day("2026-11-06", [1, 1, 1, 1, 1])], "2026-11-06", { day: "2026-11-06", scores: nov6, practice: false });
t("stored day wins over memory", memDup.games.map(g => g.total), [5]);
const memBad = H.completedGames([], "2026-11-06", { day: "2026-11-06", scores: [1, 2, 3], practice: false });
t("invalid memory ignored", memBad.games.length, 0);
const memPrac = H.completedGames([], null, { day: "2026-11-06", scores: nov6, practice: true });
t("practice memory ignored", memPrac.games.length, 0);

// Practice visit has no pinned day: every saved completed game is the history, none called "today".
const prac = H.completedGames(entries, null, { day: "2026-11-01", scores: [8, 8, 8, 8, 8], practice: true });
t("practice keeps saved days including later", prac.games.map(g => g.day), ["2026-10-28", "2026-10-31", "2026-11-06", "2026-11-07"]);
t("practice later unused", prac.later, 0);
const pracSum = H.summarize(prac.games, "overall", null);
t("practice has no viewed point", pracSum.viewed, null);
t("practice prior is the whole saved set", pracSum.priorCount, pracSum.allCount);

// Category sums equal the overall total for every game.
ok("category sums match overall", view.games.every(g => g.scores.reduce((a, b) => a + b, 0) === g.total));

// Malformed storage adapter: never writes, skips bad keys, survives throws.
function mockStorage(map, hooks) {
  const keys = Object.keys(map);
  return {
    get length() { if (hooks && hooks.length) return hooks.length(); return keys.length; },
    key(i) { if (hooks && hooks.key) return hooks.key(i, keys); return keys[i] || null; },
    getItem(k) { if (hooks && hooks.getItem) return hooks.getItem(k, map); return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
    setItem() { throw new Error("write"); },
    removeItem() { throw new Error("write"); }
  };
}
const raw = {
  "dg-2026-11-06": JSON.stringify({ scores: nov6, practice: false, counted: true }),
  "dg-2026-10-28": JSON.stringify({ scores: oct28 }),
  "dg-2026-10-30": JSON.stringify({ scores: [1, 2, 3, 4] }),
  "dg-2026-10-29": JSON.stringify({ practice: true, scores: [1, 1, 1, 1, 1] }),
  "dg-2026-02-31": JSON.stringify({ scores: [1, 1, 1, 1, 1] }),
  "dg-2026-11-08": "{not-json",
  "dg-stats": JSON.stringify({ played: 4, best: 3360, streak: 2, last: "2026-11-06" }),
  "dg-maxday": "20754",
  "bc-lang": "es",
  "dg-2026-13-01": JSON.stringify({ scores: nov6 })
};
const read = H.readLocalEntries(mockStorage(raw));
t("storage days", read.map(e => e.day).sort(), ["2026-10-28", "2026-10-29", "2026-10-30", "2026-11-06"]);
const fromStore = H.completedGames(read, "2026-11-06", null);
t("storage completed", fromStore.games.map(g => g.day), ["2026-10-28", "2026-11-06"]);
ok("zero is a valid score", H.isValidCompleted({ scores: [0, 0, 0, 0, 0] }));
ok("bool score rejected", !H.isValidCompleted({ scores: [true, 1, 1, 1, 1] }));
ok("null record rejected", !H.isValidCompleted(null));
t("throwing storage", H.readLocalEntries(mockStorage({}, { length() { throw new Error("nope"); } })).length, 0);
const skipped = H.readLocalEntries(mockStorage(raw, {
  key(i, keys) { if (keys[i] === "dg-2026-10-28") throw new Error("nope"); return keys[i] || null; }
}));
t("throwing key skipped", skipped.some(e => e.day === "2026-10-28"), false);
t("throwing key kept the rest", skipped.some(e => e.day === "2026-11-06"), true);

// Non-integer but in-range scores are kept as stored, not rounded away.
const frac = H.completedGames([day("2026-11-01", [10.5, 0, 0, 0, 0])], "2026-11-01", null);
t("fraction kept", frac.games[0].total, 10.5);

// Source guard: history module cannot persist or talk to the network.
const gh = fs.readFileSync(path.join(__dirname, "..", "graph-history.js"), "utf8");
ok("no fetch", !/\bfetch\s*\(/.test(gh));
ok("no xhr", !/XMLHttpRequest/.test(gh));
ok("no websocket", !/WebSocket/.test(gh));
ok("no setItem", !/setItem/.test(gh));
ok("no removeItem", !/removeItem/.test(gh));
ok("no setInterval", !/setInterval/.test(gh));
const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const fetches = app.match(/\bfetch\(/g) || [];
t("app keeps only the existing clock fetch", fetches.length, 1);
const fieldCfg = fs.readFileSync(path.join(__dirname, "..", "field-config.js"), "utf8");
ok("live field switch is on", /FIELD_COMPARE_ENABLED = true/.test(fieldCfg));
ok("app does not assign the switch", !/FIELD_COMPARE_ENABLED = true/.test(app) && !/FIELD_COMPARE_ENABLED = false/.test(app));
ok("no stats client", !/stats-client|BC_STATS|day_agg|\/v1\//.test(app));
ok("no result POST", !/method:\s*["']POST["']/.test(app));
t("no extra polling interval", app.split("setInterval").length - 1, 1);
ok("see results does not call share", /data-action": "see-results"[\s\S]{0,80}results\(\)/.test(app));
ok("home category graph still mounted", /scoreGraph\(s\.scores, day\)/.test(app));

console.log(bad ? bad + " failures" : "graph-history.test.js: all pass");
process.exit(bad ? 1 : 0);
