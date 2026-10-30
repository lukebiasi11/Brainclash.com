// node tools/answers.test.js — regression checks for answers.js (typo hardening + unit-aware estimates).
const A = require("../answers.js");
let bad = 0;
const t = (name, got, exp) => { if (got !== exp) { bad++; console.log("FAIL", name, "->", got, "expected", exp); } };
[["Austria", ["australia"], false], ["Iran", ["iraq"], false], ["Iraq", ["iran"], false], ["Home", ["rome"], false], ["Mal", ["mali"], false],
 ["Niger", ["nigeria"], false], ["Jokovic", ["novak djokovic", "djokovic"], true], ["Mail", ["mali"], true], ["Olso", ["oslo"], true],
 ["Wodds", ["tiger woods", "woods"], true], ["Djokovich", ["djokovic"], true], ["Cowboy", ["cowboys"], true], ["Gogle", ["google"], true],
 ["Tigr Woodz", ["tiger woods"], true], ["edison", ["thomas edison"], true, { person: true }], ["Bobby Bonds", ["barry bonds", "bonds"], false, { wrong: ["bobby bonds"] }]]
  .forEach(([i, a, e, o]) => t(`check ${i} vs ${a[0]}`, A.checkAnswer(i, a, o || {}), e));
[["2 hours", "minutes", 120], ["90", "minutes", 90], ["1.5 hours", "minutes", 90], ["5 km", "minutes", null], ["$0.05", "cents", 5], ["1.2k", null, 1200]]
  .forEach(([s, u, e]) => t(`estimate ${s} (${u})`, A.parseEstimate(s, u), e));
console.log(bad ? bad + " failures" : "answers.test.js: all pass"); process.exit(bad ? 1 : 0);
