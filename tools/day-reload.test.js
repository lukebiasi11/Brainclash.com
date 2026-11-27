// node tools/day-reload.test.js
// A tab left open through New York midnight must reload scripts from home or
// results, leave a round in progress alone, and not rewrite saved scores.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
let bad = 0;
const t = (name, ok, extra) => { if (!ok) { bad++; console.log("FAIL", name, extra == null ? "" : extra); } else console.log("ok", name); };

const BEFORE = Date.parse("2026-11-27T04:30:00.000Z"); // 2026-11-26 23:30 America/New_York
const AFTER = Date.parse("2026-11-27T05:05:00.000Z"); // 2026-11-27 00:05
const NEXT = Date.parse("2026-11-28T05:05:00.000Z"); // 2026-11-28 00:05
const SAVE_KEY = "dg-2026-11-26";
const STATS_KEY = "dg-stats";
const SAVE = JSON.stringify({ key: "2026-11-26", scores: [600, 600, 600, 600, 600], details: ["a", "b", "c", "d", "e"] });
const STATS = JSON.stringify({ played: 4, best: 4200, streak: 3, last: "2026-11-26" });

function textOf(node) {
  if (!node) return "";
  if (node.nodeType === 3) return node.nodeValue || "";
  return (node.childNodes || []).map(textOf).join("");
}
function matches(el, sel) {
  if (!el || el.nodeType !== 1 || !sel) return false;
  if (sel.charAt(0) === ".") return (" " + (el.className || "") + " ").includes(" " + sel.slice(1) + " ");
  if (sel.charAt(0) === "#") return el.id === sel.slice(1);
  return String(el.tagName || "").toLowerCase() === sel.toLowerCase();
}
function queryAll(node, sel) {
  if (!node || !sel) return [];
  if (sel.includes(",")) return sel.split(",").flatMap(part => queryAll(node, part.trim()));
  if (sel.includes("[") || sel.includes(":")) return [];
  const out = [];
  const parts = sel.split(/\s+/).filter(Boolean);
  function rec(n, i) {
    for (const c of n.childNodes || []) {
      if (c.nodeType !== 1) continue;
      if (matches(c, parts[i])) {
        if (i === parts.length - 1) out.push(c);
        else rec(c, i + 1);
      }
      rec(c, i);
    }
  }
  rec(node, 0);
  return out;
}

