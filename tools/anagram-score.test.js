// Anagram Rush scoring. Days before 2026-11-10 keep 10/25/50/100 and a 60% cap.
// From that date, longer words weigh more and 1,000 needs 92.5% of the common raw total.
const fs = require("fs"), path = require("path"), vm = require("vm");
const A = require("../answers.js");
const root = path.join(__dirname, "..");
const win = {};
vm.runInNewContext(fs.readFileSync(path.join(root, "anagrams.js"), "utf8"), { window: win });
const sets = win.ANAGRAM_SETS;
let bad = 0;
const t = (name, got, exp) => { if (got !== exp) { bad++; console.log("FAIL", name, "->", got, "expected", exp); } };

t("nov 9 stays old", A.anagramStrict("2026-11-09"), false);
t("nov 10 is new", A.anagramStrict("2026-11-10"), true);
t("nov 7 replay stays old", A.anagramStrict("2026-11-07"), false);
t("old 3", A.anagramPoints(3, false), 10);
t("old 6", A.anagramPoints(6, false), 100);
t("old 7 unused", A.anagramPoints(7, false), 0);
t("new 3", A.anagramPoints(3, true), 10);
t("new 4", A.anagramPoints(4, true), 30);
t("new 5", A.anagramPoints(5, true), 70);
t("new 6", A.anagramPoints(6, true), 150);
t("new 7", A.anagramPoints(7, true), 250);
t("cap", A.anagramScore(99999, 100, true), 1000);
t("old full at 60% raw", A.anagramScore(60, 100, false), 1000);
t("new not full at 60% raw", A.anagramScore(60, 100, true), 649);
t("new full at 92.5% raw", A.anagramScore(92.5, 100, true), 1000);
t("new 90% raw", A.anagramScore(90, 100, true), 973);

function take(words, pct, longFirst) {
  const sorted = words.slice().sort((a, b) => longFirst ? b.length - a.length || a.localeCompare(b) : a.length - b.length || a.localeCompare(b));
  const n = Math.round(sorted.length * pct);
  return sorted.slice(0, n);
}
function avg(pct, longFirst, strict) {
  let score = 0;
  sets.forEach(set => {
    const found = take(set.common, pct, longFirst);
    const raw = A.anagramCommonRaw(found, strict);
    const all = A.anagramCommonRaw(set.common, strict);
    score += A.anagramScore(raw, all, strict);
  });
  return Math.round(score / sets.length);
}
const lens = {};
let commons = 0;
sets.forEach(set => set.common.forEach(w => { commons++; lens[w.length] = (lens[w.length] || 0) + 1; }));
console.log("sets", sets.length, "common words", commons, "by length", JSON.stringify(lens));
console.log("share of common words | mostly short before/after | mostly long before/after");
[0.4, 0.6, 0.8, 0.95, 1].forEach(p => {
  const row = [Math.round(p * 100) + "%", avg(p, false, false), avg(p, false, true), avg(p, true, false), avg(p, true, true)];
  console.log(row.join(" | "));
});
t("60% of the longer words used to max", avg(0.6, true, false), 1000);
t("60% of the longer words no longer maxes", avg(0.6, true, true) < 1000, true);
t("95% of the longer words reaches the cap", avg(0.95, true, true), 1000);
t("95% of the shorter words is not quite the cap", avg(0.95, false, true) < 1000, true);
t("every common word is the cap", avg(1, false, true), 1000);
t("40% short is well under", avg(0.4, false, true) < 700, true);
function strongWords(set) {
  const by = { 3: [], 4: [], 5: [], 6: [] };
  set.common.forEach(w => { if (by[w.length]) by[w.length].push(w); });
  const pick = (arr, p) => arr.slice().sort().slice(0, Math.round(arr.length * p));
  return [].concat(pick(by[3], 1), pick(by[4], 0.7), pick(by[5], 0.4), pick(by[6], 0.2));
}
let strongOld = 0, strongNew = 0, strongN = 0, strongAll = 0;
sets.forEach(set => {
  const found = strongWords(set);
  strongN += found.length; strongAll += set.common.length;
  strongOld += A.anagramScore(A.anagramCommonRaw(found, false), A.anagramCommonRaw(set.common, false), false);
  strongNew += A.anagramScore(A.anagramCommonRaw(found, true), A.anagramCommonRaw(set.common, true), true);
});
const strongShare = Math.round(100 * strongN / strongAll);
console.log("strong-player heuristic (all 3s, 70% of 4s, 40% of 5s, 20% of 6s):", strongShare + "% of common words | before", Math.round(strongOld / sets.length), "| after", Math.round(strongNew / sets.length));

const dayOf = k => Math.floor(Date.parse(k + "T00:00:00Z") / 864e5);
const games = ["flip", "bridge", "conn", "odd", "anag"];
let next = "";
for (let d = dayOf("2026-11-10"); d < dayOf("2026-11-20"); d++) {
  if (games[((d % 5) + 5) % 5] === "anag") { next = new Date(d * 864e5).toISOString().slice(0, 10); break; }
}
console.log("next Anagram Rush on or after Nov 10:", next);
t("next rush", next, "2026-11-12");

console.log(bad ? bad + " failures" : "anagram-score.test.js: all pass");
process.exit(bad ? 1 : 0);
