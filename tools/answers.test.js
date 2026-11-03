// node tools/answers.test.js — regression checks for answers.js (typo hardening + unit-aware estimates).
const A = require("../answers.js");
let bad = 0;
const t = (name, got, exp) => { if (got !== exp) { bad++; console.log("FAIL", name, "->", got, "expected", exp); } };
[["Slovenia", ["slovakia"], false], ["Slovakia", ["slovenia"], false], ["Slovakai", ["slovakia"], true], ["Slovkia", ["slovakia"], true], ["Sweeden", ["sweden"], true], ["Austraila", ["australia"], true],
 ["Austria", ["australia"], false], ["Iran", ["iraq"], false], ["Iraq", ["iran"], false], ["Home", ["rome"], false], ["Mal", ["mali"], false],
 ["Niger", ["nigeria"], false], ["Jokovic", ["novak djokovic", "djokovic"], true], ["Mail", ["mali"], true], ["Olso", ["oslo"], true],
 ["Wodds", ["tiger woods", "woods"], true], ["Djokovich", ["djokovic"], true], ["Cowboy", ["cowboys"], true], ["Gogle", ["google"], true],
 ["Tigr Woodz", ["tiger woods"], true], ["edison", ["thomas edison"], true, { person: true }], ["Bobby Bonds", ["barry bonds", "bonds"], false, { wrong: ["bobby bonds"] }]]
  .forEach(([i, a, e, o]) => t(`check ${i} vs ${a[0]}`, A.checkAnswer(i, a, o || {}), e));
[["2 hours", "minutes", 120], ["90", "minutes", 90], ["1.5 hours", "minutes", 90], ["5 km", "minutes", null], ["$0.05", "cents", 5], ["1.2k", null, 1200]]
  .forEach(([s, u, e]) => t(`estimate ${s} (${u})`, A.parseEstimate(s, u), e));
// nov2es: accent-insensitive + leading article (en/es) dropped before matching; nearMiss rules unchanged
[["Mexico", ["méxico"], true], ["méxico", ["mexico"], true], ["Peru", ["Perú"], true], ["sao paulo", ["São Paulo"], true], ["Bogota", ["bogotá"], true],
 ["el Salvador", ["salvador"], true], ["la Habana", ["habana"], true], ["los andes", ["andes"], true], ["Las Malvinas", ["malvinas"], true],
 ["the Beatles", ["beatles"], true], ["a Tale of Two Cities", ["tale of two cities"], true], ["el Peru", ["perú"], true], ["Austria", ["Australia"], false], ["la Iran", ["iraq"], false]]
  .forEach(([i, a, e, o]) => t(`es ${i} vs ${a[0]}`, A.checkAnswer(i, a, o || {}), e));
// nov3f: es-only dot thousands separators
A.setLang("es"); t("es parseNum 5.050", A.parseNum("5.050"), 5050); t("es parseNum 1.234.567", A.parseNum("1.234.567"), 1234567); t("es parseNum 5050", A.parseNum("5050"), 5050);
t("es estimate 5.050", A.parseEstimate("5.050", null), 5050); t("es check 5.050", A.checkAnswer("5.050", ["5050"], {}), true);
A.setLang("en"); t("en parseNum 5.050", A.parseNum("5.050"), 5.05); t("en parseNum 5050", A.parseNum("5050"), 5050);
console.log(bad ? bad + " failures" : "answers.test.js: all pass"); process.exit(bad ? 1 : 0);