function boot(startMs) {
  const clock = { ms: startMs };
  const mem = new Map([[SAVE_KEY, SAVE], [STATS_KEY, STATS]]);
  const sessionMem = new Map();
  const localStorage = {
    getItem(k) { return mem.has(k) ? mem.get(k) : null; },
    setItem(k, v) { mem.set(String(k), String(v)); },
    removeItem(k) { mem.delete(k); }
  };
  const sessionStorage = {
    getItem(k) { return sessionMem.has(k) ? sessionMem.get(k) : null; },
    setItem(k, v) { sessionMem.set(String(k), String(v)); },
    removeItem(k) { sessionMem.delete(k); }
  };
  const docListeners = {};
  const winListeners = {};
  const intervals = [];
  let reloads = 0;
  let visibility = "visible";
  function make(tag) {
    const el = {
      nodeType: 1, tagName: String(tag || "div").toUpperCase(), id: "", className: "", value: "",
      style: {}, dataset: {}, childNodes: [], children: [], attrs: {}, hidden: false, parentNode: null, _on: {}
    };
    el.classList = {
      add(...names) { names.forEach(n => { if (n && !el.classList.contains(n)) el.className = (el.className + " " + n).trim(); }); },
      remove(...names) { names.forEach(n => { el.className = (" " + el.className + " ").replace(" " + n + " ", " ").trim(); }); },
      toggle(name, on) {
        const has = el.classList.contains(name);
        const next = on == null ? !has : !!on;
        if (next) el.classList.add(name); else el.classList.remove(name);
        return next;
      },
      contains(name) { return (" " + el.className + " ").includes(" " + name + " "); }
    };
    el.append = (...kids) => kids.flat().forEach(k => {
      if (k == null || k === false) return;
      const node = k.nodeType ? k : { nodeType: 3, nodeValue: String(k), textContent: String(k) };
      el.childNodes.push(node);
      if (node.nodeType === 1) el.children.push(node);
      node.parentNode = el;
    });
    el.setAttribute = (k, v) => { el.attrs[k] = String(v); if (k === "id") el.id = String(v); if (k === "class") el.className = String(v); if (k === "hidden") el.hidden = true; };
    el.getAttribute = k => Object.prototype.hasOwnProperty.call(el.attrs, k) ? el.attrs[k] : null;
    el.removeAttribute = k => { delete el.attrs[k]; };
    el.addEventListener = (type, fn) => { (el._on[type] ||= []).push(fn); };
    el.removeEventListener = () => {};
    el.querySelector = sel => queryAll(el, sel)[0] || null;
    el.querySelectorAll = sel => queryAll(el, sel);
    el.closest = sel => { let n = el; while (n) { if (n.nodeType === 1 && matches(n, sel)) return n; n = n.parentNode; } return null; };
    el.contains = n => n === el || (el.childNodes || []).some(c => c === n || (c.contains && c.contains(n)));
    el.getBoundingClientRect = () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });
    el.blur = () => {};
    el.focus = () => {};
    el.matches = sel => matches(el, sel);
    el.remove = () => {
      const p = el.parentNode;
      if (!p) return;
      p.childNodes = p.childNodes.filter(c => c !== el);
      if (p.children) p.children = p.children.filter(c => c !== el);
      el.parentNode = null;
    };
    el.removeChild = c => { c.remove(); return c; };
    Object.defineProperty(el, "textContent", {
      get() { return textOf(el); },
      set(v) { const n = { nodeType: 3, nodeValue: String(v), textContent: String(v) }; el.childNodes = [n]; el.children = []; }
    });
    Object.defineProperty(el, "innerHTML", { set() { el.childNodes = []; el.children = []; }, get() { return ""; } });
    Object.defineProperty(el, "firstChild", { get() { return el.childNodes[0] || null; } });
    Object.defineProperty(el, "lastChild", { get() { return el.childNodes[el.childNodes.length - 1] || null; } });
    Object.defineProperty(el, "offsetWidth", { get() { return 390; } });
    Object.defineProperty(el, "isConnected", { get() { return true; } });
    return el;
  }
  const appEl = make("main");
  appEl.id = "app";
  const body = make("body");
  const html = make("html");
  html.append(body);
  body.append(appEl);
  const document = {
    documentElement: html, body, activeElement: null,
    createElement: make,
    createElementNS: (ns, tag) => make(tag),
    createTextNode: text => ({ nodeType: 3, nodeValue: String(text), textContent: String(text) }),
    getElementById: id => queryAll(html, "#" + id)[0] || null,
    querySelector: sel => queryAll(html, sel)[0] || null,
    querySelectorAll: sel => queryAll(html, sel),
    addEventListener(type, fn) { (docListeners[type] ||= []).push(fn); },
    removeEventListener() {},
    scrollingElement: { scrollHeight: 800 }
  };
  Object.defineProperty(document, "visibilityState", { get() { return visibility; } });
  const sandbox = {
    console, document, localStorage, sessionStorage,
    location: { search: "?dgtest", protocol: "file:", href: "file:///index.html?dgtest", reload() { reloads++; } },
    MutationObserver: class { observe() {} disconnect() {} },
    addEventListener(type, fn) { (winListeners[type] ||= []).push(fn); },
    removeEventListener() {},
    requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
    setTimeout, clearTimeout,
    setInterval(fn) { intervals.push(fn); return intervals.length; },
    clearInterval(id) { if (id) intervals[id - 1] = null; },
    performance: { now: () => 0 },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    Intl, Math, JSON, Map, Set, Object, Array, String, Number, RegExp, Error,
    parseInt, parseFloat, isNaN, isFinite, NaN, Infinity, undefined,
    navigator: { userAgent: "node" }, CSS: { supports: () => true },
    innerHeight: 800, innerWidth: 390, scrollTo() {}, confirm: () => false,
    getComputedStyle: () => ({ fontSize: "16px", getPropertyValue: () => "" })
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const RealDate = Date;
  function PatchedDate(...args) {
    if (!new.target) return RealDate();
    if (args.length === 0) return new RealDate(clock.ms);
    return new RealDate(...args);
  }
  PatchedDate.now = () => clock.ms;
  PatchedDate.parse = RealDate.parse;
  PatchedDate.UTC = RealDate.UTC;
  PatchedDate.prototype = RealDate.prototype;
  sandbox.Date = PatchedDate;
  vm.createContext(sandbox);
  const load = file => vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), sandbox, { filename: file });
  load("content.js");
  load("anagrams.js");
  load("eagle-eye.js");
  load("i18n.js");
  load("app.js");
  function fire(map, type, event) { (map[type] || []).forEach(fn => fn(event)); }
  function saved() {
    const out = {};
    for (const [k, v] of mem) if (k !== "dg-maxday") out[k] = v;
    return JSON.stringify(out);
  }
  return {
    sandbox, body, appEl, mem, sessionMem, intervals, clock,
    saved,
    reloads: () => reloads,
    countdown: () => { const el = document.querySelector("#countdown"); return el ? el.textContent : ""; },
    setVisibility(v) { visibility = v; },
    show() { visibility = "visible"; fire(docListeners, "visibilitychange", {}); },
    hide() { visibility = "hidden"; fire(docListeners, "visibilitychange", {}); },
    pageShow(persisted) { fire(winListeners, "pageshow", { persisted: !!persisted }); },
    tick() { intervals.filter(Boolean).forEach(fn => fn()); },
    clickText(label) {
      const btn = queryAll(html, "button").find(b => textOf(b).trim() === label);
      if (!btn) return false;
      (btn._on.click || []).forEach(fn => fn({ currentTarget: btn, target: btn, preventDefault() {} }));
      return true;
    }
  };
}

