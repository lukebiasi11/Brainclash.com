(() => {
"use strict";
// ======================= SETTINGS YOU MAY CHANGE =======================
// RESET_TIMEZONE: the ONE time zone where everyone's Gauntlet resets at midnight.
// Any IANA zone name works ("America/New_York", "UTC", ...). Daylight saving is
// handled automatically. Changing it mid-season shifts the day boundary once.
const RESET_TIMEZONE = "America/New_York";
// LAUNCH_DATE: day #1 of the game, in the reset zone. Used for "Gauntlet #N" in share text.
const LAUNCH_DATE = "2026-10-23";
// ======================================================================
const I18N = window.BC_I18N || { LANG: "en", t: s => s, toggleVisible: () => false }, tr = I18N.t, LANG = I18N.LANG;
const privacyLink = document.querySelector("a[data-privacy]");
if (privacyLink) privacyLink.textContent = tr("Privacy");
if (LANG === "es") document.documentElement.lang = "es";
if (window.Answers && Answers.setLang) Answers.setLang(LANG); // nov3f: es dot-thousands in typed numbers
const C = window.CONTENT;
const $ = (s, r = document) => r.querySelector(s);
const app = $("#app");
const CATS = [
  { id: "world", img: "cat-world", name: "World Rush", icon: "🌎", sub: "Geography", desc: "2 map pins + 1 geography question" },
  { id: "history", img: "cat-history", name: "Time Warp", icon: "📜", sub: "History", desc: "2 timelines · drag cards into order" },
  { id: "sports", img: "cat-sports", name: "MVP", icon: "🏆", sub: "Sports", desc: "3 questions · easy → hard" },
  { id: "word", img: "cat-word", name: "Word Nerd", icon: "📝", sub: "Word games", desc: "" },
  { id: "think", img: "cat-brain", name: "Brain Teaser", icon: "🧠", sub: "Logic", desc: "2 brain-benders · one shot each" }
];
if (LANG === "es") CATS.forEach(c => { c.name = tr(c.name); c.sub = tr(c.sub); c.desc = tr(c.desc); });
const WORD_GAMES = [
  { id: "flip", name: "Unscramble", sub: "Unscramble 6 words from hints · 60s" },
  { id: "bridge", name: "Word Bridge", sub: "Finish the first word, start the second · 60s" },
  { id: "conn", name: "Clusters", sub: "Find 3 groups of 3 · 90s" },
  { id: "odd", name: "Imposter", sub: "Spot the word that doesn't fit · 60s" },
  { id: "anag", name: "Anagram Rush", sub: "Make words from 6 letters · 60s" }
];
if (LANG === "es") WORD_GAMES.forEach(w => { w.name = tr(w.name); w.sub = tr(w.sub); });
// Placeholder timers for categories whose time limits are not yet locked.
const THINK_SECS = 45;   // Luke, Oct 26: every Think Fast puzzle (all 6 types) gets 45 s — the single source for timer + copy
const TBD = { pin: 45, mc: 20, think: THINK_SECS };

// Optional icon hook: uses assets/icons.js when loaded + key given, else the emoji text.
const ic = (emoji, key, cls) => (key && window.icon) ? window.icon(key, emoji, cls) : emoji;
// Swaps the first flag emoji in a question for its SVG (if an img key is given).
// Deterministic shuffle: same day key + question => same order for everyone.
function seededOrder(n, seed) {
  let x = 2166136261; for (const ch of String(seed)) x = Math.imul(x ^ ch.charCodeAt(0), 16777619);
  const rnd = () => { x = Math.imul(x ^ (x >>> 15), 2246822507); x = Math.imul(x ^ (x >>> 13), 3266489909); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
  const o = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}
const qText = q => Array.isArray(q) ? q.map(x => typeof x === "string" ? x : "").join("") : String(q);
// Nov 3i: flag MCs have no emoji in q (385dba7: emoji/alt read the answer aloud), so show the img with a neutral alt.
const withFlag = (text, key) => { if (!key || !window.icon) return text; const m = text.match(/\p{RI}\p{RI}/u); if (!m) { if (!/^flag-/.test(key)) return text; const f = ic("🏳️", key, "inline-flag"); if (f.alt != null) f.alt = tr("Flag"); return [text, " ", f]; } const i = m.index; return [text.slice(0, i), ic(m[0], key, "inline-flag"), text.slice(i + m[0].length)]; };
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "html") e.innerHTML = v;
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}
const fmt = n => Math.round(n).toLocaleString();
const norm = s => s.toLowerCase().replace(/[^a-z0-9$./ ]/g, "").replace(/\s+/g, " ").trim();
function shuffle(a, rnd = Math.random) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- day / storage ----------
// ---- Daily clock (all day logic goes through here; never the device's own zone) ----
let clockSkew = 0; // ms added to Date.now() if the device clock is found to be running ahead
const now = () => Date.now() + clockSkew;
const TZF = new Intl.DateTimeFormat("en-US", { timeZone: RESET_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
function zoneParts(ms) { const p = {}; for (const x of TZF.formatToParts(new Date(ms))) p[x.type] = +x.value; if (p.hour === 24) p.hour = 0; return p; }
function keyOf(day) { return new Date(day * 864e5).toISOString().slice(0, 10); }
function dayOfKey(k) { return Math.floor(Date.parse(k + "T00:00:00Z") / 864e5); }
function zoneDay(ms) { const p = zoneParts(ms); return Math.floor(Date.UTC(p.year, p.month - 1, p.day) / 864e5); }
// Anti-clock-tamper (best effort): never go back to a day older than the newest one seen.
function dayIndex() {
  const seen = store.get("dg-maxday", 0), d = Math.max(seen, zoneDay(now()));
  if (d > seen) store.set("dg-maxday", d);
  return d;
}
function todayKey() { return keyOf(dayIndex()); }
// ms until the next midnight in RESET_TIMEZONE (correct on DST change days).
function msToReset() {
  const t = now(), offAt = ms => { const p = zoneParts(ms); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000; };
  const nextMidLocal = (zoneDay(t) + 1) * 864e5; // next zone midnight, written as if it were UTC
  let m = nextMidLocal - offAt(t); m = nextMidLocal - offAt(m);
  return Math.max(0, m - t);
}
// Trusted time: read the HTTP Date header of the site itself once. If the device
// clock is >10 min ahead, use server time. Silently ignored offline / on file://.
function syncClock() {
  if (!/^https?:/.test(location.protocol)) return;
  fetch(location.href, { method: "HEAD", cache: "no-store" }).then(r => {
    const srv = Date.parse(r.headers.get("Date")); if (!srv) return;
    const ahead = Date.now() - srv;
    if (ahead > 10 * 60e3) {
      clockSkew = -ahead;
      const real = zoneDay(now()); if (store.get("dg-maxday", 0) > real) store.set("dg-maxday", real); // undo a day reached by a fast clock
      if (!session) home();
    }
  }).catch(() => {});
}
const gameNumber = day => day - dayOfKey(LAUNCH_DATE) + 1;
const pick = (arr, i) => (Array.isArray(arr) && arr.length ? arr[((i % arr.length) + arr.length) % arr.length] : (console.error("Empty content list"), undefined));
const store = {
  get(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
let session = null;
let onKey = null; // per-screen physical keyboard handler
let timers = new Set(), cdInterval = null;
function clearScreenTimers() { timers.forEach(t => t.stop()); timers.clear(); clearInterval(cdInterval); cdInterval = null; }
window.addEventListener("beforeunload", e => { if (session && session.inProgress != null) { e.preventDefault(); e.returnValue = ""; } });
document.addEventListener("keydown", e => {
  if (!onKey || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.matches && e.target.matches("input,textarea")) return;
  if (onKey(e) !== false) { if (/^[a-z]$/i.test(e.key) || ["Backspace", "Enter", " "].includes(e.key)) e.preventDefault(); }
});
// Tall portrait map cards (e.g. 390x844): let the globe slightly overfill the width instead of leaving dead space above/below.
function globeBase(W, H) { return Math.max(20, H > W * 1.3 ? Math.min(W * 0.56, H / 2 - 8) : Math.min(W, H) / 2 - 8); }
window.globeBase = globeBase;
function countUp(el, to, ms = 900, onDone) {
  const t0 = performance.now();
  const step = t => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(to * e); if (k < 1) requestAnimationFrame(step); else if (onDone) onDone(); };
  requestAnimationFrame(step);
}
function burst(x, y, n = 18) {
  const cols = ["#E8582A", "#F2C230", "#FFF6E8", "#1F2C7A"];
  for (let i = 0; i < n; i++) {
    const p = h("i", { class: "spark" }); const a = Math.random() * 6.28, d = 40 + Math.random() * 70;
    p.style.cssText = `left:${x}px;top:${y}px;background:${cols[i % 4]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px`;
    document.body.append(p); setTimeout(() => p.remove(), 700);
  }
} // {day, practice, scores:[], details:[]}

// Loads today's saved run. If the page was closed mid-category, that category is
// locked in at whatever was earned so far (no replays).
function loadToday() {
  const s = store.get("dg-" + todayKey());
  if (s && s.inProgress != null) {
    if (s.inProgress === s.scores.length && s.scores.length < 5) { s.scores.push(Math.round(Math.max(0, Math.min(1000, s.partialCat === s.inProgress ? s.partial || 0 : 0)))); s.details.push("left mid-category");
      const c = CATS[s.scores.length - 1]; toast(tr("{0} was locked in at {1} pts — you left mid-round, so it can't be replayed.", c ? c.name : tr("That category"), fmt(s.scores[s.scores.length - 1]))); }
    delete s.inProgress; delete s.partial; delete s.partialCat; store.set("dg-" + s.key, s);
  }
  return s;
}
function toast(text) {
  const show = () => { const t = h("div", { class: "toast", role: "status" }, text); document.body.append(t); setTimeout(() => t.classList.add("out"), 4200); setTimeout(() => t.remove(), 4700); };
  document.body ? setTimeout(show, 0) : addEventListener("DOMContentLoaded", show);
}
// THE single place that turns a day key into that day's content. To move to a
// backend later, replace the body with a fetch (and make callers await it).
// ===== Append-safe rotation (see SPEC.md "Rotation & how to add content") =====
// FROZEN is the exact schedule for Oct 23 – Oct 31 2026 as played, then the week-2 pack Nov 1 – Nov 14, as content-list indexes.
// Daily lists (worldRush/history/sports/thinkFast) use one unit per day (u = epoch day);
// word-game lists use one unit per 5-day format cycle (u = floor(day / 5)), because each
// word format comes up once every 5 days. idx[k] is the entry shown for unit u0 + k.
// After the frozen window, each list plays its NOT-yet-scheduled entries in content order,
// so appending entries to the end of a list never moves any already-scheduled date.
// Only once every entry has been used does it wrap (and then it repeats in content order).
// Rule for content: never delete or reorder entries; fix one in place or append new ones.
const FROZEN = {
  // k 0-8 = Oct 23-31 (as played). k 9-22 = Nov 1-14 2026 (NY): week-2 / easier pack (Luke, Oct 31).
  worldRush: { u0: 20749, idx: [13,14,15,16,17,0,1,2,3, 32,33,34,35,36,37,38, 39,40,41,42,43,44,45] },
  history: { u0: 20749, idx: [13,14,15,16,17,0,1,2,3, 32,33,34,35,36,37,38,39,40,41,42,43,44,45] },
  sports: { u0: 20749, idx: [13,14,15,16,17,0,1,2,3, 32,33,34,35,36,37,38,39,40,41,42,43,44,45] },
  thinkFast: { u0: 20749, idx: [3,4,5,6,7,0,1,2,8, 41,42,43,44,45,46,47, 19,20,21,22,23,24,25] },
  // Word units (u = floor(day/5)): k2 = Oct 29-Nov 2 (flip/bridge/conn already played Oct 29-31; odd Nov 1, anag Nov 2).
  wordFlip: { u0: 4149, idx: [0,1,2,9,10,5] },
  wordBridge: { u0: 4149, idx: [0,1,2,9,10,5] },
  connections: { u0: 4149, idx: [0,1,2,9,10,5] },
  oddOneOut: { u0: 4149, idx: [0,1,9,10,5] },
  anagram: { u0: 4149, idx: [2,3,7,8,9] }
};
// Indexes named by DAY_OVERRIDES are already scheduled. They stay out of the fresh queue and the wrap
// so appending a pinned day does not move any other date.
function pinnedIdx(name) {
  const out = new Set();
  const all = typeof window !== "undefined" && window.DAY_OVERRIDES;
  if (!all) return out;
  for (const spec of Object.values(all)) {
    if (!spec || typeof spec !== "object") continue;
    const idx = spec[name] != null ? spec[name] : (name === "anagram" ? spec.anagrams : undefined);
    if (Number.isInteger(idx)) out.add(idx);
  }
  return out;
}
function schedIdx(name, len, u) {
  const f = FROZEN[name];
  if (!f || !len) return null;
  const pinned = pinnedIdx(name);
  const pool = [];
  for (let i = 0; i < len; i++) if (!pinned.has(i)) pool.push(i);
  const n = pool.length || len;
  const at = j => pool[((j % n) + n) % n];
  if (u < f.u0) return at(u);            // pre-launch (practice fallback): legacy
  const k = u - f.u0;
  if (k < f.idx.length) return f.idx[k] < len && !pinned.has(f.idx[k]) ? f.idx[k] : at(k);
  const used = new Set(f.idx);
  const fresh = pool.filter(i => !used.has(i));
  const j = k - f.idx.length;
  return j < fresh.length ? fresh[j] : at(j - fresh.length);
}
// Past-date stability (SPEC): word unit 4151 spans Oct 29 – Nov 2. The Nov 1 remap changed that unit's
// oddOneOut/anagram, so days before Nov 1 (20758) keep the as-played indexes (oo 2, an 4).
const PAST_PIN = { oddOneOut: { u: 4151, before: 20758, idx: 2 }, anagram: { u: 4151, before: 20758, idx: 4 } };
const sched = (name, arr, u, day) => { if (!Array.isArray(arr) || !arr.length) return pick(arr, u);
  const p = PAST_PIN[name]; if (p && day != null && u === p.u && day < p.before && p.idx < arr.length) return arr[p.idx];
  return arr[schedIdx(name, arr.length, u)]; };
// nov2es: Spanish content. Indexes are always chosen from the ENGLISH lists (rotation identical in both languages);
// in es mode the item at that index is swapped for CONTENT_ES[name][idx], merged per question/field: null or missing -> English.
// wordBridge and anagram always stay English.
const ES_OK = new Set(["worldRush", "history", "sports", "wordFlip", "connections", "oddOneOut", "thinkFast"]);
function esMerge(en, es) {
  if (es == null) return en;
  if (Array.isArray(en) && Array.isArray(es)) return en.map((x, i) => esMerge(x, es[i]));
  if (en && typeof en === "object" && !Array.isArray(en) && typeof es === "object" && !Array.isArray(es)) {
    const o = { ...en }; for (const k of Object.keys(es)) o[k] = esMerge(en[k], es[k]); return o; }
  return es;
}
function esLocalize(set) {
  const E = window.CONTENT_ES; if (typeof LANG === "undefined" || LANG !== "es" || !E) return set;
  for (const name of ES_OK) { const en = set[name], list = C[name], i = Array.isArray(list) ? list.indexOf(en) : -1;
    if (i >= 0 && Array.isArray(E[name]) && E[name][i] != null) set[name] = esMerge(en, E[name][i]); }
  return set;
}
function getDailySet(dayKey) {
  const d = dayOfKey(dayKey), w = Math.floor(d / WORD_GAMES.length);
  const set = { day: d, worldRush: sched("worldRush", C.worldRush, d), history: sched("history", C.history, d), sports: sched("sports", C.sports, d),
    // Word formats rotate daily (period 5); each format's list advances once per 5-day cycle: w = floor(day / 5).
    wordGame: pick(WORD_GAMES, d), wordFlip: sched("wordFlip", C.wordFlip, w), wordBridge: sched("wordBridge", C.wordBridge, w),
    connections: sched("connections", C.connections, w), oddOneOut: sched("oddOneOut", C.oddOneOut, w, d),
    anagram: sched("anagram", window.ANAGRAM_SETS, w, d), thinkFast: sched("thinkFast", C.thinkFast, d) };
  // A date can pin one category to a list index. Every other date keeps the frozen schedule.
  const spec = typeof window !== "undefined" && window.DAY_OVERRIDES && window.DAY_OVERRIDES[dayKey];
  if (spec && typeof spec === "object") {
    for (const name of Object.keys(spec)) {
      const key = name === "anagrams" ? "anagram" : name;
      const list = key === "anagram" ? window.ANAGRAM_SETS : (window.CONTENT && window.CONTENT[key]);
      const idx = spec[name];
      if (Array.isArray(list) && Number.isInteger(idx) && idx >= 0 && idx < list.length) set[key] = list[idx];
    }
  }
  return esLocalize(set);
}
// Practice replays a random PAST daily (launch .. yesterday) so it never spoils today
// or a future day. Before there are past days it falls back to a pre-launch day.
function practiceKey() {
  const L = dayOfKey(LAUNCH_DATE), t = dayOfKey(todayKey());
  const d = t > L ? L + Math.floor(Math.random() * (t - L)) : L - 1 - Math.floor(Math.random() * 30);
  return keyOf(d);
}
function newSession(practice) {
  let s;
  if (!practice) s = loadToday();
  if (s) s.practice = false;
  else s = { key: practice ? practiceKey() : todayKey(), practice, scores: [], details: [] };
  s.day = dayOfKey(s.key);
  Object.defineProperty(s, "set", { value: getDailySet(s.key), enumerable: false, writable: true }); // not saved
  return s;
}
// Records points earned so far in the current category (used if the page reloads).
function track(pts) {
  if (!session || session.inProgress == null) return;
  const gain = Math.round(pts - (session.partial || 0));
  session.partial = pts; session.partialCat = session.inProgress; save(); liveTotal();
  if (gain > 0) scorePop(gain);
}
// Celebration: "+N" floats up from the header score and the number bumps (CSS, ~600 ms, no layout shift).
function scorePop(gain) {
  const b = document.querySelector(".runtotal b"); if (!b) return;
  b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
  const r = b.getBoundingClientRect(), p = h("span", { class: "pts-pop", "aria-hidden": "true" }, "+" + fmt(gain));
  p.style.left = (r.left + r.width / 2) + "px"; p.style.top = (r.bottom) + "px";
  document.body.append(p); setTimeout(() => p.remove(), 900);
}
const flashBody = cls => { document.body.classList.remove("flash-good", "flash-bad"); void document.body.offsetWidth; document.body.classList.add(cls); setTimeout(() => document.body.classList.remove(cls), 600); };
// Header "Total" follows points as they are earned (committed categories + the current one so far).
function liveTotal() {
  const b = document.querySelector(".runtotal b");
  if (!b || !session) return;
  // Category score (out of 1,000), never the grand total — keeps the timer from being read as "1000 seconds".
  b.textContent = fmt(session.inProgress != null ? Math.round(session.partial || 0) : (session.lastCat != null ? session.lastCat : 0));
}
function catScoreChip() {
  const v = session && session.inProgress != null ? Math.round(session.partial || 0) : 0;
  return h("div", { class: "runtotal", "aria-label": tr("Category score") }, tr("Score "), h("b", {}, fmt(v)), tr("/1,000 pts"));
}
function save() { if (session && !session.practice) store.set("dg-" + session.key, session); }
const wordGameFor = day => getDailySet(keyOf(day)).wordGame;

// ---------- timer ----------
function Timer(seconds, onEnd, parent) {
  const bar = h("div", { class: "timer" }, h("div", { class: "timer-fill" }), h("span", { class: "timer-text" }));
  parent.append(bar);
  const end = Date.now() + seconds * 1000; let stopped = false;
  const tick = () => {
    if (stopped) return;
    const left = Math.max(0, end - Date.now());
    bar.firstChild.style.width = (left / (seconds * 1000) * 100) + "%";
    bar.lastChild.textContent = "⏱ " + Math.ceil(left / 1000) + "s";
    bar.classList.toggle("low", left < 10000);
    if (left <= 0) { stopped = true; onEnd(); } else requestAnimationFrame(tick);
  };
  const api = { stop() { stopped = true; timers.delete(api); }, get left() { return Math.max(0, end - Date.now()) / 1000; } };
  timers.add(api);
  tick();
  return api;
}

function screen(title, sub) {
  onKey = null; clearScreenTimers();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  app.innerHTML = ""; app.classList.remove("enter"); void app.offsetWidth; app.classList.add("enter");
  const cat = session && CATS[session.scores.length];
  const head = h("header", { class: "game-head" },
    h("div", { class: "crumb" }, session.practice ? tr("Practice") : "Daily Dose", " · ", session.key === "demo" ? ((session.demoAt || 0) + 1) + "/" + ((window.TYPE_DEMO || []).length || 1) : (session.scores.length + 1) + "/5"),
    h("h2", {}, title), sub ? h("p", { class: "muted" }, sub) : null,
    catScoreChip());
  const body = h("section", { class: "game-body" });
  document.body.classList.add("in-game");
  app.append(head, body);
  scheduleFit();
  return body;
}
function feedback(parent, ok, text) {
  const f = h("div", { class: "fb " + (ok === true ? "good" : ok === false ? "bad" : "neutral") }, text);
  parent.append(f);
  if (ok === true) { const r = f.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2); flashBody("flash-good"); }
  else if (ok === false) flashBody("flash-bad");
  return f;
}
// One-shot button: ignores double-clicks and key-repeat.
// Once an answer is locked, the Next/Continue button appears: freeze every running timer on the
// screen and remove Skip (applies to every mode, since they all advance through nextBtn/catDone).
function answerLocked() {
  timers.forEach(t => t.stop());
  document.querySelectorAll("#app .timer").forEach(t => t.classList.add("stopped"));
  document.querySelectorAll("#app .skip-btn").forEach(b => b.remove());
}
function nextBtn(parent, label, fn) { if (document.body.classList.contains("in-game") && session && parent.closest && parent.closest(".game-body")) answerLocked(); let used = false; const born = performance.now(); const b = h("button", { class: "btn primary big", onclick: () => { if (used || performance.now() - born < 300) return; used = true; b.disabled = true; b.blur(); fn(); } }, label); parent.append(b); if (matchMedia("(hover: hover) and (pointer: fine)").matches) b.focus({ preventScroll: true }); return b; }
// Sticky bottom bar for the main action on game screens (always reachable on phones).
const actionBar = body => { const bar = h("div", { class: "action-bar" }); body.append(bar); return bar; };
// Visible Skip control for every play screen — lives in the action bar so it stays above the browser chrome.
// Unicode-safe \b\w title case: "maría" -> "María" (\b\w treated í as a word break -> "MaríA"). ASCII output unchanged.
const titleCase = s => String(s).replace(/(?<![\p{L}\p{N}_])\p{L}/gu, c => c.toUpperCase());
function skipBtn(onSkip, label) {
  return h("button", { class: "btn skip-btn", type: "button", "aria-label": tr("Skip"), onclick: e => { e.preventDefault(); onSkip(); } }, label || tr("Skip"));
}
// RULE (Luke): Skip always sits BESIDE the Lock in / Submit button on one row, mid-screen, never under the phone's bottom bar.
// Typed-answer screens (form.answer): Skip joins the submit button in an .answer-row inside the form.
// Everything else: Skip goes in the action bar next to the primary button (see .action-bar CSS).
// RULE (Luke, 2026-10-30): no Skip on already-timed per-question modes (History/Time Warp, World Rush, Sports; shared helpers also serve Think Fast).
// Shared timed helpers call this; it now only returns the bar/row and adds no Skip. Word Nerd games add Skip directly.
const TIMED_SKIP = false;
function ensureSkipBar(body, onSkip) {
  const form = body.querySelector(":scope > form.answer"), sub = form && form.querySelector(":scope > .btn.primary, :scope > .answer-row > .btn.primary");
  if (form && sub) {
    let row = sub.parentNode.classList.contains("answer-row") ? sub.parentNode : null;
    if (!row) { row = h("div", { class: "answer-row" }); sub.replaceWith(row); row.append(sub); }
    if (TIMED_SKIP && !row.querySelector(".skip-btn")) row.append(skipBtn(onSkip));
    return row;
  }
  let bar = body.querySelector(":scope > .action-bar");
  if (!bar) bar = actionBar(body);
  if (TIMED_SKIP && !bar.querySelector(".skip-btn")) bar.append(skipBtn(onSkip));
  return bar;
}

// ---------- home ----------
// nov2b: after-play results graph on home (own points per category for today, from the saved dg-<day> session; no backend).
function scoreGraph(scores, day) {
  const tot = scores.reduce((a, b) => a + b, 0);
  const anim = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dt = new Date(day * 864e5).toLocaleDateString(I18N.locale, { month: "short", day: "numeric", timeZone: "UTC" });
  // nov3g: vertical bars (thin, wide gaps) — player's own points per category, 0–1,000 each.
  const card = h("section", { class: "score-graph" + (anim ? " anim" : ""), "aria-label": tr("Today's points by category") },
    h("p", { class: "sg-date" }, tr("Today's scores · ") + dt),
    h("div", { class: "sg-card" },
      h("h3", {}, tr("Points by category")),
      h("ul", { class: "sg-cols" }, CATS.map((c, i) => { const v = Math.max(0, Math.min(1000, scores[i] || 0));
        return h("li", { "aria-label": c.name + ": " + fmt(scores[i] || 0) },
          h("b", { class: "sg-v", "aria-hidden": "true" }, fmt(scores[i] || 0)),
          h("span", { class: "sg-track", "aria-hidden": "true" }, h("span", { class: "sg-bar", style: "--h:" + (v / 10) + "%;--d:" + (i * 90) + "ms" })),
          h("span", { class: "sg-nm", "aria-hidden": "true" }, c.name)); })),
      h("div", { class: "sg-total" }, h("span", {}, tr("Total")), h("b", {}, fmt(tot)))));
  if (anim) requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add("in")));
  return card;
}
function home() {
  document.body.classList.remove("in-game");
  $(".result-modal")?.remove();
  session = null; onKey = null; clearScreenTimers();
  app.innerHTML = ""; app.classList.remove("enter"); void app.offsetWidth; app.classList.add("enter");
  const s = loadToday();
  const done = s && s.scores.length === 5;
  const stats = store.get("dg-stats", { played: 0, best: 0, streak: 0, last: null });
  const day = dayIndex();
  const wg = wordGameFor(day);
  app.append(
    h("div", { class: "hero" },
      h("div", { class: "logo" }, "DAILY", h("span", {}, "DOSE")),
      h("p", { class: "tag" }, h("b", {}, tr("5")), tr(" categories."), h("span", { class: "sep", "aria-hidden": "true" }, "•"), h("b", {}, tr("1")), tr(" shot a day."), h("span", { class: "sep", "aria-hidden": "true" }, "•"), h("b", {}, tr("5,000")), tr(" points on the line.")),
      h("p", { class: "date" }, new Date(day * 864e5).toLocaleDateString(I18N.locale, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }) + " · Clash #" + gameNumber(day))),
    I18N.toggleVisible() ? h("div", { class: "lang-toggle", role: "group", "aria-label": tr("Language") }, ["en", "es"].map(l =>
      h("button", { type: "button", class: "lang-btn" + (LANG === l ? " on" : ""), "aria-pressed": String(LANG === l), lang: l,
        onclick: () => { if (LANG !== l) { I18N.set(l); location.reload(); } } }, l === "en" ? "English" : "Español"))) : null,
    h("ol", { class: "path" }, CATS.map((c, i) => {
      const sc = s && s.scores[i];
      const state = sc != null ? "done" : (s ? s.scores.length : 0) === i ? "next" : "locked";
      return h("li", { class: "step " + state },
        h("span", { class: "num" }, sc != null ? "✓" : i + 1),
        h("span", { class: "ic" }, ic(c.icon, c.img)),
        h("span", { class: "nm" }, h("b", {}, c.name), h("small", {}, c.id === "word" ? c.sub + tr(" · Today: ") + wg.name : c.sub)),
        h("span", { class: "pts" }, sc != null ? fmt(sc) : state === "locked" ? "🔒" : "1,000"));
    })),
    done
      ? h("div", { class: "cta" }, h("p", {}, tr("You've finished today's Clash: "), h("b", {}, fmt(s.scores.reduce((a, b) => a + b, 0)) + " / 5,000")),
          scoreGraph(s.scores, day),
          h("button", { class: "btn primary big", "data-action": "view-results", onclick: () => { session = newSession(false); results(); } }, tr("View results")),
          h("p", { class: "muted", id: "countdown" }))
      : h("div", { class: "cta" }, h("button", { class: "btn primary big" + (s && s.scores.length ? " long" : ""), onclick: () => { session = newSession(false); runNext(); } }, s && s.scores.length ? tr("Continue the Clash") : tr("Start the Clash")),
          h("p", { class: "muted", id: "countdown" })),
    h("details", { class: "rules" }, h("summary", {}, tr("How it works")),
      h("ul", {},
        h("li", {}, tr("Same challenge for everyone, new every day at midnight US Eastern (New York) time.")),
        h("li", {}, tr("Fixed order: World Rush → Time Warp → MVP → Word Nerd → Brain Teaser.")),
        h("li", {}, tr("Each category is worth up to 1,000 points. No speed bonuses — accuracy wins.")),
        h("li", {}, tr("Finish a category to unlock the next. No skipping or replays.")),
        h("li", {}, tr("Word Nerd rotates daily between Unscramble, Word Bridge, Clusters, Imposter and Anagram Rush.")))),
    h("button", { class: "btn ghost", onclick: () => { session = newSession(true); runNext(); } }, "🎯 " + tr("Practice mode (doesn't count)")),
    h("div", { class: "stats" },
      h("div", {}, h("b", {}, stats.played), h("small", {}, tr("Played"))),
      h("div", {}, h("b", {}, fmt(stats.best)), h("small", {}, tr("Best"))),
      h("div", {}, h("b", {}, stats.streak), h("small", {}, tr("Streak")))),
    h("p", { class: "fine" }, tr("Beta prototype · scores saved on this device only. Leaderboards, friends and prize pools coming later. "), h("a", { href: "credits.html" }, tr("Credits & licenses"))));
  const cd = () => {
    const el = $("#countdown"); if (!el) return;
    if (dayIndex() !== day) return home(); // new day: re-render
    const t = Math.floor(msToReset() / 1000);
    el.textContent = tr(done ? tr("Next Clash in ") : tr("Resets in ")) + [t / 3600, t % 3600 / 60, t % 60].map(x => String(Math.floor(x)).padStart(2, "0")).join(":");
  };
  cd(); cdInterval = setInterval(cd, 1000);
}

