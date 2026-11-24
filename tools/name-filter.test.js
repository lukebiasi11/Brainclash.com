// node tools/name-filter.test.js — client name rules, age flag, and the SQL term list.
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const root = path.join(__dirname, "..");
const Filter = require(path.join(root, "name-filter.js"));
const Board = require(path.join(root, "leaderboard.js"));

let bad = 0;
const t = (name, ok, extra) => { if (!ok) { bad++; console.log("FAIL", name, extra == null ? "" : extra); } else console.log("ok", name); };

const okNames = ["Luna", "Nico", "José", "O'Brien", "Ana Maria", "Ana-Maria", "Max", "Player1", "Sol", "Paz", "Niño", "Ashley", "Lucas", "Knight", "Nigella", "Niger", "Petit", "Cumbria", "Annalise", "Conor", "Zora", "Fagan", "Grape", "Drapes", "Badminton", "Moderna", "Commodore", "Yoshito", "Hoshitani", "Pornchai", "Swank", "Mammon", "Pola", "Shitake", "Therapeutic", "Pitot", "Dick Van Dyke", "Ana Luz", "Ana-Luz", "Diana Lopez", "Hana Lee", "Juana Lima", "Matt Ito", "Nigel", "Titan", "Night", "Tito", "Dickens", "Stafford", "Sexton", "Essex", "Modesto", "Peacock", "Scunthorpe", "Nigeria", "Document", "Canal", "Cassie", "Bass", "Van Dyke"];
const blocked = [
  ["Al", "length"],
  ["thisnameistoolongnowx", "length"],
  ["Daily Dose", "impersonation"],
  ["DailyDose", "impersonation"],
  ["d4ily d0se", "impersonation"],
  ["admin", "impersonation"],
  ["cooladmin", "impersonation"],
  ["mod", "impersonation"],
  ["mod1", "impersonation"],
  ["official", "impersonation"],
  ["staff", "impersonation"],
  ["support", "impersonation"],
  ["hello.com", "contact"],
  ["user@name", "contact"],
  ["555-123-4567", "contact"],
  ["call 5551234", "contact"],
  ["https://x.test", "contact"],
  ["f u c k", "profanity"],
  ["f-u-c-k", "profanity"],
  ["sh1t", "profanity"],
  ["a55", "profanity"],
  ["púta", "profanity"],
  ["pendejo", "profanity"],
  ["xxx", "profanity"],
  ["hello .com", "contact"],
  ["n i g g e r", "profanity"],
  ["xnigger", "profanity"],
  ["nigger99", "profanity"],
  ["pussy99", "profanity"],
  ["a s s h o l e", "profanity"],
  ["j i z z", "profanity"],
  ["f a g g o t", "profanity"],
  ["support99", "impersonation"],
  ["staffer", "impersonation"],
  ["modteam", "impersonation"],
  ["nigel nigger", "profanity"],
  ["nigelnigger", "profanity"],
  ["n i g e l", "profanity"],
  ["Niggel", "profanity"],
  ["ni Nigel ger", "profanity"],
  ["Dick", "profanity"],
  ["cock", "profanity"],
  ["sex", "profanity"],
  ["tit", "profanity"],
  ["player4821", "tag"],
  ["PLAYER 4821", "tag"],
  ["Player  4821", "tag"],
  ["Jugador  0001", "tag"],
  ["JUGADOR0001", "tag"],
  ["jugador 1234", "tag"],
  ["nіgger", "profanity"],
  ["fuсk", "profanity"],
  ["nıgger", "profanity"],
  ["ｎｉｇｇｅｒ", "profanity"],
  ["ｆｕｃｋ", "profanity"],
  ["𝐟𝐮𝐜𝐤𝐞𝐫", "profanity"],
  ["Ⓕⓤⓒⓚ", "profanity"],
  ["Nigel nіgger", "profanity"],
  ["Nigel ｎｉｇｇｅｒ", "profanity"],
  ["niqqer", "profanity"],
  ["nlgger", "profanity"],
  ["fæggot", "profanity"],
  ["Titan fuck", "profanity"],
  ["fu Titan ck", "profanity"],
  ["sh Night it", "profanity"],
  ["cu Nigel nt", "profanity"],
  ["Peacock cock", "profanity"],
  ["Nigel n1gg3r", "profanity"],
  ["ass", "profanity"],
  ["a s s", "profanity"],
  ["ass99", "profanity"],
  ["tits", "profanity"],
  ["s3x", "profanity"],
  ["p0rn", "profanity"],
  ["cum shot", "profanity"],
  ["cocksucker", "profanity"],
  ["wanker", "profanity"],
  ["hijo de puta", "profanity"],
  ["coño", "profanity"],
  ["maricón", "profanity"],
  ["coon", "profanity"],
  ["tranny", "profanity"],
  ["kike", "profanity"],
  ["spic", "profanity"],
  ["chink", "profanity"],
  ["gook", "profanity"],
  ["beaner", "profanity"],
  ["wetback", "profanity"],
  ["dyke", "profanity"],
  ["paki", "profanity"],
  ["raghead", "profanity"],
  ["kkk", "profanity"],
  ["nazi", "profanity"],
  ["hitler", "profanity"],
  ["1488", "profanity"],
  ["Heil Hitler", "profanity"],
  ["c o o n", "profanity"],
  ["t r a n n y", "profanity"],
  ["bollocks", "profanity"],
  ["culo", "profanity"],
  ["chinga", "profanity"],
  ["mamaguevo", "profanity"],
  ["pinga", "profanity"],
  ["pr0n", "profanity"],
  ["boobs", "profanity"],
  ["semen", "profanity"],
  ["Player-1234", "tag"],
  ["Player'1234", "tag"],
  ["Pl4yer 1234", "tag"],
  ["Player １２３４", "tag"],
  ["Plаyer 1234", "tag"],
  ["Nigel Player1234", "tag"],
  ["Titan player 1234", "tag"],
  ["Player 1234 Nigel", "tag"],
  ["Player 1234", "tag"],
  ["Player_1234", "tag"]
];
okNames.forEach(name => {
  const got = Filter.checkName(name);
  t("allow " + name, got.ok === true && got.skip !== true && got.name === name.replace(/\s+/g, " ").trim(), JSON.stringify(got));
});
t("blank skips", Filter.checkName("   ").skip === true && Filter.checkName("").ok === true);
blocked.forEach(([name, reason]) => {
  const got = Filter.checkName(name);
  t("block " + name, got.ok === false && got.reason === reason && !got.name, JSON.stringify(got));
});
const dumped = JSON.stringify(Filter.checkName("Daily Dose"));
t("rejected result hides the text", dumped.indexOf("Daily") < 0);