const src = fs.readFileSync(path.join(root, "app.js"), "utf8");
const branch = (src.match(/if \(dayIndex\(\) !== day\)[^\n]*/ ) || [""])[0];
t("midnight branch reloads instead of re-rendering home", branch.includes("reloadIfNewDayIdle()") && !branch.includes("home()"), branch);
t("bfcache pageshow is the persisted path", /pageshow", e => \{ if \(e && e\.persisted\) reloadIfNewDayIdle\(\)/.test(src));
t("visible tab checks the day", /visibilityState === "visible"\) reloadIfNewDayIdle\(\)/.test(src));

const home = boot(BEFORE);
const homeSaved = home.saved();
t("home paints the countdown on the loaded day", home.countdown().includes("Next Clash in") && home.reloads() === 0, home.countdown());
home.show();
home.pageShow(false);
t("same day show does not reload", home.reloads() === 0 && home.saved() === homeSaved);

const label = home.countdown();
home.body.classList.add("in-game");
home.clock.ms = AFTER;
home.tick();
home.show();
home.pageShow(true);
t("a round in progress is not reloaded at midnight", home.reloads() === 0 && home.sessionMem.size === 0, "reloads=" + home.reloads());
t("saved scores stay put while a round is open", home.saved() === homeSaved);

home.body.classList.remove("in-game");
home.tick();
t("home reloads once the round is no longer on screen", home.reloads() === 1 && home.sessionMem.get("dg-day-reload:2026-11-27") === "1", [...home.sessionMem.keys()].join(","));
t("countdown does not paint the new day in the old tab", home.countdown() === label, home.countdown());
t("reload does not rewrite saved results or stats", home.saved() === homeSaved && !home.mem.has("dg-day-reload:2026-11-27"));
home.tick();
home.show();
home.pageShow(true);
t("the day marker blocks a second reload", home.reloads() === 1);

home.clock.ms = NEXT;
home.show();
t("the next New York day can reload again", home.reloads() === 2 && home.sessionMem.get("dg-day-reload:2026-11-28") === "1");
t("the next reload still leaves saved scores alone", home.saved() === homeSaved);

const hidden = boot(BEFORE);
hidden.clock.ms = AFTER;
hidden.hide();
t("hiding the tab does not reload", hidden.reloads() === 0 && hidden.sessionMem.size === 0);

const results = boot(BEFORE);
const opened = results.sandbox.DGTest.openResults("2026-11-26", [600, 600, 600, 600, 600]);
const resultsSaved = results.saved();
t("results screen is up", !!results.appEl.querySelector(".final") && !results.body.classList.contains("in-game"), opened);
results.clock.ms = AFTER;
results.pageShow(false);
results.hide();
t("results ignore a normal pageshow and a hide", results.reloads() === 0);
results.pageShow(true);
t("restoring results from bfcache reloads", results.reloads() === 1 && results.sessionMem.get("dg-day-reload:2026-11-27") === "1");
t("results reload leaves the saved day and stats untouched", results.saved() === resultsSaved);
results.pageShow(true);
results.show();
t("results do not reload twice for the same day", results.reloads() === 1);

const viaHome = boot(BEFORE);
viaHome.sandbox.DGTest.openResults("2026-11-26", [600, 600, 600, 600, 600]);
const viaSaved = viaHome.saved();
viaHome.clock.ms = AFTER;
const clicked = viaHome.clickText("Home");
t("Home after midnight reloads instead of painting stale scripts", clicked && viaHome.reloads() === 1, "clicked=" + clicked);
t("Home reload does not write the saved result", viaHome.saved() === viaSaved);

const playing = boot(BEFORE);
let started = false;
try { playing.sandbox.DGTest.at("2026-11-26", 0); started = playing.body.classList.contains("in-game"); } catch (e) { started = false; console.log("FAIL start round", e && e.stack || e); bad++; }
playing.clock.ms = AFTER;
playing.show();
playing.pageShow(true);
playing.tick();
t("a category intro stays up across midnight", started && playing.reloads() === 0 && playing.saved() === homeSaved);

console.log(bad ? bad + " failed" : "day-reload.test.js: all pass");
process.exit(bad ? 1 : 0);