// Saves a category score immediately (before the score screen is shown). One-shot per category.
function commitCat(score, detail) {
  if (session.inProgress == null) return;
  session.scores.push(Math.round(Math.max(0, Math.min(1000, score))));
  session.details.push(detail || "");
  delete session.inProgress; delete session.partial; delete session.partialCat;
  save(); session.lastCat = session.scores[session.scores.length - 1]; liveTotal(); session.lastCat = null;
  if (session.scores.length >= 5) fieldNoteFinish();
}
const WG_SECS = { flip: 60, bridge: 60, conn: 90, odd: 60, anag: 60 };
function catIntro(i, start) {
  const c = CATS[i];
  if (i === 3) {
    const wg = wordGameFor(session.day);
    const body = screen(c.icon + " " + c.name, tr("Rotates daily · today's format below"));
    body.append(h("div", { class: "wg-intro" },
      h("small", { class: "wg-intro__label" }, tr("Today's word game")),
      h("div", { class: "wg-intro__name" }, wg.name),
      h("p", { class: "wg-intro__sub" }, wg.sub),
      h("div", { class: "wg-intro__chips" }, h("span", { class: "wg-chip" }, "⏱ " + tr("{0} seconds", WG_SECS[wg.id])), h("span", { class: "wg-chip" }, tr("Up to 1,000 pts"))),
      h("div", { class: "wg-intro__how" }, h("b", {}, tr("How it works")), introText("word"))));
    nextBtn(actionBar(body), tr("Start {0}", wg.name), () => { session.inProgress = i; session.partial = 0; session.partialCat = i; save(); start(); });
    return;
  }
  const body = screen(c.icon + " " + c.name, i === 3 ? tr("Today's word game: {0} — {1}", wordGameFor(session.day).name, wordGameFor(session.day).sub) : c.desc);
  body.append(h("div", { class: "intro" }, h("div", { class: "big-ic" }, ic(c.icon, c.img)), h("p", {}, tr("Worth up to "), h("b", {}, tr("1,000 points")), "."), introText(c.id)));
  nextBtn(body, tr("Start {0}", i === 3 ? wordGameFor(session.day).name : c.name), () => { session.inProgress = i; session.partial = 0; session.partialCat = i; save(); start(); });
}
function introText(id) {
  const t = {
    world: tr("Drop a pin as close as you can to two cities (up to 450 pts each — 0 at 4,000 km+), then answer one geography question (100 pts). Spin the globe to put the ✛ on your guess, then hit Lock in. 45 seconds per pin."),
    history: tr("Drag the picture cards into chronological order, earliest first (top on phones, left on wider screens). Round 1: 4 events in 45s (400 pts). Round 2: 5 events in 45s (600 pts). Partial credit for every correctly ordered pair."),
    sports: tr("Three questions of rising difficulty: 250, 350, then 400 points. Matching and ordering questions give partial credit for each one you get right."),
    word: { flip: tr("Unscramble 6 medium–hard words using the hint (definition, synonym, antonym or riddle). Tap letters to spell; correct answers auto-advance. First 4 words 150 pts, last 2 worth 200. 60 seconds."),
      bridge: tr("Find the middle word that finishes the first word and starts the second, e.g. SUN _ HOUSE → LIGHT (sunlight, lighthouse). It is NOT a word that blends both meanings. 6 puzzles: the first 4 are worth 150 pts, the last 2 are worth 200. 60 seconds."),
      conn: tr("Sort 9 words into 3 groups of 3. Groups are worth 300, 300 and 400. Three wrong guesses ends the round. 90 seconds."),
      odd: tr("8 sets of four words — tap the one that doesn't belong. 4 medium (100 pts) then 4 hard (150 pts). 60 seconds."),
      anag: (window.Answers && Answers.anagramMode(session.key) === "eased"
        ? tr("Make as many 3–6 letter words as you can from 6 letters in 60 seconds. 3 letters = 10, 4 = 30, 5 = 70, 6 = 150. A full 1,000 takes about 80% of the common-word points. No penalty for wrong guesses.")
        : window.Answers && Answers.anagramStrict(session.key)
        ? tr("Make as many 3–6 letter words as you can from 6 letters in 60 seconds. 3 letters = 10, 4 = 30, 5 = 70, 6 = 150. A full 1,000 takes about 92.5% of the common-word points. No penalty for wrong guesses.")
        : tr("Make as many 3–6 letter words as you can from 6 letters in 60 seconds. 3 letters = 10, 4 = 25, 5 = 50, 6 = 100. No penalty for wrong guesses.")) },
    think: tr("Two puzzles worth 400 and 600 points, {0} seconds each. You get ONE submission each — think before you lock it in.", THINK_SECS)
  }[id];
  return h("p", { class: "muted" }, typeof t === "string" ? t : t[wordGameFor(session.day).id]);
}
function runNext() {
  const i = session.scores.length;
  if (i >= 5) return results();
  fieldNotePlay();
  const go = [worldRush, history, sports, wordChallenge, thinkFast][i];
  catIntro(i, go);
}
function catDone(body, score, detail) {
  commitCat(score, detail);
  const b = h("b", {}, "0"), quip = h("p", { class: "quip", style: "visibility:hidden" }, catQuip(score, session.scores.length - 1));
  body.append(h("div", { class: "cat-score" }, h("small", {}, tr("Category score")), b, h("small", {}, "/ 1,000"), quip)); // quip hidden until the count-up lands so a Perfect 1000 never shows next to a mid-count number
  countUp(b, score, 900, () => { quip.style.visibility = ""; quip.classList.add("quip-in"); });
  if (session.scores.length >= 5) { setTimeout(() => { if (body.isConnected && session && session.scores.length >= 5) resultsPopup(); }, 500); }
  nextBtn(body, session.scores.length >= 5 ? tr("See final results") : tr("Next: {0} →", CATS[session.scores.length].name), runNext);
}

// ---------- maps ----------
// Spinnable orthographic globe (d3-geo + topojson-client + world-atlas / Natural Earth). No labels, no tiles.
function globeMap(el, onPick) {
  const d3 = window.d3, topo = window.WORLD_ATLAS_110M;
  const land = window.topojson.feature(topo, topo.objects.land);
  const borders = window.topojson.mesh(topo, topo.objects.countries, (a, b) => a !== b);
  const grat = d3.geoGraticule10(), sphere = { type: "Sphere" };
  const cv = h("canvas", { class: "globe", tabindex: "0", role: "application",
    "aria-label": "Globe. Drag or use arrow keys to spin, plus and minus to zoom, Enter to drop a pin at the centre crosshair." });
  el.append(cv, h("div", { class: "zbtns" },
    h("button", { type: "button", "aria-label": "Zoom in", onclick: () => zoomBy(1.4) }, "+"),
    h("button", { type: "button", "aria-label": "Zoom out", onclick: () => zoomBy(1 / 1.4) }, "−")));
  const ctx = cv.getContext("2d");
  const gl = window.BCGlobeGL ? window.BCGlobeGL(el, cv, () => req()) : null; // realistic WebGL layer (globe-gl.js); null → flat fallback
  const proj = d3.geoOrthographic().clipAngle(90).precision(0.6).rotate([-20, -20, 0]);
  const path = d3.geoPath(proj, ctx);
  let W = 0, H = 0, dpr = 1, base = 1, k = 1, K_MIN = 0.9, K_MAX = 24; // 24× lets small island groups (e.g. Hawaii) fill the screen
  let guess = null, target = null, locked = false, focusX = false, touched = false, raf = 0, vel = [0, 0], anim = null;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  // Flat vector style (no relief/shading/gradients): blue ocean, green land, darker-green borders (Luke's palette, Oct 27).
  const C = { sea: "#2F7DE1", land: "#5DBB63", border: "#3E8E46", coast: "#3E8E46", grat: "rgba(255,255,255,0.12)",
    guess: "#F2C230", target: "#E8582A", arc: "#FFFFFF", rim: "#1F2C7A", ring: "#1F2C7A" };
  function size() {
    // inner box (excludes the border) so the canvas fills the map exactly — no dark strips at the edges
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, el.clientWidth); H = Math.max(1, el.clientHeight);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + "px"; cv.style.height = H + "px";
    if (gl) gl.size(W, H, dpr);
    base = globeBase(W, H); proj.translate([W / 2, H / 2]).scale(base * k); draw();
  }
  const visible = p => d3.geoDistance([p.lon, p.lat], [-proj.rotate()[0], -proj.rotate()[1]]) < Math.PI / 2 - 1e-3;
  function dot(p, col, r) {
    if (!visible(p)) return; const [x, y] = proj([p.lon, p.lat]);
    ctx.beginPath(); ctx.arc(x, y, r + 3, 0, 7); ctx.fillStyle = "#FFF6E8"; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = col; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = C.ring; ctx.stroke();
  }
  function draw() {
    raf = 0; if (W < 2 || H < 2) return; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const [cx, cy] = proj.translate(), R = proj.scale();
    if (gl && gl.ready) { gl.draw(proj); // atmosphere glow + optional crisp white borders over the imagery
      const g = ctx.createRadialGradient(cx, cy, R * 0.98, cx, cy, R * 1.09); g.addColorStop(0, "rgba(90,160,255,0.55)"); g.addColorStop(1, "rgba(90,160,255,0)");
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.09, 0, 2 * Math.PI); ctx.moveTo(cx + R * 0.995, cy); ctx.arc(cx, cy, R * 0.995, 0, 2 * Math.PI); ctx.fillStyle = g; ctx.fill("evenodd");
      if (window.BCCoast) window.BCCoast(ctx, path, proj, k, land, W, H, req);
      if (window.MAP_BORDERS) { ctx.beginPath(); path(borders); ctx.lineWidth = 0.8; ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.stroke(); }
    } else { if (gl) gl.draw(proj);
    ctx.beginPath(); path(sphere); ctx.fillStyle = C.sea; ctx.fill();
    ctx.beginPath(); path(grat); ctx.lineWidth = 0.7; ctx.strokeStyle = C.grat; ctx.stroke();
    ctx.beginPath(); path(land); ctx.fillStyle = C.land; ctx.fill(); ctx.lineWidth = 0.8; ctx.strokeStyle = C.coast; ctx.stroke();
    ctx.beginPath(); path(borders); ctx.lineWidth = 0.7; ctx.strokeStyle = C.border; ctx.stroke();
    ctx.beginPath(); path(sphere); ctx.lineWidth = 2; ctx.strokeStyle = C.rim; ctx.stroke(); }
    if (guess && target) { ctx.beginPath(); path({ type: "LineString", coordinates: [[guess.lon, guess.lat], [target.lon, target.lat]] });
      ctx.setLineDash([7, 6]); ctx.lineWidth = 3; ctx.strokeStyle = C.arc; ctx.stroke(); ctx.setLineDash([]); }
    if (target) dot(target, C.target, 7);
    if (guess) dot(guess, C.guess, 6.5);
    if (!locked && (focusX || !guess)) { // aim crosshair: always visible until a pin is dropped (Lock in with no pin drops here)
      const xh = (w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(cx - 14, cy); ctx.lineTo(cx - 4, cy); ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + 14, cy);
        ctx.moveTo(cx, cy - 14); ctx.lineTo(cx, cy - 4); ctx.moveTo(cx, cy + 4); ctx.lineTo(cx, cy + 14); ctx.stroke(); };
      xh(4.5, "rgba(255,255,255,.9)"); xh(2, "#E8582A"); }
  }
  const req = () => { if (!raf) raf = requestAnimationFrame(draw); };
  function rotateBy(dx, dy) { // pixels → degrees, slower when zoomed in
    // Nov 1: was 90/scale (~0.6°/px on phones + inertia → 100°+ per short drag / pole flips). Now ~0.25°/px,
    // per-event step capped, latitude tilt clamped to ±70° so the globe never flips over a pole.
    // Nov 3b: 0.45°/px at default zoom on every screen (400px ≈ 180°). No per-event cap: coarse mouse events
    // (100px+ each) were being clipped to 20°, so a 400px drag only turned ~20-40°. Tilt stays clamped to ±70°.
    // nov3e: 0.45°/px horiz, 0.3°/px vert (400px ≈ 180°). clientX deltas are already screen px (the globe is never CSS-zoomed).
    const r = proj.rotate(), ddx = dx * 0.45 / k, ddy = dy * 0.3 / k; // strictly per event, no inertia
    proj.rotate([r[0] + ddx, Math.max(-70, Math.min(70, r[1] - ddy)), 0]); req();
  }
  function zoomBy(f, ax, ay) { // optional anchor (canvas px) stays under the finger/cursor
    const a = ax != null && Math.hypot(ax - proj.translate()[0], ay - proj.translate()[1]) < proj.scale() ? proj.invert([ax, ay]) : null;
    k = Math.max(K_MIN, Math.min(K_MAX, k * f)); proj.scale(base * k);
    for (let i = 0; a && i < 3; i++) { const b = proj.invert([ax, ay]); if (!b || !isFinite(b[0])) break; const r = proj.rotate();
      proj.rotate([r[0] + (((b[0] - a[0]) + 540) % 360 - 180), Math.max(-89, Math.min(89, r[1] + b[1] - a[1])), 0]); }
    if (gl) gl.zoom(k); req(); }
  // Pointer handling: one pointer spins (tap = drop pin), two pointers pinch.
  const pts = new Map(); let start = null, last = null, pinch0 = 0, k0 = 1, moved = false, lastT = 0;
  const TAP_PX = 7;
  cv.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    stopAnim(); vel = [0, 0];
    if (pts.size === 1) { start = last = [e.clientX, e.clientY]; moved = false; lastT = performance.now(); }
    else if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); k0 = k; moved = true; }
  });
  cv.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size >= 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch0 > 0) { const rc = cv.getBoundingClientRect(); zoomBy(k0 * d / pinch0 / k, (a[0] + b[0]) / 2 - rc.left, (a[1] + b[1]) / 2 - rc.top); } return; }
    if (!start) return;
    if (!moved && Math.hypot(e.clientX - start[0], e.clientY - start[1]) > TAP_PX) moved = true;
    if (!moved) return;
    const dx = e.clientX - last[0], dy = e.clientY - last[1], now = performance.now(), dt = Math.max(8, now - lastT);
    touched = true; rotateBy(dx, dy); last = [e.clientX, e.clientY]; lastT = now;
  });
  const end = e => {
    if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
    if (pts.size === 1) { const p = [...pts.values()][0]; start = last = p; pinch0 = 0; moved = true; return; } // finishing a pinch never drops a pin
    if (pts.size) return;
    if (e.type === "pointerup" && !moved && start) tapAt(e.clientX, e.clientY);
    start = null;
  };
  cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
  function stopAnim() { if (anim) cancelAnimationFrame(anim); anim = null; }
  cv.addEventListener("wheel", e => { e.preventDefault(); const rc = cv.getBoundingClientRect(); zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX - rc.left, e.clientY - rc.top); }, { passive: false });
  function pickAt(x, y) { // canvas-local px → exact lat/lng; ignores clicks off the disc
    const [cx, cy] = proj.translate(); if (Math.hypot(x - cx, y - cy) > proj.scale()) return;
    const ll = proj.invert([x, y]); if (!ll || !isFinite(ll[0]) || !isFinite(ll[1])) return;
    guess = { lat: ll[1], lon: ((ll[0] + 540) % 360) - 180 }; req(); onPick(guess);
  }
  let tap0 = null; // double-tap = zoom 2.5× at that point (the first tap's pin stays; still needs Lock in)
  function tapAt(clientX, clientY) { const r = cv.getBoundingClientRect(), x = clientX - r.left, y = clientY - r.top, now = performance.now();
    if (tap0 && now - tap0[2] < 320 && Math.hypot(x - tap0[0], y - tap0[1]) < 30) { tap0 = null; zoomBy(2.5, x, y); return; }
    tap0 = [x, y, now]; if (locked) return; pickAt(x, y); }
  cv.addEventListener("keydown", e => {
    const s = 12, m = { ArrowLeft: [s, 0], ArrowRight: [-s, 0], ArrowUp: [0, s], ArrowDown: [0, -s] }[e.key];
    if (m) { e.preventDefault(); rotateBy(m[0] * proj.scale() / 90 * 0.25, m[1] * proj.scale() / 90 * 0.25); }
    else if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomBy(1.25); }
    else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomBy(0.8); }
    else if ((e.key === "Enter" || e.key === " ") && !locked) { e.preventDefault(); pickAt(W / 2, H / 2); }
  });
  cv.addEventListener("focus", () => { focusX = cv.matches(":focus-visible"); req(); });
  cv.addEventListener("blur", () => { focusX = false; req(); });
  const ro = window.ResizeObserver ? new ResizeObserver(() => size()) : null; ro ? ro.observe(el) : window.addEventListener("resize", size);
  requestAnimationFrame(size);
  function flyTo(rot, kk, ms = 900) {
    stopAnim(); const r0 = proj.rotate(), ka = k, t0 = performance.now();
    let dl = rot[0] - r0[0]; dl = ((dl + 540) % 360) - 180;
    const step = now => { const t = Math.min(1, (now - t0) / ms), e = t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      proj.rotate([r0[0] + dl * e, r0[1] + (rot[1] - r0[1]) * e, 0]); k = ka + (kk - ka) * e; proj.scale(base * k); draw();
      anim = t < 1 ? requestAnimationFrame(step) : null; };
    anim = requestAnimationFrame(step);
  }
  const api = { reveal(t, g) {
    locked = true; target = t; cv.setAttribute("aria-label", "Globe showing the answer: " + t.name);
    let c = [t.lon, t.lat], kk = Math.max(k, 1.6);
    if (g) { c = d3.geoInterpolate([g.lon, g.lat], [t.lon, t.lat])(0.5);
      const half = d3.geoDistance([g.lon, g.lat], [t.lon, t.lat]) / 2; // both points within ~70% of the radius
      kk = Math.max(K_MIN, Math.min(4, 0.7 / Math.max(Math.sin(Math.min(half, Math.PI / 2 - 0.05)), 0.12))); if (half > 1.2) kk = K_MIN; }
    flyTo([-c[0], -c[1]], kk);
  },
    aim() { if (!locked && !guess) pickAt(W / 2, H / 2); return guess; }, touched: () => touched,
    // test hooks
    _proj: proj, _draw: draw, _gl: () => !!(gl && gl.ready), _state: () => ({ k, rotate: proj.rotate(), guess, target }) };
  el._globe = api;
  return api;
}
// Offline fallback (used only if the globe scripts fail to load): neon SVG map with zoom buttons.
function svgMap(el, onPick) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  let vb = [0, 0, 1000, 500];
  svg.setAttribute("class", "map");
  svg.innerHTML = `<rect x="-500" y="-500" width="2000" height="1500" class="sea"/><path class="land" d="${window.LAND_PATH}"/><g class="marks"></g>`;
  const setVB = () => svg.setAttribute("viewBox", vb.join(" "));
  setVB();
  const zoom = f => { const cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2; vb[2] = Math.min(1000, Math.max(80, vb[2] * f)); vb[3] = vb[2] / 2; vb[0] = cx - vb[2] / 2; vb[1] = cy - vb[3] / 2; setVB(); };
  el.append(svg, h("div", { class: "zbtns" }, h("button", { onclick: () => zoom(0.6) }, "+"), h("button", { onclick: () => zoom(1 / 0.6) }, "−")));
  const marks = svg.querySelector(".marks");
  const toXY = p => [(p.lon + 180) / 360 * 1000, (90 - p.lat) / 180 * 500];
  const r = () => vb[2] / 120;
  const draw = (p, cls) => { const [x, y] = toXY(p); const c = document.createElementNS(NS, "circle"); c.setAttribute("cx", x); c.setAttribute("cy", y); c.setAttribute("r", r()); c.setAttribute("class", "spin " + cls); marks.append(c); };
  let locked = false, down = null;
  svg.addEventListener("pointerdown", e => { down = { x: e.clientX, y: e.clientY, vb: vb.slice() }; svg.setPointerCapture(e.pointerId); });
  svg.addEventListener("pointermove", e => { if (!down) return; const k = vb[2] / svg.clientWidth; vb[0] = down.vb[0] - (e.clientX - down.x) * k; vb[1] = down.vb[1] - (e.clientY - down.y) * k; setVB(); });
  svg.addEventListener("pointerup", e => {
    const moved = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6; down = null;
    if (moved || locked) return;
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const g = { lon: Math.max(-180, Math.min(180, p.x / 1000 * 360 - 180)), lat: Math.max(-90, Math.min(90, 90 - p.y / 500 * 180)) };
    marks.innerHTML = ""; draw(g, "guess"); onPick(g);
  });
  return { reveal(t, g) { locked = true; draw(t, "target"); if (g) { const [x1, y1] = toXY(g), [x2, y2] = toXY(t); const l = document.createElementNS(NS, "line"); Object.entries({ x1, y1, x2, y2, class: "dist" }).forEach(([k, v]) => l.setAttribute(k, v)); marks.prepend(l); } } };
}

