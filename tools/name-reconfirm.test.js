// One name ask from 2026-11-25, then the saved name is what /leaderboard/post sends.
// node tools/name-reconfirm.test.js
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.join(__dirname, "..");
const stub = path.join(os.tmpdir(), "bc-reconfirm-auth-stub.mjs");
fs.writeFileSync(stub, [
  "export function createClient() {",
  "  return { auth: {",
  "    async getSession() { return { data: { session: null } }; },",
  "    async signInAnonymously() { return { data: { session: { access_token: 'tok' } } }; }",
  "  } };",
  "}",
  ""
].join("\n"));

let bad = 0;
const t = (name, ok, extra) => { if (!ok) { bad++; console.log("FAIL", name, extra == null ? "" : extra); } else console.log("ok", name); };

const bag = {};
global.localStorage = {
  getItem: k => (k in bag ? bag[k] : null),
  setItem: (k, v) => { bag[k] = String(v); },
  removeItem: k => { delete bag[k]; },
  key: i => Object.keys(bag)[i] || null,
  get length() { return Object.keys(bag).length; }
};
global.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.location = { pathname: "/index.html", search: "", href: "http://127.0.0.1/index.html" };
global.BC_NO_BOOT = false;
global.LEADERBOARD_ENABLED = true;
global.LEADERBOARD = {
  url: "https://board.example",
  publishableKey: "k",
  supabaseJs: pathToFileURL(stub).href
};
let day = "2026-11-24";
global.BCDaily = { todayKey: () => day };