const sql = fs.readFileSync(path.join(root, "supabase/migrations/20261121180000_display_name_board.sql"), "utf8");
const terms = { imp: [], impword: [], sub: [], word: [], compound: [] };
for (const m of sql.matchAll(/\('(imp|impword|sub|word|compound)', '([a-z0-9]+)'\)/g)) terms[m[1]].push(m[2]);
const same = (a, b) => a.slice().sort().join(",") === b.slice().sort().join(",");
t("imp list matches sql", same(Filter.TERMS.imp, terms.imp));
t("impWord list matches sql", same(Filter.TERMS.impWord, terms.impword));
t("sub list matches sql", same(Filter.TERMS.sub, terms.sub));
t("word list matches sql", same(Filter.TERMS.word, terms.word));
t("compound list matches sql", same(Filter.TERMS.compound, terms.compound));
const allowSql = (sql.match(/insert into private\.board_allow \(token\) values([\s\S]*?);/) || ["", ""])[1];
const allowRows = [...allowSql.matchAll(/\('([a-z0-9]+)'\)/g)].map(m => m[1]);
t("allow list matches sql", same(Filter.ALLOW, allowRows));

const bag = {};
global.localStorage = {
  getItem: k => (k in bag ? bag[k] : null),
  setItem: (k, v) => { bag[k] = String(v); },
  removeItem: k => { delete bag[k]; }
};
const young = Board.lockYear("2014", "2026-11-21");
t("under 13 locks no", young.ok === true && young.eligible === false && bag["bc-board-eligible"] === "no");
t("year is not stored", !JSON.stringify(bag).includes("2014"));
const again = Board.lockYear("1990", "2026-11-21");
t("a later year does not unlock", again.locked === true && again.eligible === false && bag["bc-board-eligible"] === "no" && !JSON.stringify(bag).includes("1990"));
delete bag["bc-board-eligible"];
const adult = Board.lockYear("2000", "2026-11-21");
t("13 or older locks yes", adult.eligible === true && bag["bc-board-eligible"] === "yes" && !JSON.stringify(bag).includes("2000"));
const badYear = Board.lockYear("20", "2026-11-21");
t("short year does not replace the flag", badYear.locked === true && bag["bc-board-eligible"] === "yes");
delete bag["bc-board-eligible"];
const freshShort = Board.lockYear("20", "2026-11-21");
t("short year does not lock", freshShort.ok === false && !bag["bc-board-eligible"]);
delete bag["bc-board-eligible"];
const edge = Board.lockYear("2013", "2026-11-21");
t("turns 13 this calendar year", edge.eligible === true && bag["bc-board-eligible"] === "yes" && !JSON.stringify(bag).includes("2013"));

