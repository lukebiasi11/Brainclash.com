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
const WORD_GAMES = [
  { id: "flip", name: "Unscramble", sub: "Unscramble 6 words from hints · 60s" },
  { id: "bridge", name: "Word Bridge", sub: "Finish the first word, start the second · 60s" },
  { id: "conn", name: "Clusters", sub: "Find 3 groups of 3 · 90s" },
  { id: "odd", name: "Imposter", sub: "Spot the word that doesn't fit · 60s" },
  { id: "anag", name: "Anagram Rush", sub: "Make words from 6 letters · 60s" }
];
// Placeholder timers for categories whose time limits are not yet locked.
const THINK_SECS = 45;   // Luke, Oct 26: every Think Fast puzzle (all 6 types) gets 45 s — the single source for timer + copy
const TBD = { pin: 30, mc: 20, think: THINK_SECS };

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
const withFlag = (text, key) => { if (!key || !window.icon) return text; const m = text.match(/\p{RI}\p{RI}/u); if (!m) return text; const i = m.index; return [text.slice(0, i), ic(m[0], key, "inline-flag"), text.slice(i + m[0].length)]; };
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
function countUp(el, to, ms = 900) {
  const t0 = performance.now();
  const step = t => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(to * e); if (k < 1) requestAnimationFrame(step); };
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
      const c = CATS[s.scores.length - 1]; toast(`${c ? c.name : "That category"} was locked in at ${fmt(s.scores[s.scores.length - 1])} pts — you left mid-round, so it can't be replayed.`); }
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
// FROZEN is the exact schedule that was live for Oct 23 – Nov 10 2026, as content-list indexes.
// Daily lists (worldRush/history/sports/thinkFast) use one unit per day (u = epoch day);
// word-game lists use one unit per 5-day format cycle (u = floor(day / 5)), because each
// word format comes up once every 5 days. idx[k] is the entry shown for unit u0 + k.
// After the frozen window, each list plays its NOT-yet-scheduled entries in content order,
// so appending entries to the end of a list never moves any already-scheduled date.
// Only once every entry has been used does it wrap (and then it repeats in content order).
// Rule for content: never delete or reorder entries; fix one in place or append new ones.
const FROZEN = {
  worldRush: { u0: 20749, idx: [13,14,15,16,17,0,1,2,3,4,5,6,7,8,9,10,11,12,18] },
  history: { u0: 20749, idx: [13,14,15,16,17,0,1,2,3,4,5,6,7,8,9,10,11,12,18] },
  sports: { u0: 20749, idx: [13,14,15,16,17,0,1,2,3,4,5,6,7,8,9,10,11,12,18] },
  thinkFast: { u0: 20749, idx: [3,4,5,6,7,0,1,2,8,9,10,11,12,13,14,15,16,17,18] },
  wordFlip: { u0: 4149, idx: [0,1,2,3,4] },
  wordBridge: { u0: 4149, idx: [0,1,2,3,4] },
  connections: { u0: 4149, idx: [0,1,2,3,4] },
  oddOneOut: { u0: 4149, idx: [0,1,2,3,4] },
  anagram: { u0: 4149, idx: [2,3,4,5,6] }
};
function schedIdx(name, len, u) {
  const f = FROZEN[name];
  if (!f || !len) return null;
  if (u < f.u0) return ((u % len) + len) % len;            // pre-launch (practice fallback): legacy
  const k = u - f.u0;
  if (k < f.idx.length) return f.idx[k] < len ? f.idx[k] : k % len;
  const used = new Set(f.idx), fresh = [];
  for (let i = 0; i < len; i++) if (!used.has(i)) fresh.push(i);
  const j = k - f.idx.length;
  return j < fresh.length ? fresh[j] : (j - fresh.length) % len;
}
const sched = (name, arr, u) => { if (!Array.isArray(arr) || !arr.length) return pick(arr, u); return arr[schedIdx(name, arr.length, u)]; };
function getDailySet(dayKey) {
  const d = dayOfKey(dayKey), w = Math.floor(d / WORD_GAMES.length);
  return { day: d, worldRush: sched("worldRush", C.worldRush, d), history: sched("history", C.history, d), sports: sched("sports", C.sports, d),
    // Word formats rotate daily (period 5); each format's list advances once per 5-day cycle: w = floor(day / 5).
    wordGame: pick(WORD_GAMES, d), wordFlip: sched("wordFlip", C.wordFlip, w), wordBridge: sched("wordBridge", C.wordBridge, w),
    connections: sched("connections", C.connections, w), oddOneOut: sched("oddOneOut", C.oddOneOut, w),
    anagram: sched("anagram", window.ANAGRAM_SETS, w), thinkFast: sched("thinkFast", C.thinkFast, d) };
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
  return h("div", { class: "runtotal", "aria-label": "Category score" }, "Score ", h("b", {}, fmt(v)), "/1,000 pts");
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
    h("div", { class: "crumb" }, session.practice ? "Practice" : "Brain Clash", " · ", (session.scores.length + 1) + "/5"),
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
function skipBtn(onSkip, label) {
  return h("button", { class: "btn skip-btn", type: "button", "aria-label": "Skip", onclick: e => { e.preventDefault(); onSkip(); } }, label || "Skip");
}
function ensureSkipBar(body, onSkip) {
  let bar = body.querySelector(":scope > .action-bar");
  if (!bar) bar = actionBar(body);
  if (!bar.querySelector(".skip-btn")) bar.append(skipBtn(onSkip));
  return bar;
}

// ---------- home ----------
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
      h("div", { class: "logo" }, "BRAIN", h("span", {}, "CLASH")),
      h("p", { class: "tag" }, h("b", {}, "5"), " categories.", h("span", { class: "sep", "aria-hidden": "true" }, "•"), h("b", {}, "1"), " shot a day.", h("span", { class: "sep", "aria-hidden": "true" }, "•"), h("b", {}, "5,000"), " points on the line."),
      h("p", { class: "date" }, new Date(day * 864e5).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }) + " · Clash #" + gameNumber(day))),
    h("ol", { class: "path" }, CATS.map((c, i) => {
      const sc = s && s.scores[i];
      const state = sc != null ? "done" : (s ? s.scores.length : 0) === i ? "next" : "locked";
      return h("li", { class: "step " + state },
        h("span", { class: "num" }, sc != null ? "✓" : i + 1),
        h("span", { class: "ic" }, ic(c.icon, c.img)),
        h("span", { class: "nm" }, h("b", {}, c.name), h("small", {}, c.id === "word" ? c.sub + " · Today: " + wg.name : c.sub)),
        h("span", { class: "pts" }, sc != null ? fmt(sc) : state === "locked" ? "🔒" : "1,000"));
    })),
    done
      ? h("div", { class: "cta" }, h("p", {}, "You've finished today's Clash: ", h("b", {}, fmt(s.scores.reduce((a, b) => a + b, 0)) + " / 5,000")),
          h("button", { class: "btn primary big", onclick: () => { session = newSession(false); results(); } }, "View results"),
          h("p", { class: "muted", id: "countdown" }))
      : h("div", { class: "cta" }, h("button", { class: "btn primary big" + (s && s.scores.length ? " long" : ""), onclick: () => { session = newSession(false); runNext(); } }, s && s.scores.length ? "Continue the Clash" : "Start the Clash"),
          h("p", { class: "muted", id: "countdown" })),
    h("details", { class: "rules" }, h("summary", {}, "How it works"),
      h("ul", {},
        h("li", {}, "Same challenge for everyone, new every day at midnight US Eastern (New York) time."),
        h("li", {}, "Fixed order: World Rush → Time Warp → MVP → Word Nerd → Brain Teaser."),
        h("li", {}, "Each category is worth up to 1,000 points. No speed bonuses — accuracy wins."),
        h("li", {}, "Finish a category to unlock the next. No skipping or replays."),
        h("li", {}, "Word Nerd rotates daily between Unscramble, Word Bridge, Clusters, Imposter and Anagram Rush."))),
    h("button", { class: "btn ghost", onclick: () => { session = newSession(true); runNext(); } }, "🎯 Practice mode (doesn't count)"),
    h("div", { class: "stats" },
      h("div", {}, h("b", {}, stats.played), h("small", {}, "Played")),
      h("div", {}, h("b", {}, fmt(stats.best)), h("small", {}, "Best")),
      h("div", {}, h("b", {}, stats.streak), h("small", {}, "Streak"))),
    h("p", { class: "fine" }, "Beta prototype · scores saved on this device only. Leaderboards, friends and prize pools coming later. ", h("a", { href: "credits.html" }, "Credits & licenses")));
  const cd = () => {
    const el = $("#countdown"); if (!el) return;
    if (dayIndex() !== day) return home(); // new day: re-render
    const t = Math.floor(msToReset() / 1000);
    el.textContent = (done ? "Next Clash in " : "Resets in ") + [t / 3600, t % 3600 / 60, t % 60].map(x => String(Math.floor(x)).padStart(2, "0")).join(":");
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
}
const WG_SECS = { flip: 60, bridge: 60, conn: 90, odd: 60, anag: 60 };
function catIntro(i, start) {
  const c = CATS[i];
  if (i === 3) {
    const wg = wordGameFor(session.day);
    const body = screen(c.icon + " " + c.name, "Rotates daily · today's format below");
    body.append(h("div", { class: "wg-intro" },
      h("small", { class: "wg-intro__label" }, "Today's word game"),
      h("div", { class: "wg-intro__name" }, wg.name),
      h("p", { class: "wg-intro__sub" }, wg.sub),
      h("div", { class: "wg-intro__chips" }, h("span", { class: "wg-chip" }, "⏱ " + WG_SECS[wg.id] + " seconds"), h("span", { class: "wg-chip" }, "Up to 1,000 pts")),
      h("div", { class: "wg-intro__how" }, h("b", {}, "How it works"), introText("word"))));
    nextBtn(actionBar(body), "Start " + wg.name, () => { session.inProgress = i; session.partial = 0; session.partialCat = i; save(); start(); });
    return;
  }
  const body = screen(c.icon + " " + c.name, i === 3 ? "Today's word game: " + wordGameFor(session.day).name + " — " + wordGameFor(session.day).sub : c.desc);
  body.append(h("div", { class: "intro" }, h("div", { class: "big-ic" }, ic(c.icon, c.img)), h("p", {}, "Worth up to ", h("b", {}, "1,000 points"), "."), introText(c.id)));
  nextBtn(body, "Start " + (i === 3 ? wordGameFor(session.day).name : c.name), () => { session.inProgress = i; session.partial = 0; session.partialCat = i; save(); start(); });
}
function introText(id) {
  const t = {
    world: "Drop a pin as close as you can to two cities (up to 450 pts each — 0 at 4,000 km+), then answer one geography question (100 pts). Tap the map to place your pin; tap again to move it.",
    history: "Drag the picture cards into chronological order, earliest first (top on phones, left on wider screens). Round 1: 4 events in 30s (400 pts). Round 2: 5 events in 45s (600 pts). Partial credit for every correctly ordered pair.",
    sports: "Three questions of rising difficulty: 250, 350, then 400 points. Matching and ordering questions give partial credit for each one you get right.",
    word: { flip: "Unscramble 6 medium–hard words using the hint (definition, synonym, antonym or riddle). Tap letters to spell; correct answers auto-advance. First 4 words 150 pts, last 2 worth 200. 60 seconds.",
      bridge: "Find the middle word that finishes the first word and starts the second, e.g. SUN _ HOUSE → LIGHT (sunlight, lighthouse). It is NOT a word that blends both meanings. 6 puzzles: the first 4 are worth 150 pts, the last 2 are worth 200. 60 seconds.",
      conn: "Sort 9 words into 3 groups of 3. Groups are worth 300, 300 and 400. Three wrong guesses ends the round. 90 seconds.",
      odd: "8 sets of four words — tap the one that doesn't belong. 4 medium (100 pts) then 4 hard (150 pts). 60 seconds.",
      anag: "Make as many 3–6 letter words as you can from 6 letters in 60 seconds. 3 letters = 10, 4 = 25, 5 = 50, 6 = 100. No penalty for wrong guesses." },
    think: `Two puzzles worth 400 and 600 points, ${THINK_SECS} seconds each. You get ONE submission each — think before you lock it in.`
  }[id];
  return h("p", { class: "muted" }, typeof t === "string" ? t : t[wordGameFor(session.day).id]);
}
function runNext() {
  const i = session.scores.length;
  if (i >= 5) return results();
  const go = [worldRush, history, sports, wordChallenge, thinkFast][i];
  catIntro(i, go);
}
function catDone(body, score, detail) {
  commitCat(score, detail);
  const b = h("b", {}, "0");
  body.append(h("div", { class: "cat-score" }, h("small", {}, "Category score"), b, h("small", {}, "/ 1,000"), h("p", { class: "quip" }, catQuip(score, session.scores.length - 1))));
  countUp(b, score);
  if (session.scores.length >= 5) { setTimeout(() => { if (body.isConnected && session && session.scores.length >= 5) resultsPopup(); }, 500); }
  nextBtn(body, session.scores.length >= 5 ? "See final results" : "Next: " + CATS[session.scores.length].name + " →", runNext);
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
  let guess = null, target = null, locked = false, focusX = false, raf = 0, vel = [0, 0], anim = null;
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
    base = Math.max(20, Math.min(W, H) / 2 - 8); proj.translate([W / 2, H / 2]).scale(base * k); draw();
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
    if (focusX && !locked) { ctx.strokeStyle = "#E8582A"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy); ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10); ctx.stroke(); }
  }
  const req = () => { if (!raf) raf = requestAnimationFrame(draw); };
  function rotateBy(dx, dy) { // pixels → degrees, slower when zoomed in
    const f = 90 / proj.scale(), r = proj.rotate();
    proj.rotate([r[0] + dx * f, Math.max(-89, Math.min(89, r[1] - dy * f)), 0]); req();
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
    rotateBy(dx, dy); vel = [dx / dt * 16, dy / dt * 16]; last = [e.clientX, e.clientY]; lastT = now;
  });
  const end = e => {
    if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
    if (pts.size === 1) { const p = [...pts.values()][0]; start = last = p; pinch0 = 0; moved = true; return; } // finishing a pinch never drops a pin
    if (pts.size) return;
    if (e.type === "pointerup" && !moved && start) tapAt(e.clientX, e.clientY);
    else if (moved && performance.now() - lastT < 80 && Math.hypot(vel[0], vel[1]) > 0.5) inertia();
    start = null;
  };
  cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
  function inertia() {
    const step = () => { vel = [vel[0] * 0.93, vel[1] * 0.93]; rotateBy(vel[0], vel[1]);
      anim = Math.hypot(vel[0], vel[1]) > 0.08 ? requestAnimationFrame(step) : null; };
    anim = requestAnimationFrame(step);
  }
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
    const body = screen("🌎 World Rush", "Pin " + (step + 1) + " of 2 · up to 450 pts");
    body.classList.add("wr-body");
    body.append(h("p", { class: "prompt wr-prompt" }, "Where is ", h("b", { class: "hl" }, target.name), "?"));
    const mapEl = h("div", { class: "lmap" });
    const zhint = h("div", { class: "map-hint", "aria-hidden": "true" }, "Drag to spin, pinch to zoom");
    const wrap = h("div", { class: "map-wrap" }, mapEl, zhint,
      h("a", { class: "map-credit", href: "credits.html", target: "_blank", rel: "noopener" }, "Map data: Natural Earth · Imagery: NASA Blue Marble"));
    body.append(wrap);
    const hideHint = () => zhint.classList.add("gone");
    ["pointerdown", "wheel", "touchstart", "keydown"].forEach(ev => wrap.addEventListener(ev, hideHint, { once: true, passive: true }));
    let guess = null, locked = false, api;
    const bar = actionBar(body);
    const btn = h("button", { class: "btn primary big", disabled: true, onclick: () => submit() }, "📍 Lock in pin");
    bar.append(btn, skipBtn(() => { if (locked) return; guess = null; submit(); }));
    const onPick = p => { if (locked) return; guess = p; btn.disabled = false; hideHint(); };
    api = window.d3 && window.d3.geoOrthographic && window.topojson && window.WORLD_ATLAS_110M ? globeMap(mapEl, onPick) : svgMap(mapEl, onPick);
    const timer = Timer(TBD.pin, () => submit(), body.parentNode.querySelector(".game-head"));
    function submit() {
      if (locked) return; locked = true; timer.stop(); btn.remove();
      let pts = 0, msg;
      if (guess) {
        const d = haversine(guess, target); pts = pinPoints(d);
        msg = `${fmt(d)} km away → +${pts}`;
      } else msg = "Time's up — no pin placed → +0";
      api.reveal(target, guess);
      total += pts; log.push(pts); track(total);
      feedback(bar, pts > 300 ? true : pts > 0 ? null : false, msg);
      step++;
      nextBtn(bar, step < 2 ? "Next pin →" : "Geography question →", step < 2 ? doPin : doMC);
    }
  };
  const doMC = () => {
    const body = screen("🌎 World Rush", "Geography question · 100 pts");
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
    feedback(body, ok, ok ? `Correct! +${value}` : i === -2 ? "Skipped. +0" : i < 0 ? "Time's up. +0" : "Not quite. +0");
    done(ok ? value : 0);
  }
}

