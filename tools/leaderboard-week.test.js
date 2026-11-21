// node tools/leaderboard-week.test.js — week math and who receives a device id.
// No hosted project and no network.
const path = require("path");
const Filter = require(path.join(__dirname, "../name-filter.js"));
const Board = require(path.join(__dirname, "../leaderboard.js"));

let bad = 0;
const t = (name, ok, extra) => { if (!ok) { bad++; console.log("FAIL", name, extra == null ? "" : extra); } else console.log("ok", name); };

function bagStore(bag) {
  return {
    getItem: k => (k in bag ? bag[k] : null),
    setItem: (k, v) => { bag[k] = String(v); },
    removeItem: k => { delete bag[k]; }
  };
}
function use(bag) { global.localStorage = bagStore(bag); }

global.NameFilter = Filter;
global.location = { pathname: "/index.html", search: "" };
global.BC_NO_BOOT = false;
global.LEADERBOARD_ENABLED = false;
global.LEADERBOARD = {};

const bounds = Board.weekBounds("2026-11-23");
t("monday starts the week", bounds && bounds.from === "2026-11-23" && bounds.to === "2026-11-29");
const prev = Board.weekBounds("2026-11-22");
t("sunday stays in the previous week", prev && prev.from === "2026-11-16" && prev.to === "2026-11-22");
t("english range", Board.formatWeek("2026-11-23", "2026-11-29", "en") === "Nov 23 – Nov 29");
t("spanish range", Board.formatWeek("2026-11-23", "2026-11-29", "es") === "23 – 29 de nov.");
t("english range crosses months", Board.formatWeek("2026-11-30", "2026-12-06", "en") === "Nov 30 – Dec 6");
t("spanish range crosses months", Board.formatWeek("2026-11-30", "2026-12-06", "es") === "30 de nov. – 6 de dic.");
t("english range crosses years", Board.formatWeek("2026-12-28", "2027-01-03", "en") === "Dec 28, 2026 – Jan 3, 2027");
t("spanish range crosses years", Board.formatWeek("2026-12-28", "2027-01-03", "es") === "28 de dic. de 2026 – 3 de ene. de 2027");

const bag = {};
use(bag);
bag["bc-board-eligible"] = "no";
bag["bc-board-name"] = "Luna";
const under = Board.postBody({ key: "2026-11-21", practice: false, scores: [1, 1, 1, 1, 1] });
t("under 13 does not get a device id", under == null && !bag[Board.deviceKey]);

delete bag["bc-board-name"];
bag["bc-board-eligible"] = "yes";
const unnamed = Board.postBody({ key: "2026-11-21", practice: false, scores: [1, 1, 1, 1, 1] });
t("unnamed does not get a device id", unnamed == null && !bag[Board.deviceKey]);

bag["bc-board-name"] = "Daily Dose";
const rejected = Board.postBody({ key: "2026-11-21", practice: false, scores: [1, 1, 1, 1, 1] });
t("a rejected name does not get a device id", rejected == null && !bag[Board.deviceKey]);

bag["bc-board-name"] = "Luna";
global.location = { pathname: "/index.html", search: "?dgtest=1" };
const dg = Board.postBody({ key: "2026-11-21", practice: false, scores: [1, 1, 1, 1, 1] });
t("dgtest does not get a device id", dg == null && !bag[Board.deviceKey]);
global.location = { pathname: "/index.html", search: "?preview=2026-11-21" };
t("preview does not get a device id", Board.postBody({ key: "2026-11-21", scores: [1, 1, 1, 1, 1] }) == null && !bag[Board.deviceKey]);
global.location = { pathname: "/index.html", search: "?lbshot=1" };
t("a screenshot does not get a device id", Board.postBody({ key: "2026-11-21", scores: [1, 1, 1, 1, 1] }) == null && !bag[Board.deviceKey]);
global.location = { pathname: "/admin.html", search: "" };
t("admin does not get a device id", Board.postBody({ key: "2026-11-21", scores: [1, 1, 1, 1, 1] }) == null && !bag[Board.deviceKey]);
global.location = { pathname: "/index.html", search: "" };
const practice = Board.postBody({ key: "2026-11-21", practice: true, scores: [1, 1, 1, 1, 1] });
t("practice does not get a device id", practice == null && !bag[Board.deviceKey]);
const badScores = Board.postBody({ key: "2026-11-21", practice: false, scores: [1, 2, 3] });
t("a partial run does not get a device id", badScores == null && !bag[Board.deviceKey]);

let fetched = 0;
global.fetch = () => { fetched++; return Promise.reject(new Error("no")); };
global.LEADERBOARD_ENABLED = true;
global.LEADERBOARD = { url: "http://127.0.0.1:9", publishableKey: "x" };
Board.noteFinish({ key: "2026-11-21", practice: true, scores: [1, 1, 1, 1, 1] });
t("practice does not post", fetched === 0 && !bag[Board.deviceKey]);

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const first = Board.postBody({ key: "2026-11-23", practice: false, scores: [10, 20, 30, 40, 50] });
t("a named player gets one device id", first && first.eligible === true && first.name === "Luna" && uuid.test(first.deviceId) && first.day === "2026-11-23" && !("year" in first) && !("birthYear" in first) && bag[Board.deviceKey] === first.deviceId, JSON.stringify(first));
Board.writeName("Nico");
const renamed = Board.postBody({ key: "2026-11-24", practice: false, scores: [5, 5, 5, 5, 5] });
t("a name change keeps the device id", renamed && renamed.name === "Nico" && renamed.deviceId === first.deviceId && bag[Board.deviceKey] === first.deviceId, JSON.stringify(renamed));

const other = {};
use(other);
other["bc-board-eligible"] = "yes";
other["bc-board-name"] = "Luna";
const second = Board.postBody({ key: "2026-11-23", practice: false, scores: [9, 0, 0, 0, 0] });
t("the same name on another device stays separate", second && second.name === "Luna" && uuid.test(second.deviceId) && second.deviceId !== first.deviceId, JSON.stringify(second));

use(bag);
global.LEADERBOARD_ENABLED = false;
delete bag[Board.deviceKey];
Board.noteFinish({ key: "2026-11-25", practice: false, scores: [1, 1, 1, 1, 1] });
t("a closed board does not mint a device id", !bag[Board.deviceKey] && fetched === 0);

console.log(bad ? bad + " failures" : "leaderboard-week.test.js: all pass");
process.exit(bad ? 1 : 0);