// ---------- 1. World Rush ----------
function haversine(a, b) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const pinPoints = d => Math.round(450 * Math.max(0, 1 - d / 4000));
window.DGScore = Object.freeze({ haversine, pinPoints }); // pure scoring helpers (read-only, for tests)
function worldRush() {
  const set = session.set.worldRush;
  let total = 0, step = 0; const log = [];
  const doPin = () => {
    const target = set.pins[step];
    const body = screen("🌎 " + tr("World Rush"), tr("Pin {0} of 2 · up to 450 pts", step + 1));
    body.classList.add("wr-body");
    body.append(h("p", { class: "prompt wr-prompt" }, tr("Where is "), h("b", { class: "hl" }, target.name), tr("?")));
    const mapEl = h("div", { class: "lmap" });
    const zhint = h("div", { class: "map-hint", "aria-hidden": "true" }, tr("Spin to put the ✛ on your guess, then Lock in"));
    const wrap = h("div", { class: "map-wrap" }, mapEl, zhint,
      h("a", { class: "map-credit", href: "credits.html", target: "_blank", rel: "noopener" }, "Map data: Natural Earth · Imagery: NASA Blue Marble"));
    body.append(wrap);
    const hideHint = () => zhint.classList.add("gone");
    ["pointerdown", "wheel", "touchstart", "keydown"].forEach(ev => wrap.addEventListener(ev, hideHint, { once: true, passive: true }));
    let guess = null, locked = false, api;
    const bar = actionBar(body);
    const btn = h("button", { class: "btn primary big", disabled: true, onclick: () => submit() }, tr("📍 Lock in pin"));
    bar.append(btn);
    const onPick = p => { if (locked) return; guess = p; btn.disabled = false; hideHint(); };
    api = window.d3 && window.d3.geoOrthographic && window.topojson && window.WORLD_ATLAS_110M ? globeMap(mapEl, onPick) : svgMap(mapEl, onPick);
    if (api.aim) btn.disabled = false; // globe: Lock in with no pin drops it at the aim crosshair
    const timer = Timer(TBD.pin, () => submit(true), body.parentNode.querySelector(".game-head"));
    function submit(timedOut) {
      if (locked) return;
      // Aim fallback: player spun the globe (or pressed Lock in) without tapping → pin at the crosshair.
      if (!guess && api.aim && (!timedOut || api.touched())) api.aim();
      locked = true; timer.stop(); btn.remove();
      let pts = 0, msg;
      if (guess) {
        const d = haversine(guess, target); pts = pinPoints(d);
        msg = `${fmt(d)} km away → +${pts}`;
      } else msg = "Time's up — no pin placed → +0";
      api.reveal(target, guess);
      total += pts; log.push(pts); track(total);
      feedback(bar, pts > 300 ? true : pts > 0 ? null : false, msg);
      step++;
      nextBtn(bar, step < 2 ? tr("Next pin →") : (set.pair ? tr("Next question →") : tr("Geography Q →")), step < 2 ? doPin : doThird);
    }
  };
  const doThird = () => { if (set.pair) doPair(); else doMC(); };
  const doPair = () => {
    const q = set.pair && set.pair.type ? set.pair : Object.assign({ type: "pair" }, set.pair || {});
    const body = screen("🌎 " + tr("World Rush"), tr("{0} · {1} pts", pairLabel(q.prompt || "Pair"), 100));
    pairQuestion(body, q, 100, 8, pts => { total += pts; track(total); log.push(pts); catDone(body, total, log.join("/")); });
  };
  const doMC = () => {
    const body = screen("🌎 " + tr("World Rush"), tr("Geography question · 100 pts"));
    mcQuestion(body, withFlag(set.mc.q, set.mc.img), set.mc.optionImgs ? set.mc.options.map((o, k) => ic(o, set.mc.optionImgs[k], "flag")) : set.mc.options, set.mc.a, 100, TBD.mc, pts => { total += pts; track(total); log.push(pts); catDone(body, total, log.join("/")); });
  };
  doPin();
}
function mcQuestion(body, q, options, answer, value, seconds, done, visual, pinLast) {
  if (visual) body.append(visual instanceof Node && visual.classList && visual.classList.contains("tf-svg") ? visual : h("div", { class: "visual" }, visual));
  body.append(h("p", { class: "prompt" }, q));
  let over = false;
  // order[pos] = original index. pinLast (optional index, e.g. an illusion's "They're equal") stays last, the rest seeded-shuffled.
  let order = seededOrder(options.length, session.key + "|" + qText(q));
  if (pinLast != null && pinLast >= 0) order = order.filter(i => i !== pinLast).concat(pinLast);
  const opts = h("div", { class: "options" }, order.map(i => h("button", { class: "opt", onclick: () => choose(i) }, options[i])));
  body.append(opts);
  const skipBar = ensureSkipBar(body, () => choose(-2));
  const timer = seconds ? Timer(seconds, () => choose(-1), body.parentNode.querySelector(".game-head")) : null;
  function choose(i) {
    if (over) return; over = true; timer && timer.stop();
    skipBar.querySelector(".skip-btn")?.remove();
    [...opts.children].forEach((b, pos) => { const j = order[pos]; b.disabled = true; if (j === answer) b.classList.add("right"); else if (j === i) b.classList.add("wrong"); });
    const ok = i === answer;
    feedback(body, ok, ok ? tr("Correct! +{0}", value) : i === -2 ? "Skipped. +0" : i < 0 ? tr("Time's up. +0") : tr("Not quite. +0"));
    done(ok ? value : 0);
  }
}

// ---------- 2. History Timeline ----------
function history() {
  const set = session.set.history;
  const rounds = [{ ...set.r1, secs: 45, max: 400 }, { ...set.r2, secs: 45, max: 600 }];
  let total = 0, r = 0; const log = [];
  const R = rng(session.day * 7 + 3);
  const kindOf = rd => {
    const t = rd && rd.type;
    if (t === "pair" || t === "reveal" || t === "mc") return t;
    if (t === "text" || t === "typed") return "text";
    return "timeline";
  };
  const play = () => {
    const rd = rounds[r];
    const kind = kindOf(rd);
    if (kind !== "timeline") return playRound(rd, kind);
    const body = screen("📜 " + tr("Time Warp"), tr("Round {0} of 2 · {1} · up to {2} pts", r + 1, rd.theme, rd.max));
    // Instructions follow the layout: stacked cards (≤560px, same breakpoint as the CSS) read top → bottom, a row reads left → right.
    body.append(h("p", { class: "prompt" }, tr("Drag the cards into order — "),
      h("b", { class: "tl-dir tl-dir--v" }, tr("earliest at top, latest at bottom")), h("b", { class: "tl-dir tl-dir--h" }, tr("earliest on the left, latest on the right")), "."));
    let order = shuffle(rd.events.map((_, i) => i), R);
    if (order.every((v, i) => v === i)) order.reverse();
    const line = h("div", { class: "timeline" });
    const axis = h("div", { class: "axis" }, h("span", {}, tr("Earliest ←")), h("span", {}, tr("→ Latest")));
    const vaxis = h("div", { class: "vaxis", "aria-hidden": "true" }, h("span", {}, tr("Earliest")), h("i", {}), h("span", {}, tr("Latest")));
    body.append(h("p", { class: "drag-hint" }, tr("☝️ Touch and drag to reorder")), axis, h("div", { class: "tl-wrap" }, vaxis, line));
    let locked = false;
    const render = () => {
      line.innerHTML = "";
      order.forEach((ev, pos) => {
        const e = rd.events[ev];
        const card = h("div", { class: "card", "data-ev": ev, tabindex: locked ? -1 : 0, "aria-label": e[1] + (locked ? "" : " — drag to reorder, or use arrow keys") },
          h("div", { class: "pic" }, ic(e[0], e[3]), locked && window.histCredit && window.histCredit(e[3]) ? h("a", { class: "pcr", href: window.histCredit(e[3]), target: "_blank", rel: "noopener", "aria-label": "Photo credit", title: "Photo credit" }, "i") : null), h("div", { class: "cap" }, e[1]),
          locked ? h("div", { class: "yr" }, e[2] < 0 ? -e[2] + " BC" : e[2]) : h("div", { class: "grip", "aria-hidden": "true" }, "⠿"));
        if (!locked) enableDrag(card);
        line.append(card);
      });
      line.classList.toggle("locked", locked);
    };
    const syncOrder = () => { order = [...line.children].filter(c => c.dataset.ev != null).map(c => +c.dataset.ev); };
    // Pointer-event drag: floating preview follows the finger/mouse, a placeholder shows the drop slot,
    // the page auto-scrolls near the edges and never scrolls under the drag (touch-action: none on cards).
    function enableDrag(card) {
      card.addEventListener("keydown", e => {
        const k = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key]; if (!k || locked) return;
        e.preventDefault(); const kids = [...line.children], i = kids.indexOf(card), j = i + k; if (j < 0 || j >= kids.length) return;
        if (k < 0) line.insertBefore(card, kids[j]); else line.insertBefore(kids[j], card); syncOrder(); card.focus();
      });
      card.addEventListener("pointerdown", e => {
        if (locked || (e.pointerType === "mouse" && e.button !== 0)) return;
        e.preventDefault();
        const r0 = card.getBoundingClientRect(), dx = e.clientX - r0.left, dy = e.clientY - r0.top;
        const vertical = getComputedStyle(line).gridAutoFlow.startsWith("row");
        const ghost = card.cloneNode(true); ghost.classList.add("drag-ghost"); ghost.removeAttribute("tabindex");
        const gz = parseFloat(line.style.zoom) || 1; // the fit pass may have zoomed the timeline; keep the ghost the same visual size
        Object.assign(ghost.style, { zoom: gz === 1 ? "" : String(gz), width: r0.width / gz + "px", height: r0.height / gz + "px", left: r0.left / gz + "px", top: r0.top / gz + "px" });
        // The touched card itself is never moved in the DOM while dragging (iOS Safari cancels the touch stream
        // when its target is re-inserted, which made drags stop after one slot). A placeholder moves instead.
        const slot = card.cloneNode(true); slot.removeAttribute("tabindex"); slot.removeAttribute("data-ev"); slot.classList.add("drag-placeholder");
        line.insertBefore(slot, card); card.classList.add("drag-src");
        document.body.append(ghost); document.body.classList.add("is-dragging");
        const noScroll = ev => ev.preventDefault(); window.addEventListener("touchmove", noScroll, { passive: false });
        try { card.setPointerCapture(e.pointerId); } catch {}
        let lastY = e.clientY, lastX = e.clientX, raf = 0;
        const place = () => {
          // Drop into the SLOT nearest the dragged card's centre (where the user sees it), not "before the
          // first card whose midpoint is below the finger": that rule tied exactly on the top slot, and a card
          // grabbed near its bottom edge and lined up with the top slot landed in slot 2.
          const vis = [...line.children].filter(c => c !== card), others = vis.filter(c => c !== slot);
          const gy = lastY - dy + r0.height / 2, gx = lastX - dx + r0.width / 2;
          let best = 0, bd = Infinity;
          vis.forEach((o, k) => { const r = o.getBoundingClientRect(), dd = vertical ? Math.abs(gy - (r.top + r.height / 2)) : Math.abs(gx - (r.left + r.width / 2)); if (dd < bd) { bd = dd; best = k; } });
          const before = others[best] || null;
          let nx = slot.nextSibling; if (nx === card) nx = card.nextSibling;
          if (nx !== before) line.insertBefore(slot, before);
        };
        const scroller = () => {
          const edge = 70, H = window.innerHeight; let v = 0;
          if (lastY < edge) v = -Math.ceil((edge - lastY) / 6); else if (lastY > H - edge) v = Math.ceil((lastY - (H - edge)) / 6);
          if (v) { window.scrollBy(0, v); place(); }
          raf = requestAnimationFrame(scroller);
        };
        raf = requestAnimationFrame(scroller);
        const mv = ev => { if (ev.pointerId !== e.pointerId) return; lastX = ev.clientX; lastY = ev.clientY; ghost.style.left = (lastX - dx) / gz + "px"; ghost.style.top = (lastY - dy) / gz + "px"; place(); };
        const up = ev => {
          if (ev && ev.pointerId !== e.pointerId) return;
          cancelAnimationFrame(raf);
          window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
          window.removeEventListener("touchmove", noScroll);
          line.insertBefore(card, slot); slot.remove(); card.classList.remove("drag-src");
          ghost.remove(); document.body.classList.remove("is-dragging");
          syncOrder();
        };
        // listen on window: re-inserting the card in the DOM drops pointer capture
        window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
      });
    }
    render();
    const bar = actionBar(body);
    const btn = h("button", { class: "btn primary big", onclick: () => submit(false) }, tr("Lock in order"));
    bar.append(btn);
    const timer = Timer(rd.secs, () => submit(false), body.parentNode.querySelector(".game-head"));
    function submit(skipped) {
      if (locked) return; locked = true; timer.stop(); btn.remove(); bar.querySelector(".skip-btn")?.remove();
      let good = 0, pairs = 0;
      for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) { pairs++; if (rd.events[order[i]][2] < rd.events[order[j]][2]) good++; }
      const pts = skipped ? 0 : Math.round(rd.max * good / pairs);
      render();
      const correct = rd.events.map((e, i) => i).sort((a, b) => rd.events[a][2] - rd.events[b][2]);
      body.append(h("p", { class: "muted" }, tr("Correct order: ") + correct.map(i => rd.events[i][1] + " (" + (rd.events[i][2] < 0 ? -rd.events[i][2] + " BC" : rd.events[i][2]) + ")").join(" → ")));
      feedback(body, skipped ? false : good === pairs ? true : good > pairs / 2 ? null : false, skipped ? tr("Skipped. +0") : tr("{0}/{1} pairs in order → {2} pts", good, pairs, pts));
      total += pts; log.push(pts); track(total); r++;
      body.querySelector(".drag-hint")?.remove(); body.querySelector(".prompt")?.remove(); body.classList.add("tw-done");
      // Results read top-down: reveal + feedback first, then the bar (its auto top margin no longer leaves a big gap on desktop).
      if (r < 2) { bar.classList.add("after-result"); body.append(bar); nextBtn(bar, tr("Round 2 →"), play); } else { bar.remove(); catDone(body, total, log.join("/")); }
    }
  };
  function playRound(rd, kind) {
    const label = rd.theme || (kind === "mc" || kind === "text" ? pairLabel(rd.q) : pairLabel(rd.prompt)) || "";
    const body = screen("📜 " + tr("Time Warp"), tr("Round {0} of 2 · {1} · up to {2} pts", r + 1, label, rd.max));
    const after = pts => {
      total += pts; log.push(pts); track(total); r++;
      if (r < 2) nextBtn(actionBar(body), tr("Round 2 →"), play);
      else catDone(body, total, log.join("/"));
    };
    if (kind === "pair") pairQuestion(body, rd, rd.max, 8, after);
    else if (kind === "reveal") revealQuestion(body, rd, rd.max, rd.secs, after);
    else if (kind === "mc") mcQuestion(body, rd.q, rd.options, rd.a, rd.max, rd.secs, after);
    else textQuestion(body, rd.q, rd.answers || [], rd.max, rd.secs, after, null, (rd.answers && rd.answers[0]) || "", rd.explain, rd, { timeoutZero: true });
  }
  play();
}

