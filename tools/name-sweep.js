// node tools/name-sweep.js — first/last/place singles and short pairs through the client name check.
const fs = require("fs");
const path = require("path");
const Filter = require("../name-filter.js");
const data = require("./name-sweep-data.js");

function words(text) {
  const seen = new Set();
  const out = [];
  String(text).split(/\s+/).forEach(word => {
    if (!word || seen.has(word)) return;
    seen.add(word);
    out.push(word);
  });
  return out;
}
function verdict(name) {
  const got = Filter.checkName(name);
  return got.skip ? "skip" : got.ok ? "ok" : got.reason || "reject";
}

const first = words(data.first);
const last = words(data.last);
const places = words(data.places);
const singleRejects = [];
const alone = new Map();
function remember(name) {
  const why = verdict(name);
  alone.set(name, why);
  if (why !== "ok") singleRejects.push(name + " (" + why + ")");
}
first.forEach(remember);
last.forEach(remember);
places.forEach(remember);

function leet(s) {
  return s.replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/6/g, "g").replace(/7/g, "t").replace(/8/g, "b").replace(/9/g, "g");
}
function squeeze(s) { return s.replace(/([a-z])\1+/g, "$1"); }
function attached(text, term) {
  if (!text || text === term) return false;
  const tails = ["boys", "boy", "lord", "eyes", "eye", "face", "man", "ies", "es", "s"];
  for (const tail of tails) {
    if (text.indexOf(term + tail) === 0 && /^\d*$/.test(text.slice(term.length + tail.length))) return true;
  }
  if (text.indexOf(term) === 0 && /^\d+$/.test(text.slice(term.length))) return true;
  if (term.endsWith("y")) {
    const plural = term.slice(0, -1) + "ies";
    if (text.indexOf(plural) === 0 && /^\d*$/.test(text.slice(plural.length))) return true;
  }
  return false;
}
function hitTerm(text) {
  if (!text) return "";
  const sq = squeeze(text);
  const collapsed = sq !== text;
  const longs = Filter.TERMS.sub.concat(Filter.TERMS.compound, Filter.TERMS.imp);
  for (const term of longs) {
    const tsq = squeeze(term);
    if (text.indexOf(term) >= 0 || attached(text, term)) return term;
    if (term !== "boobs" && collapsed && (sq === tsq || (tsq.length >= 4 && sq.indexOf(tsq) >= 0))) return term;
  }
  const shorts = Filter.TERMS.word.concat(Filter.TERMS.impWord);
  for (const term of shorts) {
    const tsq = squeeze(term);
    if (text === term || attached(text, term) || text === "the" + term || text === term + "lover" || new RegExp("^x+" + term + "x+$").test(text)) return term;
    if (collapsed && (sq === tsq || attached(sq, tsq))) return term;
  }
  if (/^x{3,}$/.test(text) || /^x{3,}$/.test(sq)) return "xxx";
  return "";
}
function joinHits(name) {
  const parts = Filter.fold(name).split(/[^a-z0-9]+/).filter(Boolean);
  const runs = [];
  let run = [];
  function flush() { if (run.length >= 2) runs.push(run.slice()); run = []; }
  parts.forEach(part => {
    const prev = run[run.length - 1];
    if (!prev || prev.length <= 3 || part.length <= 3) run.push(part);
    else { flush(); run = [part]; }
  });
  flush();
  const hits = [];
  runs.forEach(runParts => {
    const joined = leet(runParts.join(""));
    const raw = runParts.join("");
    const term = hitTerm(raw) || hitTerm(joined) || hitTerm(leet(raw));
    if (term) hits.push(runParts.join("+") + " → " + term);
  });
  return hits;
}
const pairRejects = [];
let pairs = 0;
function consider(a, b) {
  const name = a + " " + b;
  if (name.length > 20) return;
  pairs += 1;
  if (alone.get(a) !== "ok" || alone.get(b) !== "ok") return;
  const why = verdict(name);
  if (why === "ok") return;
  const hits = joinHits(name);
  if (!hits.length) return;
  pairRejects.push(name + " (" + why + "; " + hits.join(", ") + ")");
}
first.forEach(a => last.forEach(b => consider(a, b)));
first.forEach(a => places.forEach(b => consider(a, b)));

const singles = first.length + last.length + places.length;
console.log("singles", singles, "first", first.length, "last", last.length, "places", places.length);
console.log("pairs checked", pairs);
console.log("total checked", singles + pairs);
console.log("singles rejected", singleRejects.length);
singleRejects.forEach(line => console.log("  " + line));
console.log("pairs rejected only because of a join", pairRejects.length);
pairRejects.forEach(line => console.log("  " + line));

function loadLines(file) {
  return fs.readFileSync(path.join(__dirname, file), "utf8").split(/\s+/).filter(Boolean);
}
function sweepFile(label, file) {
  const rows = loadLines(file);
  let checked = 0;
  let rejected = 0;
  const samples = [];
  rows.forEach(name => {
    if (name.length < 3 || name.length > 20) return;
    checked += 1;
    const why = verdict(name);
    if (why !== "ok") {
      rejected += 1;
      if (samples.length < 40) samples.push(name + " (" + why + ")");
    }
  });
  console.log(label, "checked", checked, "rejected", rejected);
  samples.forEach(line => console.log("  " + line));
}
sweepFile("common words", "common-words.txt");
sweepFile("common first names", "common-first-names.txt");
sweepFile("common surnames", "common-surnames.txt");
