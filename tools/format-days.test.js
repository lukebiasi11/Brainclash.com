/* World 2-pin days, a single 5-event timeline, and celebrity MVP rounds.
   2026-11-25 and 2026-11-26 World, Time Warp, and MVP are pinned to the approved sets. 11/25 Think Fast stays on rotation index 26. 11/26 Think Fast is the already-merged Brain Teaser. */
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
let bad = 0;
const t = (name, got, exp) => { if (got !== exp) { bad++; console.log("FAIL", name, "->", got, "expected", exp); } };
const ok = (name, cond) => t(name, !!cond, true);

const document = {
  documentElement: { lang: "en", classList: { add() {}, remove() {}, contains() { return false; } }, style: { setProperty() {} } },
  body: { classList: { add() {}, remove() {}, contains() { return false; } }, append() {} },
  querySelector() { return null; },
  getElementById() { return { style: {} }; },
  addEventListener() {},
  createElement() { return { style: {}, classList: { add() {}, remove() {}, contains() { return false; } }, append() {}, setAttribute() {} }; }
};
const sandbox = {
  console, document,
  location: { search: "", protocol: "file:", href: "file:///" },
  localStorage: { getItem: () => null, setItem() {} },
  navigator: { userAgent: "node" },
  MutationObserver: class { observe() {} disconnect() {} },
  addEventListener() {}, requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
  setTimeout, clearTimeout, setInterval, clearInterval,
  performance: { now: () => 0 }, Intl, Date, Math, JSON, Map, Set, Object, Array, String, Number, RegExp, Error,
  parseInt, parseFloat, isNaN, isFinite, NaN, Infinity, undefined,
  CSS: { supports: () => true }, innerHeight: 844, innerWidth: 390,
  matchMedia: () => ({ matches: false, addEventListener() {} })
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
sandbox.BC_NO_BOOT = true;
for (const f of ["content.js", "anagrams.js", "answers.js", "i18n.js", "demo-types.js", "app.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), sandbox, { filename: f });
}
const S = sandbox.DGScore;
const V = require("./validate.js");
const demo = sandbox.FORMAT_DEMO;
const pins = demo.world.pins;

const classic = S.worldPlan({ pins, mc: { q: "Q", options: ["A"], a: 0 } });
const pairDay = S.worldPlan({ pins, pair: { type: "pair", prompt: "P", rounds: [] } });
const only = S.worldPlan(demo.world);
t("classic pin value", classic.each, 450);
t("classic total", classic.total, 1000);
t("classic third", classic.third, "mc");
t("pair third", pairDay.third, "pair");
t("pair pins stay 450", pairDay.each, 450);
t("two-pin count", only.count, 2);
t("two-pin value", only.each, 500);
t("two-pin total", only.total, 1000);
t("two-pin has no third", only.third, null);
t("exact pin still 450", S.pinPoints(0), 450);
t("exact 500 pin", S.pinPointsFor(0, 500), 500);
t("halfway 500 pin", S.pinPointsFor(2000, 500), 250);
t("missed 500 pin", S.pinPointsFor(4000, 500), 0);
t("live validator accepts 2 pins", V.checkWorldDay("w", demo.world).length, 0);

const five = demo.history.events;
const perfect = [0, 1, 2, 3, 4];
const oneSwap = [0, 1, 2, 4, 3];
const reversed = [4, 3, 2, 1, 0];
t("five events perfect", S.timelineScore(five, perfect, 1000).pts, 1000);
t("five events pairs", S.timelineScore(five, perfect, 1000).pairs, 10);
t("one adjacent swap", S.timelineScore(five, oneSwap, 1000).pts, 900);
t("reversed timeline", S.timelineScore(five, reversed, 1000).pts, 0);
const solo = S.historyPlan(demo.history);
const nested = S.historyPlan({ r1: { theme: "Debuts", events: five } });
const both = S.historyPlan({ r1: { theme: "A", events: five.slice(0, 4) }, r2: { theme: "B", events: five } });
t("solo rounds", solo.length, 1);
t("solo max", solo[0].max, 1000);
ok("solo flag", solo[0].solo);
t("nested solo max", nested[0].max, 1000);
t("classic round count", both.length, 2);
t("classic r1 max", both[0].max, 400);
t("classic r2 max", both[1].max, 600);
ok("classic is not solo", !both[0].solo && !both[1].solo);
t("validator accepts the fixture timeline", V.checkHistoryDay("h", demo.history).length, 0);
t("validator accepts nested 5", V.checkHistoryDay("h", { r1: { theme: "Debuts", events: five.map(e => [e[0], "Event", e[2]]) } }).length, 0);

demo.mvp.forEach((q, i) => t("celebrity question " + (i + 1), V.checkSportsQuestion("mvp", q).length, 0));
const face = S.mvpFace(demo.mvp[0]);
ok("actor face is celebrity", face.celeb);
ok("actor hint says name", /first name at the top/.test(face.orderHint) && !/team/.test(face.orderHint));
t("actor columns", face.matchLeft + "/" + face.matchRight, "Names/Clues");
t("actor art", face.artAlt, "Clue");
const sports = S.mvpFace({ type: "order", kind: "team-path", q: "Teams", items: ["A", "B", "C"] });
ok("team-path keeps team wording", /first team at the top/.test(sports.orderHint) && sports.orderAria === "Teams in career order, first at top");
const records = S.mvpFace({ type: "match", kind: "match-records" });
t("records stay sports", records.matchLeft + "/" + records.matchRight, "Athletes/Records");
ok("missing team and sport are not labels", demo.mvp.every(q => q.team == null && q.sport == null));

const day = sandbox.BCDaily.getDailySet("2026-11-25");
t("11/25 world pin", sandbox.DAY_OVERRIDES["2026-11-25"].worldRush, 61);
t("11/25 history pin", sandbox.DAY_OVERRIDES["2026-11-25"].history, 62);
t("11/25 sports pin", sandbox.DAY_OVERRIDES["2026-11-25"].sports, 60);
t("11/25 thinkFast unpinned", sandbox.DAY_OVERRIDES["2026-11-25"].thinkFast, undefined);
t("11/25 thinkFast index", sandbox.CONTENT.thinkFast.indexOf(day.thinkFast), 26);
t("11/25 still two teasers", day.thinkFast.length, 2);
t("11/25 world index", sandbox.CONTENT.worldRush.indexOf(day.worldRush), 61);
t("11/25 world has no third question", day.worldRush.mc ? "mc" : day.worldRush.pair ? "pair" : "none", "none");
t("11/25 world pin count", day.worldRush.pins.length, 2);
t("11/25 pin 1", day.worldRush.pins[0].name, "Hudson Bay, Canada");
t("11/25 pin 2", day.worldRush.pins[1].name, "Mont-Saint-Michel, France");
t("11/25 history index", sandbox.CONTENT.history.indexOf(day.history), 62);
t("11/25 history theme", day.history.theme, "Hits everyone remembers");
t("11/25 history events", day.history.events.length, 5);
t("11/25 sports index", sandbox.CONTENT.sports.indexOf(day.sports), 60);
t("11/25 sports types", day.sports.map(q => q.type).join("/"), "mc/text/reveal");
t("11/24 thinkFast stays pinned", sandbox.DAY_OVERRIDES["2026-11-24"].thinkFast, 64);
t("11/24 world stays pinned", sandbox.DAY_OVERRIDES["2026-11-24"].worldRush, 57);

const packed = { worldRush: day.worldRush, history: day.history, sports: day.sports };
t("11/25 world subhead", S.catBlurb("world", packed), "2 map pins");
t("11/25 history subhead", S.catBlurb("history", packed), "One 5-event timeline");
t("11/25 mvp subhead", S.catBlurb("sports", packed), "3 questions · easy → hard");

const day26 = sandbox.BCDaily.getDailySet("2026-11-26");
t("11/26 world pin", sandbox.DAY_OVERRIDES["2026-11-26"].worldRush, 62);
t("11/26 history pin", sandbox.DAY_OVERRIDES["2026-11-26"].history, 63);
t("11/26 sports pin", sandbox.DAY_OVERRIDES["2026-11-26"].sports, 61);
t("11/26 thinkFast unpinned in overrides", sandbox.DAY_OVERRIDES["2026-11-26"].thinkFast, undefined);
t("11/26 world index", sandbox.CONTENT.worldRush.indexOf(day26.worldRush), 62);
t("11/26 world has no third question", day26.worldRush.mc ? "mc" : day26.worldRush.pair ? "pair" : "none", "none");
t("11/26 pin 1", day26.worldRush.pins[0].name, "Mount Rushmore, South Dakota, USA");
t("11/26 pin 2", day26.worldRush.pins[1].name, "Cliffs of Moher, Ireland");
t("11/26 pin 1 coords", day26.worldRush.pins[0].lat + "," + day26.worldRush.pins[0].lon, "43.88,-103.46");
t("11/26 history index", sandbox.CONTENT.history.indexOf(day26.history), 63);
t("11/26 history theme", day26.history.theme, "Games, movies and a mega hit");
t("11/26 history events", day26.history.events.length, 5);
t("11/26 sports index", sandbox.CONTENT.sports.indexOf(day26.sports), 61);
t("11/26 sports types", day26.sports.map(q => q.type).join("/"), "mc/text/reveal");
t("11/25 world stays pinned", sandbox.DAY_OVERRIDES["2026-11-25"].worldRush, 61);
t("11/26 world subhead", S.catBlurb("world", day26), "2 map pins");
t("11/26 history subhead", S.catBlurb("history", day26), "One 5-event timeline");
t("11/26 mvp subhead", S.catBlurb("sports", day26), "3 questions · easy → hard");
t("2-pin subhead", S.catBlurb("world", { worldRush: demo.world }), "2 map pins");
t("5-event subhead", S.catBlurb("history", { history: demo.history }), "One 5-event timeline");
t("celebrity subhead", S.catBlurb("sports", { sports: demo.mvp }), "Athletes and celebrities · actors, singers, artists, reality TV");
const es = sandbox.BC_I18N.ES;
t("es 2 pins", es["2 map pins"], "2 pines en el mapa");
t("es one timeline", es["One 5-event timeline"], "Una línea de tiempo de 5 eventos");
t("es mvp people", es["Athletes and celebrities · actors, singers, artists, reality TV"], "Deportistas y famosos · actores, cantantes, artistas y reality");
const rights = demo.mvp[2].right;
t("match rights", rights.length, 4);
ok("match rights are bilingual", rights.every(r => r.en && r.es && r.es !== r.en));
t("match right es", rights.map(r => r.es).join("|"), "Un concurso de canto|Una casa de cocina|Una pista de baile|Una isla de supervivencia");

const reveal = { type: "reveal", prompt: "Who is this?", clues: ["A fast wide receiver", "Kansas City", "Cheetah"], answer: "Tyreek Hill", accept: ["Tyreek"], wrong: ["grant hill", "tyreke"] };
const ro = sandbox.BCReveal.opts(reveal);
ok("reveal opts pass wrong", Array.isArray(ro.wrong) && ro.wrong.join(",") === "grant hill,tyreke");
const hit = s => sandbox.Answers.checkAnswer(s, [reveal.answer], ro);
t("reveal rejects grant hill", hit("grant hill"), false);
t("reveal rejects tyreke", hit("tyreke"), false);
t("reveal accepts tyreek hill", hit("tyreek hill"), true);
t("reveal accepts Tyreek Hill", hit("Tyreek Hill"), true);
t("reveal accepts a typo of the full name", hit("Tyreek Hil"), true);
t("reveal accepts a typo inside the first name", hit("Tyreke Hill"), true);
t("reveal accepts the surname hill", hit("hill"), true);

console.log(bad ? bad + " failures" : "format-days.test.js: all pass");
process.exit(bad ? 1 : 0);