global.location = { pathname: "/index.html", search: "?dgtest=1" };
t("dgtest is a tester run", Board.isTester({ practice: false, key: "2026-11-21" }) === true);
global.location = { pathname: "/index.html", search: "?preview=2026-11-01" };
t("preview is a tester run", Board.isTester({ key: "2026-11-01" }) === true);
global.location = { pathname: "/admin.html", search: "" };
t("admin is a tester run", Board.isTester(null) === true);
global.BC_NO_BOOT = true;
global.location = { pathname: "/index.html", search: "" };
t("admin boot is a tester run", Board.isTester(null) === true);
global.BC_NO_BOOT = false;
global.location = { pathname: "/index.html", search: "" };
t("practice is a tester run", Board.isTester({ practice: true, key: "2026-11-20" }) === true);
t("a daily run is not a tester run", Board.isTester({ practice: false, key: "2026-11-21" }) === false);

let fetched = 0;
global.fetch = () => { fetched++; return Promise.reject(new Error("no")); };
bag["bc-board-eligible"] = "yes";
bag["bc-board-name"] = "Luna";
Board.noteFinish({ key: "2026-11-21", practice: true, scores: [100, 100, 100, 100, 100] });
t("practice does not post", fetched === 0 && bag["bc-board-name"] === "Luna");