// ---------- 3. Sports IQ ----------
// Sports IQ is timed like every other section: SPORTS_SECONDS per question, same Timer bar component.
// Time out = 0 points and the question ends, exactly like the World Rush multiple-choice timeout.
const SPORTS_SECONDS = 45;
// Partial credit: order questions score round(value × items in the correct position / n).
const PARTIAL_ORDER = true;
// Stat-chart / sports SVG: assets/<img>.svg (same pattern as Think Fast illusions); placeholder if missing.
// Art lookup goes through the icon map first (assets/icons.js maps sports-dN-qM → a shared
// sport-*.svg). Missing/broken art is removed cleanly — never a "coming soon" placeholder.
const artSrc = id => (id && window.ICONS && window.ICONS[id]) || (id && /^[a-z0-9-]+$/i.test(id) ? "assets/" + id + ".svg" : null);
function artBox(cls, id, alt, keepPlaceholder) {
  const box = h("div", { class: cls }), own = id && /^[a-z0-9-]+$/i.test(id) ? "assets/" + id + ".svg" : null, src = own || artSrc(id);
  if (!src) { box.hidden = true; return box; }
  const img = h("img", { src, alt, decoding: "async" });
  // Prefer the question's own art file; fall back to the generic icons.js mapping only if it 404s.
  img.addEventListener("error", () => { const fb = artSrc(id); if (fb && img.getAttribute("src") !== fb) { img.src = fb; return; } if (keepPlaceholder) { img.remove(); box.classList.add("art-missing"); box.append(h("p", { class: "art-missing-msg", role: "img", "aria-label": alt }, "Image unavailable — answer from the question text")); scheduleFit(); return; } box.remove(); scheduleFit(); }); img.addEventListener("load", scheduleFit);
  box.append(img); return box;
}
function sportsArt(id, alt) { return artBox("tf-svg sports-chart", id, alt || "Sports illustration"); }
// Q3 team-path: order nicknames first→last. Vertical chips, drag / ▲▼ / tap-to-swap / arrow keys.
function localizedText(value) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const en = typeof value.en === "string" ? value.en.trim() : "";
    const es = typeof value.es === "string" ? value.es.trim() : "";
    return LANG === "es" ? (es || en) : (en || es);
  }
  return "";
}
function questionHint(q, fallback) {
  const custom = localizedText(q && q.hint);
  if (custom) return typeof q.hint === "string" ? tr(custom) : custom;
  return tr(fallback);
}
function pairLabel(value) {
  if (value && typeof value === "object") return localizedText(value);
  return value == null ? "" : tr(String(value));
}
function pairRoundSeconds(q, fallback) {
  const n = Number(q && q.roundSeconds);
  if (Number.isFinite(n) && n > 0) return n;
  const f = Number(fallback);
  return Number.isFinite(f) && f > 0 ? f : 8;
}
function flipPack(raw) {
  const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.words) ? raw.words : []);
  const n = Number(raw && raw.timerSec);
  return { list, secs: Number.isFinite(n) && n > 0 ? n : 60 };
}
function orderQuestion(body, q, value, seconds, done) {
  const items = (q.items || []).slice();
  const n = items.length;
  body.append(h("p", { class: "prompt" }, q.q));
  const orderFallback = "Drag into order — first team at the top. Or use ▲▼, tap two chips to swap, or arrow keys.";
  body.append(h("p", { class: "drag-hint" }, questionHint(q, orderFallback)));
  let order = seededOrder(n, session.key + "|order|" + q.q);
  if (order.every((v, i) => v === i)) order = seededOrder(n, session.key + "|order|" + q.q + "|reshuffle");
  if (order.every((v, i) => v === i) && n > 1) { const o = order.slice(); [o[0], o[n - 1]] = [o[n - 1], o[0]]; order = o; }
  let locked = false, sel = null;
  const live = h("div", { class: "sr-only", "aria-live": "polite", "aria-atomic": "true" });
  const customHint = localizedText(q && q.hint);
  const list = h("div", { class: "order-list", role: "list", "aria-label": customHint ? questionHint(q, orderFallback) : "Teams in career order, first at top" });
  const wrap = h("div", { class: "order-wrap" },
    h("div", { class: "order-ends" }, h("span", { class: "order-end" }, tr("FIRST")), h("span", { class: "order-end" }, tr("LAST"))),
    list);
  body.append(wrap, live);
  const announce = t => { live.className = "sr-only"; live.textContent = ""; void live.offsetWidth; live.textContent = t; };
  const sync = () => { order = [...list.children].map(c => +c.dataset.idx); };
  const move = (from, to) => {
    if (locked || to < 0 || to >= n || from === to) return;
    const o = order.slice(); const [x] = o.splice(from, 1); o.splice(to, 0, x); order = o; sel = to; render();
    announce(items[order[to]] + " moved to position " + (to + 1) + " of " + n);
  };
  const swap = (a, b) => {
    if (locked || a === b) return;
    const o = order.slice(); [o[a], o[b]] = [o[b], o[a]]; order = o; sel = b; render();
    announce("Swapped " + items[order[a]] + " and " + items[order[b]]);
  };
  function enableDrag(chip) {
    chip.addEventListener("pointerdown", e => {
      if (locked || e.target.closest(".order-move") || (e.pointerType === "mouse" && e.button !== 0)) return;
      e.preventDefault();
      const r0 = chip.getBoundingClientRect(), dy = e.clientY - r0.top;
      const ghost = chip.cloneNode(true); ghost.classList.add("drag-ghost"); ghost.removeAttribute("tabindex");
      const gz = parseFloat(list.style.zoom) || 1;
      Object.assign(ghost.style, { zoom: gz === 1 ? "" : String(gz), width: r0.width / gz + "px", height: r0.height / gz + "px", left: r0.left / gz + "px", top: r0.top / gz + "px" });
      document.body.append(ghost); chip.classList.add("drag-placeholder"); document.body.classList.add("is-dragging");
      try { chip.setPointerCapture(e.pointerId); } catch {}
      let lastY = e.clientY, raf = 0, moved = false;
      const place = () => {
        const others = [...list.children].filter(c => c !== chip);
        let before = null;
        const gy = lastY - dy + r0.height / 2; // dragged chip's centre, not the finger
        for (const o of others) { const r = o.getBoundingClientRect(); if (gy < r.top + r.height / 2) { before = o; break; } }
        if (before ? chip.nextSibling !== before : list.lastChild !== chip) { list.insertBefore(chip, before); moved = true; }
      };
      const scroller = () => {
        const edge = 70, H = window.innerHeight; let v = 0;
        if (lastY < edge) v = -Math.ceil((edge - lastY) / 6); else if (lastY > H - edge) v = Math.ceil((lastY - (H - edge)) / 6);
        if (v) { window.scrollBy(0, v); place(); }
        raf = requestAnimationFrame(scroller);
      };
      raf = requestAnimationFrame(scroller);
      const mv = ev => { if (ev.pointerId !== e.pointerId) return; lastY = ev.clientY; ghost.style.top = (lastY - dy) / gz + "px"; place(); };
      const up = ev => {
        if (ev && ev.pointerId !== e.pointerId) return;
        cancelAnimationFrame(raf);
        window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
        ghost.remove(); chip.classList.remove("drag-placeholder"); document.body.classList.remove("is-dragging");
        sync();
        if (!moved) {
          // tap-to-swap: first tap selects, second tap swaps
          const i = +chip.dataset.pos;
          if (sel == null) { sel = i; chip.classList.add("order-sel"); announce(items[order[i]] + " selected. Tap another team to swap."); }
          else if (sel === i) { sel = null; chip.classList.remove("order-sel"); announce("Selection cleared."); }
          else { const a = sel; sel = null; swap(a, i); }
        } else { sel = +chip.dataset.pos; announce(items[order[sel]] + " moved to position " + (sel + 1) + " of " + n); render(); }
      };
      window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
    });
  }
  const render = () => {
    list.innerHTML = "";
    order.forEach((idx, pos) => {
      const label = items[idx];
      const up = h("button", { class: "order-move", type: "button", "aria-label": "Move " + label + " up", disabled: locked || pos === 0, onclick: e => { e.stopPropagation(); move(pos, pos - 1); } }, "▲");
      const dn = h("button", { class: "order-move", type: "button", "aria-label": "Move " + label + " down", disabled: locked || pos === n - 1, onclick: e => { e.stopPropagation(); move(pos, pos + 1); } }, "▼");
      const chip = h("div", { class: "order-chip" + (sel === pos ? " order-sel" : ""), role: "listitem", tabindex: locked ? -1 : 0,
        "data-idx": idx, "data-pos": pos, "aria-label": label + ", position " + (pos + 1) + " of " + n },
        h("div", { class: "order-moves" }, up, dn),
        h("span", { class: "order-label" }, label));
      if (!locked) {
        enableDrag(chip);
        chip.addEventListener("keydown", e => {
          if (locked) return;
          if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); move(pos, pos - 1); }
          else if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); move(pos, pos + 1); }
          else if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            if (sel == null) { sel = pos; render(); announce(label + " selected. Choose another team to swap."); }
            else if (sel === pos) { sel = null; render(); announce("Selection cleared."); }
            else { const a = sel; sel = null; swap(a, pos); }
          }
        });
      }
      list.append(chip);
    });
    scheduleFit();
  };
  const bar = actionBar(body);
  const btn = h("button", { class: "btn primary big", onclick: () => submit(false) }, tr("Lock in order"));
  bar.append(btn);
  const timer = seconds ? Timer(seconds, () => submit(false, true), body.parentNode.querySelector(".game-head")) : null;
  function submit(skipped, timedOut) {
    if (locked) return; locked = true; timer && timer.stop(); btn.remove(); bar.querySelector(".skip-btn")?.remove(); if (!bar.children.length) bar.remove(); // empty bar left a big gap above the reveal
    body.querySelector(".drag-hint")?.remove();
    sel = null;
    let good = 0; const pairs = n;
    for (let i = 0; i < n; i++) if (order[i] === i) good++;
    const exact = order.every((v, i) => v === i);
    let pts = 0;
    if (!skipped && !timedOut) pts = PARTIAL_ORDER && pairs ? Math.round(value * good / pairs) : (exact ? value : 0);
    // Reveal: mark chips, show correct order + explain
    [...list.children].forEach((chip, pos) => {
      chip.classList.remove("order-sel");
      chip.classList.add(order[pos] === pos ? "order-right" : "order-wrong");
      chip.querySelectorAll("button").forEach(b => { b.disabled = true; });
      chip.tabIndex = -1;
    });
    body.append(h("p", { class: "muted order-reveal" }, tr("Correct order: ") + items.join(" → ")));
    if (q.explain) body.append(h("p", { class: "muted tf-explain" }, q.explain));
    const msg = skipped ? "Skipped. +0" : timedOut ? "Time's up. +0" : exact ? tr("Correct! +{0}", pts) : PARTIAL_ORDER ? tr("{0}/{1} in the right spot → +{2}", good, pairs, pts) : tr("Not quite. +0");
    feedback(body, exact && !skipped && !timedOut ? true : pts > 0 ? null : false, msg);
    done(pts);
  }
  render();
}

// Partial credit: match-records scores round(value × correct/n), e.g. 1/4 of 400 = 100.
const PARTIAL_MATCH = true;
// Q3 bracket: who-beat-who — single matchup (two nicknames). Spec allows a "small bracket"; samples are one fork.
function bracketQuestion(body, q, value, seconds, done) {
  const teams = (q.matchup || q.options || []).slice(0, 2);
  const answer = q.a;
  if (q.round) body.append(h("p", { class: "bracket-round" }, q.round));
  body.append(h("p", { class: "prompt" }, q.q));
  let over = false, picked = null;
  const fork = h("div", { class: "bracket-fork", "aria-hidden": "true" },
    h("span", { class: "bracket-arm" }), h("span", { class: "bracket-stem" }), h("span", { class: "bracket-cup" }));
  const live = h("div", { class: "sr-only", "aria-live": "polite" });
  const opts = h("div", { class: "bracket-opts", role: "group", "aria-label": tr("Pick the winner") });
  // Seeded display shuffle (same pattern as mcQuestion) so a content a:0 is not always the first chip.
  // order[pos] = original index; picked/answer stay in ORIGINAL indices, so scoring is unchanged.
  const order = seededOrder(teams.length, session.key + "|bracket|" + qText(q.q));
  order.forEach((i, pos) => { const name = teams[i];
    const b = h("button", { class: "bracket-chip", type: "button", "aria-pressed": "false",
      onclick: () => { if (over || b.dataset.dragged) return; picked = i; [...opts.children].forEach((c, j) => { c.classList.toggle("bracket-sel", j === pos); c.setAttribute("aria-pressed", j === pos ? "true" : "false"); }); live.textContent = name + " selected"; lockBtn.disabled = false; } }, name);
    // Drag-to-slot (Nov 1): dragging a chip onto the bracket/cup (drop slot) picks it exactly like a tap.
    let dd = null;
    b.addEventListener("pointerdown", e => { if (over || (e.pointerType === "mouse" && e.button !== 0)) return; dd = { x: e.clientX, y: e.clientY, g: null, id: e.pointerId }; });
    b.addEventListener("pointermove", e => { if (!dd || dd.id !== e.pointerId) return;
      if (!dd.g && Math.hypot(e.clientX - dd.x, e.clientY - dd.y) > 8) { try { b.setPointerCapture(e.pointerId); } catch (_) {}
        dd.g = b.cloneNode(true); Object.assign(dd.g.style, { position: "fixed", pointerEvents: "none", zIndex: 999, opacity: ".9", width: b.offsetWidth + "px" }); document.body.append(dd.g); document.body.classList.add("is-dragging"); }
      if (dd.g) { e.preventDefault(); dd.g.style.left = (e.clientX - b.offsetWidth / 2) + "px"; dd.g.style.top = (e.clientY - b.offsetHeight / 2) + "px";
        // Generous invisible drop zone: full option-row width, from 80px above the bracket down to just above the chips.
        const r = fork.getBoundingClientRect(), o = opts.getBoundingClientRect(), L = Math.min(r.left, o.left) - 24, R = Math.max(r.right, o.right) + 24;
        const hit = e.clientX >= L && e.clientX <= R && e.clientY >= r.top - 80 && e.clientY <= Math.max(r.bottom + 24, o.top - 6); fork.classList.toggle("bracket-drop-hot", hit); dd.hit = hit; } });
    const dEnd = e => { if (!dd || dd.id !== e.pointerId) return; const d = dd; dd = null;
      if (d.g) { d.g.remove(); document.body.classList.remove("is-dragging"); fork.classList.remove("bracket-drop-hot"); if (d.hit && e.type === "pointerup") b.click();
        b.dataset.dragged = "1"; setTimeout(() => delete b.dataset.dragged, 0); } };
    b.addEventListener("pointerup", dEnd); b.addEventListener("pointercancel", dEnd);
    b.style.touchAction = "none";
    opts.append(b);
  });
  body.append(fork, opts, live);
  const bar = actionBar(body);
  const lockBtn = h("button", { class: "btn primary big", type: "button", disabled: true, onclick: () => submit(false) }, tr("Lock in"));
  bar.append(lockBtn);
  const timer = seconds ? Timer(seconds, () => submit(false, true), body.parentNode.querySelector(".game-head")) : null;
  function submit(skipped, timedOut) {
    if (over) return; over = true; timer && timer.stop(); lockBtn.remove(); bar.querySelector(".skip-btn")?.remove();
    const choice = skipped || timedOut ? -1 : picked;
    const ok = choice === answer;
    [...opts.children].forEach((b, pos) => {
      const i = order[pos]; b.disabled = true;
      if (i === answer) b.classList.add("right");
      else if (i === choice) b.classList.add("wrong");
    });
    if (q.explain) body.append(h("p", { class: "muted tf-explain" }, q.explain));
    const pts = ok ? value : 0;
    feedback(body, ok, skipped ? "Skipped. +0" : timedOut ? "Time's up. +0" : ok ? tr("Correct! +{0}", value) : tr("Not quite. +0"));
    done(pts);
  }
  scheduleFit();
}
// Q3 match-records: 4×4 tap-to-pair (primary) + drag bonus. Right column seed-shuffled; left stays author order.
function matchQuestion(body, q, value, seconds, done) {
  const left = (q.left || []).slice();
  const right = (q.right || []).slice();
  const pairs = (q.pairs || []).slice(); // pairs[i] = right-index for left[i]
  const n = left.length;
  body.append(h("p", { class: "prompt" }, q.q));
  body.append(h("p", { class: "drag-hint" }, questionHint(q, "Tap a name, then a record to pair them. Tap a pair again to unpair. Drag also works.")));
  const live = h("div", { class: "sr-only", "aria-live": "polite", "aria-atomic": "true" });
  // rightOrder[pos] = original right index at display position
  let rightOrder = seededOrder(n, session.key + "|match-r|" + q.q);
  if (rightOrder.every((v, i) => v === i) && n > 1) rightOrder = seededOrder(n, session.key + "|match-r|" + q.q + "|reshuffle");
  // pairing: leftIdx -> rightIdx (original), or null
  const link = Array(n).fill(null);
  let selLeft = null, locked = false;
  const COLORS = ["#00f0ff", "#ff2fd6", "#ffe600", "#39ff88"];
  const board = h("div", { class: "match-board" });
  const leftCol = h("div", { class: "match-col match-left", role: "list", "aria-label": "Athletes" });
  const rightCol = h("div", { class: "match-col match-right", role: "list", "aria-label": "Records" });
  board.append(leftCol, rightCol);
  body.append(board, live);
  const announce = t => { live.className = "sr-only"; live.textContent = ""; void live.offsetWidth; live.textContent = t; };
  const pairedRight = () => new Set(link.filter(x => x != null));
  const render = () => {
    leftCol.innerHTML = ""; rightCol.innerHTML = "";
    left.forEach((name, i) => {
      const paired = link[i] != null;
      const color = paired ? COLORS[i % COLORS.length] : "";
      const num = paired ? String(i + 1) : "";
      const b = h("button", { class: "match-chip" + (selLeft === i ? " match-sel" : "") + (paired ? " match-paired" : ""),
        type: "button", role: "listitem", "aria-pressed": selLeft === i || paired ? "true" : "false",
        "data-left": i, disabled: locked,
        style: paired ? `--match-c:${color}` : "",
        onclick: () => onLeft(i) },
        paired ? h("span", { class: "match-num", "aria-hidden": "true" }, num) : null,
        h("span", { class: "match-label" }, name));
      if (!locked) enableDragLeft(b, i);
      leftCol.append(b);
    });
    rightOrder.forEach((ri, pos) => {
      const owner = link.findIndex(x => x === ri);
      const paired = owner >= 0;
      const color = paired ? COLORS[owner % COLORS.length] : "";
      const b = h("button", { class: "match-chip" + (paired ? " match-paired" : ""),
        type: "button", role: "listitem", "aria-pressed": paired ? "true" : "false",
        "data-right": ri, disabled: locked,
        style: paired ? `--match-c:${color}` : "",
        onclick: () => onRight(ri) },
        paired ? h("span", { class: "match-num", "aria-hidden": "true" }, String(owner + 1)) : null,
        h("span", { class: "match-label" }, right[ri]));
      rightCol.append(b);
    });
    lockBtn.disabled = locked || link.some(x => x == null);
    scheduleFit();
  };
  const clearPairForRight = ri => { const i = link.findIndex(x => x === ri); if (i >= 0) link[i] = null; };
  const onLeft = i => {
    if (locked) return;
    if (link[i] != null) { // unpair
      const ri = link[i]; link[i] = null; selLeft = null;
      announce("Unpaired " + left[i] + " from " + right[ri]); render(); return;
    }
    if (selLeft === i) { selLeft = null; announce("Selection cleared."); render(); return; }
    selLeft = i; announce(left[i] + " selected. Tap a record to pair."); render();
  };
  const onRight = ri => {
    if (locked) return;
    const owner = link.findIndex(x => x === ri);
    if (selLeft == null) {
      if (owner >= 0) { link[owner] = null; announce("Unpaired " + left[owner]); render(); }
      return;
    }
    clearPairForRight(ri);
    link[selLeft] = ri;
    announce("Paired " + left[selLeft] + " with " + right[ri]);
    selLeft = null; render();
  };
  function enableDragLeft(chip, i) {
    chip.addEventListener("pointerdown", e => {
      if (locked || e.pointerType === "mouse" && e.button !== 0) return;
      if (e.target.closest && false) return;
      e.preventDefault();
      const r0 = chip.getBoundingClientRect(), dy = e.clientY - r0.top, dx = e.clientX - r0.left;
      const ghost = chip.cloneNode(true); ghost.classList.add("drag-ghost"); ghost.removeAttribute("tabindex");
      Object.assign(ghost.style, { width: r0.width + "px", height: r0.height + "px", left: r0.left + "px", top: r0.top + "px" });
      document.body.append(ghost); document.body.classList.add("is-dragging");
      try { chip.setPointerCapture(e.pointerId); } catch {}
      let lastX = e.clientX, lastY = e.clientY, moved = false;
      const mv = ev => { if (ev.pointerId !== e.pointerId) return; lastX = ev.clientX; lastY = ev.clientY; ghost.style.left = (lastX - dx) + "px"; ghost.style.top = (lastY - dy) + "px"; if (Math.hypot(lastX - e.clientX, lastY - e.clientY) > 6) moved = true; };
      const up = ev => {
        if (ev && ev.pointerId !== e.pointerId) return;
        window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
        ghost.remove(); document.body.classList.remove("is-dragging");
        if (moved) {
          const el = document.elementFromPoint(lastX, lastY);
          const tgt = el && el.closest && el.closest(".match-right .match-chip");
          if (tgt && tgt.dataset.right != null) { selLeft = i; onRight(+tgt.dataset.right); }
        } else onLeft(i);
      };
      window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
    });
  }
  const bar = actionBar(body);
  const lockBtn = h("button", { class: "btn primary big", type: "button", disabled: true, onclick: () => submit(false) }, tr("Lock in pairs"));
  bar.append(lockBtn);
  const timer = seconds ? Timer(seconds, () => submit(false, true), body.parentNode.querySelector(".game-head")) : null;
  function submit(skipped, timedOut) {
    if (locked) return; locked = true; timer && timer.stop(); lockBtn.remove(); bar.querySelector(".skip-btn")?.remove();
    body.querySelector(".drag-hint")?.remove();
    selLeft = null;
    let good = 0;
    for (let i = 0; i < n; i++) if (link[i] === pairs[i]) good++;
    const exact = good === n;
    let pts = 0;
    if (!skipped && !timedOut) pts = PARTIAL_MATCH && n ? Math.round(value * good / n) : (exact ? value : 0);
    // reveal
    left.forEach((_, i) => {
      const chip = leftCol.querySelector(`[data-left="${i}"]`);
      if (!chip) return;
      chip.disabled = true;
      chip.classList.toggle("order-right", link[i] === pairs[i]);
      chip.classList.toggle("order-wrong", link[i] !== pairs[i]);
    });
    rightOrder.forEach(ri => {
      const chip = rightCol.querySelector(`[data-right="${ri}"]`);
      if (!chip) return;
      chip.disabled = true;
      const owner = pairs.indexOf(ri);
      const linked = link[owner];
      chip.classList.toggle("order-right", linked === ri);
      chip.classList.toggle("order-wrong", linked !== ri);
    });
    // show correct mapping
    const lines = left.map((name, i) => name + " → " + right[pairs[i]]);
    body.append(h("p", { class: "muted order-reveal" }, tr("Correct: ") + lines.join("; ")));
    if (q.explain) body.append(h("p", { class: "muted tf-explain" }, q.explain));
    const msg = skipped ? "Skipped. +0" : timedOut ? "Time's up. +0" : exact ? tr("Correct! +{0}", pts) : PARTIAL_MATCH ? tr("{0}/{1} correct → +{2}", good, n, pts) : tr("Not quite. +0");
    feedback(body, exact && !skipped && !timedOut ? true : pts > 0 ? null : false, msg);
    done(pts);
  }
  render();
}
// Pair, reveal, and slider. Usable from any category that plays a question object.
// Timeout scores only what was locked: tapped pair rounds, a correct reveal, or a locked slider. Otherwise 0.
// No Skip: these use the category timer, same as Sports and Brain Teaser.
function typeHead(body) { return body.parentNode && body.parentNode.querySelector(".game-head"); }
function typeDiff(q) {
  const name = { easy: "Easy", medium: "Medium", hard: "Hard" }[q && q.difficulty];
  return name ? h("p", { class: "q-diff" }, tr(name)) : null;
}
function typeExplain(body, q) { if (q && q.explain) body.append(h("p", { class: "muted tf-explain" }, q.explain)); }
function playNewType(body, q, value, seconds, done, pairFallback) {
  if (!q || (q.type !== "pair" && q.type !== "reveal" && q.type !== "slider")) return false;
  if (q.type === "pair") pairQuestion(body, q, value, pairFallback != null ? pairFallback : 8, done);
  else if (q.type === "reveal") revealQuestion(body, q, value, seconds, done);
  else sliderQuestion(body, q, value, seconds, done);
  return true;
}
function pairQuestion(body, q, value, seconds, done) {
  const rounds = Array.isArray(q.rounds) ? q.rounds : [];
  const n = rounds.length;
  let i = 0, correct = 0, over = false, awaiting = false;
  body.append(typeDiff(q));
  body.append(h("p", { class: "prompt" }, pairLabel(q.prompt || "")));
  const meta = h("p", { class: "pair-meta" });
  const cards = h("div", { class: "pair-cards" });
  const note = h("p", { class: "pair-note" });
  body.append(meta, cards, note);
  const bar = actionBar(body);
  const roundSecs = pairRoundSeconds(q, seconds);
  let roundTimer = null;
  function stopRoundTimer() {
    if (roundTimer) { roundTimer.stop(); roundTimer = null; }
    const head = typeHead(body);
    if (head) head.querySelectorAll(".timer").forEach(n => n.remove());
  }
  function armRoundTimer() {
    stopRoundTimer();
    if (roundSecs > 0) roundTimer = Timer(roundSecs, () => lockRound(null, true), typeHead(body));
  }
  const scoreNow = () => { if (session) { session.inProgress = session.inProgress == null ? 0 : session.inProgress; track(window.Answers.pairScore(correct, n, value)); } };
  function render() {
    const r = rounds[i];
    awaiting = false;
    meta.textContent = tr("Round {0} of {1}", i + 1, n);
    note.textContent = "";
    note.className = "pair-note";
    cards.replaceChildren();
    bar.replaceChildren();
    ["left", "right"].forEach(side => {
      const b = h("button", { type: "button", class: "opt pair-card", "data-side": side }, pairLabel(r[side]));
      b.onclick = () => lockRound(side, false);
      cards.append(b);
    });
    armRoundTimer();
  }
  function lockRound(side, timedOut) {
    if (over || awaiting) return;
    awaiting = true;
    stopRoundTimer();
    const r = rounds[i];
    const ok = !timedOut && side === r.correct;
    if (ok) correct++;
    [...cards.children].forEach(b => {
      b.disabled = true;
      if (b.dataset.side === r.correct) b.classList.add("right");
      else if (!timedOut && b.dataset.side === side) b.classList.add("wrong");
    });
    const revealed = pairLabel(r.note) || tr("Answer: {0}", pairLabel(r[r.correct]));
    note.textContent = timedOut ? tr("Time's up. ") + revealed : (pairLabel(r.note) || (ok ? tr("Correct") : tr("Answer: {0}", pairLabel(r[r.correct]))));
    note.classList.add(ok ? "good" : "bad");
    scoreNow();
    const last = i >= n - 1;
    const b = h("button", { type: "button", class: "btn primary big" }, last ? tr("See score") : tr("Next round →"));
    b.onclick = () => { if (last) finish(false); else { i++; render(); } };
    bar.replaceChildren(b);
  }
  function finish(timedOut) {
    if (over) return;
    over = true;
    stopRoundTimer();
    [...cards.querySelectorAll("button")].forEach(b => { b.disabled = true; });
    bar.replaceChildren();
    const pts = window.Answers.pairScore(correct, n, value);
    const msg = (timedOut ? tr("Time's up. ") : "") + tr("{0} of {1} rounds. +{2}", correct, n, pts);
    feedback(body, pts === value ? true : pts > 0 ? null : false, msg);
    typeExplain(body, q);
    done(pts);
  }
  if (!n) { finish(false); return; }
  render();
}
function revealQuestion(body, q, value, seconds, done) {
  const clues = Array.isArray(q.clues) ? q.clues.slice(0, 3) : [];
  const parts = window.Answers.splitAccept(q.accept);
  const given = [].concat(parts.given, q.given || [], q.exactOnly || []);
  const opts = { aliases: parts.aliases, given, exactOnly: q.exactOnly, q: q.prompt || "", person: q.person };
  let shown = 1, over = false;
  body.append(typeDiff(q));
  body.append(h("p", { class: "prompt" }, q.prompt || ""));
  const list = h("div", { class: "reveal-clues" });
  body.append(list);
  const input = h("input", { class: "txt", placeholder: tr("Type your answer"), autocomplete: "off", autocapitalize: "off", spellcheck: "false", "aria-label": tr("Type your answer") });
  const form = h("form", { class: "answer", onsubmit: e => { e.preventDefault(); submit(); } }, input, h("button", { class: "btn primary", type: "submit" }, tr("Lock in")));
  body.append(form);
  const bar = actionBar(body);
  const next = h("button", { type: "button", class: "btn big" }, tr("Next clue"));
  next.onclick = () => advance();
  bar.append(next);
  const timer = seconds ? Timer(seconds, () => end(0, true), typeHead(body)) : null;
  function draw() {
    list.replaceChildren();
    clues.slice(0, shown).forEach((c, n) => list.append(h("p", { class: "reveal-clue" }, h("b", {}, tr("Clue {0} of {1}", n + 1, clues.length)), " ", c)));
    next.hidden = shown >= clues.length;
  }
  function advance() {
    if (over || shown >= clues.length) return;
    shown++;
    input.value = "";
    draw();
    input.focus();
  }
  function submit() {
    if (over) return;
    if (!input.value.trim()) { input.classList.remove("shake"); void input.offsetWidth; input.classList.add("shake"); return; }
    const ok = window.Answers.checkAnswer(input.value, [q.answer], opts);
    if (ok) return end(shown, false);
    if (shown < clues.length) return advance();
    end(0, false);
  }
  function end(stage, timedOut) {
    if (over) return;
    over = true;
    timer && timer.stop();
    input.disabled = true;
    form.querySelector("button")?.remove();
    next.remove();
    const pts = window.Answers.revealScore(stage, value);
    if (session) { session.inProgress = session.inProgress == null ? 0 : session.inProgress; track(pts); }
    const ans = q.answer || "";
    const msg = timedOut ? tr("Time's up. Answer: {0}. +0", ans) : stage ? tr("Correct on clue {0}. +{1}", stage, pts) : tr("Answer: {0}. +0", ans);
    feedback(body, pts === value ? true : pts > 0 ? null : false, msg);
    typeExplain(body, q);
    done(pts);
  }
  draw();
  setTimeout(() => input.focus(), 50);
}
function sliderSnap(n, min, max, step) {
  const s = step > 0 ? step : 1;
  const clamped = Math.min(max, Math.max(min, n));
  const k = Math.round((clamped - min) / s);
  return Math.min(max, Math.max(min, +(min + k * s).toFixed(6)));
}
function sliderArt(q) {
  if (typeof q.marbles === "number" && window.marbleJar) {
    const jar = window.marbleJar(q.marbles);
    if (!jar) return null;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", jar.jar.view);
    svg.setAttribute("class", "jar-svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", tr("A jar of marbles"));
    const glass = document.createElementNS("http://www.w3.org/2000/svg", "path");
    glass.setAttribute("d", jar.jar.d);
    glass.setAttribute("class", "jar-glass");
    svg.append(glass);
    const colors = ["#E8582A", "#1F2C7A", "#F2C230", "#2E9B57", "#C0262D"];
    jar.pts.forEach((p, i) => {
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("cx", p.x); c.setAttribute("cy", p.y); c.setAttribute("r", jar.r * 0.86);
      c.setAttribute("fill", colors[i % colors.length]);
      svg.append(c);
    });
    return svg;
  }
  if (typeof q.image === "string" && q.image.trim()) return h("img", { class: "slider-photo", src: q.image, alt: "" });
  return null;
}
function sliderQuestion(body, q, value, seconds, done) {
  const min = q.min, max = q.max, step = q.step > 0 ? q.step : 1;
  const tol = q.tolerance == null ? 0 : q.tolerance;
  const percent = q.scale === "percent";
  const perPct = q.per_pct == null ? 20 : q.per_pct;
  let valueNow = window.Answers.sliderStart(min, max, step);
  let over = false;
  const art = sliderArt(q);
  body.append(typeDiff(q));
  body.append(h("p", { class: "prompt" }, q.prompt || ""));
  if (art) body.append(h("div", { class: "slider-art" }, art));
  const unit = q.unit ? h("span", { class: "slider-unit" }, tr(q.unit)) : null;
  const val = h("b", { class: "slider-val" }, String(valueNow));
  const range = h("input", { class: "slider-range", type: "range", min: String(min), max: String(max), step: String(step), value: String(valueNow), "data-answer": String(q.answer), "aria-label": q.prompt || tr("Your answer") });
  const typed = q.typed ? h("input", { class: "txt slider-type", type: "number", inputmode: "numeric", min: String(min), max: String(max), step: String(step), value: String(valueNow), "aria-label": tr("Type a number") }) : null;
  const show = n => {
    if (!Number.isFinite(n)) return;
    valueNow = sliderSnap(n, min, max, step);
    range.value = String(valueNow);
    val.textContent = String(valueNow);
    if (typed && document.activeElement !== typed) typed.value = String(valueNow);
  };
  range.oninput = () => show(+range.value);
  if (typed) typed.oninput = () => { if (typed.value === "" || typed.value === "-") return; show(+typed.value); };
  const nudges = h("div", { class: "nudge-row" }, [-10, -1, 1, 10].map(d => {
    const b = h("button", { type: "button", class: "btn nudge", "aria-label": (d > 0 ? "+" : "") + d }, (d > 0 ? "+" : "") + d);
    b.onclick = () => { if (!over) show(valueNow + d); };
    return b;
  }));
  const hint = percent
    ? tr("Each 1% off costs {0} points.", perPct) + (tol > 0 ? " " + tr("Full points within {0}.", tol) : "")
    : tr("Each 1 off costs {0} points.", q.per_unit) + (tol > 0 ? " " + tr("Full points within {0}.", tol) : "");
  body.append(h("p", { class: "slider-readout" }, val, unit), range, nudges);
  if (typed) body.append(h("label", { class: "slider-type-row" }, tr("Or type a number"), typed));
  body.append(h("p", { class: "muted slider-hint" }, hint));
  const bar = actionBar(body);
  const lock = h("button", { type: "button", class: "btn primary big" }, tr("Lock in"));
  lock.onclick = () => finish(false);
  bar.append(lock);
  const timer = seconds ? Timer(seconds, () => finish(true), typeHead(body)) : null;
  function finish(timedOut) {
    if (over) return;
    over = true;
    timer && timer.stop();
    range.disabled = true;
    if (typed) typed.disabled = true;
    nudges.querySelectorAll("button").forEach(b => { b.disabled = true; });
    lock.remove();
    const guess = timedOut ? null : valueNow;
    const scoreOpts = { scale: q.scale, per_unit: q.per_unit, per_pct: q.per_pct, tolerance: q.tolerance };
    const pts = guess == null ? 0 : window.Answers.sliderScore(guess, q.answer, value, scoreOpts);
    if (session) { session.inProgress = session.inProgress == null ? 0 : session.inProgress; track(pts); }
    const off = guess == null ? null : Math.abs(guess - q.answer);
    const shown = String(q.answer) + (q.unit ? " " + tr(q.unit) : "");
    const pct = guess == null || !q.answer ? null : off / Math.abs(q.answer) * 100;
    const numText = n => Math.abs(n - Math.round(n)) < 1e-6 ? String(Math.round(n)) : String(Math.round(n * 10) / 10);
    let msg;
    if (timedOut) msg = tr("Time's up. Answer: {0}. +0", shown);
    else if (off === 0) msg = tr("Exact. Answer: {0}. +{1}", shown, pts);
    else if (!percent && tol > 0 && off <= tol) msg = tr("Within range. Answer: {0}. +{1}", shown, pts);
    else if (percent && tol > 0 && pct <= tol) msg = tr("Within range. Answer: {0}. +{1}", shown, pts);
    else if (percent) msg = tr("Off by {0}%. +{1}", numText(pct), pts);
    else msg = tr("Off by {0}. Answer: {1}. +{2}", numText(off), shown, pts);
    feedback(body, pts === value ? true : pts > 0 ? null : false, msg);
    typeExplain(body, q);
    done(pts);
  }
}
function runSlotDemo() {
  const demo = window.SLOT_DEMO || {};
  const shot = (location.search.match(/[?&]shot=(world|warp|mc|order|orderhint|match|matchhint|secs|think|emoji|flip)\b/) || [])[1] || "world";
  session.practice = true;
  session.inProgress = shot === "warp" || shot === "mc" || shot === "secs" ? 1 : shot === "world" ? 0 : shot === "think" || shot === "emoji" ? 4 : shot === "flip" ? 3 : 2;
  session.partial = 0;
  session.partialCat = session.inProgress;
  session.scores = shot === "world" ? [] : shot === "warp" || shot === "mc" || shot === "secs" ? [0] : shot === "think" || shot === "emoji" ? [0, 0, 0, 0] : shot === "flip" ? [0, 0, 0] : [0, 0];
  const q = { order: demo.order, orderhint: demo.orderHint, match: demo.match, matchhint: demo.matchHint }[shot];
  if (shot === "world") session.set = Object.assign({}, session.set, { worldRush: demo.world });
  else if (shot === "warp") session.set = Object.assign({}, session.set, { history: demo.history });
  else if (shot === "mc") session.set = Object.assign({}, session.set, { history: demo.historyOther });
  else if (shot === "secs") session.set = Object.assign({}, session.set, { history: { r1: demo.timed, r2: demo.history.r2 } });
  else if (shot === "think") session.set = Object.assign({}, session.set, { thinkFast: [demo.thinkPair, { q: "Type belief.", answers: ["belief"] }] });
  else if (shot === "emoji") session.set = Object.assign({}, session.set, { thinkFast: (window.EMOJI_DEMO || [])[0] });
  else if (shot === "flip") session.set = Object.assign({}, session.set, { wordFlip: demo.flip });
  else session.set = Object.assign({}, session.set, { sports: [q, q, q] });
  if (shot === "warp" || shot === "mc" || shot === "secs") history();
  else if (shot === "world") worldRush();
  else if (shot === "think" || shot === "emoji") thinkFast();
  else if (shot === "flip") wordFlip();
  else sports();
}
function runTypeDemo() {
  const list = (window.TYPE_DEMO || []).slice();
  const shot = (location.search.match(/[?&]shot=(pair|reveal|slider)\b/) || [])[1];
  let i = 0;
  if (shot) { const j = list.findIndex(q => q.type === shot); if (j >= 0) i = j; }
  const ask = () => {
    if (!list.length) return;
    const q = list[i];
    session.demoAt = i;
    session.inProgress = 0;
    session.partial = 0;
    const value = q.points || 300;
    const body = screen("✦ " + tr("Type demo"), tr("Example {0} of {1} · {2} pts", i + 1, list.length, value));
    const next = pts => {
      session.scores.push(pts);
      session.inProgress = null;
      i++;
      if (i < list.length) nextBtn(actionBar(body), tr("Next example →"), ask);
      else {
        session.demoAt = list.length - 1;
        const doneBody = screen(tr("Type demo"), tr("Practice"));
        const total = session.scores.reduce((a, b) => a + b, 0);
        doneBody.append(h("p", { class: "prompt" }, tr("Demo complete")), h("p", { class: "slider-val" }, fmt(total)), h("p", { class: "muted" }, tr("This practice demo is not saved.")));
      }
    };
    if (!playNewType(body, q, value, 45, next)) next(0);
  };
  ask();
}

