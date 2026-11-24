/* Cup logic: the ball's final slot matches an independent replay, for many seeds and all tiers.
   Points are the Think Fast total (400 + 600) split 15/25/35/10/15.
   On 2026-11-26 those rounds are Think Fast's two questions: Cup Shuffle 150, Track the Dot 250. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const EE = require("../eagle-eye.js");
const root = path.join(__dirname, "..");
let pass = 0, fail = 0;
const t = (ok, why) => { if (ok) pass++; else { fail++; console.log("FAIL", why); } };

const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const vals = app.match(/function thinkFast\(\) \{\n  if \(window\.EagleEye && EagleEye\.on\(session\.key\)\) return thinkFastPerception\(\);\n  const qs = session\.set\.thinkFast\.map\(normPuzzle\), vals = \[(\d+), (\d+)\]/);
t(!!vals, "thinkFast still declares its two point values");
t(vals && EE.THINK_PARTS[0] === +vals[1] && EE.THINK_PARTS[1] === +vals[2], "the point parts stay the Think Fast pair (" + (vals && vals.slice(1).join("+")) + ")");
const max = EE.THINK_PARTS[0] + EE.THINK_PARTS[1];
t(EE.THINK_MAX === max && EE.roundPoints().reduce((a, b) => a + b, 0) === max, "round points sum to the Think Fast total");
t(EE.WEIGHTS.join(",") === "0.15,0.25,0.35,0.1,0.15" && EE.roundPoints().join(",") === "150,250,350,100,150", "15/25/35/10/15 of 1000");
t(EE.scoreTrack(0, 1) === 0 && EE.scoreTrack(1, 1) === 0 && EE.scoreTrack(2, 1) === 150, "track round 2 is all or nothing");
t(EE.scoreTrack(1, 0) === 100 && EE.scoreTrack(0, 0) === 0, "track round 1 is all or nothing");
const dbl = { picks: [], lastAt: null };
t(EE.trackPick(dbl, 6, 1000) && dbl.picks.join(",") === "6", "the first tap counts");
t(!EE.trackPick(dbl, 2, 1200) && dbl.picks.join(",") === "6", "a second tap inside 300 ms does not pick another dot");
t(!EE.trackPick(dbl, 6, 1400) && dbl.picks.length === 1, "the same dot is not picked twice");
t(EE.trackPick(dbl, 2, 1400) && dbl.picks.join(",") === "6,2", "the second dot counts after the lock");
["2026-11-22", "2026-11-23", "2026-11-24", "2026-11-25", "2026-11-27", "2026-12-01"].forEach(d => t(!EE.on(d), d + " stays Think Fast"));
t(EE.on("2026-11-26") && EE.DAY === "2026-11-26", "only 2026-11-26 swaps in Cup Shuffle and Track the Dot");
t(EE.TIERS[1].pts === 150 && EE.TRACK[0].pts + EE.TRACK[1].pts === 250, "the two scheduled questions are 150 and 250");
t(EE.TIERS[2].pts === 250 && EE.TIERS[3].pts === 350 && !/cupRound\(env, 2/.test(fs.readFileSync(path.join(root, "eagle-eye.js"), "utf8")) && !/cupRound\(env, 3/.test(fs.readFileSync(path.join(root, "eagle-eye.js"), "utf8")), "tiers 2 and 3 stay banked");
t(EE.onEpoch(Math.floor(Date.parse("2026-11-26T00:00:00Z") / 864e5)) === true && EE.onEpoch(Math.floor(Date.parse("2026-11-25T00:00:00Z") / 864e5)) === false, "epoch matches the admin date key");
const adminDate = k => new Date(k + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
t(adminDate("2026-11-26") === "Thu, Nov 26, 2026" && adminDate("2026-11-25") === "Wed, Nov 25, 2026", "admin labels Thu, Nov 26, 2026 and Wed, Nov 25, 2026");

const i18n = require("../i18n.js");
const i18nSrc = fs.readFileSync(path.join(root, "i18n.js"), "utf8");
t(!/Eagle Eye|Ojo de Águila/.test(i18nSrc), "i18n has no Eagle Eye strings");
t(i18n.ES["Puzzle 1, {0}, is worth {1} points. {2} {3} Puzzle 2, {4}, is worth {5} points. {6} {7}"] === "Acertijo 1, {0}, vale {1} puntos. {2} {3} Acertijo 2, {4}, vale {5} puntos. {6} {7}", "Spanish Think Fast how-to");
EE.CUPS_HOW.forEach((en, i) => t(i18n.ES[en] === EE.CUPS_HOW_ES[i], "Spanish cup line " + (i + 1)));
EE.DOT_HOW.forEach((en, i) => t(i18n.ES[en] === EE.DOT_HOW_ES[i], "Spanish dot line " + (i + 1)));
t(!/Five rounds|Cinco rondas|Follow the ball|glowing|Eagle Eye/.test(EE.CUPS_HOW.join(" ") + EE.DOT_HOW.join(" ")), "directions stay short and say orange");
t(i18n.ES["Round {0} · {1} cups · {2} pts"] === "Ronda {0} · {1} vasos · {2} pts", "Spanish cup round header");
t(i18n.ES["Round {0} · 1 dot · {1} pts"] === "Ronda {0} · 1 punto · {1} pts", "Spanish one-dot header");
t(i18n.ES["Round {0} · {1} dots · {2} pts"] === "Ronda {0} · {1} puntos · {2} pts", "Spanish two-dot header");
t(i18n.ES["Follow them…"] === "Síguelos…" && i18n.ES["Lost it · +0"] === "Se te escapó · +0", "Spanish follow and miss lines");
t(!i18n.ES["One of two · +{0}"] && !i18n.ES["Follow the glowing dots."], "partial and glowing copy are gone");
const eeSrc = fs.readFileSync(path.join(root, "eagle-eye.js"), "utf8");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");
t(!/hop/.test(eeSrc) && !/One of two/.test(eeSrc) && !/glowing/.test(eeSrc), "no hop feint, partial credit, or glowing copy");
t(/Track round 2 is all or nothing/.test(admin) && !/pts per dot/.test(admin), "admin says track round 2 is all or nothing");

function realMoves(moves) { return moves.filter(m => m.t !== "feint"); }
let rot2 = 0, far2 = 0, rot3 = 0, far3 = 0, n = 0;
for (let s = 0; s < 300; s++) {
  const seed = "eagleeye|seed-" + s;
  for (const tier of [1, 2, 3]) {
    const T = EE.TIERS[tier];
    const plan = EE.planCup(seed, tier);
    const again = EE.planCup(seed, tier);
    const ball = EE.replayBall(plan.startSlot, plan.moves);
    const cup = EE.replayCups(plan.n, plan.startSlot, plan.moves);
    n++;
    if (ball !== plan.finalSlot || cup !== plan.finalSlot) {
      t(false, seed + " tier " + tier + " ball " + ball + " cup " + cup + " final " + plan.finalSlot);
      continue;
    }
    if (plan.finalSlot < 0 || plan.finalSlot >= plan.n) t(false, "final slot out of range " + seed + " t" + tier);
    if (realMoves(plan.moves).length !== T.moves) t(false, "real move count " + seed + " t" + tier);
    if (plan.moves.filter(m => m.t === "feint").length !== T.feints) t(false, "feint count " + seed + " t" + tier);
    if (plan.moves.some(m => m.t === "feint" && m.kind !== "swap")) t(false, "a feint was not a swap " + seed + " t" + tier);
    const feintMoves = plan.moves.some(m => m.t === "feint" && EE.applyMove(2, m) !== 2);
    if (feintMoves) t(false, "a feint moved the ball " + seed);
    if (tier === 1) {
      const bad = plan.moves.some(m => m.t !== "swap" || Math.abs(m.b - m.a) > 2 || m.far);
      if (bad) t(false, "tier 1 left the near-swap set " + seed);
    }
    if (JSON.stringify(plan.moves) !== JSON.stringify(again.moves) || plan.finalSlot !== again.finalSlot || plan.startSlot !== again.startSlot) t(false, "same seed was not stable " + seed + " t" + tier);
    plan.moves.forEach(m => {
      if (m.t === "rot") { if (tier === 2) rot2++; if (tier === 3) rot3++; }
      if (m.t === "swap" && m.far) { if (tier === 2) far2++; if (tier === 3) far3++; }
    });
  }
  const full3 = EE.planCup(seed, 3);
  const alone = EE.planCup(seed, 3);
  if (JSON.stringify(full3) !== JSON.stringify(alone)) t(false, "tier 3 stream changed " + seed);
}
t(n === 900, "played 300 seeds × 3 tiers");
t(rot2 > 300 && far2 > 200, "tier 2 includes rotations (" + rot2 + ") and far swaps (" + far2 + ")");
t(rot3 > 400 && far3 > 300, "tier 3 includes rotations (" + rot3 + ") and far swaps (" + far3 + ")");
const a = EE.planCup("eagleeye|2026-11-22", 1);
const b = EE.planCup("eagleeye|2026-11-23", 1);
t(JSON.stringify(a.moves) !== JSON.stringify(b.moves), "a different date gets a different shuffle");

const day = EE.planCup("eagleeye|2026-11-22", 2);
let slot = day.startSlot;
day.moves.forEach(m => { slot = EE.applyMove(slot, m); });
t(slot === day.finalSlot && EE.replayCups(4, day.startSlot, day.moves) === day.finalSlot, "seeded tier 2 ball ends where the cups leave it");

const bank = {};
vm.runInNewContext(fs.readFileSync(path.join(root, "content.js"), "utf8"), { window: bank });
const nov22 = bank.DAY_OVERRIDES["2026-11-22"];
const nov23 = bank.DAY_OVERRIDES["2026-11-23"];
t(nov22 && nov22.thinkFast === 65, "11/22 pins thinkFast #65");
t(bank.CONTENT.thinkFast[65][0].q.indexOf("truck gets stuck under a low bridge") > 0 && bank.CONTENT.thinkFast[65][1].answers.indexOf("palm") === 0, "thinkFast #65 is the bridge puzzle plus the palm riddle");
t(nov23 && nov23.thinkFast === 63 && bank.CONTENT.thinkFast[63][0].q.indexOf("matchsticks") > 0, "11/23 still names the banked matchstick teaser");
const scheduled63 = Object.keys(bank.DAY_OVERRIDES).filter(k => bank.DAY_OVERRIDES[k] && bank.DAY_OVERRIDES[k].thinkFast === 63);
t(scheduled63.length === 1 && scheduled63[0] === "2026-11-23", "only the 11/23 override names the matchstick index");
t(/if \(window\.EagleEye && EagleEye\.on\(session\.key\)\) return thinkFastPerception\(\)/.test(app), "11/26 runs inside thinkFast");
t(!/eagleEye|eagleIntro|tr\("Eagle Eye"\)/.test(app), "the player never titles a screen Eagle Eye");
t(/const go = \[worldRush, history, sports, wordChallenge, thinkFast\]/.test(app), "the fifth category is always thinkFast");

function renderThinkFast(lang, day) {
  const nodes = new Set();
  function textOf(node) {
    if (!node) return "";
    if (node.nodeType === 3) return node.nodeValue || "";
    return (node.childNodes || []).map(textOf).join("");
  }
  function make(tag) {
    const el = {
      nodeType: 1, tagName: String(tag || "div").toUpperCase(), id: "", className: "",
      textContent: "", value: "", style: {}, dataset: {}, childNodes: [], children: [],
      classList: null, hidden: false
    };
    el.classList = {
      add() {}, remove() {}, toggle() {},
      contains(name) { return (" " + el.className + " ").includes(" " + name + " "); }
    };
    el.append = (...kids) => kids.flat().forEach(k => {
      if (k == null || k === false) return;
      el.childNodes.push(k); if (k.nodeType === 1) el.children.push(k); k.parentNode = el;
    });
    el.setAttribute = (k, v) => { if (k === "id") el.id = v; if (k === "class") el.className = v; };
    el.addEventListener = () => {};
    el.removeEventListener = () => {};
    el.querySelector = () => null;
    el.querySelectorAll = () => [];
    el.closest = () => null;
    el.contains = n => n === el || (el.childNodes || []).some(c => c === n || (c.contains && c.contains(n)));
    el.getBoundingClientRect = () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });
    el.blur = () => {};
    el.focus = () => {};
    el.matches = () => false;
    el.remove = () => {};
    Object.defineProperty(el, "innerHTML", { set() { el.childNodes = []; el.children = []; }, get() { return ""; } });
    Object.defineProperty(el, "offsetWidth", { get() { return 390; } });
    nodes.add(el);
    return el;
  }
  const appEl = make("main");
  appEl.id = "app";
  const body = make("body");
  const document = {
    documentElement: make("html"),
    body: body,
    createElement: make,
    createTextNode: text => ({ nodeType: 3, nodeValue: String(text), textContent: String(text) }),
    getElementById: id => id === "app" ? appEl : null,
    querySelector: sel => sel === "#app" ? appEl : null,
    querySelectorAll: () => [],
    addEventListener() {},
    scrollingElement: { scrollHeight: 800 }
  };
  const sandbox = {
    console, document,
    location: { search: "?dgtest&lang=" + lang, protocol: "file:", href: "file:///index.html" },
    localStorage: (() => { const bag = {}; return { getItem: k => (k in bag ? bag[k] : null), setItem: (k, v) => { bag[k] = String(v); }, removeItem: k => { delete bag[k]; } }; })(),
    MutationObserver: class { observe() {} disconnect() {} },
    addEventListener() {}, requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
    setTimeout, clearTimeout, setInterval, clearInterval,
    performance: { now: () => 0 }, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    Intl, Date, Math, JSON, Map, Set, Object, Array, String, Number, RegExp, Error,
    parseInt, parseFloat, isNaN, isFinite, NaN, Infinity, undefined,
    navigator: { userAgent: "node" }, CSS: { supports: () => true },
    innerHeight: 844, innerWidth: 390, getComputedStyle: () => ({ fontSize: "16px" }),
    confirm: () => false, scrollTo() {}
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const load = file => vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), sandbox, { filename: file });
  sandbox.BC_NO_BOOT = true;
  load("content.js");
  load("anagrams.js");
  load("eagle-eye.js");
  load("i18n.js");
  load("app.js");
  sandbox.DGTest.at(day, 4);
  return textOf(appEl);
}
["en", "es"].forEach(lang => {
  let text = "";
  try { text = renderThinkFast(lang, "2026-11-26"); }
  catch (e) { t(false, lang + " 11/26 render threw " + e.message); return; }
  t(!/Eagle Eye|Ojo de Águila/.test(text), lang + " 11/26 renders no Eagle Eye");
  t(lang === "es" ? /Rompecocos/.test(text) : /Brain Teaser/.test(text), lang + " 11/26 uses the Think Fast name");
  t(/150/.test(text) && /250/.test(text), lang + " 11/26 shows 150 and 250 (" + text.slice(0, 180) + ")");
  t(lang === "es" ? /Vasos/.test(text) && /Sigue el punto/.test(text) : /Cup Shuffle/.test(text) && /Track the Dot/.test(text), lang + " 11/26 names both questions");
});
{
  const plain = renderThinkFast("en", "2026-11-25");
  t(/400 and 600/.test(plain) && !/Cup Shuffle/.test(plain) && !/Eagle Eye/.test(plain), "11/25 stays the regular Think Fast intro");
}

console.log(pass + " passed, " + fail + " failed");
if (rot2) console.log("tier2 rot/seed", (rot2 / 300).toFixed(2), "far/seed", (far2 / 300).toFixed(2), "tier3 rot/seed", (rot3 / 300).toFixed(2), "far/seed", (far3 / 300).toFixed(2));
process.exit(fail ? 1 : 0);