// ---------- 2. History Timeline ----------
function history() {
  const set = session.set.history;
  const rounds = [{ ...set.r1, secs: 30, max: 400 }, { ...set.r2, secs: 45, max: 600 }];
  let total = 0, r = 0; const log = [];
  const R = rng(session.day * 7 + 3);
  const play = () => {
    const rd = rounds[r];
    const body = screen("📜 Time Warp", `Round ${r + 1} of 2 · ${rd.theme} · up to ${rd.max} pts`);
    // Instructions follow the layout: stacked cards (≤560px, same breakpoint as the CSS) read top → bottom, a row reads left → right.
    body.append(h("p", { class: "prompt" }, "Drag the cards into order — ",
      h("b", { class: "tl-dir tl-dir--v" }, "earliest at top, latest at bottom"), h("b", { class: "tl-dir tl-dir--h" }, "earliest on the left, latest on the right"), "."));
    let order = shuffle(rd.events.map((_, i) => i), R);
    if (order.every((v, i) => v === i)) order.reverse();
    const line = h("div", { class: "timeline" });
    const axis = h("div", { class: "axis" }, h("span", {}, "Earliest ←"), h("span", {}, "→ Latest"));
    const vaxis = h("div", { class: "vaxis", "aria-hidden": "true" }, h("span", {}, "Earliest"), h("i", {}), h("span", {}, "Latest"));
    body.append(h("p", { class: "drag-hint" }, "☝️ Touch and drag to reorder"), axis, h("div", { class: "tl-wrap" }, vaxis, line));
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
    const btn = h("button", { class: "btn primary big", onclick: () => submit(false) }, "Lock in order");
    bar.append(btn, skipBtn(() => submit(true)));
    const timer = Timer(rd.secs, () => submit(false), body.parentNode.querySelector(".game-head"));
    function submit(skipped) {
      if (locked) return; locked = true; timer.stop(); btn.remove(); bar.querySelector(".skip-btn")?.remove();
      let good = 0, pairs = 0;
      for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) { pairs++; if (rd.events[order[i]][2] < rd.events[order[j]][2]) good++; }
      const pts = skipped ? 0 : Math.round(rd.max * good / pairs);
      render();
      const correct = rd.events.map((e, i) => i).sort((a, b) => rd.events[a][2] - rd.events[b][2]);
      body.append(h("p", { class: "muted" }, "Correct order: " + correct.map(i => rd.events[i][1] + " (" + (rd.events[i][2] < 0 ? -rd.events[i][2] + " BC" : rd.events[i][2]) + ")").join(" → ")));
      feedback(body, skipped ? false : good === pairs ? true : good > pairs / 2 ? null : false, skipped ? "Skipped. +0" : `${good}/${pairs} pairs in order → ${pts} pts`);
      total += pts; log.push(pts); track(total); r++;
      body.querySelector(".drag-hint")?.remove(); body.querySelector(".prompt")?.remove(); body.classList.add("tw-done");
      if (r < 2) nextBtn(bar, "Round 2 →", play); else catDone(body, total, log.join("/"));
    }
  };
  play();
}