function sports() {
  const qs = session.set.sports, vals = [250, 350, 400], labels = ["Easy", tr("Medium"), "Hard"];
  let total = 0, i = 0; const log = [];
  const ask = () => {
    const q = qs[i], body = screen("🏆 " + tr("MVP"), tr("Question {0} of 3 · {1} · {2} pts", i + 1, tr(labels[i]), vals[i]));
    const after = pts => { total += pts; track(total); log.push(pts); i++; if (i < 3) nextBtn(actionBar(body), tr("Next question →"), ask); else { // Nov 1: hold on the right/wrong feedback before the score + results popup take over (phone one-tap MC)
        const fb = body.querySelector(".fb"); if (fb && fb.scrollIntoView) fb.scrollIntoView({ block: "nearest", behavior: "smooth" });
        setTimeout(() => { if (body.isConnected) catDone(body, total, log.join("/")); }, 1500); } };
    const t = q.type || "text";
    if (playNewType(body, q, vals[i], SPORTS_SECONDS, after)) { /* pair, reveal, or slider */ }
    else if (t === "order") orderQuestion(body, q, vals[i], SPORTS_SECONDS, after);
    else if (t === "bracket") bracketQuestion(body, q, vals[i], SPORTS_SECONDS, after);
    else if (t === "match") matchQuestion(body, q, vals[i], SPORTS_SECONDS, after);
    else if (t === "guess") guessQuestion(body, q, vals[i], SPORTS_SECONDS, after, { timeoutZero: true });
    else if (t === "mc") mcQuestion(body, q.q, q.options, q.a, vals[i], SPORTS_SECONDS, after, q.img ? sportsArt(q.img, tr("Sports")) : q.visual);
    else if (q.kind === "common-teammate") {
      // Five player clues, one shared teammate. Typed answer, lenient checker with person-name (surname) matching.
      const ans = q.answers || [q.answer], src = Object.assign({}, q, { answers: ans, person: q.person !== false });
      const clues = h("ol", { class: "ct-clues", "aria-label": "Clues" }, ...(q.clues || []).map(c => h("li", {}, c)));
      textQuestion(body, q.q, ans, vals[i], SPORTS_SECONDS, after, clues, ans[0], q.explain, src, { timeoutZero: true });
    }
    else {
      const visKinds = { "stat-chart": "Stat chart", moment: "Memorable moment", "color-swatch": "Team colours", "jersey-number": "Jersey number" };
      const art = q.img ? sportsArt(q.img, visKinds[q.kind] || "Sports art") : q.visual;
      textQuestion(body, q.q, q.answers, vals[i], SPORTS_SECONDS, after, art, q.answers[0], q.explain, q, { timeoutZero: true });
    }
  };
  ask();
}
function textQuestion(body, q, answers, value, seconds, done, visual, display, explain, src, tq) {
  if (visual) body.append(visual instanceof Node && visual.classList && (visual.classList.contains("tf-svg") || visual.classList.contains("ct-clues")) ? visual : h("div", { class: "visual" }, visual));
  body.append(h("p", { class: "prompt" }, q));
  let over = false;
  const input = h("input", { class: "txt", placeholder: tr("Type your answer"), autocomplete: "off", autocapitalize: "off", spellcheck: "false" });
  const form = h("form", { class: "answer", onsubmit: e => { e.preventDefault(); if (input.value.trim()) submit(input.value); } }, input, h("button", { class: "btn primary", type: "submit" }, tr("Lock in")));
  body.append(form); setTimeout(() => input.focus(), 50);
  const skipBar = ensureSkipBar(body, () => submit(null, false, true));
  // tq.timeoutZero (Sports IQ): running out of time scores 0 with "Time's up", like mcQuestion's choose(-1).
  const timeUp = () => tq && tq.timeoutZero ? submit(null, true) : submit(input.value);
  const timer = seconds ? Timer(seconds, timeUp, body.parentNode.querySelector(".game-head")) : null;
  function submit(v, timedOut, skipped) {
    if (over) return; over = true; timer && timer.stop(); input.disabled = true; form.querySelector("button").remove();
    skipBar.querySelector(".skip-btn")?.remove();
    if (skipped) { feedback(body, false, tr("Skipped. Answer: {0}. +0", titleCase(display))); done(0); return; }
    if (timedOut) { feedback(body, false, tr("Time's up. Answer: {0}. +0", titleCase(display))); done(0); return; }
    const ok = window.Answers ? window.Answers.checkAnswer(v || "", answers, { aliases: src && src.aliases, wrong: src && (src.wrong || src.options), noSurname: src && src.noSurname, textOnly: src && src.textOnly, person: src && src.person, given: src && src.given, exactOnly: src && src.exactOnly, q: src && typeof src.q === "string" ? src.q : "" })
      : answers.some(a => norm(a) === norm(v || ""));
    feedback(body, ok, (ok ? tr("Correct! +{0}", value) : tr("Answer: {0}. +0", titleCase(display))) + (explain ? " — " + explain : ""));
    done(ok ? value : 0);
  }
}

// ---------- 4. Word Challenge ----------
function wordChallenge() { ({ flip: wordFlip, bridge: wordBridge, conn: connections, odd: oddOneOut, anag: anagramRush })[wordGameFor(session.day).id](); }

// Accent-insensitive only for this tile word: ARCOÍRIS and ARCOIRIS are the same answer.
// Dictionary anagrams still require the exact tiled letters, so this does not widen other games.
function flipFold(s) { return String(s).normalize("NFD").replace(/\p{M}/gu, "").toUpperCase(); }
function flipAccept(word, guess, dict) {
  const sorted = x => x.split("").sort().join("");
  return guess === word || flipFold(guess) === flipFold(word) || (sorted(guess) === sorted(word) && dict && dict.has(guess));
}
function wordFlip() {
  const packed = flipPack(session.set.wordFlip), list = packed.list, flipSecs = packed.secs, R = rng(session.day);
  const body = screen("📝 Unscramble", "6 words · " + flipSecs + " seconds");
  let i = 0, total = 0, over = false, busy = false, built = [];
  // Any dictionary word using exactly the same letters also counts (e.g. LISTEN for SILENT).
  const dict = new Set(Object.values(window.ANAGRAM_SETS || {}).flatMap(s => s.valid || []).map(w => w.toUpperCase()));
  const hintEl = h("div", { class: "hint" }), slots = h("div", { class: "slots" }), tiles = h("div", { class: "tiles" }), prog = h("div", { class: "prog" });
  const ctrls = h("div", { class: "row" }, h("button", { class: "btn", onclick: () => { if (busy) return; built.pop(); draw(); } }, tr("↩ Undo")), h("button", { class: "btn", onclick: () => { if (busy) return; built = []; draw(); } }, tr("Clear")), skipBtn(() => { if (busy) return; skip(); }, tr("Skip →")));
  const results = [];
  // Skipped words go to the back of the queue and come back while time remains.
  let queue = list.slice(0, 6).map((_, k) => k), cur = 0;
  body.append(prog, hintEl, slots, tiles, ctrls, h("p", { class: "skip-note" }, tr("Skipped words come back at the end if time remains.")));
  let letters = [];
  const val = k => k < 4 ? 150 : 200;
  const load = () => {
    i = queue[0]; const [w] = list[i];
    do letters = shuffle(w.split("").map((c, k) => ({ c, k })), R); while (letters.map(l => l.c).join("") === w);
    built = []; draw();
  };
  const draw = () => {
    const [w, style, hint] = list[i];
    prog.textContent = tr("Word {0}/6 · {1} pts · Score {2}/1,000 pts", i + 1, val(i), fmt(total)) + (queue.length < 6 ? tr(" · {0} left", queue.length) : "");
    hintEl.innerHTML = ""; hintEl.append(h("span", { class: "badge" }, tr(style)), " ", hint);
    slots.innerHTML = ""; w.split("").forEach((_, k) => slots.append(h("span", { class: "slot" + (built[k] != null ? " on" : "") }, built[k] != null ? letters[built[k]].c : "")));
    tiles.innerHTML = ""; letters.forEach((l, k) => tiles.append(h("button", { class: "tile", disabled: built.includes(k), onclick: () => { if (busy) return; built.push(k); draw(); check(); } }, l.c)));
  };
  const check = () => {
    const w = list[i][0];
    if (built.length < w.length) return;
    const guess = built.map(k => letters[k].c).join("");
    busy = true; // block input during the win/shake animation
    if (flipAccept(w, guess, dict)) { total += val(i); track(total); results[i] = true; slots.classList.add("win"); setTimeout(() => { if (!body.isConnected) return; slots.classList.remove("win"); busy = false; advance(); }, 350); }
    else { slots.classList.add("shake"); setTimeout(() => { slots.classList.remove("shake"); busy = false; if (over) return; built = []; draw(); }, 400); }
  };
  const advance = () => { if (over) return; queue.shift(); if (!queue.length) end(); else load(); };
  const skip = () => { if (over) return; results[i] = false; queue.push(queue.shift()); load(); };
  const end = () => {
    if (over) return; over = true; timer.stop(); ctrls.remove(); tiles.remove(); slots.remove(); hintEl.remove(); prog.remove();
    body.append(h("ul", { class: "review" }, list.map(([w], k) => h("li", { class: results[k] ? "ok" : "no" }, (results[k] ? "✓ " : "✗ ") + w))));
    catDone(body, total, "flip");
  };
  onKey = e => {
    if (over) return false;
    if (busy) return /^[a-z]$/i.test(e.key) || e.key === "Backspace" ? undefined : false;
    if (e.key === "Backspace") { built.pop(); draw(); return; }
    const keyFold = flipFold(e.key); if (keyFold.length === 1 && keyFold >= "A" && keyFold <= "Z") { const k = letters.findIndex((l, idx) => flipFold(l.c) === keyFold && !built.includes(idx)); if (k >= 0) { built.push(k); draw(); check(); } return; }
    return false;
  };
  body.append(h("p", { class: "kbd-tip" }, "⌨️ Type letters on your keyboard · Backspace to undo"));
  const timer = Timer(flipSecs, end, body.parentNode.querySelector(".game-head"));
  load();
}

