// node tools/name-sweep.js — first/last/place singles and short pairs through the client name check.
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

const pairRejects = [];
let pairs = 0;
function consider(a, b) {
  const name = a + " " + b;
  if (name.length > 20) return;
  pairs += 1;
  if (alone.get(a) !== "ok" || alone.get(b) !== "ok") return;
  const why = verdict(name);
  if (why !== "ok") pairRejects.push(name + " (" + why + ")");
}
first.forEach(a => last.forEach(b => consider(a, b)));
first.forEach(a => places.forEach(b => consider(a, b)));

const singles = first.length + last.length + places.length;
console.log("singles", singles, "first", first.length, "last", last.length, "places", places.length);
console.log("pairs checked", pairs);
console.log("total checked", singles + pairs);
console.log("singles rejected", singleRejects.length);
singleRejects.forEach(line => console.log("  " + line));
console.log("pairs rejected with both parts accepted", pairRejects.length);
pairRejects.forEach(line => console.log("  " + line));