// ---------- 3. Sports IQ ----------
// Sports IQ is timed like every other section: SPORTS_SECONDS per question, same Timer bar component.
// Time out = 0 points and the question ends, exactly like the World Rush multiple-choice timeout.
const SPORTS_SECONDS = 20;
// Partial credit: order questions score round(value × items in the correct position / n).
const PARTIAL_ORDER = true;
// Stat-chart / sports SVG: assets/<img>.svg (same pattern as Think Fast illusions); placeholder if missing.
// Art lookup goes through the icon map first (assets/icons.js maps sports-dN-qM → a shared
// sport-*.svg). Missing/broken art is removed cleanly — never a "coming soon" placeholder.
const artSrc = id => (id && window.ICONS && window.ICONS[id]) || (id && /^[a-z0-9-]+$/i.test(id) ? "assets/" + id + ".svg" : null);
function artBox(cls, id, alt) {
  const box = h("div", { class: cls }), own = id && /^[a-z0-9-]+$/i.test(id) ? "assets/" + id + ".svg" : null, src = own || artSrc(id);
  if (!src) { box.hidden = true; return box; }
  const img = h("img", { src, alt, decoding: "async" });
  // Prefer the question's own art file; fall back to the generic icons.js mapping only if it 404s.
  img.addEventListener("error", () => { const fb = artSrc(id); if (fb && img.getAttribute("src") !== fb) { img.src = fb; return; } box.remove(); scheduleFit(); }); img.addEventListener("load", scheduleFit);
  box.append(img); return box;
}
function sportsArt(id, alt) { return artBox("tf-svg sports-chart", id, alt || "Sports illustration"); }
// Q3 team-path: order nicknames first→last. Vertical chips, drag / ▲▼ / tap-to-swap / arrow keys.
function orderQuestion(body, q, value, seconds, done) {
  const items = (q.items || []).slice();
  const n = items.length;
  body.append(h("p", { class: "prompt" }, q.q));
  body.append(h("p", { class: "drag-hint" }, "Drag into order — first team at the top. Or use ▲▼, tap two chips to swap, or arrow keys."));
  let order = seededOrder(n, session.key + "|order|" + q.q);
  if (order.every((v, i) => v === i)) order = seededOrder(n, session.key + "|order|" + q.q + "|reshuffle");
  if (order.every((v, i) => v === i) && n > 1) { const o = order.slice(); [o[0], o[n - 1]] = [o[n - 1], o[0]]; order = o; }
  let locked = false, sel = null;
  const live = h("div", { class: "sr-only", "aria-live": "polite", "aria-atomic": "true" });
  const list = h("div", { class: "order-list", role: "list", "aria-label": "Teams in career order, first at top" });
  const wrap = h("div", { class: "order-wrap" },
    h("div", { class: "order-ends" }, h("span", { class: "order-end" }, "FIRST"), h("span", { class: "order-end" }, "LAST")),
    list);
  body.append(wrap, live);
  const announce = t => { live.textContent = ""; void live.offsetWidth; live.textContent = t; };
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
  const btn = h("button", { class: "btn primary big", onclick: () => submit(false) }, "Lock in order");
  bar.append(btn, skipBtn(() => submit(true)));
  const timer = seconds ? Timer(seconds, () => submit(false, true), body.parentNode.querySelector(".game-head")) : null;
  function submit(skipped, timedOut) {
    if (locked) return; locked = true; timer && timer.stop(); btn.remove(); bar.querySelector(".skip-btn")?.remove();
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
    body.append(h("p", { class: "muted order-reveal" }, "Correct order: " + items.join(" → ")));
    if (q.explain) body.append(h("p", { class: "muted tf-explain" }, q.explain));
    const msg = skipped ? "Skipped. +0" : timedOut ? "Time's up. +0" : exact ? `Correct! +${pts}` : PARTIAL_ORDER ? `${good}/${pairs} in the right spot → +${pts}` : `Not quite. +0`;
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
  const opts = h("div", { class: "bracket-opts", role: "group", "aria-label": "Pick the winner" });
  teams.forEach((name, i) => {
    const b = h("button", { class: "bracket-chip", type: "button", "aria-pressed": "false",
      onclick: () => { if (over) return; picked = i; [...opts.children].forEach((c, j) => { c.classList.toggle("bracket-sel", j === i); c.setAttribute("aria-pressed", j === i ? "true" : "false"); }); live.textContent = name + " selected"; lockBtn.disabled = false; } }, name);
    opts.append(b);
  });
  body.append(fork, opts, live);
  const bar = actionBar(body);
  const lockBtn = h("button", { class: "btn primary big", type: "button", disabled: true, onclick: () => submit(false) }, "Lock in");
  bar.append(lockBtn, skipBtn(() => submit(true)));
  const timer = seconds ? Timer(seconds, () => submit(false, true), body.parentNode.querySelector(".game-head")) : null;
  function submit(skipped, timedOut) {
    if (over) return; over = true; timer && timer.stop(); lockBtn.remove(); bar.querySelector(".skip-btn")?.remove();
    const choice = skipped || timedOut ? -1 : picked;
    const ok = choice === answer;
    [...opts.children].forEach((b, i) => {
      b.disabled = true;
      if (i === answer) b.classList.add("right");
      else if (i === choice) b.classList.add("wrong");
    });
    if (q.explain) body.append(h("p", { class: "muted tf-explain" }, q.explain));
    const pts = ok ? value : 0;
    feedback(body, ok, skipped ? "Skipped. +0" : timedOut ? "Time's up. +0" : ok ? `Correct! +${value}` : "Not quite. +0");
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
  body.append(h("p", { class: "drag-hint" }, "Tap a name, then a record to pair them. Tap a pair again to unpair. Drag also works."));
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
  const announce = t => { live.textContent = ""; void live.offsetWidth; live.textContent = t; };
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
  const lockBtn = h("button", { class: "btn primary big", type: "button", disabled: true, onclick: () => submit(false) }, "Lock in pairs");
  bar.append(lockBtn, skipBtn(() => submit(true)));
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
    body.append(h("p", { class: "muted order-reveal" }, "Correct: " + lines.join("; ")));
    if (q.explain) body.append(h("p", { class: "muted tf-explain" }, q.explain));
    const msg = skipped ? "Skipped. +0" : timedOut ? "Time's up. +0" : exact ? `Correct! +${pts}` : PARTIAL_MATCH ? `${good}/${n} correct → +${pts}` : `Not quite. +0`;
    feedback(body, exact && !skipped && !timedOut ? true : pts > 0 ? null : false, msg);
    done(pts);
  }
  render();
}
function sports() {
  const qs = session.set.sports, vals = [250, 350, 400], labels = ["Easy", "Medium", "Hard"];
  let total = 0, i = 0; const log = [];
  const ask = () => {
    const q = qs[i], body = screen("🏆 MVP", `Question ${i + 1} of 3 · ${labels[i]} · ${vals[i]} pts`);
    const after = pts => { total += pts; track(total); log.push(pts); i++; if (i < 3) nextBtn(actionBar(body), "Next question →", ask); else catDone(body, total, log.join("/")); };
    const t = q.type || "text";
    if (t === "order") orderQuestion(body, q, vals[i], SPORTS_SECONDS, after);
    else if (t === "bracket") bracketQuestion(body, q, vals[i], SPORTS_SECONDS, after);
    else if (t === "match") matchQuestion(body, q, vals[i], SPORTS_SECONDS, after);
    else if (t === "guess") guessQuestion(body, q, vals[i], SPORTS_SECONDS, after, { timeoutZero: true });
    else if (t === "mc") mcQuestion(body, q.q, q.options, q.a, vals[i], SPORTS_SECONDS, after, q.img ? sportsArt(q.img, "Sports") : q.visual);
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
  const input = h("input", { class: "txt", placeholder: "Type your answer", autocomplete: "off", autocapitalize: "off", spellcheck: "false" });
  const form = h("form", { class: "answer", onsubmit: e => { e.preventDefault(); if (input.value.trim()) submit(input.value); } }, input, h("button", { class: "btn primary", type: "submit" }, "Lock in"));
  body.append(form); setTimeout(() => input.focus(), 50);
  const skipBar = ensureSkipBar(body, () => submit(null, false, true));
  // tq.timeoutZero (Sports IQ): running out of time scores 0 with "Time's up", like mcQuestion's choose(-1).
  const timeUp = () => tq && tq.timeoutZero ? submit(null, true) : submit(input.value);
  const timer = seconds ? Timer(seconds, timeUp, body.parentNode.querySelector(".game-head")) : null;
  function submit(v, timedOut, skipped) {
    if (over) return; over = true; timer && timer.stop(); input.disabled = true; form.querySelector("button").remove();
    skipBar.querySelector(".skip-btn")?.remove();
    if (skipped) { feedback(body, false, `Skipped. Answer: ${display.replace(/\b\w/g, c => c.toUpperCase())}. +0`); done(0); return; }
    if (timedOut) { feedback(body, false, `Time's up. Answer: ${display.replace(/\b\w/g, c => c.toUpperCase())}. +0`); done(0); return; }
    const ok = window.Answers ? window.Answers.checkAnswer(v || "", answers, { aliases: src && src.aliases, wrong: src && (src.wrong || src.options), noSurname: src && src.noSurname, textOnly: src && src.textOnly, person: src && src.person, q: src && typeof src.q === "string" ? src.q : "" })
      : answers.some(a => norm(a) === norm(v || ""));
    feedback(body, ok, (ok ? `Correct! +${value}` : `Answer: ${display.replace(/\b\w/g, c => c.toUpperCase())}. +0`) + (explain ? " — " + explain : ""));
    done(ok ? value : 0);
  }
}

// ---------- 4. Word Challenge ----------
function wordChallenge() { ({ flip: wordFlip, bridge: wordBridge, conn: connections, odd: oddOneOut, anag: anagramRush })[wordGameFor(session.day).id](); }

function wordFlip() {
  const list = session.set.wordFlip, R = rng(session.day);
  const body = screen("📝 Unscramble", "6 words · 60 seconds");
  let i = 0, total = 0, over = false, busy = false, built = [];
  // Any dictionary word using exactly the same letters also counts (e.g. LISTEN for SILENT).
  const dict = new Set(Object.values(window.ANAGRAM_SETS || {}).flatMap(s => s.valid || []).map(w => w.toUpperCase()));
  const sorted = x => x.split("").sort().join("");
  const hintEl = h("div", { class: "hint" }), slots = h("div", { class: "slots" }), tiles = h("div", { class: "tiles" }), prog = h("div", { class: "prog" });
  const ctrls = h("div", { class: "row" }, h("button", { class: "btn", onclick: () => { if (busy) return; built.pop(); draw(); } }, "↩ Undo"), h("button", { class: "btn", onclick: () => { if (busy) return; built = []; draw(); } }, "Clear"));
  const results = [];
  // Skipped words go to the back of the queue and come back while time remains.
  let queue = list.slice(0, 6).map((_, k) => k), cur = 0;
  body.append(prog, hintEl, slots, tiles, ctrls, h("p", { class: "skip-note" }, "Skipped words come back at the end if time remains."));
  const flipBar = actionBar(body); flipBar.append(skipBtn(() => { if (busy) return; skip(); }, "Skip →"));
  let letters = [];
  const val = k => k < 4 ? 150 : 200;
  const load = () => {
    i = queue[0]; const [w] = list[i];
    do letters = shuffle(w.split("").map((c, k) => ({ c, k })), R); while (letters.map(l => l.c).join("") === w);
    built = []; draw();
  };
  const draw = () => {
    const [w, style, hint] = list[i];
    prog.textContent = `Word ${i + 1}/6 · ${val(i)} pts · Score ${total}/1,000 pts` + (queue.length < 6 ? ` · ${queue.length} left` : "");
    hintEl.innerHTML = ""; hintEl.append(h("span", { class: "badge" }, style), " ", hint);
    slots.innerHTML = ""; w.split("").forEach((_, k) => slots.append(h("span", { class: "slot" + (built[k] != null ? " on" : "") }, built[k] != null ? letters[built[k]].c : "")));
    tiles.innerHTML = ""; letters.forEach((l, k) => tiles.append(h("button", { class: "tile", disabled: built.includes(k), onclick: () => { if (busy) return; built.push(k); draw(); check(); } }, l.c)));
  };
  const check = () => {
    const w = list[i][0];
    if (built.length < w.length) return;
    const guess = built.map(k => letters[k].c).join("");
    busy = true; // block input during the win/shake animation
    if (guess === w || (sorted(guess) === sorted(w) && dict.has(guess))) { total += val(i); track(total); results[i] = true; slots.classList.add("win"); setTimeout(() => { if (!body.isConnected) return; slots.classList.remove("win"); busy = false; advance(); }, 350); }
    else { slots.classList.add("shake"); setTimeout(() => { slots.classList.remove("shake"); busy = false; if (over) return; built = []; draw(); }, 400); }
  };
  const advance = () => { if (over) return; queue.shift(); if (!queue.length) end(); else load(); };
  const skip = () => { if (over) return; results[i] = false; queue.push(queue.shift()); load(); };
  const end = () => {
    if (over) return; over = true; timer.stop(); ctrls.remove(); flipBar.remove(); tiles.remove(); slots.remove(); hintEl.remove(); prog.remove();
    body.append(h("ul", { class: "review" }, list.map(([w], k) => h("li", { class: results[k] ? "ok" : "no" }, (results[k] ? "✓ " : "✗ ") + w))));
    catDone(body, total, "flip");
  };
  onKey = e => {
    if (over) return false;
    if (busy) return /^[a-z]$/i.test(e.key) || e.key === "Backspace" ? undefined : false;
    if (e.key === "Backspace") { built.pop(); draw(); return; }
    if (/^[a-z]$/i.test(e.key)) { const k = letters.findIndex((l, idx) => l.c === e.key.toUpperCase() && !built.includes(idx)); if (k >= 0) { built.push(k); draw(); check(); } return; }
    return false;
  };
  body.append(h("p", { class: "kbd-tip" }, "⌨️ Type letters on your keyboard · Backspace to undo"));
  const timer = Timer(60, end, body.parentNode.querySelector(".game-head"));
  load();
}

function wordBridge() {
  const list = session.set.wordBridge;
  const body = screen("📝 Word Bridge", "6 puzzles · 60 seconds");
  let i = 0, total = 0, over = false, busy = false; const res = [];
  const val = k => k < 4 ? 150 : 200;
  const prog = h("div", { class: "prog" }), puzzle = h("div", { class: "bridge" });
  const input = h("input", { class: "txt", placeholder: "Missing word", autocomplete: "off", autocapitalize: "characters", spellcheck: "false" });
  const form = h("form", { class: "answer", onsubmit: e => { e.preventDefault(); guess(); } }, input, h("button", { class: "btn primary", type: "submit" }, "Submit"));
  let queue = list.slice(0, 6).map((_, k) => k);
  body.append(prog, puzzle, form, h("p", { class: "skip-note" }, "Skipped puzzles come back at the end if time remains."));
  const brBar = actionBar(body); brBar.append(skipBtn(() => skipB(), "Skip →"));
  const draw = () => { i = queue[0]; const [a, b] = list[i]; prog.textContent = `Puzzle ${i + 1}/6 · ${val(i)} pts · Score ${total}/1,000 pts` + (queue.length < 6 ? ` · ${queue.length} left` : ""); puzzle.innerHTML = ""; puzzle.append(h("span", {}, a), h("span", { class: "gap" }, "?"), h("span", {}, b)); input.value = ""; input.focus(); };
  const guess = () => {
    if (over || busy) return; // lock during the win animation: a double Enter must not score twice / skip a puzzle
    const v = norm(input.value).toUpperCase().replace(/ /g, ""); if (!v) return;
    if (v === list[i][2]) { busy = true; total += val(i); track(total); res[i] = true; puzzle.classList.add("win"); setTimeout(() => { busy = false; if (!body.isConnected) return; puzzle.classList.remove("win"); adv(); }, 300); }
    else { form.classList.add("shake"); setTimeout(() => form.classList.remove("shake"), 400); input.select(); }
  };
  const adv = () => { if (over) return; queue.shift(); if (!queue.length) end(); else draw(); };
  const skipB = () => { if (over || busy) return; res[i] = false; queue.push(queue.shift()); draw(); };
  const end = () => {
    if (over) return; over = true; timer.stop(); form.remove(); brBar.remove(); puzzle.remove(); prog.remove();
    body.append(h("ul", { class: "review" }, list.map(([a, b, w], k) => h("li", { class: res[k] ? "ok" : "no" }, `${res[k] ? "✓" : "✗"} ${a} ${w} · ${w} ${b}`))));
    catDone(body, total, "bridge");
  };
  const timer = Timer(60, end, body.parentNode.querySelector(".game-head"));
  draw();
}

function connections() {
  const set = session.set.connections;
  const body = screen("📝 Clusters", "Find 3 groups of 3 · 90 seconds");
  let words = shuffle(set.groups.flatMap(g => g.words), rng(session.day)), sel = [], found = [], mistakes = 0, total = 0, over = false;
  const solved = h("div", { class: "solved" }), grid = h("div", { class: "grid3" }), info = h("div", { class: "prog" });
  // Secondary controls: small outline pills in their own row under the grid (visibly unlike the word tiles);
  // Submit is the primary action in the bottom bar.
  const ctrls = h("div", { class: "pill-row" },
    h("button", { class: "pill-btn", type: "button", onclick: () => { words = shuffle(words); draw(); } }, h("span", { "aria-hidden": "true" }, "⇄"), " Shuffle"),
    h("button", { class: "pill-btn", type: "button", onclick: () => { sel = []; draw(); } }, h("span", { "aria-hidden": "true" }, "✕"), " Deselect"));
  body.append(info, solved, grid, ctrls);
  const subBar = actionBar(body);
  subBar.append(h("button", { class: "btn primary big", id: "csub", onclick: () => submit() }, "Submit"), skipBtn(() => end()));
  // Incremental updates: solved groups are appended once (their animation plays once);
  // selecting a word only toggles that tile's class; the grid is rebuilt only when words change.
  const shown = new Set(); let gridKey = "";
  const draw = () => {
    info.innerHTML = ""; info.append(`Score ${total}/1,000 pts · Mistakes left: `, h("b", {}, "●".repeat(3 - mistakes) + "○".repeat(mistakes)));
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
    else { mistakes++; const one = set.groups.some(g => g.words.filter(w => sel.includes(w)).length === 2); grid.classList.add("shake"); setTimeout(() => grid.classList.remove("shake"), 400); if (one) feedbackTmp("One away…"); sel = []; if (mistakes >= 3) return end(); }
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
  const body = screen("📝 Imposter", "8 puzzles · 60 seconds");
  let i = 0, total = 0, over = false; const res = [];
  const val = k => k < 4 ? 100 : 150;
  const prog = h("div", { class: "prog" }), opts = h("div", { class: "options two" });
  body.append(prog, h("p", { class: "prompt" }, "Which one doesn't belong?"), opts);
  const oddBar = actionBar(body); oddBar.append(skipBtn(() => pickIt(-1)));
  let drawnAt = 0;
  const draw = () => {
    drawnAt = performance.now();
    prog.textContent = `Puzzle ${i + 1}/8 · ${i < 4 ? "Medium" : "Hard"} · ${val(i)} pts · Score ${total}/1,000 pts`;
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
  const valid = new Set(set.valid), PTS = { 3: 10, 4: 25, 5: 50, 6: 100 };
  // Behind-the-scenes conversion (NOT finalized in spec): 1,000 = 60% of the raw points available from common words.
  const target = 0.6 * set.common.reduce((a, w) => a + PTS[w.length], 0);
  const body = screen("📝 Anagram Rush", "6 letters · 60 seconds");
  let letters = shuffle(set.letters.split(""), rng(session.day)), built = [], found = [], raw = 0, over = false;
  const scoreEl = h("div", { class: "raw" }), cur = h("div", { class: "slots" }), tiles = h("div", { class: "tiles" }), list = h("div", { class: "found" });
  const form = h("p", { class: "kbd-tip" }, "⌨️ Type letters · Enter to submit · Backspace to delete · Space to shuffle");
  const ctrls = h("div", { class: "row" }, h("button", { class: "btn", onclick: () => { letters = shuffle(letters); built = []; draw(); } }, "🔀 Shuffle"), h("button", { class: "btn", onclick: () => { built = []; draw(); } }, "Clear"), h("button", { class: "btn primary", onclick: () => tryWord(built.map(k => letters[k]).join("")) }, "Submit word"));
  body.append(scoreEl, cur, tiles, ctrls, form, list);
  const anBar = actionBar(body); anBar.append(skipBtn(() => end()));
  // Update in place (no innerHTML rebuild on each key/submit) so Enter never re-creates the screen or moves focus.
  const slotEls = Array.from({ length: 6 }, () => h("span", { class: "slot" }));
  cur.append(...slotEls);
  let tileEls = [];
  const buildTiles = () => { tiles.replaceChildren(...(tileEls = letters.map((l, k) => h("button", { class: "tile", onclick: () => { if (!built.includes(k)) { built.push(k); draw(); } } }, l)))); };
  const scoreB = h("b", {}, "0"), scoreRest = h("small", { class: "raw-sub" });
  scoreEl.append("Score ", scoreB, "/1,000 pts", scoreRest);
  let shownFound = 0;
  const draw = () => {
    scoreB.textContent = Math.min(1000, Math.round(raw / target * 1000)); scoreRest.textContent = `${found.length} words · ${raw} raw`;
    slotEls.forEach((el, k) => { const on = built[k] != null; el.className = "slot" + (on ? " on" : ""); el.textContent = on ? letters[built[k]] : ""; });
    if (tileEls.length !== letters.length || tileEls.some((b, k) => b.textContent !== letters[k])) buildTiles();
    tileEls.forEach((b, k) => { b.disabled = built.includes(k); });
    while (shownFound < found.length) { const w = found[found.length - 1 - shownFound]; list.prepend(h("span", { class: "chip" }, w.toUpperCase() + " +" + PTS[w.length])); shownFound++; }
  };
  // Fixed-height feedback line: text changes in place, no element insert/remove, no full-screen flash (layout never shifts).
  const fbSlot = h("div", { class: "an-fb", "aria-live": "polite" });
  let fbT = 0;
  const flash = (t, ok) => { fbSlot.textContent = t; fbSlot.className = "an-fb show " + (ok === true ? "good" : ok === false ? "bad" : "neutral"); clearTimeout(fbT); fbT = setTimeout(() => { fbSlot.className = "an-fb"; }, 900); };
  const tryWord = w => {
    if (over) return; w = w.toLowerCase().trim(); built = [];
    if (w.length < 3) { draw(); return; }
    if (found.includes(w)) flash("Already found", null);
    else if (valid.has(w)) { found.unshift(w); raw += PTS[w.length]; track(Math.min(1000, Math.round(raw / target * 1000))); flash("+" + PTS[w.length], true); }
    else flash("Not a word", false);
    draw();
  };
  const end = () => {
    if (over) return; over = true; timer.stop(); clearTimeout(fbT); fbSlot.remove(); tiles.remove(); ctrls.remove(); anBar.remove(); form.remove(); cur.remove();
    const missed = set.common.filter(w => !found.includes(w));
    body.append(h("p", { class: "muted" }, "Missed words: " + (missed.length ? missed.map(w => w.toUpperCase()).join(", ") : "none — wow!")));
    // ONE number everywhere: the converted /1,000 score is what the header shows, what is banked and what the total sums.
    body.append(h("p", { class: "muted" }, `${found.length} word${found.length === 1 ? "" : "s"} · ${fmt(raw)} raw points`));
    catDone(body, Math.min(1000, Math.round(raw / target * 1000)), "anag raw " + raw);
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
const TF_KIND = { math: "Math trap", sequence: "Sequence", logic: "Logic", guesstimate: "Guesstimate", illusion: "Optical illusion", riddle: "Lateral riddle" };
// Illusion art: Designer's SVGs have fixed colours, so a plain <img> (uniform scale via object-fit) — placeholder if missing.
function puzzleArt(id) { return artBox("tf-svg", id, "Optical illusion — look closely, then answer"); }
function guessQuestion(body, q, value, seconds, done, gq) {
  body.append(h("p", { class: "prompt" }, q.q));
  let over = false;
  const yearMode = q.exactYear === true || typeof q.yearBand === "number";
  const yearBand = typeof q.yearBand === "number" && isFinite(q.yearBand) ? Math.max(0, q.yearBand) : 0;
  const input = h("input", { class: "txt", placeholder: yearMode ? "Year" : "Your best estimate", inputmode: "decimal", autocomplete: "off", autocapitalize: "off", spellcheck: "false", "aria-label": "Your estimate" + (q.unit ? " in " + q.unit : "") });
  const form = h("form", { class: "answer guess", onsubmit: e => { e.preventDefault(); if (input.value.trim()) submit(input.value); } },
    h("div", { class: "guess-field" }, input, q.unit ? h("span", { class: "guess-unit" }, q.unit) : null),
    h("button", { class: "btn primary", type: "submit" }, "Lock in"));
  const noteTxt = yearMode
    ? (yearBand > 0 ? `Exact year ±${yearBand} = full points · otherwise 0` : "Exact year only = full points · otherwise 0")
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
        off = diff ? ` Off by ${diff} year${diff === 1 ? "" : "s"}.` : "";
      } else {
        pts = window.Answers.closenessScore(n, q.answer, value);
        off = !q.answer ? "" : ` You were ${Math.round(Math.abs(n - q.answer) / Math.abs(q.answer) * 100)}% off.`;
      }
    }
    feedback(body, pts === value ? true : pts > 0 ? null : false, (skipped ? "Skipped." : n === null ? "Time's up." : pts === value ? "Spot on!" : pts > 0 ? "Close!" : "Not close.") +
      ` Answer: ${fmtN(q.answer)}${q.unit ? " " + q.unit : ""}.${off} +${pts}` + (q.explain ? " — " + q.explain : ""));
    done(pts);
  }
}
function thinkFast() {
  const qs = session.set.thinkFast.map(normPuzzle), vals = [400, 600];
  let total = 0, i = 0; const log = [];
  const ask = () => {
    const q = qs[i], kind = TF_KIND[q.kind] ? " · " + TF_KIND[q.kind] : "";
    const body = screen("🧠 Brain Teaser", `Puzzle ${i + 1} of 2${kind} · ${vals[i]} pts · one submission`);
    const next = pts => { total += pts; track(total); log.push(pts); i++; if (i < 2) nextBtn(actionBar(body), "Final puzzle →", ask); else catDone(body, total, log.join("/")); };
    if (q.type === "guess") guessQuestion(body, q, vals[i], TBD.think, next);
    else if (q.type === "mc") {
      const pin = q.kind === "illusion" ? q.options.findIndex(o => /equal|same/i.test(o)) : -1; // "They're equal" stays last; others seeded-shuffled
      mcQuestion(body, q.q, q.options, q.a, vals[i], TBD.think, pts => { if (q.explain) body.append(h("p", { class: "muted tf-explain" }, q.explain)); next(pts); },
        q.img || q.kind === "illusion" ? puzzleArt(q.img) : null, pin);
    } else textQuestion(body, q.q, q.answers, vals[i], TBD.think, next, null, q.answers[0], q.explain, q);
  };
  ask();
}

// ---------- results ----------
const blocks = s => s >= 900 ? "🟩" : s >= 600 ? "🟨" : s >= 300 ? "🟧" : "🟥";
const SITE_URL = "https://lukebiasi11.github.io/Brainclash.com/";
const shareText = () => `Brain Clash ${session.practice ? "(practice)" : "#" + gameNumber(dayOfKey(session.key)) + " · " + session.key}\n${session.scores.map((s, i) => CATS[i].icon + " " + blocks(s) + " " + s).join("\n")}\n🏁 ${session.scores.reduce((a, b) => a + b, 0).toLocaleString()} / 5,000\n${SITE_URL}`;
async function doShare(btn) { const t = shareText(); try { if (navigator.share) await navigator.share({ text: t }); else { await navigator.clipboard.writeText(t); btn.textContent = "Copied!"; } } catch {} }
// Lightweight confetti on a single canvas (~2 s, no library).
// Fix (Oct 26): the canvas used to sit at z-index 1 INSIDE the modal, under the card (z-index 2), which covers
// nearly the whole phone width, so the burst was hidden. It now sits ABOVE the card (pointer-events: none),
// is sized from its own layout box after insertion (never 0), and starts on the next frame after the modal paints.
// Reduced motion: one static scatter that fades out with no movement.
function confetti(host) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const c = h("canvas", { class: "confetti-canvas", "aria-hidden": "true" }); host.append(c);
  requestAnimationFrame(() => {
    if (!c.isConnected) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = c.clientWidth || innerWidth || document.documentElement.clientWidth, ch = c.clientHeight || innerHeight || document.documentElement.clientHeight;
    const W = c.width = Math.max(1, Math.round(cw * dpr)), H = c.height = Math.max(1, Math.round(ch * dpr)), ctx = c.getContext("2d");
    const cols = ["#E8582A", "#F2C230", "#FFF6E8", "#1F2C7A"];
    const N = W < 900 * dpr ? 70 : 110;
    const ps = Array.from({ length: N }, (_, n) => { const left = n % 2 === 0; return {
      x: left ? W * .05 : W * .95, y: H * (.15 + Math.random() * .1),
      vx: (left ? 1 : -1) * (3 + Math.random() * 9) * dpr, vy: (-4 - Math.random() * 9) * dpr,
      r: (5 + Math.random() * 6) * dpr, a: Math.random() * 6, va: (Math.random() - .5) * .4, c: cols[Math.random() * 4 | 0] }; });
    const paint = (alpha) => ps.forEach(p => { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.globalAlpha = alpha; ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore(); });
    if (reduce) {
      ps.forEach(p => { p.x = Math.random() * W; p.y = Math.random() * H * .45; });
      paint(.9); c.style.transition = "opacity .6s"; setTimeout(() => { c.style.opacity = 0; }, 1200); setTimeout(() => c.remove(), 1900); return;
    }
    const t0 = performance.now(), LIFE = 2200;
    const step = t => {
      if (!c.isConnected) return; const k = t - t0; ctx.clearRect(0, 0, W, H);
      ps.forEach(p => { p.vy += .28 * dpr; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va; });
      paint(Math.max(0, Math.min(1, 1.6 - 1.6 * k / LIFE)));
      if (k < LIFE) requestAnimationFrame(step); else c.remove();
    };
    requestAnimationFrame(step);
  });
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
  perfect: ["Flawless. Are you cheating, or just insufferable?", "5,000. Go outside, you've earned it.", "Perfect score. We're calling your mom to brag."],
  great: ["Big brain energy. Mildly annoying, honestly.", "Strong showing. Don't let it go to your head.", "Impressive. The other brains are taking notes."],
  mid: ["Solidly… fine. Like a beige couch.", "Not bad, not great. Peak Tuesday energy.", "Your brain showed up. Mostly."],
  rough: ["Rough one. Your brain called in sick?", "Well, at least you finished.", "Bold strategy: guess everything."],
  zero: ["Zero. Impressive in its own way.", "A perfect zero. Was the phone upside down?", "Nothing! Tomorrow can only go up."]
};
function snarkLine(tot) {
  const band = tot >= 5000 ? "perfect" : tot >= 3750 ? "great" : tot >= 2000 ? "mid" : tot > 0 ? "rough" : "zero";
  const l = SNARK[band]; return l[((session ? session.day : 0) % l.length + l.length) % l.length];
}
// Category-level quips (per 1,000-point category): roast low, praise high. Stable per day + category.
const CAT_QUIP = {
  top: ["Showing off now, are we?", "Clean sweep. Rude, honestly.", "That category never stood a chance."],
  good: ["Nicely done. Keep that energy.", "Solid. Your brain is warmed up.", "Respectable work. Carry on."],
  mid: ["Middle of the pack. Very… balanced.", "Half right, half vibes.", "Could be worse. Could be better."],
  low: ["Oof. Shake it off.", "That one bit back.", "Let's pretend that didn't happen."],
  zero: ["A goose egg. Bold.", "Zero. Next category, quickly.", "Nothing? The next one's yours."]
};
function catQuip(score, cat) {
  const band = score >= 900 ? "top" : score >= 650 ? "good" : score >= 350 ? "mid" : score > 0 ? "low" : "zero";
  const l = CAT_QUIP[band], k = (session ? session.day : 0) * 7 + (cat || 0);
  return l[((k % l.length) + l.length) % l.length];
}
function resultsPopup() {
  if ($(".result-modal")) return;
  countStats();
  const tot = session.scores.reduce((a, b) => a + b, 0);
  const num = h("b", { class: "result-modal__score" }, "0");
  const close = () => { m.remove(); document.removeEventListener("keydown", esc); };
  const esc = e => { if (e.key === "Escape") close(); };
  const shareBtn = h("button", { class: "btn primary big result-modal__share", onclick: () => doShare(shareBtn) }, "📤 Share result");
  const m = h("div", { class: "result-modal", role: "dialog", "aria-modal": "true", "aria-label": "Clash complete" },
    h("div", { class: "result-modal__card" },
      h("small", { class: "result-modal__kicker" }, session.practice ? "Practice complete" : "Clash complete!"),
      num, h("small", { class: "result-modal__of" }, "/ 5,000"),
      h("p", { class: "result-modal__quip" }, snarkLine(tot)),
      h("div", { class: "result-modal__blocks" }, session.scores.map(x => h("span", {}, blocks(x)))),
      shareBtn,
      h("button", { class: "btn result-modal__full", onclick: () => { close(); results(); } }, "See full results")));
  document.addEventListener("keydown", esc);
  document.body.append(m); confetti(m); countUp(num, tot, 1200);
}
function results() {
  const tot = session.scores.reduce((a, b) => a + b, 0);
  clearScreenTimers(); onKey = null;
  $(".result-modal")?.remove();
  countStats();
  document.body.classList.remove("in-game");
  app.innerHTML = ""; window.scrollTo(0, 0);
  const share = shareText(); // ends with SITE_URL
  app.append(
    h("div", { class: "hero small" }, h("div", { class: "logo" }, "BRAIN", h("span", {}, "CLASH")), h("p", { class: "tag" }, session.practice ? "Practice run complete" : "Today's Clash complete")),
    h("div", { class: "final" }, h("small", {}, "Final score"), h("b", { id: "finalnum" }, "0"), h("small", {}, "/ 5,000"), h("p", { class: "quip" }, snarkLine(tot))),
    h("ol", { class: "path" }, CATS.map((c, i) => h("li", { class: "step done" }, h("span", { class: "num" }, blocks(session.scores[i])), h("span", { class: "ic" }, ic(c.icon, c.img)), h("span", { class: "nm" }, h("b", {}, c.name), c.id === "word" ? h("small", {}, wordGameFor(session.day).name) : null), h("span", { class: "pts" }, fmt(session.scores[i]))))),
    h("pre", { class: "share" }, share),
    h("div", { class: "row center" },
      h("button", { class: "btn primary", onclick: e => doShare(e.currentTarget) }, "Share result"),
      h("button", { class: "btn", onclick: home }, "Home")),
    h("p", { class: "fine" }, "Global & friends leaderboards arrive with accounts in a future version."));
  countUp($("#finalnum"), tot, 1600);
  setTimeout(() => { const f = $("#finalnum"); if (!f) return; const r = f.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, 40); }, 1600);
}

document.addEventListener("click", e => { if (e.target.closest(".brand")) { if (!session || session.inProgress == null || confirm("Leave this game? Progress in the current category is lost.")) home(); } });

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
  const kids = [...body.children].filter(k => !k.classList.contains("lmap") && !k.classList.contains("tf-svg") && !k.classList.contains("action-bar") && !k.classList.contains("order-wrap") && !k.classList.contains("match-board") && !k.classList.contains("bracket-opts") && !k.matches(".btn.big") && !k.querySelector(".lmap"));
  kids.forEach(k => { k.style.zoom = ""; delete k.dataset.fitz; });
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
    const z = Math.max(0.45, cur * (h - excess - 2) / h);
    if (z >= cur - 0.005) break;
    kids.forEach(k => { k.style.zoom = z.toFixed(3); k.dataset.fitz = ""; });
  }
}
new MutationObserver(m => { if (m.some(r => !(r.target.closest && r.target.closest(".timer, .runtotal, .cat-score b")))) scheduleFit(); }).observe(document.getElementById("app"), { childList: true, subtree: true });
(vv || window).addEventListener("resize", scheduleFit);
syncClock();
// ---- Admin preview hooks (admin.html). Inert on normal visits. ----
// ?preview=YYYY-MM-DD plays that day's real set as a practice run: save() and countStats()
// skip practice sessions, so daily progress, stats and streaks are never touched.
window.BCDaily = Object.freeze({ getDailySet, keyOf, dayOfKey, todayKey: () => keyOf(zoneDay(now())), gameNumber, wordGames: WORD_GAMES.map(w => ({ ...w })) });
const PREVIEW_KEY = (location.search.match(/[?&]preview=(\d{4}-\d{2}-\d{2})\b/) || [])[1];
if (window.BC_NO_BOOT) { /* admin.html: content lookups only */ }
else if (PREVIEW_KEY && !isNaN(dayOfKey(PREVIEW_KEY))) {
  session = newSession(true); session.key = PREVIEW_KEY; session.day = dayOfKey(PREVIEW_KEY); session.set = getDailySet(PREVIEW_KEY);
  document.title = "Preview " + PREVIEW_KEY + " — Brain Clash"; window.BCPreview = Object.freeze({ key: PREVIEW_KEY, cat: () => session.scores.length }); runNext();
} else home();
// Dev/test only (inert unless the URL has ?dgtest): jump straight to a category / word-game format for layout tests.
if (/[?&]dgtest\b/.test(location.search)) window.DGTest = Object.freeze({
  jump(cat, wg) {
    let d = 0; if (wg) while (d < 2000 && getDailySet(keyOf(d)).wordGame.id !== wg) d++;
    session = newSession(true); session.key = keyOf(d); session.day = d; session.set = getDailySet(session.key);
    session.scores = Array.from({ length: cat }, () => 0); runNext();
  },
  thinkFast(day) { session = newSession(true); session.set = { ...session.set, thinkFast: day }; session.scores = [0, 0, 0, 0]; runNext(); },
  sports(i) { session = newSession(true); session.set = { ...session.set, sports: C.sports[i] }; session.scores = [0, 0]; runNext(); },
  sportsSet(day) { session = newSession(true); session.set = { ...session.set, sports: day }; session.scores = [0, 0]; runNext(); },
  state() { return session; },
  popup(sc) { session = newSession(true); session.scores = sc || [400, 300, 250, 500, 600]; results(); resultsPopup(); },
  wordGames: () => [...new Set(Array.from({ length: 60 }, (_, d) => getDailySet(keyOf(d)).wordGame.id))]
});
})();