// Listed answers only (slot 2, plus an optional slot 3). Case, punctuation and spaces fold
// through the same norm used everywhere else. A second listed answer may also be typed as
// that puzzle's own left+answer or answer+right compound ("rain check", "drop box").
function bridgeHit(puzzle, raw) {
  const v = norm(raw).toUpperCase().replace(/ /g, "");
  if (!v || !puzzle) return false;
  const answers = puzzle.slice(2).filter(s => typeof s === "string" && s.trim()).map(s => norm(s).toUpperCase().replace(/ /g, ""));
  if (answers.includes(v)) return true;
  if (answers.length < 2) return false;
  const left = norm(puzzle[0]).toUpperCase().replace(/ /g, ""), right = norm(puzzle[1]).toUpperCase().replace(/ /g, "");
  return answers.some(a => v === left + a || v === a + right);
}
function wordBridge() {
  const list = session.set.wordBridge;
  const body = screen("📝 Word Bridge", "6 puzzles · 60 seconds");
  let i = 0, total = 0, over = false, busy = false; const res = [];
  const val = k => k < 4 ? 150 : 200;
  const prog = h("div", { class: "prog" }), puzzle = h("div", { class: "bridge" });
  const input = h("input", { class: "txt", placeholder: tr("Missing word"), autocomplete: "off", autocapitalize: "characters", spellcheck: "false" });
  const form = h("form", { class: "answer", onsubmit: e => { e.preventDefault(); guess(); } }, input, h("div", { class: "answer-row" }, h("button", { class: "btn primary", type: "submit" }, tr("Submit")), skipBtn(() => skipB(), tr("Skip →"))));
  let queue = list.slice(0, 6).map((_, k) => k);
  body.append(prog, puzzle, form, h("p", { class: "skip-note" }, tr("Skipped puzzles come back at the end if time remains.")));
  // Skip sits beside Submit (one row, mid-screen) so it is never under the phone's bottom browser bar.
  const draw = () => { i = queue[0]; const [a, b] = list[i]; prog.textContent = tr("Puzzle {0}/6 · {1} pts · Score {2}/1,000 pts", i + 1, val(i), fmt(total)) + (queue.length < 6 ? tr(" · {0} left", queue.length) : ""); puzzle.innerHTML = ""; puzzle.append(h("span", {}, a), h("span", { class: "gap" }, tr("?")), h("span", {}, b)); input.value = ""; input.focus(); };
  const guess = () => {
    if (over || busy) return; // lock during the win animation: a double Enter must not score twice / skip a puzzle
    if (!norm(input.value).replace(/ /g, "")) return;
    if (bridgeHit(list[i], input.value)) { busy = true; total += val(i); track(total); res[i] = true; puzzle.classList.add("win"); setTimeout(() => { busy = false; if (!body.isConnected) return; puzzle.classList.remove("win"); adv(); }, 300); }
    else { form.classList.add("shake"); setTimeout(() => form.classList.remove("shake"), 400); input.select(); }
  };
  const adv = () => { if (over) return; queue.shift(); if (!queue.length) end(); else draw(); };
  const skipB = () => { if (over || busy) return; res[i] = false; queue.push(queue.shift()); draw(); };
  const end = () => {
    if (over) return; over = true; timer.stop(); form.remove(); puzzle.remove(); prog.remove();
    body.append(h("ul", { class: "review" }, list.map((p, k) => { const [a, b] = p, w = p.slice(2).filter(s => typeof s === "string" && s.trim()).join("/"); return h("li", { class: res[k] ? "ok" : "no" }, `${res[k] ? "✓" : "✗"} ${a} ${w} · ${w} ${b}`); })));
    catDone(body, total, "bridge");
  };
  const timer = Timer(60, end, body.parentNode.querySelector(".game-head"));
  draw();
}

function connections() {
  const set = session.set.connections;
  const body = screen("📝 " + tr("Clusters"), tr("Find 3 groups of 3 · 90 seconds"));
  let words = shuffle(set.groups.flatMap(g => g.words), rng(session.day)), sel = [], found = [], mistakes = 0, total = 0, over = false;
  const solved = h("div", { class: "solved" }), grid = h("div", { class: "grid3" }), info = h("div", { class: "prog" });
  // Secondary controls: small outline pills in their own row under the grid (visibly unlike the word tiles);
  // Submit is the primary action in the bottom bar.
  const ctrls = h("div", { class: "pill-row" },
    h("button", { class: "pill-btn", type: "button", onclick: () => { words = shuffle(words); draw(); } }, h("span", { "aria-hidden": "true" }, "⇄"), " " + tr("Shuffle")),
    h("button", { class: "pill-btn", type: "button", onclick: () => { sel = []; draw(); } }, h("span", { "aria-hidden": "true" }, "✕"), tr(" Deselect")));
  body.append(info, solved, grid, ctrls);
  const subBar = actionBar(body);
  subBar.append(h("button", { class: "btn primary big", id: "csub", onclick: () => submit() }, tr("Submit")), skipBtn(() => end()));
  // Incremental updates: solved groups are appended once (their animation plays once);
  // selecting a word only toggles that tile's class; the grid is rebuilt only when words change.
  const shown = new Set(); let gridKey = "";
  const draw = () => {
    info.innerHTML = ""; info.append(tr("Score {0}/1,000 pts · Mistakes left: ", fmt(total)), h("b", {}, "●".repeat(3 - mistakes) + "○".repeat(mistakes)));
    found.forEach(g => { if (shown.has(g.name)) return; shown.add(g.name); solved.append(h("div", { class: "group g" + set.groups.findIndex(x => x.name === g.name) + (g.pts === 0 ? " missed" : "") }, h("b", {}, g.name + " · " + g.pts), h("span", {}, g.words.join(", ")))); });
    const key = words.join("|");
    if (key !== gridKey) {
      gridKey = key; grid.innerHTML = "";
      words.forEach(w => grid.append(h("button", { class: "wtile", "data-w": w, onclick: () => { if (over) return; if (sel.includes(w)) sel = sel.filter(x => x !== w); else if (sel.length < 3) sel.push(w); draw(); } }, w)));
    }
    [...grid.children].forEach(b => b.classList.toggle("sel", sel.includes(b.dataset.w)));
    const cs = $("#csub"); if (cs) cs.disabled = sel.length !== 3;
  };
  const submit = () => {
    const g = set.groups.find(g => g.words.every(w => sel.includes(w)));
    if (g) { found.push(g); total += g.pts; track(total); words = words.filter(w => !g.words.includes(w)); sel = []; if (found.length === 3) return end(); }
    else { mistakes++; const one = set.groups.some(g => g.words.filter(w => sel.includes(w)).length === 2); grid.classList.add("shake"); setTimeout(() => grid.classList.remove("shake"), 400); if (one) feedbackTmp(tr("One away…")); sel = []; if (mistakes >= 3) return end(); }
    draw();
  };
  const feedbackTmp = t => { const f = feedback(body, null, t); setTimeout(() => f.remove(), 1200); };
  const end = () => {
    if (over) return; over = true; timer.stop(); grid.remove(); ctrls.remove(); subBar.remove();
    found = found.concat(set.groups.filter(g => !found.includes(g)).map(g => Object.assign({}, g, { pts: 0 })));
    draw();
    catDone(body, total, "conn");
  };
  const timer = Timer(90, end, body.parentNode.querySelector(".game-head"));
  draw();
}

function oddOneOut() {
  const list = session.set.oddOneOut;
  const body = screen("📝 " + tr("Imposter"), tr("8 puzzles · 60 seconds"));
  let i = 0, total = 0, over = false; const res = [];
  const val = k => k < 4 ? 100 : 150;
  const prog = h("div", { class: "prog" }), opts = h("div", { class: "options two" });
  const promptEl = h("p", { class: "prompt" }, tr("Which one doesn't belong?"));
  body.append(prog, promptEl, opts);
  const oddBar = actionBar(body); oddBar.append(skipBtn(() => pickIt(-1)));
  let drawnAt = 0;
  const draw = () => {
    drawnAt = performance.now();
    prog.textContent = tr("Puzzle {0}/8 · {1} · {2} pts · Score {3}/1,000 pts", i + 1, tr(i < 4 ? tr("Medium") : tr("Hard")), val(i), fmt(total));
    promptEl.textContent = list[i].prompt || tr("Which one doesn't belong?");
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); // no carried-over highlight
    opts.innerHTML = ""; seededOrder(list[i].words.length, session.key + "|odd|" + list[i].words.join(",")).forEach(k => { const w = list[i].words[k]; opts.append(h("button", { class: "opt", onclick: () => pickIt(k) }, w)); });
  };
  const pickIt = k => { if (over || performance.now() - drawnAt < 300) return; if (k < 0) { res.push(false); i++; if (i >= 8) end(); else draw(); return; } const ok = k === list[i].odd; res.push(ok); if (ok) { total += val(i); track(total); } i++; if (i >= 8) end(); else draw(); };
  const end = () => {
    if (over) return; over = true; timer.stop(); opts.remove(); oddBar.remove(); prog.remove(); body.querySelector(".prompt").remove();
    body.append(h("ul", { class: "review" }, list.map((p, k) => h("li", { class: res[k] ? "ok" : "no" }, `${res[k] ? "✓" : res[k] === false ? "✗" : "–"} ${p.words.join(" · ")} — ${p.why}`))));
    catDone(body, total, "odd");
  };
  const timer = Timer(60, end, body.parentNode.querySelector(".game-head"));
  draw();
}

function anagramRush() {
  const set = session.set.anagram;
  const valid = new Set(set.valid);
  const mode = window.Answers && Answers.anagramMode(session.key);
  const ptsOf = w => window.Answers.anagramPoints(w.length, mode);
  const commonRaw = window.Answers.anagramCommonRaw(set.common, mode);
  const shown = raw => window.Answers.anagramScore(raw, commonRaw, mode);
  const body = screen("📝 " + tr("Anagram Rush"), tr("6 letters · 60 seconds"));
  let letters = shuffle(set.letters.split(""), rng(session.day)), built = [], found = [], raw = 0, over = false;
  const scoreEl = h("div", { class: "raw" }), cur = h("div", { class: "slots" }), tiles = h("div", { class: "tiles" }), list = h("div", { class: "found" });
  const form = h("p", { class: "kbd-tip" }, tr("⌨️ Type letters · Enter to submit · Backspace to delete · Space to shuffle"));
  const ctrls = h("div", { class: "row" }, h("button", { class: "btn", onclick: () => { letters = shuffle(letters); built = []; draw(); } }, tr("🔀 Shuffle")), h("button", { class: "btn", onclick: () => { built = []; draw(); } }, tr("Clear")), h("button", { class: "btn primary", onclick: () => tryWord(built.map(k => letters[k]).join("")) }, tr("Submit word")), skipBtn(() => end()));
  body.append(scoreEl, cur, tiles, ctrls, form, list);
  // Update in place (no innerHTML rebuild on each key/submit) so Enter never re-creates the screen or moves focus.
  const slotEls = Array.from({ length: 6 }, () => h("span", { class: "slot" }));
  cur.append(...slotEls);
  let tileEls = [];
  const buildTiles = () => { tiles.replaceChildren(...(tileEls = letters.map((l, k) => h("button", { class: "tile", onclick: () => { if (!built.includes(k)) { built.push(k); draw(); } } }, l)))); };
  const scoreB = h("b", {}, "0"), scoreRest = h("small", { class: "raw-sub" });
  scoreEl.append(tr("Score "), scoreB, tr("/1,000 pts"), scoreRest);
  let shownFound = 0;
  const draw = () => {
    scoreB.textContent = shown(raw); scoreRest.textContent = tr("{0} words · {1} raw", found.length, raw);
    slotEls.forEach((el, k) => { const on = built[k] != null; el.className = "slot" + (on ? " on" : ""); el.textContent = on ? letters[built[k]] : ""; });
    if (tileEls.length !== letters.length || tileEls.some((b, k) => b.textContent !== letters[k])) buildTiles();
    tileEls.forEach((b, k) => { b.disabled = built.includes(k); });
    while (shownFound < found.length) { const w = found[found.length - 1 - shownFound]; list.prepend(h("span", { class: "chip" }, w.toUpperCase() + " +" + ptsOf(w))); shownFound++; }
  };
  // Fixed-height feedback line: text changes in place, no element insert/remove, no full-screen flash (layout never shifts).
  const fbSlot = h("div", { class: "an-fb", "aria-live": "polite" });
  let fbT = 0;
  const flash = (t, ok) => { fbSlot.textContent = t; fbSlot.className = "an-fb show " + (ok === true ? "good" : ok === false ? "bad" : "neutral"); clearTimeout(fbT); fbT = setTimeout(() => { fbSlot.className = "an-fb"; }, 900); };
  const tryWord = w => {
    if (over) return; w = w.toLowerCase().trim(); built = [];
    if (w.length < 3) { draw(); return; }
    if (found.includes(w)) flash(tr("Already found"), null);
    else if (valid.has(w)) { found.unshift(w); raw += ptsOf(w); track(shown(raw)); flash("+" + ptsOf(w), true); }
    else flash(tr("Not a word"), false);
    draw();
  };
  const end = () => {
    if (over) return; over = true; timer.stop(); clearTimeout(fbT); fbSlot.remove(); tiles.remove(); ctrls.remove(); form.remove(); cur.remove();
    const missed = set.common.filter(w => !found.includes(w));
    body.append(h("p", { class: "muted" }, tr("Missed words: ") + (missed.length ? missed.map(w => w.toUpperCase()).join(", ") : tr("none — wow!"))));
    // ONE number everywhere: the converted /1,000 score is what the header shows, what is banked and what the total sums.
    body.append(h("p", { class: "muted" }, `${found.length} word${found.length === 1 ? "" : "s"} · ${fmt(raw)} raw points`));
    catDone(body, shown(raw), "anag raw " + raw);
  };
  onKey = e => {
    if (over) return false;
    if (e.key === "Enter") { tryWord(built.map(k => letters[k]).join("")); return; }
    if (e.key === "Backspace") { built.pop(); draw(); return; }
    if (e.key === " ") { letters = shuffle(letters); built = []; draw(); return; }
    if (/^[a-z]$/i.test(e.key)) { const k = letters.findIndex((l, idx) => l === e.key.toUpperCase() && !built.includes(idx)); if (k >= 0) { built.push(k); draw(); } else { cur.classList.add("shake"); setTimeout(() => cur.classList.remove("shake"), 300); } return; }
    return false;
  };
  ctrls.after(fbSlot);
  const timer = Timer(60, end, body.parentNode.querySelector(".game-head"));
  draw();
}

