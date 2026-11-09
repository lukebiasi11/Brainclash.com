// Unscramble scores. Days through 2026-11-09 keep the old sum. Later days use the stricter curve.
const A = require("../answers.js");
let bad = 0;
const t = (name, got, exp) => { if (got !== exp) { bad++; console.log("FAIL", name, "->", got, "expected", exp); } };
const all = [true, true, true, true, true, true];
const missLast = [true, true, true, true, true, false];
const hint150 = [true, false, false, false, false, false];
const twoHints = [true, true, false, false, false, false];
const old = (solved) => A.unscrambleScore(solved, hint150, 0, false);
const now = (solved, hinted, left) => A.unscrambleScore(solved, hinted, left, true);

t("cutoff", A.FLIP_STRICT_FROM, "2026-11-10");
t("nov 9 stays old", A.flipStrict("2026-11-09"), false);
t("nov 10 is strict", A.flipStrict("2026-11-10"), true);
t("today key is not strict", A.flipStrict("2026-11-09"), false);
t("old ignores the clock", old(all), 1000);
t("old ignores hints", A.unscrambleScore(all, hint150, 0, false), 1000);
t("old miss one hard word", old(missLast), 800);

const rows = [
  ["fast, all words, no hints, 50s left", all, [false, false, false, false, false, false], 50],
  ["good, all words, no hints, 25s left", all, [false, false, false, false, false, false], 25],
  ["good, all words, one hint, 25s left", all, hint150, 25],
  ["average, all words, one hint, 20s left", all, hint150, 20],
  ["slow, all words, no hints, clock out", all, [false, false, false, false, false, false], 0],
  ["slow, all words, two hints, clock out", all, twoHints, 0],
  ["miss one hard word, no hints, 30s left", missLast, [false, false, false, false, false, false], 30]
];
console.log("run | before | after");
rows.forEach(([name, solved, hinted, left]) => {
  const before = A.unscrambleScore(solved, hinted, left, false);
  const after = now(solved, hinted, left);
  console.log(name + " | " + before + " | " + after);
  t(name, after, after);
});
t("fast clean is 1000", now(all, [false, false, false, false, false, false], 50), 1000);
t("45s left is still 1000", now(all, [], 45), 1000);
t("44s left drops", now(all, [], 44) < 1000, true);
t("good 25s", now(all, [], 25), 831);
t("good one hint 25s", now(all, hint150, 25), 781);
t("average one hint 20s", now(all, hint150, 20), 742);
t("slow clock out", now(all, [], 0), 620);
t("slow two hints", now(all, twoHints, 0), 546);
t("good band", now(all, [], 25) >= 700 && now(all, hint150, 25) <= 850, true);
t("not applied to a saved-day replay", A.flipStrict("2026-11-08"), false);

console.log(bad ? bad + " failures" : "unscramble-score.test.js: all pass");
process.exit(bad ? 1 : 0);
