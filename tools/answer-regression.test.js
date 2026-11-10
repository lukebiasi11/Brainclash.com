// Old-vs-new checkAnswer regression. The old file is the Fact Checker head a28d5a2.
// Live questions must score the same. Single-word accepts are covered in types.test.js.
const fs = require("fs"), path = require("path"), vm = require("vm"), { execFileSync } = require("child_process");
const root = path.join(__dirname, "..");
const oldPath = path.join("/tmp", "answers-a28d5a2.js");
fs.writeFileSync(oldPath, execFileSync("git", ["show", "a28d5a2:answers.js"], { cwd: root }));
const oldA = require(oldPath);
const newA = require(path.join(root, "answers.js"));
const win = {};
vm.runInNewContext(fs.readFileSync(path.join(root, "content.js"), "utf8"), { window: win });
const C = win.CONTENT;
const questions = [];
function walk(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { node.forEach(walk); return; }
  if (Array.isArray(node.answers) || typeof node.answer === "string" || Array.isArray(node.accept)) questions.push(node);
  for (const k of Object.keys(node)) if (k !== "answers" && k !== "accept" && k !== "aliases" && k !== "wrong" && k !== "given" && k !== "exactOnly") walk(node[k]);
}
walk(C);
function opts(q) {
  return { aliases: q.aliases, wrong: q.wrong || q.options, given: q.given, exactOnly: q.exactOnly, noSurname: q.noSurname, textOnly: q.textOnly, person: q.person, q: typeof q.q === "string" ? q.q : (q.prompt || "") };
}
function targets(q) {
  return [].concat(q.answers || [], typeof q.answer === "string" ? [q.answer] : [], q.accept || []).filter(s => typeof s === "string" && s.trim());
}
function probes(s) {
  const out = new Set([s, s.toUpperCase(), s.toLowerCase(), s + "!", "the " + s, " " + s + " ", s + "s"]);
  const chars = [...s];
  if (chars.length > 2) {
    out.add(s.slice(0, -1)); out.add(s.slice(1)); out.add(s[0] + "x" + s.slice(2));
    chars.forEach((c, i) => {
      if (i > 20) return;
      out.add(chars.slice(0, i).concat(chars.slice(i + 1)).join(""));
      out.add(chars.slice(0, i).concat("a", chars.slice(i + 1)).join(""));
      out.add(chars.slice(0, i).concat("e", chars.slice(i)).join(""));
    });
  }
  return [...out];
}
let n = 0, diffs = [];
for (const q of questions) {
  const list = targets(q), o = opts(q);
  const answers = [].concat(q.answers || [], typeof q.answer === "string" ? [q.answer] : []);
  for (const extra of [{}, { person: true }, { noSurname: true }]) {
    const o2 = Object.assign({}, o, extra);
    for (const s of list) for (const input of probes(s)) {
      const a = oldA.checkAnswer(input, answers, o2);
      const b = newA.checkAnswer(input, answers, o2);
      n++;
      if (a !== b && diffs.length < 20) diffs.push({ q: (o.q || "").slice(0, 60), input, old: a, now: b, extra });
    }
  }
}
const extra = [
  ["bryent", ["Kobe Bryant"], { aliases: ["Bryant"], q: "Who is this?" }, true],
  ["Bryant", ["Kobe Bryant"], { aliases: ["Bryant"], q: "Who is this?" }, true],
  ["sorentam", ["Annika Sorenstam"], { aliases: ["Sorenstam"], q: "Who is this?" }, true],
  ["muhamma", ["Muhammad Ali"], { aliases: ["Muhammad"], exactOnly: ["Muhammad"], q: "Who is this?" }, false],
  ["Muhammad", ["Muhammad Ali"], { aliases: ["Muhammad"], exactOnly: ["Muhammad"], q: "Who is this?" }, true]
];
let extraBad = 0;
for (const [input, answers, o, exp] of extra) {
  n++;
  if (newA.checkAnswer(input, answers, o) !== exp) { extraBad++; console.log("FAIL extra", input, "expected", exp); }
}
console.log("comparisons", n, "content questions", questions.length, "diffs", diffs.length);
diffs.forEach(d => console.log("DIFF", JSON.stringify(d)));
if (n < 26000) { console.log("FAIL fewer than 26000 comparisons"); process.exit(1); }
if (diffs.length || extraBad) process.exit(1);
console.log("answer-regression.test.js: all pass");