// ---------- 5. Think Fast ----------
// Think Fast puzzle schema (see SPEC.md §5). Illusion img ids map to assets/<img>.svg. Day = [thinking (400), fun (600)]; the pairing/rotation comes from content order.
//   typed (default, legacy): { q, answers, aliases?, wrong?, noSurname?, explain? }
//   guess:                   { type:"guess", q, answer:Number, unit?, explain? }            → numeric input, closeness scoring
//   mc / illusion:           { type:"mc", kind?:"illusion", img?:"illusion-…", q, options, a, explain? }
//   alias (Designer):        { type:"illusion", svg:"assets/illusion-….svg", q, options, a } → normalised to the mc shape
function normPuzzle(q) {
  if (q && q.type === "illusion") return { ...q, type: "mc", kind: "illusion", img: q.img || String(q.svg || "").replace(/^.*\//, "").replace(/\.svg$/i, "") };
  return q;
}
const TF_KIND = { math: tr("Math trap"), sequence: tr("Sequence"), logic: tr("Logic"), guesstimate: tr("Guesstimate"), illusion: tr("Optical illusion"), riddle: tr("Lateral riddle") };
// Illusion art: Designer's SVGs have fixed colours, so a plain <img> (uniform scale via object-fit) — placeholder if missing.
function puzzleArt(id) { return artBox("tf-svg", id, "Optical illusion — look closely, then answer", true); }
function guessQuestion(body, q, value, seconds, done, gq) {
  body.append(h("p", { class: "prompt" }, q.q));
  let over = false;
  const yearMode = q.exactYear === true || typeof q.yearBand === "number";
  const yearBand = typeof q.yearBand === "number" && isFinite(q.yearBand) ? Math.max(0, q.yearBand) : 0;
  const input = h("input", { class: "txt", placeholder: yearMode ? tr("Year") : tr("Your best estimate"), inputmode: "decimal", autocomplete: "off", autocapitalize: "off", spellcheck: "false", "aria-label": tr("Your estimate") + (q.unit ? tr(" in ") + q.unit : "") });
  const form = h("form", { class: "answer guess", onsubmit: e => { e.preventDefault(); if (input.value.trim()) submit(input.value); } },
    h("div", { class: "guess-field" }, input, q.unit ? h("span", { class: "guess-unit" }, tr(q.unit)) : null),
    h("button", { class: "btn primary", type: "submit" }, tr("Lock in")));
  const noteTxt = yearMode
    ? (yearBand > 0 ? tr("Exact year ±{0} = full points · otherwise 0", yearBand) : tr("Exact year only = full points · otherwise 0"))
    : "Within 5% = full points · 0 at 50% off";
  const note = h("p", { class: "muted guess-note" }, noteTxt);
  body.append(form, note); setTimeout(() => input.focus(), 50);
  const skipBar = ensureSkipBar(body, () => submit(null, true, true));
  const timer = seconds ? Timer(seconds, () => gq && gq.timeoutZero ? submit(null, true) : submit(input.value, true), body.parentNode.querySelector(".game-head")) : null;
  const fmtN = n => yearMode ? String(Math.round(Number(n))) : Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
  function submit(v, timedOut, skipped) {
    if (over) return;
    const n = skipped ? null : (v == null ? null : window.Answers.parseEstimate(v, q.unit || null));
    if (n === null && !timedOut && !skipped) { input.classList.remove("shake"); void input.offsetWidth; input.classList.add("shake"); note.textContent = yearMode ? "Enter a year, e.g. 1954" : "Enter a number, e.g. 1,200 or 1.2k"; return; }
    over = true; timer && timer.stop(); input.disabled = true; form.querySelector("button").remove(); note.remove();
    skipBar.querySelector(".skip-btn")?.remove();
    let pts = 0, off = "";
    if (n !== null) {
      if (yearMode) {
        pts = window.Answers.yearScore(n, q.answer, value, { yearBand });
        const diff = Math.abs(Math.round(n) - Math.round(q.answer));
        off = diff ? tr(diff === 1 ? " Off by {0} year." : " Off by {0} years.", diff) : "";
      } else {
        pts = window.Answers.closenessScore(n, q.answer, value);
        off = !q.answer ? "" : tr(" You were {0}% off.", Math.round(Math.abs(n - q.answer) / Math.abs(q.answer) * 100));
      }
    }
    feedback(body, pts === value ? true : pts > 0 ? null : false, tr(skipped ? "Skipped." : n === null ? "Time's up." : pts === value ? "Spot on!" : pts > 0 ? tr("Close!") : tr("Not close.")) +
      tr(" Answer: {0}.", fmtN(q.answer) + (q.unit ? " " + q.unit : "")) + `${off} +${pts}` + (q.explain ? " — " + q.explain : ""));
    done(pts);
  }
}
function emojiQuestion(body, q, value, seconds, done) {
  body.append(h("p", { class: "emoji-rebus" }, q.emoji || ""));
  const answers = [].concat(q.answers || [], q.answer ? [q.answer] : []).filter(a => a != null && String(a).trim());
  const parts = window.Answers.splitAccept(q.accept);
  const src = Object.assign({}, q, { aliases: [].concat(q.aliases || [], parts.aliases), given: [].concat(q.given || [], parts.given), exactOnly: q.exactOnly });
  textQuestion(body, pairLabel(q.prompt || q.q || "What word do these emojis spell?"), answers, value, seconds, done, null, answers[0] || "", q.explain, src, { timeoutZero: true });
}
function thinkFast() {
  const qs = session.set.thinkFast.map(normPuzzle), vals = [400, 600];
  let total = 0, i = 0; const log = [];
  const ask = () => {
    const q = qs[i], kind = TF_KIND[q.kind] ? " · " + TF_KIND[q.kind] : "";
    const body = screen("🧠 " + tr("Brain Teaser"), tr("Puzzle {0} of 2{1} · {2} pts · one submission", i + 1, kind, vals[i]));
    const next = pts => { total += pts; track(total); log.push(pts); i++; if (i < 2) nextBtn(actionBar(body), tr("Final puzzle →"), ask); else { // Nov 1: hold on the right/wrong feedback before the score + results popup take over (phone one-tap MC)
        const fb = body.querySelector(".fb"); if (fb && fb.scrollIntoView) fb.scrollIntoView({ block: "nearest", behavior: "smooth" });
        setTimeout(() => { if (body.isConnected) catDone(body, total, log.join("/")); }, 1500); } };
    if (q.type === "emoji" || q.type === "emoji-rebus" || q.kind === "emoji-rebus") emojiQuestion(body, q, vals[i], TBD.think, next);
    else if (playNewType(body, q, vals[i], TBD.think, next, 20)) { /* pair uses 20s per round; reveal and slider keep the category timer */ }
    else if (q.type === "guess") guessQuestion(body, q, vals[i], TBD.think, next);
    else if (q.type === "mc") {
      const pin = q.kind === "illusion" ? q.options.findIndex(o => /equal|same|igual|mismo/i.test(o)) : -1; // "They're equal" stays last; others seeded-shuffled
      mcQuestion(body, q.q, q.options, q.a, vals[i], TBD.think, pts => { if (q.explain) body.append(h("p", { class: "muted tf-explain" }, q.explain)); next(pts); },
        q.img || q.kind === "illusion" ? puzzleArt(q.img) : null, pin);
    } else textQuestion(body, q.q, q.answers, vals[i], TBD.think, next, null, q.answers[0], q.explain, q);
  };
  ask();
}

// ---------- results graphs ----------
// Graph 1 calls the field only when FIELD_COMPARE_ENABLED is true.
function fieldOn() { try { return window.FIELD_COMPARE_ENABLED === true; } catch (e) { return false; } }
function fieldNotePlay() { try { if (fieldOn() && window.FieldCompare && session) window.FieldCompare.onPlay(session); } catch (e) {} }
function fieldNoteFinish() { try { if (fieldOn() && window.FieldCompare && session) window.FieldCompare.onFinish(session); } catch (e) {} }
function clockDayKey() { return keyOf(zoneDay(now())); }
function fmtDayKey(key, style) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key || "")) return "";
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return "";
  const opt = style === "long" ? { month: "long", day: "numeric", timeZone: "UTC" } : { month: "short", day: "numeric", timeZone: "UTC" };
  try { return dt.toLocaleDateString(I18N.locale, opt); } catch (e) { return key; }
}
function fmtTenths(n) {
  const H = window.BCHistory;
  const r = H ? H.roundTenths(n) : (n == null || !Number.isFinite(n) ? null : Math.round(n * 10) / 10);
  if (r == null) return "—";
  const digits = Math.abs(r - Math.round(r)) < 1e-6 ? 0 : 1;
  try { return r.toLocaleString(I18N.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }); } catch (e) { return String(r); }
}
function fmtGrouped(n) { const r = Math.round(n); try { return r.toLocaleString(I18N.locale); } catch (e) { return String(r); } }
function fmtPlain(n) { return String(Math.round(n)); }
function svgEl(tag, attrs, ...kids) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null && v !== false) e.setAttribute(k, String(v));
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}
function sessionScoresValid() {
  if (!session || !Array.isArray(session.scores)) return false;
  const H = window.BCHistory;
  return H ? H.isValidCompleted({ practice: false, scores: session.scores }) : false;
}
function loadPersonalHistory() {
  const H = window.BCHistory;
  if (!H) return null;
  try {
    const practice = !!(session && session.practice);
    const viewedDay = !practice && session && H.isDayKey(session.key) ? session.key : null;
    const memory = viewedDay ? { day: session.key, scores: session.scores, practice: false } : null;
    const found = H.completedGames(H.readLocalEntries(localStorage), viewedDay, memory);
    return { games: found.games, later: found.later, viewedDay, practice, clockDay: clockDayKey() };
  } catch (e) { return null; }
}
function g1Axes(mode) {
  const W = 360, Ht = 150, pad = { l: 8, r: 8, t: 8, b: mode === "total" ? 26 : 16 };
  const nodes = [
    svgEl("line", { x1: pad.l, y1: pad.t, x2: pad.l, y2: Ht - pad.b, stroke: "#d5d9e2" }),
    svgEl("line", { x1: pad.l, y1: Ht - pad.b, x2: W - pad.r, y2: Ht - pad.b, stroke: "#d5d9e2" })
  ];
  if (mode === "total") {
    [0, 1000, 2000, 3000, 4000, 5000].forEach((v, i, arr) => {
      const x = pad.l + (W - pad.l - pad.r) * (i / (arr.length - 1));
      nodes.push(svgEl("text", { x, y: Ht - 6, "text-anchor": i === 0 ? "start" : i === arr.length - 1 ? "end" : "middle", fill: "#8b93a7", "font-size": 10 }, String(v)));
    });
  } else {
    nodes.push(svgEl("text", { x: pad.l + 6, y: pad.t + 14, fill: "#8b93a7", "font-size": 11 }, fmtGrouped(1000)));
    nodes.push(svgEl("text", { x: pad.l + 6, y: Ht - pad.b - 6, fill: "#8b93a7", "font-size": 11 }, "0"));
  }
  const label = (mode === "total" ? tr("Score range") + ", " + tr("Number of completed games") : tr("Category") + ", " + tr("Score")) + ". " + tr("No scores are plotted while collection is off.");
  return svgEl("svg", { viewBox: "0 0 " + W + " " + Ht, class: "g1-axes", role: "img", "aria-label": label }, nodes);
}
function g1Privacy() { return h("p", { class: "g-foot" }, h("a", { class: "g1-privacy", href: "privacy.html?v=g1live1" }, tr("Privacy"))); }
function g1Date(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key || "")) return "";
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return "";
  const loc = I18N.locale || "en-US";
  try { return dt.toLocaleDateString(loc, { month: "long", day: "numeric", timeZone: "UTC" }); } catch (e) { return fmtDayKey(key, "long"); }
}
function g1Bin(score, width) {
  if (!Number.isFinite(Number(score))) return 0;
  return Math.min(9, Math.max(0, Math.floor(Number(score) / width)));
}
function g1Ticks(max) {
  const top = Math.max(1, max);
  if (top <= 4) { const a = []; for (let i = 0; i <= top; i++) a.push(i); return a; }
  const step = Math.max(1, Math.ceil(top / 4));
  const a = [];
  for (let v = 0; v <= top; v += step) a.push(v);
  if (a[a.length - 1] < top) a.push(top);
  return a;
}
function g1BarPath(x, y, w, h) {
  const base = y + h;
  if (h <= 0.5) return "";
  const r = Math.min(4, w / 2, h);
  return "M" + x.toFixed(1) + " " + base.toFixed(1) +
    " L" + x.toFixed(1) + " " + (y + r).toFixed(1) +
    " Q" + x.toFixed(1) + " " + y.toFixed(1) + " " + (x + r).toFixed(1) + " " + y.toFixed(1) +
    " L" + (x + w - r).toFixed(1) + " " + y.toFixed(1) +
    " Q" + (x + w).toFixed(1) + " " + y.toFixed(1) + " " + (x + w).toFixed(1) + " " + (y + r).toFixed(1) +
    " L" + (x + w).toFixed(1) + " " + base.toFixed(1) + " Z";
}
function g1Histogram(bins, ownBin, xMax, xTicks) {
  const W = 360, Ht = 176, pad = { l: 32, r: 8, t: 18, b: 22 };
  const iw = W - pad.l - pad.r, ih = Ht - pad.t - pad.b;
  const max = Math.max(1, ...bins);
  const yTicks = g1Ticks(max);
  const yTop = yTicks[yTicks.length - 1];
  const yAt = v => pad.t + ih - (Math.max(0, v) / yTop) * ih;
  const base = pad.t + ih;
  const nodes = [];
  yTicks.forEach(v => {
    const y = yAt(v);
    nodes.push(svgEl("line", { x1: pad.l, y1: y.toFixed(1), x2: W - pad.r, y2: y.toFixed(1), stroke: "#eceff3" }));
    nodes.push(svgEl("text", { x: pad.l - 4, y: (y + 3).toFixed(1), "text-anchor": "end", fill: "#98a0b0", "font-size": 10 }, String(v)));
  });
  nodes.push(svgEl("line", { x1: pad.l, y1: pad.t, x2: pad.l, y2: base, stroke: "#e1e4ec" }));
  nodes.push(svgEl("line", { x1: pad.l, y1: base, x2: W - pad.r, y2: base, stroke: "#d5d9e2" }));
  const slot = iw / bins.length;
  const bw = Math.max(8, slot * 0.62);
  bins.forEach((count, i) => {
    const cx = pad.l + slot * i + slot / 2;
    const x = cx - bw / 2;
    const hgt = (Math.max(0, count) / yTop) * ih;
    const y = base - hgt;
    const mine = i === ownBin;
    const d = g1BarPath(x, y, bw, hgt);
    if (d) nodes.push(svgEl("path", { class: "g1-bin", d: d, fill: mine ? "#E8774A" : "#5B7FE0", "data-you": mine ? "1" : "0", "data-count": String(count) }));
    else nodes.push(svgEl("path", { class: "g1-bin", d: "M" + x.toFixed(1) + " " + base + " L" + (x + bw).toFixed(1) + " " + base, fill: "none", stroke: mine ? "#E8774A" : "#5B7FE0", "stroke-width": "2", "data-you": mine ? "1" : "0", "data-count": "0" }));
    if (mine) nodes.push(svgEl("text", { x: cx.toFixed(1), y: Math.max(12, y - 5).toFixed(1), "text-anchor": "middle", fill: "#E8774A", "font-size": 11, "font-weight": "800" }, tr("You")));
  });
  xTicks.forEach(v => {
    const x = pad.l + (v / xMax) * iw;
    nodes.push(svgEl("text", { x: x.toFixed(1), y: Ht - 6, "text-anchor": v === 0 ? "start" : v === xMax ? "end" : "middle", fill: "#98a0b0", "font-size": 10 }, fmt(v)));
  });
  return svgEl("svg", { viewBox: "0 0 " + W + " " + Ht, class: "g1-axes", role: "img", "aria-label": tr("Number of completed games") }, nodes);
}
function g1Percent(above, others) {
  if (above == null || !Number.isFinite(Number(above)) || !Number.isFinite(Number(others)) || Number(others) <= 0) return null;
  return Math.round(100 * Number(above) / Number(others));
}
function g1OnSection() {
  const practice = !!(session && session.practice);
  const preview = /[?&]preview=\d{4}-\d{2}-\d{2}\b/.test(location.search);
  const skipped = practice || preview || window.BC_NO_BOOT === true;
  const pinned = !practice && session && window.BCHistory && window.BCHistory.isDayKey(session.key) ? session.key : "";
  const clock = clockDayKey();
  let mode = "total";
  let cat = 0;
  let snap = null;
  const section = h("section", { class: "g1-card", id: "results-g1", "data-g1-state": skipped ? "practice" : "pending", "data-collection": skipped ? "skipped" : "on", "data-g1-day": pinned, "aria-labelledby": "g1-title" });
  const title = tr("Today's Competition");
  const dateLine = practice || preview ? tr("Practice run · not part of the daily field") : (pinned ? g1Date(pinned) : "");
  const totalBtn = h("button", { type: "button", "data-g1-view": "total", "aria-pressed": "true" }, tr("Total Score"));
  const catBtn = h("button", { type: "button", "data-g1-view": "category", "aria-pressed": "false" }, tr("By Category"));
  const status = h("p", { class: "g1-quiet" });
  const strip = h("div", { class: "g1-strip" });
  const picker = h("select", { id: "g1-cat", class: "g1-cat-pick", "aria-label": tr("Category") });
  CATS.forEach((c, i) => picker.append(h("option", { value: String(i) }, c.name)));
  const plot = h("div", { class: "g1-plot" });
  const legend = h("p", { class: "g1-legend" });
  const foot = h("div", { class: "g1-footrow" });
  const note = h("p", { class: "g-foot" });
  const paint = () => {
    totalBtn.setAttribute("aria-pressed", mode === "total" ? "true" : "false");
    catBtn.setAttribute("aria-pressed", mode === "category" ? "true" : "false");
    section.setAttribute("data-g1-mode", mode);
    section.setAttribute("data-g1-cat", mode === "category" ? String(cat) : "");
    picker.hidden = mode !== "category";
    const youScores = sessionScoresValid() ? session.scores.slice(0, 5) : null;
    const ready = !skipped && snap && snap.state === "ready" && youScores;
    section.setAttribute("data-g1-state", skipped ? "practice" : snap ? (ready ? "ready" : "quiet") : "pending");
    section.setAttribute("data-g1-reason", snap && snap.reason ? snap.reason : "");
    while (strip.firstChild) strip.removeChild(strip.firstChild);
    while (plot.firstChild) plot.removeChild(plot.firstChild);
    while (legend.firstChild) legend.removeChild(legend.firstChild);
    while (foot.firstChild) foot.removeChild(foot.firstChild);
    status.textContent = "";
    note.textContent = "";
    if (!ready) {
      if (!skipped && snap) status.textContent = tr("No other results yet");
      return;
    }
    const total = youScores.reduce((a, b) => a + b, 0);
    const you = mode === "total" ? total : youScores[cat];
    const avg = mode === "total" ? snap.restAverage : snap.restCategoryAverage[cat];
    const bins = mode === "total" ? snap.scoreBins : snap.categoryBins[cat];
    const above = mode === "total" ? snap.othersAtOrAbove : snap.categoryAtOrAbove[cat];
    const ownBin = mode === "total" ? g1Bin(total, 500) : g1Bin(youScores[cat], 100);
    const pct = g1Percent(above, snap.restFinishes);
    const delta = Math.round(you - avg);
    section.setAttribute("data-you", String(Math.round(you)));
    section.setAttribute("data-rest", String(Math.round(avg)));
    section.setAttribute("data-percentile", pct == null ? "" : String(pct));
    section.setAttribute("data-delta", String(delta));
    section.setAttribute("data-bin", String(ownBin));
    strip.append(
      h("div", {}, h("span", {}, tr("Your score")), h("b", {}, fmt(you))),
      h("div", {}, h("span", {}, tr("Player average")), h("b", {}, fmt(avg))),
      h("div", {}, h("span", {}, tr("Percentile")), h("b", {}, pct == null ? "—" : tr("Top {0}%", pct)))
    );
    const xTicks = mode === "total" ? [0, 1000, 2000, 3000, 4000, 5000] : [0, 200, 400, 600, 800, 1000];
    const xMax = mode === "total" ? 5000 : 1000;
    plot.append(
      h("div", { class: "g1-chart g1-hist" }, h("div", { class: "g1-ylab" }, tr("↑ Number of completed games")), h("div", {}, g1Histogram(bins, ownBin, xMax, xTicks), h("div", { class: "g-xlab" }, tr("Score range"))))
    );
    legend.append(
      h("span", {}, h("i", { class: "you", "aria-hidden": "true" }), tr("Your score range")),
      h("span", {}, h("i", { class: "rest", "aria-hidden": "true" }), tr("Other completed games"))
    );
    const sign = delta > 0 ? "+" : delta < 0 ? "−" : "+";
    const shown = Math.abs(delta);
    foot.append(
      h("b", {}, tr("Your score") + ": " + fmt(you)),
      h("span", { class: "g1-delta " + (delta < 0 ? "down" : "up") }, sign + fmt(shown) + " " + tr("vs average"))
    );
    note.textContent = tr("These bars count today's completed games, not including yours.");
  };
  totalBtn.addEventListener("click", () => { mode = "total"; paint(); });
  catBtn.addEventListener("click", () => { mode = "category"; paint(); });
  picker.addEventListener("change", () => { cat = Number(picker.value) || 0; paint(); });
  section.append(
    h("div", { class: "g1-head" }, h("div", {}, h("h2", { id: "g1-title" }, title), dateLine ? h("p", { class: "g-sub" }, dateLine) : null)),
    h("div", { class: "g1-toggle", role: "radiogroup", "aria-label": tr("Competition view") }, totalBtn, catBtn),
    picker, status, strip, plot, legend, foot, note, g1Privacy());
  paint();
  if (!skipped && window.FieldCompare && session) {
    let stop = null;
    const apply = result => {
      if (!section.isConnected) { if (stop) stop(); return; }
      snap = result && result.state === "ready" ? result : { state: "quiet", reason: (result && result.reason) || "network" };
      paint();
    };
    const load = fromWatch => {
      if (fromWatch && !section.isConnected) { if (stop) stop(); return; }
      const job = window.FieldCompare.backfillToday ? window.FieldCompare.backfillToday(session, clock) : Promise.resolve();
      Promise.resolve(job).then(() => { if (!section.isConnected) { if (stop) stop(); return null; } return window.FieldCompare.dayFor(session); }).then(result => { if (result) apply(result); }).catch(() => apply(null));
    };
    if (window.FieldCompare.watch) stop = window.FieldCompare.watch(() => load(true));
    load(false);
  }
  return section;
}
function g1OffSection() {
  const practice = !!(session && session.practice);
  const pinned = !practice && session && window.BCHistory && window.BCHistory.isDayKey(session.key) ? session.key : "";
  const clock = clockDayKey();
  let mode = "total";
  const section = h("section", { class: "g1-card", id: "results-g1", "data-g1-state": "collection-off", "data-collection": "off", "data-g1-day": pinned, "aria-labelledby": "g1-title" });
  const title = !practice && pinned && pinned === clock ? tr("Today's competition") : tr("Daily competition");
  const dateLine = practice ? tr("Practice run · not part of the daily field") : (pinned ? tr("{0} · New York", fmtDayKey(pinned, "long")) : tr("New York"));
  const totalBtn = h("button", { type: "button", "data-g1-view": "total", "aria-pressed": "true" }, tr("Total score"));
  const catBtn = h("button", { type: "button", "data-g1-view": "category", "aria-pressed": "false" }, tr("By category"));
  const plot = h("div", { class: "g1-plot" });
  const paint = () => {
    totalBtn.setAttribute("aria-pressed", mode === "total" ? "true" : "false");
    catBtn.setAttribute("aria-pressed", mode === "category" ? "true" : "false");
    section.setAttribute("data-g1-mode", mode);
    while (plot.firstChild) plot.removeChild(plot.firstChild);
    const yName = mode === "total" ? tr("Number of completed games") : tr("Score");
    const xName = mode === "total" ? tr("Score range") : tr("Category");
    plot.append(h("div", { class: "g1-chart" }, h("div", { class: "g-ylab" }, yName), h("div", {}, g1Axes(mode), h("div", { class: "g-xlab" }, xName))), h("p", { class: "g1-empty" }, tr("No scores are plotted while collection is off.")));
    if (mode === "category") plot.append(h("ul", { class: "g1-cats" }, CATS.map(c => h("li", {}, c.name))));
  };
  totalBtn.addEventListener("click", () => { mode = "total"; paint(); });
  catBtn.addEventListener("click", () => { mode = "category"; paint(); });
  const yours = h("p", { class: "g1-yours" });
  if (sessionScoresValid()) yours.append(h("span", {}, practice ? tr("This run") : tr("Your score")), h("b", {}, fmtPlain(session.scores.reduce((a, b) => a + b, 0))));
  section.append(
    h("div", { class: "g1-head" }, h("div", {}, h("h2", { id: "g1-title" }, title), h("p", { class: "g-sub" }, dateLine)), h("span", { class: "g1-badge" }, tr("Not live"))),
    h("div", { class: "g1-toggle", role: "radiogroup", "aria-label": tr("Competition view") }, totalBtn, catBtn),
    h("h3", {}, tr("Comparison unavailable")),
    h("p", { class: "g1-unavail" }, tr("Daily field collection is off. Daily Dose is not gathering other completed games, so there is no average, distribution, or percentile.")),
    plot, yours,
    h("p", { class: "g-foot" }, tr("Collection stays off. This view does not download scores or send results. Counts would be completed games, not verified players.")),
    g1Privacy());
  paint();
  return section;
}
function g1Section() {
  try { return fieldOn() ? g1OnSection() : g1OffSection(); }
  catch (e) { return g1OffSection(); }
}
function g2Chart(points, scale, highlightDay, priorMean) {
  const W = 360, Ht = 200, pad = { l: 46, r: 16, t: 16, b: 32 };
  const iw = W - pad.l - pad.r, ih = Ht - pad.t - pad.b, n = points.length;
  const xAt = i => n <= 1 ? pad.l + iw / 2 : pad.l + iw * i / (n - 1);
  const yAt = v => pad.t + ih - (Math.max(0, Math.min(scale, v)) / scale) * ih;
  const nodes = [];
  (scale === 5000 ? [0, 2500, 5000] : [0, 500, 1000]).forEach(v => {
    const y = yAt(v);
    nodes.push(svgEl("line", { x1: pad.l, y1: y, x2: W - pad.r, y2: y, stroke: "#eceff3" }));
    nodes.push(svgEl("text", { x: pad.l - 8, y: y + 4, "text-anchor": "end", fill: "#98a0b0", "font-size": 11 }, String(v)));
  });
  if (priorMean != null && Number.isFinite(priorMean)) {
    const y = yAt(priorMean);
    nodes.push(svgEl("line", { x1: pad.l, y1: y, x2: W - pad.r, y2: y, stroke: "#8b93a7", "stroke-width": "1.5", "stroke-dasharray": "4 4", "data-prior-line": "1" }));
  }
  if (n >= 2) nodes.push(svgEl("path", { d: points.map((p, i) => (i ? "L" : "M") + xAt(i).toFixed(1) + " " + yAt(p.value).toFixed(1)).join(" "), fill: "none", stroke: "#1F2C7A", "stroke-width": "2", "stroke-linejoin": "round", "stroke-linecap": "round" }));
  const labelIdx = n <= 6 ? points.map((_, i) => i) : [0, 1, 2, 3, 4].map(k => Math.round(k * (n - 1) / 4));
  const seen = new Set();
  labelIdx.forEach(i => {
    if (seen.has(i) || !points[i]) return; seen.add(i);
    const bold = points[i].day === highlightDay;
    nodes.push(svgEl("text", { x: xAt(i), y: Ht - 8, "text-anchor": "middle", fill: bold ? "#14182e" : "#8b93a7", "font-size": 11, "font-weight": bold ? "700" : "500" }, fmtDayKey(points[i].day, "short")));
  });
  points.forEach((p, i) => {
    const cx = xAt(i), cy = yAt(p.value), on = p.day === highlightDay;
    nodes.push(svgEl("circle", { cx: cx.toFixed(1), cy: cy.toFixed(1), r: on ? 5.5 : 4.5, fill: on ? "#E8582A" : "#fff", stroke: on ? "#E8582A" : "#1F2C7A", "stroke-width": "2" }));
    if (on) nodes.push(svgEl("text", { x: Math.min(cx, W - pad.r).toFixed(1), y: cy > pad.t + 18 ? cy - 10 : cy + 16, "text-anchor": i === n - 1 ? "end" : "middle", fill: "#14182e", "font-size": 12, "font-weight": "700" }, fmtPlain(p.value)));
  });
  return svgEl("svg", { viewBox: "0 0 " + W + " " + Ht, class: "g2-svg", "aria-hidden": "true", focusable: "false" }, nodes);
}
function g2Section() {
  const section = h("section", { class: "g2-card", id: "results-g2", "data-g2": "editorial", "aria-labelledby": "g2-title" });
  const hist = loadPersonalHistory();
  const select = h("select", { id: "g2-metric" });
  select.append(h("option", { value: "overall" }, tr("Overall")));
  CATS.forEach((c, i) => select.append(h("option", { value: String(i) }, c.name)));
  const sub = h("p", { class: "g-sub" });
  const body = h("div", { class: "g2-body", "aria-live": "polite" });
  section.append(h("div", { class: "g2-head" }, h("div", {}, h("h2", { id: "g2-title" }, tr("Your history")), sub), h("label", { class: "g2-select" }, h("span", { class: "sr-only" }, tr("History metric")), select)), body);
  const paint = () => {
    const metric = select.value === "overall" ? "overall" : Number(select.value);
    const name = metric === "overall" ? tr("Overall") : (CATS[metric] ? CATS[metric].name : "");
    while (body.firstChild) body.removeChild(body.firstChild);
    if (!hist || !window.BCHistory) {
      section.setAttribute("data-g2-state", "unreadable");
      sub.textContent = "";
      body.append(h("p", { class: "g2-empty" }, tr("History couldn't be read on this page. Saved games were left as they are.")));
      return;
    }
    const H = window.BCHistory, scale = H.scaleFor(metric), summary = H.summarize(hist.games, metric, hist.viewedDay);
    const includes = !!(hist.viewedDay && summary.viewed);
    const hero = includes ? summary.viewed : (summary.points.length ? summary.points[summary.points.length - 1] : null);
    const isToday = !!(includes && hist.viewedDay === hist.clockDay);
    section.setAttribute("data-g2-state", summary.allCount ? "ready" : "empty");
    section.setAttribute("data-metric", metric === "overall" ? "overall" : String(metric));
    section.setAttribute("data-viewed-day", hist.viewedDay || "");
    section.setAttribute("data-includes-viewed", includes ? "1" : "0");
    section.setAttribute("data-all-count", String(summary.allCount));
    section.setAttribute("data-all-sum", String(summary.allSum));
    section.setAttribute("data-all-mean", summary.allMean == null ? "" : String(H.roundTenths(summary.allMean)));
    section.setAttribute("data-prior-count", String(summary.priorCount));
    section.setAttribute("data-prior-mean", summary.priorMean == null ? "" : String(H.roundTenths(summary.priorMean)));
    section.setAttribute("data-later", String(hist.later));
    section.setAttribute("data-practice", hist.practice ? "1" : "0");
    sub.textContent = hist.practice ? tr("Completed games saved on this device") : (isToday ? tr("Completed games, earlier → today") : tr("Completed games, earlier → {0}", fmtDayKey(hist.viewedDay, "short") || ""));
    const foot = tr("Finished games saved on this device. Practice and unfinished days are left out.");
    if (!summary.allCount) {
      body.append(h("p", { class: "g2-empty" }, tr("No completed games on this device yet.")), h("p", { class: "g-foot" }, hist.practice ? tr("Practice runs are not saved and are not part of this history.") : foot));
      return;
    }
    const short = fmtDayKey(hero.day, "short");
    const kicker = hist.practice ? tr("Latest saved · {0} · {1}", short, name) : isToday ? tr("Today · {0} · {1}", short, name) : includes ? tr("Completed · {0} · {1}", short, name) : tr("Latest saved · {0} · {1}", short, name);
    const dash = !hist.practice && summary.priorCount > 0 ? summary.priorMean : (hist.practice && summary.allCount >= 2 ? summary.allMean : null);
    const kids = [h("p", { class: "g2-kicker" }, kicker), h("p", { class: "g2-big" }, fmtPlain(hero.value)), h("p", { class: "g2-scale" }, tr("points · scale 0–{0}", fmtGrouped(scale)))];
    if (dash != null && !hist.practice) kids.push(h("p", { class: "g2-legend" }, h("i", { "aria-hidden": "true" }), isToday ? tr("Prior avg {0} · excl. today", fmtTenths(summary.priorMean)) : tr("Prior avg {0} · excl. {1}", fmtTenths(summary.priorMean), fmtDayKey(hist.viewedDay, "short"))));
    else if (dash != null) kids.push(h("p", { class: "g2-legend" }, h("i", { "aria-hidden": "true" }), tr("Dashed line = average {0} of these saved games.", fmtTenths(summary.allMean))));
    kids.push(h("div", { class: "g2-chart" }, h("div", { class: "g-ylab" }, tr("Score")), h("div", {}, g2Chart(summary.points, scale, includes ? hist.viewedDay : null, dash), h("div", { class: "g-xlab" }, tr("Date")))));
    kids.push(h("table", { class: "sr-only" }, h("caption", {}, tr("Graph of your completed games")), h("thead", {}, h("tr", {}, h("th", {}, tr("Date")), h("th", {}, tr("Score")))), h("tbody", {}, summary.points.map(p => h("tr", {}, h("td", {}, fmtDayKey(p.day, "long") || p.day), h("td", {}, fmtPlain(p.value)))))));
    const viewedLong = fmtDayKey(hist.viewedDay, "long");
    kids.push(h("p", { class: "g2-all-kicker" }, includes && isToday ? tr("All time · includes today") : includes ? tr("All time · includes {0}", viewedLong) : tr("All time · saved games")));
    kids.push(h("div", { class: "g2-stats" }, h("div", {}, h("span", {}, tr("Average")), h("b", {}, fmtTenths(summary.allMean))), h("div", {}, h("span", {}, tr("Total")), h("b", {}, fmtGrouped(summary.allSum))), h("div", {}, h("span", {}, tr("Games")), h("b", {}, fmtGrouped(summary.allCount)))));
    if (!hist.practice && includes && summary.priorCount > 0) kids.push(h("p", { class: "g-foot" }, tr("Dashed line = prior avg {0}, before {1} only. Average, total, and games include {1}.", fmtTenths(summary.priorMean), viewedLong)));
    else if (!hist.practice && includes) kids.push(h("p", { class: "g-foot" }, tr("No earlier completed games on this device. Average, total, and games include {0}.", viewedLong)));
    if (hist.practice) kids.push(h("p", { class: "g-foot" }, tr("Practice runs are not saved and are not part of this history.")));
    if (hist.later > 0) kids.push(h("p", { class: "g-foot" }, tr("Later completed games on this device stay with their own day and are not mixed in here.")));
    kids.push(h("p", { class: "g-foot" }, foot));
    body.append(...kids);
  };
  select.addEventListener("change", paint);
  paint();
  return section;
}
function bcGraphs() {
  try { const wrap = h("div", { class: "bc-graphs" }); wrap.append(g1Section(), g2Section()); return wrap; }
  catch (e) { return h("div", { class: "bc-graphs" }, h("p", { class: "g-fallback" }, tr("Results charts couldn't be read from this device. Saved games were left as they are."))); }
}

