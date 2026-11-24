/* World 2-pin days, a single 5-event timeline, and celebrity MVP rounds.
   Live days stay as they are. 2026-11-25 Think Fast is not rescheduled. */
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
t("11/25 is not pinned", sandbox.DAY_OVERRIDES["2026-11-25"], undefined);
t("11/25 thinkFast index", sandbox.CONTENT.thinkFast.indexOf(day.thinkFast), 26);
t("11/25 still two teasers", day.thinkFast.length, 2);
t("11/25 world index", sandbox.CONTENT.worldRush.indexOf(day.worldRush), 19);
t("11/25 world still has a third question", day.worldRush.mc ? "mc" : day.worldRush.pair ? "pair" : "none", "mc");
t("11/25 world pin count", day.worldRush.pins.length, 2);
t("11/25 history index", sandbox.CONTENT.history.indexOf(day.history), 19);
t("11/25 history rounds", day.history.r1.events.length + "/" + day.history.r2.events.length, "4/5");
t("11/25 sports index", sandbox.CONTENT.sports.indexOf(day.sports), 19);
t("11/24 thinkFast stays pinned", sandbox.DAY_OVERRIDES["2026-11-24"].thinkFast, 64);

console.log(bad ? bad + " failures" : "format-days.test.js: all pass");
process.exit(bad ? 1 : 0);