function domNode(tag) {
  const node = {
    tagName: tag, children: [], parentNode: null, attrs: {}, className: "", _text: "", value: "", hidden: false, disabled: false, listeners: {},
    setAttribute(k, v) { this.attrs[k] = String(v); if (k === "hidden") this.hidden = true; },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
    removeAttribute(k) { delete this.attrs[k]; if (k === "hidden") this.hidden = false; },
    append(...kids) {
      kids.forEach(kid => {
        if (kid == null || kid === false) return;
        if (typeof kid !== "object") { this._text += String(kid); return; }
        kid.parentNode = this;
        this.children.push(kid);
      });
    },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    removeEventListener() {},
    querySelector(sel) { const all = []; collect(this, all, false); return all.find(n => match(n, sel)) || null; },
    querySelectorAll(sel) { const all = []; collect(this, all, false); return all.filter(n => match(n, sel)); },
    contains(other) { if (other === this) return true; return this.children.some(k => k.contains && k.contains(other)); },
    remove() {
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(k => k !== this);
      this.parentNode = null;
    },
    insertBefore(node, before) {
      if (!node) return;
      node.parentNode = this;
      const at = this.children.indexOf(before);
      if (at < 0) this.children.unshift(node);
      else this.children.splice(at, 0, node);
    },
    get firstChild() { return this.children[0] || null; },
    focus() { global.document.activeElement = this; },
    scrollIntoView() {}
  };
  Object.defineProperty(node, "textContent", {
    get() {
      const nested = this.children.map(k => (k && k.textContent) || "").join("");
      return nested || this._text || "";
    },
    set(v) { this.children = []; this._text = v == null ? "" : String(v); }
  });
  return node;
}
function collect(node, out, includeSelf) {
  if (includeSelf) out.push(node);
  (node.children || []).forEach(kid => { if (kid && kid.children) collect(kid, out, true); });
}
function match(node, sel) {
  return String(sel).split(",").some(part => matchOne(node, part.trim()));
}
function matchOne(node, sel) {
  if (!sel) return false;
  if (sel.charAt(0) === "[") {
    const body = sel.slice(1, -1);
    const eq = body.indexOf("=");
    if (eq < 0) return node.getAttribute(body) != null;
    return node.getAttribute(body.slice(0, eq)) === body.slice(eq + 1).replace(/^["']|["']$/g, "");
  }
  if (sel.charAt(0) === ".") return String(node.className || "").split(/\s+/).indexOf(sel.slice(1)) >= 0;
  if (sel.charAt(0) === "#") return node.attrs.id === sel.slice(1);
  if (sel.indexOf(".") > 0) {
    const [tag, cls] = sel.split(".");
    return node.tagName === tag && matchOne(node, "." + cls);
  }
  return node.tagName === sel;
}

const body = domNode("body");
global.document = {
  body: body,
  activeElement: null,
  listeners: {},
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter(f => f !== fn); },
  createElement: domNode,
  contains(node) { return body.contains(node); },
  querySelector(sel) { return body.querySelector(sel); },
  dispatchEvent(ev) { (this.listeners[ev.type] || []).forEach(fn => fn(ev)); return true; }
};
global.Event = function Event(type) { this.type = type; };

const calls = [];
let refreshCount = 0;
global.document.addEventListener("bc-board-refresh", () => { refreshCount += 1; });
global.fetch = async (url, opts) => {
  const parsed = opts && opts.body ? JSON.parse(opts.body) : null;
  calls.push({ url: String(url), body: parsed, method: opts && opts.method, headers: opts && opts.headers || {} });
  if (String(url).indexOf("/leaderboard/check") >= 0) {
    if (parsed && parsed.name === "Nico") return { ok: false, status: 400, async json() { return { ok: false, error: "name_rejected" }; } };
    return { ok: true, status: 200, async json() { return { ok: true, name: parsed.name }; } };
  }
  if (String(url).indexOf("/leaderboard/post") >= 0) {
    return { ok: true, status: 200, async json() { return { ok: true, token: "own-row" }; } };
  }
  return { ok: true, status: 200, async json() { return { ok: true, rows: [] }; } };
};

const Filter = require(path.join(root, "name-filter.js"));
const Board = require(path.join(root, "leaderboard.js"));
const i18n = require(path.join(root, "i18n.js"));
const ASKED = "bc_name_reconfirm_v2";
const ERR = "That name can't be used. Try a different nickname, or play without a name.";

function reset() {
  Object.keys(bag).forEach(k => delete bag[k]);
  calls.length = 0;
  refreshCount = 0;
  body.children = [];
}
async function click(sel) {
  const node = global.document.querySelector(sel);
  const fns = node && node.listeners.click ? node.listeners.click.slice() : [];
  for (const fn of fns) await fn();
  return node;
}
function dialog() { return global.document.querySelector("[data-board-name]"); }
function input() { return global.document.querySelector("[data-board-name-input]"); }
function pressEscape() {
  const ev = { key: "Escape", shiftKey: false, preventDefault() {} };
  (global.document.listeners.keydown || []).slice().forEach(fn => fn(ev));
}
function helpIds() {
  const ids = [];
  function walk(node) {
    if (node && node.attrs && node.attrs.id && node.attrs.id.indexOf("board-name-help") === 0) ids.push(node.attrs.id);
    (node && node.children || []).forEach(walk);
  }
  walk(body);
  return ids;
}

(async () => {
  t("filter still rejects a blocked name", Filter.checkName("admin").ok === false && Filter.checkName("Daily Dose").ok === false && Filter.checkName("Luna").ok === true && Filter.checkName("Scunthorpe").ok === true);
  t("spanish name ask", i18n.ES["Name for the leaderboard"] === "Nombre para la clasificación" && i18n.ES["Type the name you want on the leaderboard."] === "Escribe el nombre que quieres en la clasificación." && i18n.ES[ERR] === "Ese nombre no se puede usar. Prueba con otro apodo, o juega sin un nombre.");

  bag["bc-board-eligible"] = "yes";
  bag["bc-board-name"] = "Luna";
  const early = await Board.beforeStart({});
  t("before go-live a saved name is not asked again", early === true && !dialog() && bag[ASKED] !== "1" && bag["bc-board-name"] === "Luna");

  day = "2026-11-25";
  const held = await Board.beforeStart({ started: true });
  t("a game already started does not use up the ask", held === true && !dialog() && bag[ASKED] !== "1");

  const first = Board.beforeStart({});
  const prefilled = input();
  t("go-live prefills the stored name", !!dialog() && prefilled && prefilled.value === "Luna" && (global.document.querySelector("[data-board-lead]") || {}).textContent === "Type the name you want on the leaderboard.");
  prefilled.value = "admin";
  await click("[data-board-save]");
  const err = global.document.querySelector("[data-board-error]");
  t("a blocked name stays in the ask", !!dialog() && err && err.hidden === false && err.textContent === ERR && bag["bc-board-name"] === "Luna" && bag[ASKED] !== "1" && !calls.some(c => c.url.indexOf("/leaderboard/post") >= 0));

  prefilled.value = "Nico";
  await click("[data-board-save]");
  t("a server rejection keeps the stored name", !!dialog() && bag["bc-board-name"] === "Luna" && bag[ASKED] !== "1" && err.textContent === ERR);

  prefilled.value = "Luna";
  await click("[data-board-save]");
  const started = await first;
  t("saving stores the name and the one-time flag", started === true && !dialog() && bag["bc-board-name"] === "Luna" && bag[ASKED] === "1" && bag["bc-board-name-skip"] !== "1");
  const again = await Board.beforeStart({});
  t("the ask does not show again on this device", again === true && !dialog());

  calls.length = 0;
  refreshCount = 0;
  await Board.noteFinish({ key: "2026-11-25", practice: false, scores: [200, 200, 200, 200, 200] });
  const post = calls.find(c => c.url.indexOf("/leaderboard/post") >= 0);
  t("completion posts the saved name", !!post && post.body.name === "Luna" && post.body.day === "2026-11-25" && post.body.eligible === true && JSON.stringify(post.body.scores) === JSON.stringify([200, 200, 200, 200, 200]) && !Object.prototype.hasOwnProperty.call(post.body, "player_tag") && post.headers.Authorization === "Bearer tok");
  const entry = JSON.parse(bag["bc-board-entry"] || "null");
  t("the post token is what the highlight uses", entry && entry.day === "2026-11-25" && entry.token === "own-row" && refreshCount === 1);
  const host = domNode("section");
  const list = domNode("ol");
  list.className = "board-rows";
  const empty = domNode("p");
  empty.className = "board-empty";
  host.append(list, empty);
  Board.paint(host, {
    served: true,
    rows: [
      { rank: 1, name: "Sol", score: 4200, token: "sol" },
      { rank: 2, name: "Luna", score: 3900, token: "own-row" }
    ],
    me: { found: true, rank: 2, total: 2, token: "own-row", name: "Luna", score: 3900 }
  });
  const you = host.querySelector(".you");
  const names = host.querySelectorAll(".board-name").map(n => n.textContent);
  t("the finished row highlights only that name", !!you && you.querySelector(".board-name").textContent === "Luna" && names.filter(n => n === "Luna").length === 1 && host.querySelectorAll(".you").length === 1);

  reset();
  day = "2026-11-25";
  bag["bc-board-eligible"] = "yes";
  bag["bc-board-name"] = "Luna";
  const skipAsk = Board.beforeStart({});
  t("skip starts from the prefilled ask", input() && input().value === "Luna");
  await click("[data-board-skip]");
  await skipAsk;
  t("skip forgets the name and is not asked again", !dialog() && !bag["bc-board-name"] && bag["bc-board-name-skip"] === "1" && bag[ASKED] === "1");
  const skipAgain = await Board.beforeStart({});
  calls.length = 0;
  await Board.noteFinish({ key: "2026-11-25", practice: false, scores: [1, 1, 1, 1, 1] });
  const anon = calls.find(c => c.url.indexOf("/leaderboard/post") >= 0);
  t("skip posts no name", skipAgain === true && !dialog() && anon && anon.body.name === null && !Object.prototype.hasOwnProperty.call(anon.body, "player_tag"));

  reset();
  day = "2026-11-25";
  bag["bc-board-eligible"] = "no";
  bag["bc-board-name"] = "Luna";
  const kid = await Board.beforeStart({});
  calls.length = 0;
  await Board.noteFinish({ key: "2026-11-25", practice: false, scores: [1, 1, 1, 1, 1] });
  t("under 13 is not asked and posts nothing", kid === true && !dialog() && bag[ASKED] !== "1" && calls.length === 0 && bag["bc-board-name"] === "Luna");

  reset();
  day = "2026-11-25";
  bag["bc-board-eligible"] = "yes";
  const fresh = Board.beforeStart({});
  t("a new player gets an empty name ask", input() && input().value === "" && !bag["bc-board-name"]);
  await click("[data-board-skip]");
  await fresh;
  t("a new skip is remembered", bag[ASKED] === "1" && bag["bc-board-name-skip"] === "1" && !bag["bc-board-name"]);

  reset();
  day = "2026-11-25";
  bag["bc-board-eligible"] = "yes";
  const once = Board.beforeStart({});
  const twice = Board.beforeStart({});
  t("a double press of Start opens one name dialog", once !== twice && twice instanceof Promise && body.querySelectorAll("[data-board-modal]").length === 1 && (await twice) === false && !!dialog());
  await click("[data-board-skip]");
  await once;

  reset();
  day = "2026-11-25";
  bag["bc-board-eligible"] = "yes";
  bag["bc-board-name"] = "Luna";
  const escAsk = Board.beforeStart({});
  t("escape starts from the saved name", input() && input().value === "Luna");
  pressEscape();
  const escStarted = await escAsk;
  const escAgain = await Board.beforeStart({});
  calls.length = 0;
  await Board.noteFinish({ key: "2026-11-25", practice: false, scores: [3, 3, 3, 3, 3] });
  const escPost = calls.find(c => c.url.indexOf("/leaderboard/post") >= 0);
  t("escape keeps the saved name and sets the flag", escStarted === true && escAgain === true && !dialog() && bag["bc-board-name"] === "Luna" && bag["bc-board-name-skip"] !== "1" && bag[ASKED] === "1" && escPost && escPost.body.name === "Luna");

  reset();
  day = "2026-11-25";
  bag["bc-board-eligible"] = "yes";
  bag["bc-board-name"] = "Luna";
  const closeAsk = Board.beforeStart({});
  input().value = "Daily Dose";
  await click("[data-board-close]");
  const closeStarted = await closeAsk;
  const closeAgain = await Board.beforeStart({});
  t("close keeps the saved name and sets the flag", closeStarted === true && closeAgain === true && !dialog() && bag["bc-board-name"] === "Luna" && bag["bc-board-name-skip"] !== "1" && bag[ASKED] === "1");

  reset();
  day = "2026-11-25";
  bag["bc-board-eligible"] = "yes";
  const freshEsc = Board.beforeStart({});
  t("a new player escape has no saved name", input() && input().value === "");
  pressEscape();
  await freshEsc;
  t("a new player escape matches the first-visit close", !dialog() && !bag["bc-board-name"] && bag["bc-board-name-skip"] === "1" && bag[ASKED] === "1");

  reset();
  day = "2026-11-25";
  bag["bc-board-eligible"] = "yes";
  bag["bc-board-name"] = "Luna";
  const cta = domNode("div");
  const startBtn = domNode("button");
  startBtn.className = "btn primary";
  cta.append(startBtn);
  body.append(cta);
  Board.decorate(cta, {});
  const both = Board.beforeStart({});
  const ids = helpIds();
  const described = [];
  function walkInputs(node) {
    if (node && node.attrs && node.attrs["data-board-name-input"]) described.push(node.attrs["aria-describedby"]);
    (node && node.children || []).forEach(walkInputs);
  }
  walkInputs(body);
  t("name help ids stay unique", ids.length >= 2 && new Set(ids).size === ids.length && described.length === ids.length && described.every(id => ids.indexOf(id) >= 0) && new Set(described).size === described.length);
  await click("[data-board-close]");
  await both;

  console.log(bad ? bad + " failures" : "name-reconfirm.test.js: all pass");
  process.exit(bad ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