const i18n = fs.readFileSync(path.join(root, "i18n.js"), "utf8");
[
  "This name is shown publicly. Use a nickname, not your full name.",
  "Este nombre se muestra públicamente. Usa un apodo, no tu nombre completo.",
  "Rankings are for fun, with no prizes.",
  "Las clasificaciones son para divertirse, sin premios.",
  "What year were you born?",
  "¿En qué año naciste?",
  "Players under 13 can't post a nickname or appear on a leaderboard."
].forEach(s => t("copy " + s.slice(0, 24), i18n.includes(s)));
const lb = fs.readFileSync(path.join(root, "leaderboard.js"), "utf8");
const yearFn = lb.slice(lb.indexOf("function yearCard"), lb.indexOf("function nameCard"));
t("year gate is a div", yearFn.includes('el("div"') && !/el\("form"/.test(yearFn));
t("year field is cleared before it is judged", /input\.value = "";\s*const result = lockYear\(raw, todayKey\(\)\);\s*raw = "";/.test(yearFn));
t("year field is numeric and not autofilled", yearFn.includes('autocomplete: "off"') && yearFn.includes('inputmode: "numeric"') && yearFn.includes('type: "text"'));
t("posted body has eligible and no year", /JSON\.stringify\(\{ day: day, name: name \|\| null, scores: scores, eligible: true \}\)/.test(lb) && !/birthYear|birth_year/.test(lb));
t("only yes or no is written", /setItem\(FLAG, eligible \? "yes" : "no"\)/.test(lb));
t("the saved name is one key", lb.includes('const NAME = "bc-board-name"') && /writeName\(server\.ok && server\.name \? server\.name : checked\.name\)/.test(lb) && !/setItem\("bc-board-pending"|setItem\("bc-board-nick"/.test(lb));
const privacy = fs.readFileSync(path.join(root, "privacy.html"), "utf8");
t("rankings stay off the notice", !privacy.includes("Rankings are for fun") && !fs.readFileSync(path.join(root, "docs/privacy-notice-draft.md"), "utf8").split("## English")[1].includes("Rankings are for fun"));
const day = "2026-11-21";
const entry = { day: day, token: "own" };
const tie = [{ token: "own", name: "Luna", score: 100 }, { token: "other", name: "Nico", score: 100 }];
t("a tie highlights only the saved entry", Board.isOwnRow(tie[0], entry, "Luna", day) === true && Board.isOwnRow(tie[1], entry, "Luna", day) === false);
const dup = [{ token: "other", name: "Luna", score: 100 }, { token: "own", name: "Luna", score: 90 }];
t("a duplicate name highlights only the saved entry", Board.isOwnRow(dup[0], entry, "Luna", day) === false && Board.isOwnRow(dup[1], entry, "Luna", day) === true);
t("anonymous own row is only its token", Board.isOwnRow(tie[0], entry, "", day) === true && Board.isOwnRow(tie[1], entry, "", day) === false && Board.isOwnRow(tie[0], null, "", day) === false);
t("own row ignores score and name", Board.isOwnRow({ token: "own", name: "Nico", score: 1 }, entry, "Luna", day) === true && Board.isOwnRow({ token: "nope", name: "Luna", score: 100 }, entry, "Luna", day) === false);
const dupRows = [
  { rank: 1, name: "Luna", score: 3700, token: "aaa" },
  { rank: 2, name: "Luna", score: 3700, token: "bbb" },
  { rank: 3, name: "Nico", score: 3700, token: "ccc" }
];
const inTop = Board.ownPlacement({ rows: dupRows, me: { found: true, rank: 2, total: 40, token: "bbb", name: "Luna", score: 3700 } }, { day: day, token: "aaa" }, day);
t("duplicate names or scores highlight only the server row", inTop.highlight === "bbb" && inTop.below == null && dupRows.filter(row => row.token === inTop.highlight).length === 1 && dupRows.filter(row => row.name === "Luna" && row.score === 3700).length === 2);
const outside = Board.ownPlacement({ rows: dupRows, me: { found: true, rank: 140, total: 180, token: "aaa", name: "Luna", score: 1339 } }, { day: day, token: "aaa" }, day);
t("a rank outside the top 100 highlights nothing", outside.highlight === "" && outside.below && outside.below.rank === 140 && outside.below.name === "Luna" && outside.below.score === 1339);
t("own line is separated by an ellipsis", lb.includes('class: "board-more"') && lb.includes('"aria-label": tr("More players")') && lb.includes("⋯") && lb.includes('"aria-hidden": "true"'));
const ranked = [{ token: "a", name: "Luna", rank: 2, score: 100 }, { token: "b", name: "Luna", rank: 3, score: 100 }];
t("rank follows the entry token through a tie", JSON.stringify(Board.rankFromRows(ranked, "b")) === JSON.stringify({ rank: 3, total: 2 }) && Board.rankFromRows(ranked, "missing") == null);
t("rank below 100 uses the server total", JSON.stringify(Board.rankFromRows([{ token: "z", rank: 140 }], "z", 180)) === JSON.stringify({ rank: 140, total: 180 }));
t("Nov 21 fifth tab is Brain Teaser", Board.fifthName("2026-11-21") === "Brain Teaser");
t("Nov 22 fifth tab is still Brain Teaser", Board.fifthName("2026-11-22") === "Brain Teaser");
t("Nov 23 fifth tab stays Brain Teaser", Board.fifthName("2026-11-23") === "Brain Teaser");
t("Nov 25 fifth tab stays Brain Teaser", Board.fifthName("2026-11-25") === "Brain Teaser");
t("Nov 26 fifth tab stays Brain Teaser", Board.fifthName("2026-11-26") === "Brain Teaser");
t("Nov 27 fifth tab stays Brain Teaser", Board.fifthName("2026-11-27") === "Brain Teaser");
const esMap = require(path.join(root, "i18n.js")).ES;
t("es Nov 22 label", esMap["Brain Teaser"] === "Rompecocos");
t("es has no Eagle Eye label", esMap["Eagle Eye"] == null && esMap["Brain Teaser"] === "Rompecocos");
const underEn = "Leaderboard names aren't available on this device. You can still play!";
const underEs = "Los nombres en la clasificación no están disponibles en este dispositivo. ¡Igual puedes jugar!";
t("under 13 home line stays neutral", esMap[underEn] === underEs && !/13|age|edad|años/i.test(underEn + " " + underEs));
t("player tag label", esMap["Player {0}"] === "Jugador {0}" && esMap["Play without a name"] === "Jugar sin nombre" && esMap["Add a name"] === "Agregar un nombre");
t("quick check title", esMap["Quick check"] === "Verificación rápida");
t("plain Player is not a tag", Filter.checkName("Player").ok === true && Filter.checkName("player 482").ok === true && Filter.checkName("player48210").ok === true);
global.EagleEye = { on: () => true };
t("fifth tab ignores EagleEye.on", Board.fifthName("2026-11-25") === "Brain Teaser" && Board.fifthName("2026-11-26") === "Brain Teaser");
delete global.EagleEye;

(async () => {
  global.LEADERBOARD_ENABLED = true;
  global.LEADERBOARD = { url: "https://xhgrcbsshhpvmfwzjtmp.supabase.co", publishableKey: "k" };
  delete bag["bc-board-name"];
  global.fetch = () => Promise.reject(new Error("down"));
  const saved = await Board.acceptName("Luna");
  t("client accept saves when the server is unreachable", saved.ok === true && bag["bc-board-name"] === "Luna");
  global.fetch = async () => ({ ok: false, status: 400, async json() { return { ok: false, error: "name_rejected" }; } });
  bag["bc-board-name-skip"] = "1";
  const rejected = await Board.acceptName("Luna");
  t("explicit rejection clears that saved name", rejected.ok === false && !bag["bc-board-name"] && bag["bc-board-name-skip"] !== "1");
  global.fetch = () => Promise.reject(new Error("down"));
  const kept = await Board.acceptName("Luna");
  t("a later outage keeps the name", kept.ok === true && bag["bc-board-name"] === "Luna");
  global.BCDaily = { todayKey: () => "2026-11-21" };
  global.location = { pathname: "/index.html", search: "" };
  global.BC_NO_BOOT = false;
  bag["bc-board-eligible"] = "yes";
  bag["bc-board-name-skip"] = "1";
  bag["bc-board-entry"] = JSON.stringify({ day: "2026-11-21", token: "low" });
  let rankUrl = "";
  global.fetch = async (url) => { rankUrl = String(url); return { ok: true, async json() { return { ok: true, served: true, total: 180, rows: [], me: { found: true, rank: 140, total: 180 } }; } }; };
  const phrase = await Board.rankPhrase();
  t("below 100 rank comes from the server", phrase === "Rank #140 of 180 today" && rankUrl.includes("token=low"));
  delete bag["bc-board-eligible"];
  delete bag["bc-board-name"];
  delete bag["bc-board-name-skip"];
  function domNode(tag) {
    return {
      tagName: tag, children: [], parentNode: null, attrs: {}, className: "", textContent: "", value: "", hidden: false, disabled: false, listeners: {},
      setAttribute(k, v) { this.attrs[k] = String(v); },
      getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
      removeAttribute(k) { delete this.attrs[k]; },
      append(...kids) { kids.forEach(kid => { if (!kid) return; kid.parentNode = this; this.children.push(kid); }); },
      addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
      removeEventListener() {},
      querySelector(sel) { const all = []; collect(this, all); return all.find(node => match(node, sel)) || null; },
      querySelectorAll(sel) { const all = []; collect(this, all); return all.filter(node => sel.split(",").some(part => match(node, part.trim()))); },
      contains(node) { if (node === this) return true; return this.children.some(kid => kid.contains && kid.contains(node)); },
      remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(kid => kid !== this); this.parentNode = null; },
      focus() {
        let parent = this, connected = false;
        while (parent) { if (parent === global.document.body) connected = true; parent = parent.parentNode; }
        this.connectedOnFocus = connected;
        global.document.activeElement = this;
        (this.listeners.focus || []).forEach(fn => fn());
      }
    };
  }
  function collect(node, out) { out.push(node); (node.children || []).forEach(kid => { if (kid && kid.children) collect(kid, out); }); }
  function match(node, sel) {
    if (sel === "input" || sel === "button") return node.tagName === sel;
    if (sel.charAt(0) === "#") return node.attrs.id === sel.slice(1);
    if (sel.charAt(0) === ".") return String(node.className || "").split(/\s+/).indexOf(sel.slice(1)) >= 0;
    if (sel.charAt(0) === "[") return Object.prototype.hasOwnProperty.call(node.attrs, sel.slice(1, -1).replace(/["']/g, ""));
    return node.tagName === sel;
  }
  const body = domNode("body");
  global.document = {
    body: body,
    activeElement: null,
    addEventListener() {},
    removeEventListener() {},
    createElement: domNode,
    contains(node) { return body.contains(node); },
    querySelector() { return null; }
  };
  let boardGets = 0;
  global.fetch = async (url) => {
    if (String(url).indexOf("/leaderboard/board") >= 0) boardGets += 1;
    return { ok: false, status: 503, async json() { return { ok: false, error: "board_off" }; } };
  };
  delete require.cache[require.resolve(path.join(root, "leaderboard.js"))];
  const freshBoard = require(path.join(root, "leaderboard.js"));
  const firstBoard = freshBoard.section();
  const secondBoard = freshBoard.section();
  body.append(firstBoard, secondBoard);
  await new Promise(r => setTimeout(r, 40));
  t("a closed board is requested once", boardGets === 1 && firstBoard.getAttribute("data-board-off") === "1" && secondBoard.getAttribute("data-board-off") === "1");
  Board.beforeStart({}).catch(() => {});
  const year = global.document.activeElement;
  t("year field is focused after the pop-up is appended", !!year && year.attrs && year.attrs.id === "board-year" && year.connectedOnFocus === true);
  console.log(bad ? bad + " failures" : "name-filter.test.js: all pass");
  process.exit(bad ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
