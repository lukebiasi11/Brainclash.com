/* Clusters "one away": exactly one selected tile is outside a real group of the same size.
   3-tile days: 2 of 3. 4-tile days: 3 of 4. Two or more tiles off is not one away.
   node tools/clusters-one-away.test.js */
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "app.js"), "utf8");
const i18nSrc = fs.readFileSync(path.join(root, "i18n.js"), "utf8");
const i = src.indexOf("function clustersOneAway("), j = src.indexOf("\nfunction connections(");
if (i < 0 || j < 0) throw Error("missing clustersOneAway");
const ctx = {};
vm.runInNewContext(src.slice(i, j) + "\nthis.clustersOneAway = clustersOneAway;", ctx);
const one = ctx.clustersOneAway;
let pass = 0, fail = 0;
const t = (ok, why) => { if (ok) pass++; else { fail++; console.log("FAIL", why); } };

const g3 = [
  { name: "neck", words: ["SHIRT", "VASE", "FLASK"] },
  { name: "face", words: ["CLOCK", "CLIFF", "DICE"] },
  { name: "bridge", words: ["NOSE", "GLASSES", "SONG"] }
];
const g4 = [
  { name: "red", words: ["A1", "A2", "A3", "A4"] },
  { name: "blue", words: ["B1", "B2", "B3", "B4"] },
  { name: "gold", words: ["C1", "C2", "C3", "C4"] }
];

t(one(g3, ["SHIRT", "VASE", "CLOCK"]) === true, "3-tile: 2 of 3 is one away");
t(one(g3, ["NOSE", "SONG", "VASE"]) === true, "3-tile: the off tile can come from another group");
t(one(g3, ["CLOCK", "CLIFF", "ZZZ"]) === true, "3-tile: the off tile need not belong to a group");
t(one(g3, ["SHIRT", "VASE", "FLASK"]) === false, "3-tile: a solved group is not one away");
t(one(g3, ["SHIRT", "CLOCK", "NOSE"]) === false, "3-tile: one from each group is two or more off");
t(one(g3, ["SHIRT", "CLOCK", "ZZZ"]) === false, "3-tile: best overlap of 1 is two off");
t(one(g3, ["SHIRT", "VASE"]) === false, "3-tile: a short selection is not a group guess");
t(one(g3, ["SHIRT", "VASE", "CLOCK", "DICE"]) === false, "3-tile: an oversized selection is not one away");
t(one(g3, []) === false, "3-tile: empty selection");
t(one(null, ["SHIRT", "VASE", "CLOCK"]) === false, "missing groups");
t(one(g3, null) === false, "missing selection");

t(one(g4, ["A1", "A2", "A3", "B1"]) === true, "4-tile: 3 of 4 is one away");
t(one(g4, ["C2", "C3", "C4", "A4"]) === true, "4-tile: one off the last group");
t(one(g4, ["A1", "A2", "A3", "A4"]) === false, "4-tile: a solved group is not one away");
t(one(g4, ["A1", "A2", "B1", "C1"]) === false, "4-tile: 2 of 4 is two off, not one away");
t(one(g4, ["A1", "A2", "B1", "B2"]) === false, "4-tile: two and two is not one away");
t(one(g4, ["A1", "B2", "C3", "A4"]) === false, "4-tile: 1 and 1 and 2 still is not 3 of 4");
t(one(g4, ["A1", "B1", "C1", "ZZZ"]) === false, "4-tile: one from each group");
t(one(g4, ["A1", "A2", "A3"]) === false, "4-tile: 3 tiles is a short guess, not one away from a 4-group");

const mixed = g3.concat(g4);
t(one(mixed, ["SHIRT", "VASE", "A1"]) === true, "mixed board: 2 of 3 still counts");
t(one(mixed, ["A1", "A2", "A3", "SHIRT"]) === true, "mixed board: 3 of 4 still counts");
t(one(mixed, ["A1", "A2", "SHIRT", "CLOCK"]) === false, "mixed board: 2 of 4 is not one away");
t(one(mixed, ["A1", "A2", "SHIRT"]) === false, "mixed board: 2 from a 4-group inside a 3-guess is not one away");

const submit = src.slice(src.indexOf("const submit = () => {"), src.indexOf("const feedbackTmp"));
t(submit.includes("mistakes++"), "a wrong guess still spends a try");
t(submit.indexOf("mistakes++") < submit.indexOf("clustersOneAway"), "the try is spent before the one-away check");
t(submit.includes("clustersOneAway(set.groups, sel)"), "submit uses the size-aware check");
t(submit.includes('tr("One away!")'), "the toast uses the i18n key");
t(!submit.includes("One away…"), "the ellipsis copy is gone");
t(!/length === 2/.test(submit), "overlap of 2 is not hardcoded");
t(submit.includes("mistakes >= 3"), "the 3-try limit remains");
t(submit.includes("total += g.pts"), "a solved group still adds its points");
t(!submit.slice(submit.indexOf("else {")).includes("total"), "a miss, including one away, does not change the score");
t(!/save\(|localStorage|dg-/.test(submit), "the guess path does not write a saved result");

function loadI18n(lang) {
  const mem = {};
  const sandbox = {
    localStorage: { getItem: k => (k in mem ? mem[k] : null), setItem(k, v) { mem[k] = String(v); } },
    location: { search: lang ? "?lang=" + lang : "" },
    module: { exports: {} }
  };
  vm.runInNewContext(i18nSrc, sandbox);
  return sandbox.module.exports;
}
const en = loadI18n("en"), es = loadI18n("es");
t(en.t("One away!") === "One away!", "English toast is One away!");
t(es.t("One away!") === "¡Te falta una!", "Spanish toast is ¡Te falta una!");
t(!Object.prototype.hasOwnProperty.call(en.ES, "One away…"), "old English ellipsis key is gone");
t(!i18nSrc.includes("Te falta una…"), "old Spanish ellipsis copy is gone");

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
