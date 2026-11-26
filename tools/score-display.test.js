// The category card, header, completion modal, and run FX use the committed score.
// A count-up used to leave 819 on a perfect 1,000 card and 3,582 on a 3,700 total.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");
let bad = 0;
const t = (name, ok, extra) => { if (!ok) { bad++; console.log("FAIL", name, extra == null ? "" : extra); } else console.log("ok", name); };

function boot() {
  const nodes = new Set();
  function textOf(node) {
    if (!node) return "";
    if (node.nodeType === 3) return node.nodeValue || "";
    return (node.childNodes || []).map(textOf).join("");
  }
  function matches(el, sel) {
    if (!el || el.nodeType !== 1) return false;
    if (sel.charAt(0) === ".") return (" " + (el.className || "") + " ").includes(" " + sel.slice(1) + " ");
    if (sel.charAt(0) === "#") return el.id === sel.slice(1);
    return String(el.tagName || "").toLowerCase() === sel.toLowerCase();
  }
  function walk(node, fn) {
    if (!node) return null;
    if (fn(node)) return node;
    for (const c of node.childNodes || []) { const hit = walk(c, fn); if (hit) return hit; }
    return null;
  }
  function queryAll(node, sel) {
    const out = [];
    const parts = sel.split(/\s+/);
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
  function make(tag) {
    const el = { nodeType: 1, tagName: String(tag || "div").toUpperCase(), id: "", className: "", value: "", style: {}, dataset: {}, childNodes: [], children: [], attrs: {}, hidden: false, parentNode: null };
    el.classList = {
      add(...names) { names.forEach(n => { if (!el.classList.contains(n)) el.className = (el.className + " " + n).trim(); }); },
      remove(...names) { names.forEach(n => { el.className = (" " + el.className + " ").replace(" " + n + " ", " ").trim(); }); },
      toggle() {},
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
    el.addEventListener = () => {};
    el.removeEventListener = () => {};
    el.querySelector = sel => queryAll(el, sel)[0] || null;
    el.querySelectorAll = sel => queryAll(el, sel);
    el.closest = () => null;
    el.contains = n => n === el || (el.childNodes || []).some(c => c === n || (c.contains && c.contains(n)));
    el.getBoundingClientRect = () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });
    el.blur = () => {};
    el.focus = () => {};
    el.matches = sel => matches(el, sel);
    el.remove = () => { if (el.parentNode) el.parentNode.childNodes = el.parentNode.childNodes.filter(c => c !== el); };
    Object.defineProperty(el, "textContent", {
      get() { return (el.childNodes || []).map(n => n.nodeType === 3 ? (n.nodeValue || "") : (n.textContent || "")).join(""); },
      set(v) { const n = { nodeType: 3, nodeValue: String(v), textContent: String(v) }; el.childNodes = [n]; el.children = []; }
    });
    Object.defineProperty(el, "innerHTML", { set() { el.childNodes = []; el.children = []; }, get() { return ""; } });
    Object.defineProperty(el, "offsetWidth", { get() { return 390; } });
    Object.defineProperty(el, "isConnected", { get() { return true; } });
    nodes.add(el);
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
    createTextNode: text => ({ nodeType: 3, nodeValue: String(text), textContent: String(text) }),
    getElementById: id => walk(html, n => n.id === id),
    querySelector: sel => queryAll(html, sel)[0] || null,
    querySelectorAll: sel => queryAll(html, sel),
    addEventListener() {}, removeEventListener() {},
    scrollingElement: { scrollHeight: 800 }
  };
  const sandbox = {
    console, document,
    location: { search: "?dgtest", protocol: "file:", href: "file:///index.html?dgtest" },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    addEventListener() {}, removeEventListener() {},
    requestAnimationFrame(fn) { return 1; }, cancelAnimationFrame() {},
    setTimeout, clearTimeout, setInterval, clearInterval,
    performance: { now: () => 0 },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    Intl, Date, Math, JSON, Map, Set, Object, Array, String, Number, RegExp, Error,
    parseInt, parseFloat, isNaN, isFinite, NaN, Infinity, undefined,
    navigator: { userAgent: "node" }, CSS: { supports: () => true },
    innerHeight: 667, innerWidth: 390, scrollTo() {}, confirm: () => false,
    getComputedStyle: () => ({ fontSize: "16px", getPropertyValue: () => "" })
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
  return { sandbox, textOf, appEl, body };
}

const view = boot();
const card = view.sandbox.DGTest.categoryCard(1000, "250/350/400");
const cardNode = view.appEl.querySelector(".cat-score b");
const header = view.appEl.querySelector(".runtotal b");
t("perfect MVP commits 1000", card === 1000);
t("category card shows the committed 1,000", cardNode && cardNode.textContent === "1,000" && cardNode.getAttribute("data-score") === "1000", cardNode && cardNode.textContent);
t("header shows the committed 1,000", header && header.textContent === "1,000", header && header.textContent);
t("card is not a mid-count frame", cardNode && cardNode.textContent !== "819" && cardNode.textContent !== "804");

const modalView = boot();
modalView.sandbox.DGTest.completionPopup("2026-11-26", [700, 1000, 1000, 1000, 0]);
const modal = modalView.body.querySelector(".result-modal");
const score = modal && modal.querySelector(".result-modal__score");
const blocks = modal && [...modal.querySelectorAll(".result-modal__blocks span")].map(n => n.textContent).join("");
t("modal shows the committed 3,700", score && score.textContent === "3,700" && score.getAttribute("data-score") === "3700", score && score.textContent);
t("modal blocks follow the committed scores", blocks === "🟨🟩🟩🟩🟥", blocks);
t("3,700 does not rain", modal && modal.getAttribute("data-fx") === "none" && !modalView.body.querySelector(".rain-layer"), modal && modal.getAttribute("data-fx"));
t("run fx uses the committed total", modalView.sandbox.DGTest.runFx(3700, "2026-11-26") === "none" && modalView.sandbox.DGTest.runFx(2100, "2026-11-26") === "rain" && modalView.sandbox.DGTest.runFx(3950, "2026-11-26") === "confetti" && modalView.sandbox.DGTest.runFx(3591, "2026-11-26") === "none");

modalView.sandbox.DGTest.openResults("2026-11-26", [700, 1000, 1000, 1000, 0]);
const finalNum = modalView.appEl.querySelector("#finalnum");
const shareText = (modalView.appEl.querySelector(".share") || {}).textContent || "";
t("results page shows 3,700", finalNum && finalNum.textContent === "3,700" && finalNum.getAttribute("data-score") === "3700", finalNum && finalNum.textContent);
t("share text uses the committed total", shareText.includes("3,700") && shareText.includes("700") && shareText.includes("1000") && shareText.includes("🟥 0"), shareText.split("\n").slice(0, 8).join(" | "));
t("results fx is none for 3,700", (modalView.appEl.querySelector(".final") || {}).getAttribute && modalView.appEl.querySelector(".final").getAttribute("data-fx") === "none");

console.log(bad ? bad + " failed" : "score-display.test.js: all pass");
process.exit(bad ? 1 : 0);
