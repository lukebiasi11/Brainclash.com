/* Admin preview cards. Renders card() for every day from launch through the
   scheduled window (includes 2026-11-18 – 2026-11-24 and later rotation days)
   and checks World Rush pins, multiple choice, flag art, and pair rounds. */
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
let pass = 0, fail = 0;
const t = (ok, why) => { if (ok) pass++; else { fail++; console.log("FAIL", why); } };

function el(tag) {
  return {
    tagName: String(tag || "div").toUpperCase(),
    className: "",
    id: "",
    innerHTML: "",
    textContent: "",
    value: "",
    style: {},
    dataset: {},
    children: [],
    classList: { toggle() {}, add() {}, remove() {} },
    append(c) { this.children.push(c); },
    prepend(c) { this.children.unshift(c); },
    setAttribute() {},
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    scrollIntoView() {}
  };
}
const ids = {};
function byId(id) {
  if (!ids[id]) ids[id] = el("div");
  ids[id].id = id;
  return ids[id];
}
const document = {
  documentElement: { lang: "en", classList: { add() {}, remove() {}, toggle() {} }, style: { setProperty() {} } },
  body: el("body"),
  createElement: el,
  getElementById: byId,
  querySelector(sel) { return sel === "#app" ? byId("app") : null; },
  querySelectorAll() { return []; },
  addEventListener() {}
};
const storage = {};
const sandbox = {
  console,
  document,
  localStorage: { getItem: k => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); }, removeItem: k => { delete storage[k]; } },
  location: { search: "", protocol: "file:", href: "file:///admin.html" },
  MutationObserver: class { observe() {} disconnect() {} },
  addEventListener() {},
  requestAnimationFrame() { return 1; },
  cancelAnimationFrame() {},
  setTimeout, clearTimeout, setInterval, clearInterval,
  performance: { now: () => 0 },
  Intl, Date, Math, JSON, Map, Set, Object, Array, String, Number, RegExp, Error,
  parseInt, parseFloat, isNaN, isFinite, NaN, Infinity, undefined,
  navigator: { userAgent: "node" },
  CSS: { supports: () => true },
  innerHeight: 800,
  innerWidth: 1200
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const load = file => vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), sandbox, { filename: file });
load("content.js");
load("anagrams.js");
load("assets/icons.js");
load("answers.js");
sandbox.BC_NO_BOOT = true;
load("app.js");
load("feedback.js");
const html = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const inline = html.match(/<script>\s*\(\(\) => \{[\s\S]*\}\)\(\);\s*<\/script>\s*<\/body>/);
if (!inline) throw new Error("admin inline script not found");
vm.runInContext(inline[0].replace(/^<script>/, "").replace(/<\/script>\s*<\/body>$/, ""), sandbox, { filename: "admin.html" });

const B = sandbox.BCDaily, A = sandbox.BCAdmin;
t(!!B && typeof B.getDailySet === "function", "getDailySet loaded");
t(!!A && typeof A.card === "function" && typeof A.renderWindow === "function", "admin card exported");
const openKeys = byId("days").children.map(n => n.dataset.key);
const today0 = B.dayOfKey(B.todayKey());
const expectOpen = Array.from({ length: 7 }, (_, i) => B.keyOf(today0 + i));
t(openKeys.join(",") === expectOpen.join(","), "opening window renders today and the next 6 days (got " + openKeys.join(",") + ")");

function htmlOf(node) { return node && node.innerHTML || ""; }
function textOf(v) {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && !Array.isArray(v)) return (typeof v.en === "string" && v.en.trim()) || (typeof v.es === "string" && v.es.trim()) || "";
  return "";
}

const from = B.dayOfKey("2026-10-23"), to = B.dayOfKey("2027-01-31");
const scheduled = [];
for (let d = from; d <= to; d++) scheduled.push(B.keyOf(d));
for (const k of Object.keys(sandbox.DAY_OVERRIDES || {})) if (/^\d{4}-\d{2}-\d{2}$/.test(k) && !scheduled.includes(k)) scheduled.push(k);

let badDays = [];
for (const k of scheduled) {
  let node;
  try { node = A.showDay(k, null, false); }
  catch (e) { badDays.push(k + " threw " + e.message); continue; }
  const h = htmlOf(node);
  if (!h.includes("World Rush") || h.includes("unrecognized item")) badDays.push(k + (h.includes("unrecognized item") ? " unrecognized" : " missing World Rush"));
  const items = sandbox.BCFeedback.items(B.getDailySet(k));
  if (items.some(it => it.prompt === "unrecognized item")) badDays.push(k + " review unrecognized");
}
t(badDays.length === 0, "every scheduled day renders clean (" + scheduled.length + " days)" + (badDays.length ? ": " + badDays.slice(0, 8).join("; ") : ""));