// ---------- results ----------
const blocks = s => s >= 900 ? "🟩" : s >= 600 ? "🟨" : s >= 300 ? "🟧" : "🟥";
const SITE_URL = "https://lukebiasi11.github.io/Brainclash.com/";
const shareText = () => `Daily Dose ${session.practice ? "(practice)" : "#" + gameNumber(dayOfKey(session.key)) + " · " + session.key}\n${session.scores.map((s, i) => CATS[i].icon + " " + blocks(s) + " " + s).join("\n")}\n🏁 ${session.scores.reduce((a, b) => a + b, 0).toLocaleString()} / 5,000\n${SITE_URL}`;
async function doShare(btn) { const t = shareText(); try { if (navigator.share) await navigator.share({ text: t }); else { await navigator.clipboard.writeText(t); btn.textContent = tr("Copied!"); } } catch {} }
// Lightweight confetti on a single canvas (~2 s, no library).
// Fix (Oct 26): the canvas used to sit at z-index 1 INSIDE the modal, under the card (z-index 2), which covers
// nearly the whole phone width, so the burst was hidden. It now sits ABOVE the card (pointer-events: none),
// is sized from its own layout box after insertion (never 0), and starts on the next frame after the modal paints.
// Reduced motion: one static scatter that fades out with no movement.
function confetti(host) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Oct 30 (Luke): full-viewport burst. The canvas is a direct child of <body> (NOT inside the modal: its backdrop-filter
  // makes it the containing block for position:fixed, which clipped the burst), fixed inset 0, pointer-events none.
  const c = h("canvas", { class: "confetti-canvas", "aria-hidden": "true" }); document.body.append(c);
  if (host) new MutationObserver((_, o) => { if (!host.isConnected) { c.remove(); o.disconnect(); } }).observe(document.body, { childList: true });
  requestAnimationFrame(() => {
    if (!c.isConnected) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(c.clientWidth, innerWidth || 0, document.documentElement.clientWidth), ch = Math.max(c.clientHeight, innerHeight || 0);
    const W = c.width = Math.max(1, Math.round(cw * dpr)), H = c.height = Math.max(1, Math.round(ch * dpr)), ctx = c.getContext("2d");
    const cols = ["#E8582A", "#F2C230", "#FFF6E8", "#1F2C7A"];
    const N = W < 900 * dpr ? 160 : 220;
    // Half burst from both side edges, half rain from across the full top edge, so it fills the whole screen.
    const ps = Array.from({ length: N }, (_, n) => { const side = n % 2 === 0, left = n % 4 === 0; return side ? {
      x: left ? 0 : W, y: H * (.1 + Math.random() * .5),
      vx: (left ? 1 : -1) * (4 + Math.random() * 12) * dpr, vy: (-4 - Math.random() * 10) * dpr,
      r: (5 + Math.random() * 6) * dpr, a: Math.random() * 6, va: (Math.random() - .5) * .4, c: cols[Math.random() * 4 | 0] } : {
      x: Math.random() * W, y: -Math.random() * H * .6,
      vx: (Math.random() - .5) * 3 * dpr, vy: (2 + Math.random() * 4) * dpr,
      r: (5 + Math.random() * 6) * dpr, a: Math.random() * 6, va: (Math.random() - .5) * .4, c: cols[Math.random() * 4 | 0] }; });
    const paint = (alpha) => ps.forEach(p => { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.globalAlpha = alpha; ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore(); });
    if (reduce) {
      ps.forEach(p => { p.x = Math.random() * W; p.y = Math.random() * H; });
      paint(.9); c.style.transition = "opacity .6s"; setTimeout(() => { c.style.opacity = 0; }, 1200); setTimeout(() => c.remove(), 1900); return;
    }
    const t0 = performance.now(), LIFE = 2800;
    const step = t => {
      if (!c.isConnected) return; const k = t - t0; ctx.clearRect(0, 0, W, H);
      ps.forEach(p => { p.vy += .28 * dpr; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va; });
      paint(Math.max(0, Math.min(1, 1.6 - 1.6 * k / LIFE)));
      if (k < LIFE) requestAnimationFrame(step); else c.remove();
    };
    requestAnimationFrame(step);
  });
}
// End-of-run FX. Bands LOCKED by Luke (Oct 30): low <= 2100 soft rain (Designer asset), high >= 3950 full-viewport confetti, mid none. Never both.
const FX_LOW_MAX = 2100, FX_HIGH_MIN = 3950; // locked by Luke
function softRain(hostCard) {
  document.body.classList.add("fx-low-rain"); hostCard?.classList.add("fx-deflate");
  const layer = h("div", { class: "rain-layer", "aria-hidden": "true" });
  for (let i = 0; i < 40; i++) {
    const d = h("div", { class: "rain-drop" });
    d.style.left = (Math.random() * 100) + "%"; d.style.animationDelay = (Math.random() * 0.9) + "s"; d.style.animationDuration = (2.1 + Math.random() * 0.7) + "s";
    layer.append(d);
  }
  document.body.append(layer);
  setTimeout(() => { layer.remove(); document.body.classList.remove("fx-low-rain"); hostCard?.classList.remove("fx-deflate"); }, 2800);
}
function endFx(tot, host, card) {
  if (tot >= FX_HIGH_MIN) confetti(host); else if (tot <= FX_LOW_MAX) softRain(card);
}
function countStats() {
  if (session.practice || session.counted) return;
  session.counted = true; save();
  const tot = session.scores.reduce((a, b) => a + b, 0);
  const st = store.get("dg-stats", { played: 0, best: 0, streak: 0, last: null });
  // Streak credits the day the run STARTED (session.key), even if it finishes after the reset.
  const gap = st.last ? dayOfKey(session.key) - dayOfKey(st.last) : null;
  st.streak = gap === 1 ? st.streak + 1 : gap === 0 ? st.streak : 1; st.last = session.key; st.played++; st.best = Math.max(st.best, tot);
  store.set("dg-stats", st);
}
// Pop-up shown the moment the 5th category finishes. Styling: .result-modal* / .confetti-canvas in style.css.
// Snarky one-liners by score band; picked by day so the line is stable on reload.
const SNARK = {
  perfect: ["Flawless. Are you cheating, or just insufferable?", tr("5,000. Go outside, you've earned it."), "Perfect score. We're calling your mom to brag."],
  great: ["Big brain energy. Mildly annoying, honestly.", tr("Strong showing. Don't let it go to your head."), "Impressive. The other brains are taking notes."],
  mid: ["Solidly… fine. Like a beige couch.", tr("Not bad, not great. Peak Tuesday energy."), "Your brain showed up. Mostly."],
  rough: ["Rough one. Your brain called in sick?", tr("Well, at least you finished."), "Bold strategy: guess everything."],
  zero: ["Zero. Impressive in its own way.", tr("A perfect zero. Was the phone upside down?"), "Nothing! Tomorrow can only go up."]
};
function snarkLine(tot) {
  const band = tot >= 5000 ? "perfect" : tot >= 3750 ? "great" : tot >= 2000 ? "mid" : tot > 0 ? "rough" : "zero";
  const l = SNARK[band]; return tr(l[((session ? session.day : 0) % l.length + l.length) % l.length]);
}
// Category-level quips (per 1,000-point category): roast low, praise high. Stable per day + category.
const CAT_QUIP = {
  top: ["Showing off now, are we?", tr("Clean sweep. Rude, honestly."), "That category never stood a chance."],
  good: ["Nicely done. Keep that energy.", tr("Solid. Your brain is warmed up."), "Respectable work. Carry on."],
  mid: ["Middle of the pack. Very… balanced.", tr("Half right, half vibes."), "Could be worse. Could be better."],
  low: ["Oof. Shake it off.", tr("That one bit back."), "Let's pretend that didn't happen."],
  zero: ["A goose egg. Bold.", tr("Zero. Next category, quickly."), "Nothing? The next one's yours."]
};
function catQuip(score, cat) {
  const band = score >= 900 ? "top" : score >= 650 ? "good" : score >= 350 ? "mid" : score > 0 ? "low" : "zero";
  const l = CAT_QUIP[band], k = (session ? session.day : 0) * 7 + (cat || 0);
  return tr(l[((k % l.length) + l.length) % l.length]);
}
function resultsPopup() {
  if ($(".result-modal")) return;
  countStats();
  const tot = session.scores.reduce((a, b) => a + b, 0);
  const num = h("b", { class: "result-modal__score" }, "0");
  const close = () => { m.remove(); document.removeEventListener("keydown", esc); };
  const esc = e => { if (e.key === "Escape") close(); };
  const shareBtn = h("button", { class: "btn primary big result-modal__share", "data-action": "share-results", onclick: () => doShare(shareBtn) }, tr("📤 Share result"));
  const m = h("div", { class: "result-modal", role: "dialog", "aria-modal": "true", "aria-label": "Clash complete" },
    h("div", { class: "result-modal__card" },
      h("small", { class: "result-modal__kicker" }, session.practice ? tr("Practice complete") : tr("Clash complete!")),
      num, h("small", { class: "result-modal__of" }, "/ 5,000"),
      h("p", { class: "result-modal__quip" }, snarkLine(tot)),
      h("div", { class: "result-modal__blocks" }, session.scores.map(x => h("span", {}, blocks(x)))),
      shareBtn,
      h("button", { class: "btn result-modal__full", "data-action": "see-results", onclick: () => { close(); results(); } }, tr("See results"))));
  document.addEventListener("keydown", esc);
  document.body.append(m); endFx(tot, m, m.querySelector(".result-modal__card")); countUp(num, tot, 1200);
}
function results() {
  const tot = session.scores.reduce((a, b) => a + b, 0);
  clearScreenTimers(); onKey = null;
  $(".result-modal")?.remove();
  countStats();
  document.body.classList.remove("in-game");
  app.classList.remove("enter");
  app.innerHTML = ""; window.scrollTo(0, 0);
  const share = shareText(); // ends with SITE_URL
  app.append(
    h("div", { class: "hero small" }, h("div", { class: "logo" }, "DAILY", h("span", {}, "DOSE")), h("p", { class: "tag" }, session.practice ? tr("Practice run complete") : tr("Today's Clash complete"))),
    h("div", { class: "final" }, h("small", {}, tr("Final score")), h("b", { id: "finalnum" }, "0"), h("small", {}, "/ 5,000"), h("p", { class: "quip" }, snarkLine(tot))),
    bcGraphs(),
    h("ol", { class: "path" }, CATS.map((c, i) => h("li", { class: "step done" }, h("span", { class: "num" }, blocks(session.scores[i])), h("span", { class: "ic" }, ic(c.icon, c.img)), h("span", { class: "nm" }, h("b", {}, c.name), c.id === "word" ? h("small", {}, wordGameFor(session.day).name) : null), h("span", { class: "pts" }, fmt(session.scores[i]))))),
    h("pre", { class: "share" }, share),
    h("div", { class: "row center" },
      h("button", { class: "btn primary", "data-action": "share-results", onclick: e => doShare(e.currentTarget) }, tr("Share result")),
      h("button", { class: "btn", onclick: home }, tr("Home"))),
    h("p", { class: "fine" }, tr("Global & friends leaderboards arrive with accounts in a future version.")));
  countUp($("#finalnum"), tot, 1600);
  setTimeout(() => { if ($("#finalnum")) endFx(tot, null, $(".final")); }, 1600); // full-viewport FX (was burst() around #finalnum)
}

document.addEventListener("click", e => { if (e.target.closest(".brand")) { if (!session || session.inProgress == null || confirm(tr("Leave this game? Progress in the current category is lost."))) home(); } });

// ---------- fit-one-screen ----------
// Game screens are a full-height flex column (CSS). Older Safari without svh/dvh gets --vh from visualViewport.
const vv = window.visualViewport;
if (!(window.CSS && CSS.supports && (CSS.supports("height", "100svh") || CSS.supports("height", "100dvh")))) {
  document.documentElement.classList.add("vh-js");
  const setVh = () => document.documentElement.style.setProperty("--vh", ((vv ? vv.height : innerHeight) / 100) + "px");
  setVh(); (vv || window).addEventListener("resize", setVh); addEventListener("orientationchange", setVh);
}
// Last resort if a screen is still taller than the viewport: shrink (CSS zoom) the content blocks — never the globe,
// whose canvas flexes to the remaining space instead — so the page never scrolls and the action button stays visible.
let fitQueued = false;
function scheduleFit() { if (!fitQueued) { fitQueued = true; requestAnimationFrame(() => { fitQueued = false; fitScreen(); }); } }
function fitScreen() {
  const body = $(".game-body");
  if (!body || !document.body.classList.contains("in-game") || document.body.classList.contains("is-dragging")) return;
  // nov2a: keyboard open (typed answer focused, or visual viewport much shorter than the layout viewport) -> never refit/shrink;
  // keep the current zoom and let the card scroll instead, so the prompt stays readable.
  const ae = document.activeElement, typing = ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName) && body.contains(ae);
  if (typing || (vv && vv.height < innerHeight * 0.8)) {
    body.classList.add("fit-scroll");
    // shrink the diagram/art (never the prompt) so Lock in stays above the keyboard
    const act = body.querySelector("form.answer .btn"), art = body.querySelector(":scope > .tf-svg, :scope > .sports-art, :scope > figure, :scope > img");
    if (act && art) {
      const ex = Math.ceil(act.getBoundingClientRect().bottom - (vv ? vv.height + vv.offsetTop : innerHeight) + 4);
      if (ex > 0) { const ah = art.getBoundingClientRect().height; art.style.maxHeight = art.style.height = Math.max(40, ah - ex) + "px"; art.dataset.kbfit = ""; }
    }
    if (act && typing) requestAnimationFrame(() => { const r = act.getBoundingClientRect(); if (r.bottom > (vv ? vv.height : innerHeight)) { act.scrollIntoView({ block: "end" }); const pr = body.querySelector(".prompt"), bt = body.getBoundingClientRect().top; if (pr && pr.getBoundingClientRect().top < bt) body.scrollTop -= Math.min(bt - pr.getBoundingClientRect().top + 2, Math.max(0, (vv ? vv.height : innerHeight) - act.getBoundingClientRect().bottom)); } });
    return;
  }
  body.querySelectorAll("[data-kbfit]").forEach(a => { a.style.maxHeight = a.style.height = ""; delete a.dataset.kbfit; });
  const kids = [...body.children].filter(k => !k.classList.contains("lmap") && !k.classList.contains("tf-svg") && !k.classList.contains("action-bar") && !k.classList.contains("order-wrap") && !k.classList.contains("match-board") && !k.classList.contains("bracket-opts") && !k.classList.contains("review") && !k.classList.contains("pair-cards") && !k.classList.contains("nudge-row") && !k.classList.contains("slider-range") && !k.classList.contains("slider-type-row") && !k.classList.contains("reveal-clues") && !k.matches(".btn.big") && !k.matches("form.answer") && !k.querySelector(".lmap"));
  kids.forEach(k => { k.style.zoom = ""; delete k.dataset.fitz; });
  body.classList.toggle("fit-scroll", innerWidth >= 1000); // wide desktop: scroll the card rather than zoom text to unreadable
  // nov2a: prompt text must stay >= 16px after zoom; if that still overflows, the card scrolls (fit-scroll) instead.
  const pr = body.querySelector(".prompt"), pfs = pr ? parseFloat(getComputedStyle(pr).fontSize) || 16 : 16;
  const zFloor = Math.max(innerWidth >= 1000 ? 0.85 : 0.45, Math.min(1, 16.2 / pfs));
  for (let i = 0; i < 4; i++) {
    const over = document.scrollingElement.scrollHeight - innerHeight, bodyOver = body.scrollHeight - body.clientHeight;
    // body is overflow:hidden, so also check that the last action button really ends inside the viewport (sub-pixel rounding)
    const act = [...document.querySelectorAll("#app .action-bar .btn, #app .game-body > .btn.big")].pop();
    const btnOver = act ? Math.ceil(act.getBoundingClientRect().bottom - (vv ? vv.height : innerHeight)) : 0;
    const excess = Math.max(over, bodyOver, btnOver);
    if (excess <= 0) break;
    const cur = parseFloat(kids[0]?.style.zoom || 1);
    const h = kids.reduce((a, k) => a + k.getBoundingClientRect().height, 0);
    if (!h) break;
    const z = Math.max(zFloor, cur * (h - excess - 2) / h); // never shrink prompt below 16px; card scrolls instead
    if (z >= cur - 0.005) { body.classList.add("fit-scroll"); break; }
    kids.forEach(k => { k.style.zoom = z.toFixed(3); k.dataset.fitz = ""; });
  }
}
new MutationObserver(m => { if (m.some(r => !(r.target.closest && r.target.closest(".timer, .runtotal, .cat-score b")))) scheduleFit(); }).observe(document.getElementById("app"), { childList: true, subtree: true });
(vv || window).addEventListener("resize", scheduleFit);
// nov2es2: real keyboards don't always fire window resize, and a page can load already short -> also refit (and scroll
// Lock in into view) on visualViewport resize, window resize and focus of a typed input, plus once more after layout settles.
if (vv) addEventListener("resize", scheduleFit);
document.addEventListener("focusin", e => { if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName) && e.target.closest(".game-body")) { scheduleFit(); setTimeout(scheduleFit, 350); } });
syncClock();
// ---- Admin preview hooks (admin.html). Inert on normal visits. ----
// ?preview=YYYY-MM-DD plays that day's real set as a practice run: save() and countStats()
// skip practice sessions, so daily progress, stats and streaks are never touched.
window.BCDaily = Object.freeze({ getDailySet, keyOf, dayOfKey, todayKey: () => keyOf(zoneDay(now())), gameNumber, wordGames: WORD_GAMES.map(w => ({ ...w })) });
const PREVIEW_KEY = (location.search.match(/[?&]preview=(\d{4}-\d{2}-\d{2})\b/) || [])[1];
const DEMO_PREVIEW = /[?&]preview=demo\b/.test(location.search);
const SLOT_PREVIEW = /[?&]preview=slots\b/.test(location.search);
if (window.BC_NO_BOOT) { /* admin.html: content lookups only */ }
else if (SLOT_PREVIEW) {
  session = newSession(true); session.key = "demo"; session.day = dayOfKey(LAUNCH_DATE); session.scores = [];
  document.title = "Slot demo — Daily Dose"; runSlotDemo();
} else if (DEMO_PREVIEW) {
  session = newSession(true); session.key = "demo"; session.day = dayOfKey(LAUNCH_DATE); session.scores = [];
  document.title = "Type demo — Daily Dose"; runTypeDemo();
} else if (PREVIEW_KEY && !isNaN(dayOfKey(PREVIEW_KEY))) {
  session = newSession(true); session.key = PREVIEW_KEY; session.day = dayOfKey(PREVIEW_KEY); session.set = getDailySet(PREVIEW_KEY);
  document.title = "Preview " + PREVIEW_KEY + " — Daily Dose"; window.BCPreview = Object.freeze({ key: PREVIEW_KEY, cat: () => session.scores.length }); runNext();
} else home();
// Dev/test only (inert unless the URL has ?dgtest): jump straight to a category / word-game format for layout tests.
if (/[?&]dgtest\b/.test(location.search)) var DGTest = window.DGTest = Object.freeze({
  // Day args accept a date key "2026-11-01", an epoch day number, or "today"; all resolve via getDailySet(key)
  // (same path as live play). Numbers < 1000 are offsets from LAUNCH_DATE (jump(4, null, 9) = Nov 1).
  _key(x) { if (x == null || x === "today") return todayKey(); if (typeof x === "string") return x; return keyOf(x < 1000 ? dayOfKey(LAUNCH_DATE) + x : x); },
  at(key, cat) { const k = DGTest._key(key); session = newSession(true); session.key = k; session.day = dayOfKey(k); session.set = getDailySet(k);
    session.scores = Array.from({ length: cat || 0 }, () => 0); runNext(); },
  jump(cat, wg, day) {
    let k = DGTest._key(day);
    if (wg && typeof wg === "string" && !/^\d{4}-/.test(wg)) { let d = dayOfKey(k); const e = d + 400; while (d < e && getDailySet(keyOf(d)).wordGame.id !== wg) d++; k = keyOf(d); }
    else if (wg != null) k = DGTest._key(wg);
    DGTest.at(k, cat);
  },
  thinkFast(day) { if (Array.isArray(day)) { session = newSession(true); session.set = { ...session.set, thinkFast: day }; session.scores = [0, 0, 0, 0]; return runNext(); } DGTest.at(day, 4); },
  sports(i) { session = newSession(true); session.set = { ...session.set, sports: C.sports[i] }; session.scores = [0, 0]; runNext(); },
  sportsSet(day) { if (Array.isArray(day) || (day && typeof day === "object")) { session = newSession(true); session.set = { ...session.set, sports: day }; session.scores = [0, 0]; return runNext(); } DGTest.at(day, 2); },
  state() { return session; },
  popup(sc) { session = newSession(true); session.scores = sc || [400, 300, 250, 500, 600]; results(); resultsPopup(); },
  // Read-only results hooks. counted is set first so countStats does not write dg-stats or the day record.
  _view(key, scores, opts) {
    opts = opts || {};
    const k = typeof key === "string" ? key : DGTest._key(key);
    session = { key: k, practice: opts.practice === true, counted: true, scores: Array.isArray(scores) ? scores.slice() : [], details: [] };
    session.day = dayOfKey(k); session.set = getDailySet(k);
  },
  openResults(key, scores, opts) { DGTest._view(key, scores, opts); results(); },
  completionPopup(key, scores, opts) { DGTest._view(key, scores, opts); resultsPopup(); },
  wordGames: () => [...new Set(Array.from({ length: 60 }, (_, d) => getDailySet(keyOf(d)).wordGame.id))]
});
})();
