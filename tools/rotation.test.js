/* Rotation freeze + append-safety. Fails if any date Oct 23 – Nov 14 2026 changes what it shows,
   or if appending entries to a list moves any already-scheduled future date. */
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, ".."), src = fs.readFileSync(path.join(root, "app.js"), "utf8");
let pass = 0, fail = 0; const t = (ok, why) => { if (ok) pass++; else { fail++; console.log("FAIL", why); } };
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < 0) throw Error("missing " + a); return src.slice(i, j); };
const code = [cut("const WORD_GAMES = [", "];") + "];", cut("function keyOf(day)", "\n", ) , cut("function dayOfKey(k)", "\n"), cut("const pick =", "\n"),
  cut("const FROZEN = {", "// Practice replays")].join("\n");
function load(extra) {
  const win = {}; vm.runInNewContext(fs.readFileSync(path.join(root, "content.js"), "utf8"), { window: win });
  vm.runInNewContext(fs.readFileSync(path.join(root, "anagrams.js"), "utf8"), { window: win });
  if (extra) extra(win);
  const ctx = { window: win, C: win.CONTENT, console }; vm.runInNewContext(code + "\nthis.getDailySet = getDailySet; this.dayOfKey = dayOfKey; this.keyOf = keyOf;", ctx);
  return { ...ctx, win };
}
const LISTS = { tf: ["thinkFast", "thinkFast"], wr: ["worldRush", "worldRush"], hi: ["history", "history"], sp: ["sports", "sports"],
  wf: ["wordFlip", "wordFlip"], wb: ["wordBridge", "wordBridge"], cn: ["connections", "connections"], oo: ["oddOneOut", "oddOneOut"], an: [null, "anagram"] };
function table(R, from, to) {
  const out = {}, list = k => (LISTS[k][0] ? R.win.CONTENT[LISTS[k][0]] : R.win.ANAGRAM_SETS);
  for (let d = R.dayOfKey(from); d <= R.dayOfKey(to); d++) {
    const s = R.getDailySet(R.keyOf(d)), row = { wg: s.wordGame.id };
    for (const k in LISTS) row[k] = list(k).indexOf(s[LISTS[k][1]]);
    out[R.keyOf(d)] = row;
  }
  return out;
}
// Frozen expectation: Oct 23-31 as played (commit 9ae728b; Oct 29-31 oo 2 / an 4 pinned), Nov 1-14 = week-2 remap (d100f54, 82f70b5). Columns: word game, then list indexes.
const F = `2026-10-23 anag 3 13 13 13 0 0 0 0 2|2026-10-24 flip 4 14 14 14 1 1 1 1 3|2026-10-25 bridge 5 15 15 15 1 1 1 1 3|2026-10-26 conn 6 16 16 16 1 1 1 1 3
2026-10-27 odd 7 17 17 17 1 1 1 1 3|2026-10-28 anag 0 0 0 0 1 1 1 1 3|2026-10-29 flip 1 1 1 1 2 2 2 2 4|2026-10-30 bridge 2 2 2 2 2 2 2 2 4
2026-10-31 conn 8 3 3 3 2 2 2 2 4|2026-11-01 odd 41 32 32 32 2 2 2 9 7|2026-11-02 anag 42 33 33 33 2 2 2 9 7|2026-11-03 flip 43 34 34 34 9 9 9 10 8
2026-11-04 bridge 44 35 35 35 9 9 9 10 8|2026-11-05 conn 45 36 36 36 9 9 9 10 8|2026-11-06 odd 46 37 37 37 9 9 9 10 8|2026-11-07 anag 47 38 38 38 9 9 9 10 8
2026-11-08 flip 19 39 39 39 10 10 10 5 9|2026-11-09 bridge 20 40 40 40 10 10 10 5 9|2026-11-10 conn 21 41 41 41 10 10 10 5 9|2026-11-11 odd 22 42 42 42 10 10 10 5 9
2026-11-12 anag 23 43 43 43 10 10 10 5 9|2026-11-13 flip 24 44 44 44 5 5 5 2 0|2026-11-14 bridge 25 45 45 45 5 5 5 2 0`;
const R = load(), T = table(R, "2026-10-23", "2026-11-14");
for (const line of F.split(/[|\n]/)) {
  const [k, wg, ...n] = line.trim().split(/\s+/), row = T[k], cols = ["tf", "wr", "hi", "sp", "wf", "wb", "cn", "oo", "an"];
  t(row && row.wg === wg, k + " word game " + wg + " (got " + (row && row.wg) + ")");
  cols.forEach((c, i) => t(row && row[c] === +n[i], `${k} ${c} = ${n[i]} (got ${row && row[c]})`));
}
// Append safety: add 10 fake entries to every list; nothing scheduled before the first wrap may move.
const R2 = load(w => { for (const k of ["thinkFast", "worldRush", "history", "sports", "wordFlip", "wordBridge", "connections", "oddOneOut"]) for (let i = 0; i < 10; i++) w.CONTENT[k].push({ fake: i });
  for (let i = 0; i < 10; i++) w.ANAGRAM_SETS.push({ fake: i }); });
const before = table(R, "2026-10-23", "2027-12-31"), after = table(R2, "2026-10-23", "2027-12-31");
const len = k => (LISTS[k][0] ? R.win.CONTENT[LISTS[k][0]] : R.win.ANAGRAM_SETS).length;
for (const k in LISTS) {
  // "before" is valid until the original list first wraps (an index repeats); up to there, after must match.
  const seen = new Set(); let moved = 0, checked = 0;
  for (const day in before) { const i = before[day][k]; seen.add(i); checked++; if (after[day][k] !== i) moved++; if (seen.size >= len(k)) break; }
  t(moved === 0, `${k}: appending moved ${moved} of ${checked} scheduled dates`);
}
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