function worldBits(k) {
  const w = B.getDailySet(k).worldRush;
  const pins = (w.pins || []).map(p => p.name);
  let third = "", answers = [];
  if (w.mc) {
    third = textOf(w.mc.q);
    answers = [textOf(w.mc.options[w.mc.a])];
  } else if (w.pair) {
    third = textOf(w.pair.prompt);
    answers = w.pair.rounds.map(r => textOf(r[r.correct]));
  }
  return { pins, third, answers, flag: w.mc && w.mc.img, shape: w.mc ? (w.mc.img && String(w.mc.img).startsWith("flag-") ? "flag" : "mc") : "pair" };
}
for (let d = B.dayOfKey("2026-11-18"); d <= B.dayOfKey("2026-11-24"); d++) {
  const k = B.keyOf(d), node = A.card(k, null, k === "2026-11-18"), h = htmlOf(node), bits = worldBits(k);
  t(h.includes("World Rush") && !h.includes("unrecognized item"), k + " card stays intact (" + bits.shape + ")");
  bits.pins.forEach(name => t(h.includes(name), k + " lists pin " + name));
  t(h.includes(bits.third), k + " lists third question");
  bits.answers.forEach(a => t(a && h.includes(a), k + " lists answer " + a));
  if (bits.flag) t(h.includes("flag") && h.includes(sandbox.ICONS[bits.flag]), k + " lists flag " + bits.flag);
  if (bits.shape === "pair") t(h.includes(">pair<") && h.includes(">round<"), k + " lists pair rounds");
}

const windowKeys = ["2026-11-18", "not-a-day", "2026-11-20", "2026-11-24"];
let nodes;
try { nodes = A.renderWindow(windowKeys, "2026-11-18"); }
catch (e) { nodes = []; t(false, "renderWindow threw " + e.message); }
t(nodes.length === windowKeys.length, "one bad day does not stop the window (got " + nodes.length + ")");
t(htmlOf(nodes[0]).includes(worldBits("2026-11-18").third), "Nov 18 still renders beside a bad day");
t(htmlOf(nodes[1]).includes("unrecognized item"), "bad day shows unrecognized item");
t(htmlOf(nodes[2]).includes("Which country's flag is this?") && htmlOf(nodes[2]).includes("Greece"), "Nov 20 flag still renders");
t(htmlOf(nodes[3]).includes(worldBits("2026-11-24").third), "Nov 24 still renders");

const odd = A.worldParts({ pins: [{ name: "Nowhere" }], flags: [{ q: "Which flag?" }] });
t(odd.items.includes("unrecognized item") && !/Cannot read/.test(odd.items + odd.answers), "odd World Rush shape notes unrecognized item");
const missing = A.worldParts(null);
t(missing.items.includes("unrecognized item"), "missing World Rush notes unrecognized item");
const flagOnly = A.worldParts({ pins: [{ name: "Oslo, Norway", lat: 59.91, lon: 10.75 }, { name: "Seoul, South Korea", lat: 37.57, lon: 126.98 }], mc: { q: "Which country's flag is this?", img: "flag-japan", options: ["South Korea", "Japan"], a: 1, optionImgs: ["flag-south-korea", "flag-japan"] } });
t(flagOnly.items.includes(">flag<") && flagOnly.items.includes("flag-japan") && flagOnly.answers.includes("Japan") && !flagOnly.items.includes("unrecognized item"), "flag multiple choice lists the flag and its answer");

const pinsOnly = { pins: [{ name: "Quito, Ecuador", lat: -0.18, lon: -78.47 }, { name: "Wellington, New Zealand", lat: -41.29, lon: 174.78 }] };
const twoPins = A.worldParts(pinsOnly);
t(twoPins.items.includes("Quito, Ecuador") && twoPins.items.includes("Wellington, New Zealand") && !twoPins.items.includes("unrecognized item"), "admin lists a 2-pin day without a third question");
const events = [1895, 1928, 1952, 1977, 2007].map((y, i) => ["🎬", "Debut " + (i + 1), y]);
const review = sandbox.BCFeedback.items({
  worldRush: pinsOnly,
  history: { theme: "Screen debuts", events: events },
  sports: [{ type: "text", kind: "actor", q: "Name the actor from these clues.", answers: ["alejandro marin castillo"], clues: ["Billing name: Alejandro Marin Castillo"] }],
  wordGame: { id: "flip", name: "Unscramble" },
  wordFlip: [["ALPHA", "definition", "a"], ["BRAVO", "definition", "b"], ["CHARLIE", "definition", "c"], ["DELTA", "definition", "d"], ["ECHO", "definition", "e"], ["FOXTROT", "definition", "f"]],
  thinkFast: [{ q: "One", answers: ["a"] }, { q: "Two", answers: ["b"] }]
});
const warp = review.filter(it => it.cat === "Time Warp");
const world = review.filter(it => it.cat === "World Rush");
const mvp = review.filter(it => it.cat === "MVP");
t(warp.length === 1 && warp[0].prompt.includes("Debut 1") && warp[0].prompt.includes("Debut 5") && warp[0].answer.includes("1895") && !/unrecognized|undefined/.test(warp[0].prompt + warp[0].answer), "review has one 5-event timeline");
t(world.length === 2 && world.every(it => it.prompt.startsWith("Pin:")) && !world.some(it => it.prompt === "unrecognized item"), "review has two pins and no third question");
t(mvp.length === 1 && mvp[0].answer.includes("alejandro marin castillo") && !/undefined|Sports|team/.test(mvp[0].prompt + mvp[0].answer), "review celebrity round has no sports label");
const classic = sandbox.DGScore.worldPlan({ pins: pinsOnly.pins, mc: { q: "Q", options: ["A"], a: 0 } });
const only = sandbox.DGScore.worldPlan(pinsOnly);
t(classic.each === 450 && classic.total === 1000 && classic.third === "mc", "a third question keeps 450-point pins");
t(only.each === 500 && only.total === 1000 && only.third === null && only.count === 2, "two pins alone total 1,000");

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
