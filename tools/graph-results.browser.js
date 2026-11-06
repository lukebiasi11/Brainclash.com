// node tools/graph-results.browser.js — results flow, storage safety, EN/ES, 360 and desktop.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const H = require("../graph-history.js");

const ROOT = path.resolve(__dirname, "..");
const SHOTS = path.join("/tmp", "bc-graph-shots");
fs.mkdirSync(SHOTS, { recursive: true });
let bad = 0;
const fail = (name, detail) => { bad++; console.log("FAIL", name, detail == null ? "" : typeof detail === "string" ? detail : JSON.stringify(detail)); };
const pass = name => console.log("ok", name);

function contentType(fp) {
  const ext = path.extname(fp);
  return { ".html": "text/html;charset=utf-8", ".js": "text/javascript;charset=utf-8", ".css": "text/css;charset=utf-8", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".json": "application/json" }[ext] || "application/octet-stream";
}
function startServer() {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent((req.url || "/").split("?")[0]);
    const rel = u === "/" ? "index.html" : u.replace(/^\/+/, "");
    const fp = path.normalize(path.join(ROOT, rel));
    if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(fp, (err, buf) => {
      if (err) { res.writeHead(404); return res.end("missing"); }
      res.writeHead(200, { "Content-Type": contentType(fp), "Cache-Control": "no-store" });
      res.end(buf);
    });
  });
  return new Promise(resolve => srv.listen(0, "127.0.0.1", () => resolve(srv)));
}
function shift(key, delta) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}
function seedSource(entries, lang) {
  const lines = ["try{localStorage.clear();}catch(e){}"];
  if (lang) lines.push("localStorage.setItem('bc-lang'," + JSON.stringify(lang) + ");");
  for (const [k, v] of Object.entries(entries)) lines.push("localStorage.setItem(" + JSON.stringify(k) + "," + JSON.stringify(v) + ");");
  return lines.join("\n");
}
class CDP {
  constructor(ws) {
    this.ws = ws; this.nextId = 0; this.pending = new Map(); this.waiters = new Map(); this.queue = new Map(); this.handlers = [];
    this.reqs = []; this.errors = [];
    ws.addEventListener("message", ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id) {
        const p = this.pending.get(msg.id); if (!p) return; this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message || JSON.stringify(msg.error))); else p.resolve(msg.result || {});
        return;
      }
      if (!msg.method) return;
      this.handlers.forEach(fn => fn(msg.method, msg.params || {}));
      const w = this.waiters.get(msg.method);
      if (w && w.length) w.shift()(msg.params || {});
      else { const q = this.queue.get(msg.method) || []; q.push(msg.params || {}); this.queue.set(msg.method, q); }
    });
    this.on((m, p) => {
      if (m === "Network.requestWillBeSent") this.reqs.push({ url: p.request.url, method: p.request.method });
      if (m === "Runtime.exceptionThrown") this.errors.push(p.exceptionDetails && (p.exceptionDetails.exception && p.exceptionDetails.exception.description || p.exceptionDetails.text) || "exception");
    });
  }
  on(fn) { this.handlers.push(fn); }
  send(method, params = {}, ms = 10000) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { this.pending.delete(id); reject(new Error("timeout " + method)); }, ms);
      this.pending.set(id, { resolve: v => { clearTimeout(t); resolve(v); }, reject: e => { clearTimeout(t); reject(e); } });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  wait(method, ms = 10000) {
    const q = this.queue.get(method);
    if (q && q.length) return Promise.resolve(q.shift());
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("timeout event " + method)), ms);
      const arr = this.waiters.get(method) || [];
      arr.push(v => { clearTimeout(t); resolve(v); });
      this.waiters.set(method, arr);
    });
  }
}
function wsOpen(url) { const ws = new WebSocket(url); return new Promise((resolve, reject) => { ws.addEventListener("open", () => resolve(ws)); ws.addEventListener("error", () => reject(new Error("ws"))); }); }

async function openPage(port, url, seed, viewport) {
  const createdRes = await fetch("http://127.0.0.1:" + port + "/json/new?" + encodeURIComponent("about:blank"), { method: "PUT" });
  const createdText = await createdRes.text();
  let created;
  try { created = JSON.parse(createdText); } catch (e) { throw new Error("json/new " + createdRes.status + " " + createdText.slice(0, 180)); }
  const ws = await wsOpen(created.webSocketDebuggerUrl);
  const cdp = new CDP(ws);
  cdp.id = created.id;
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  if (viewport) await cdp.send("Emulation.setDeviceMetricsOverride", viewport);
  if (seed) await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: seed });
  await cdp.send("Page.navigate", { url });
  const ready = await evalJson(cdp, `new Promise(resolve => { const start = Date.now(); const tick = () => { if (location.href.indexOf('index.html') >= 0 && document.querySelector('#app') && document.querySelector('#app').children.length) resolve(true); else if (Date.now() - start > 8000) resolve(false); else setTimeout(tick, 40); }; tick(); })`);
  if (!ready) throw new Error("page did not render " + url);
  await cdp.send("Runtime.evaluate", { expression: "Promise.race([document.fonts && document.fonts.ready, new Promise(r => setTimeout(r, 2000))])", awaitPromise: true });
  await cdp.send("Runtime.evaluate", { expression: "window.__shareCalls=0; navigator.share=function(){window.__shareCalls++;return Promise.resolve();}; if(!navigator.clipboard) navigator.clipboard={}; navigator.clipboard.writeText=function(){window.__shareCalls++;return Promise.resolve();}; true", returnByValue: true });
  return cdp;
}
async function evalJson(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || ""));
  return r.result ? r.result.value : undefined;
}
async function shot(cdp, name) {
  await evalJson(cdp, "new Promise(r => setTimeout(r, 1700))");
  const metrics = await cdp.send("Page.getLayoutMetrics");
  const width = Math.max(1, Math.ceil(metrics.cssContentSize.width));
  const height = Math.max(1, Math.ceil(metrics.cssContentSize.height));
  const img = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height, scale: 1 } }, 20000);
  fs.writeFileSync(path.join(SHOTS, name), Buffer.from(img.data, "base64"));
}
function forbid(cdp, label) {
  const badReqs = cdp.reqs.filter(r => r.method !== "GET" && r.method !== "HEAD" || /\/v1\/|stats-client|day_agg|workers\.dev/i.test(r.url));
  const offHost = cdp.reqs.filter(r => { try { const u = new URL(r.url); if (u.protocol === "data:") return false; return u.hostname !== "127.0.0.1" && u.hostname !== "fonts.googleapis.com" && u.hostname !== "fonts.gstatic.com"; } catch (e) { return true; } });
  if (badReqs.length || offHost.length) fail(label + " network", { badReqs, offHost });
  else pass(label + " network");
  if (cdp.errors.length) fail(label + " exceptions", cdp.errors.slice(0, 4));
  else pass(label + " no exceptions");
}
async function snap(cdp) {
  return evalJson(cdp, `(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && (k.startsWith('dg-') || k === 'bc-lang')) o[k] = localStorage.getItem(k); } return o; })()`);
}
function sameScores(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) if (k !== "dg-maxday" && before[k] !== after[k]) return k;
  return null;
}

const SCORES = [
  [400, 500, 450, 500, 420],
  [500, 480, 520, 450, 400],
  [520, 500, 480, 510, 450],
  [600, 520, 500, 480, 500],
  [620, 540, 520, 500, 520],
  [700, 680, 660, 640, 680]
];

(async () => {
  const srv = await startServer();
  const origin = "http://127.0.0.1:" + srv.address().port;
  const userDir = fs.mkdtempSync(path.join("/tmp", "bc-chrome-"));
  const chrome = spawn("google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--remote-debugging-port=9334", "--user-data-dir=" + userDir, "--no-first-run", "--disable-background-networking", "--disable-sync", "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
  let chromeLog = "";
  chrome.stderr.on("data", d => { chromeLog += d.toString(); });
  chrome.stdout.on("data", d => { chromeLog += d.toString(); });
  const port = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("chrome did not listen\n" + chromeLog)), 20000);
    const watch = () => { const m = chromeLog.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/); if (m) { clearTimeout(t); resolve(+m[1]); } };
    chrome.stderr.on("data", watch); chrome.stdout.on("data", watch); watch();
  });
  const pages = [];
  try {
    const probe = await openPage(port, origin + "/index.html?dgtest", seedSource({}), null);
    pages.push(probe);
    const today = await evalJson(probe, "BCDaily.todayKey()");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error("today " + today);
    pass("clock day " + today);
    await fetch("http://127.0.0.1:" + port + "/json/close/" + probe.id).catch(() => {});

    const offsets = [-9, -6, -5, -3, -1, 0];
    const pack = {};
    offsets.forEach((off, i) => { pack["dg-" + shift(today, off)] = JSON.stringify({ key: shift(today, off), practice: false, counted: true, scores: SCORES[i], details: [] }); });
    pack["dg-" + shift(today, -4)] = JSON.stringify({ scores: [1, 2, 3], practice: false });
    pack["dg-" + shift(today, -2)] = JSON.stringify({ practice: true, scores: [9, 9, 9, 9, 9] });
    pack["dg-2026-02-31"] = JSON.stringify({ scores: [1, 1, 1, 1, 1] });
    pack["dg-" + shift(today, -8)] = "{not-json";
    pack["dg-stats"] = JSON.stringify({ played: 99, best: 5000, streak: 7, last: today });
    const entries = H.readLocalEntries({ length: Object.keys(pack).length, key: i => Object.keys(pack)[i], getItem: k => pack[k] });
    const expected = H.summarize(H.completedGames(entries, today, null).games, "overall", today);
    const expectedCat = H.summarize(H.completedGames(entries, today, null).games, 0, today);

    async function scenario(name, url, seed, viewport) {
      const cdp = await openPage(port, origin + url, seedSource(seed.entries, seed.lang), viewport);
      pages.push(cdp);
      return cdp;
    }
    const desk = { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false };
    const phone = { width: 360, height: 740, deviceScaleFactor: 2, mobile: true };

    // Desktop completed history.
    {
      const cdp = await scenario("desk", "/index.html?dgtest", { entries: pack }, desk);
      const before = await snap(cdp);
      await evalJson(cdp, "DGTest.openResults(" + JSON.stringify(today) + "," + JSON.stringify(SCORES[5]) + ")");
      const info = await evalJson(cdp, `(() => {
        const g1 = document.getElementById('results-g1'), g2 = document.getElementById('results-g2');
        const share = document.querySelector('#app [data-action=share-results]');
        const order = !!(g1 && g2 && share) && (g1.compareDocumentPosition(g2) & Node.DOCUMENT_POSITION_FOLLOWING) && (g2.compareDocumentPosition(share) & Node.DOCUMENT_POSITION_FOLLOWING);
        const g1t = g1 ? g1.textContent : '';
        return {
          order, collection: g1 && g1.getAttribute('data-collection'), state: g1 && g1.getAttribute('data-g1-state'),
          g1t, rects: g1 ? g1.querySelectorAll('rect').length : -1,
          viewed: g2 && g2.getAttribute('data-viewed-day'), includes: g2 && g2.getAttribute('data-includes-viewed'),
          allCount: g2 && g2.getAttribute('data-all-count'), priorCount: g2 && g2.getAttribute('data-prior-count'),
          allMean: g2 && g2.getAttribute('data-all-mean'), priorMean: g2 && g2.getAttribute('data-prior-mean'),
          allSum: g2 && g2.getAttribute('data-all-sum'), later: g2 && g2.getAttribute('data-later'),
          big: (g2 && g2.querySelector('.g2-big') || {}).textContent || '',
          opts: [...document.querySelectorAll('#g2-metric option')].map(o => o.textContent),
          shareCalls: window.__shareCalls, dash: !!(g2 && g2.querySelector('[data-prior-line]')),
          graph: document.querySelector('.score-graph') ? 'home-graph-on-results' : 'results-only',
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      })()`);
      if (!info.order) fail("desktop order", info); else pass("desktop G1 before G2 before share");
      if (info.collection !== "off" || info.state !== "collection-off") fail("desktop collection", info); else pass("desktop collection off");
      if (/Player average|Top \d+%|\+248 vs|Fictional example|Example data|illustrative preview|3,112|3112/.test(info.g1t)) fail("desktop invented field copy", info.g1t); else pass("desktop no invented field copy");
      if (!/Not live/.test(info.g1t) || !/Comparison unavailable/.test(info.g1t) || !/collection is off/i.test(info.g1t)) fail("desktop unavailable copy", info.g1t); else pass("desktop unavailable copy");
      if (info.rects !== 0) fail("desktop g1 rects", info.rects); else pass("desktop no g1 bars");
      if (info.viewed !== today || info.includes !== "1" || info.allCount !== "6" || info.priorCount !== "5" || info.later !== "0") fail("desktop counts", info); else pass("desktop history counts");
      if (info.allMean !== String(H.roundTenths(expected.allMean)) || info.priorMean !== String(H.roundTenths(expected.priorMean)) || info.allSum !== String(expected.allSum)) fail("desktop means", { info, expected }); else pass("desktop means " + info.priorMean + " / " + info.allMean);
      if (info.big !== String(SCORES[5].reduce((a, b) => a + b, 0))) fail("desktop big", info.big); else pass("desktop big number");
      if (!info.dash) fail("desktop prior line"); else pass("desktop prior line");
      if (info.opts.join("|") !== ["Overall", "World Rush", "Time Warp", "MVP", "Word Nerd", "Brain Teaser"].join("|")) fail("desktop options", info.opts); else pass("desktop selector");
      if (info.shareCalls !== 0) fail("desktop share before click", info.shareCalls); else pass("desktop share not required");
      await shot(cdp, "desktop-en.png");
      const cat = await evalJson(cdp, `(() => { const s = document.querySelector('#g2-metric'); s.value = '0'; s.dispatchEvent(new Event('change')); const g2 = document.getElementById('results-g2'); return { metric: g2.getAttribute('data-metric'), sum: g2.getAttribute('data-all-sum'), mean: g2.getAttribute('data-all-mean'), prior: g2.getAttribute('data-prior-mean'), big: g2.querySelector('.g2-big').textContent, scale: g2.querySelector('.g2-scale').textContent }; })()`);
      if (cat.metric !== "0" || cat.sum !== String(expectedCat.allSum) || cat.big !== "700" || !/1,000|1000/.test(cat.scale)) fail("desktop category", cat); else pass("desktop category math");
      const g1cat = await evalJson(cdp, `(() => { document.querySelector('[data-g1-view=category]').click(); const g1 = document.getElementById('results-g1'); return { mode: g1.getAttribute('data-g1-mode'), rects: g1.querySelectorAll('rect').length, text: g1.textContent, names: [...g1.querySelectorAll('.g1-cats li')].map(li => li.textContent) }; })()`);
      if (g1cat.mode !== "category" || g1cat.rects !== 0 || /Player average|Top \d+%/.test(g1cat.text) || g1cat.names.join("|") !== "World Rush|Time Warp|MVP|Word Nerd|Brain Teaser") fail("desktop g1 category", g1cat); else pass("desktop g1 category empty");
      await evalJson(cdp, "document.querySelector('#app [data-action=share-results]').click()");
      const afterShare = await evalJson(cdp, "({calls: window.__shareCalls, g1: !!document.getElementById('results-g1'), g2: !!document.getElementById('results-g2'), off: document.getElementById('results-g1').getAttribute('data-collection')})");
      if (afterShare.calls !== 1 || !afterShare.g1 || !afterShare.g2 || afterShare.off !== "off") fail("desktop share keeps graphs", afterShare); else pass("desktop share stays optional");
      const after = await snap(cdp);
      const changed = sameScores(before, after);
      if (changed) fail("desktop storage changed", changed); else pass("desktop storage unchanged");
      if (info.overflow > 1) fail("desktop overflow", info.overflow); else pass("desktop no horizontal overflow");
      forbid(cdp, "desktop");
    }

    // Mobile 360.
    {
      const cdp = await scenario("phone", "/index.html?dgtest", { entries: pack }, phone);
      await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
      await evalJson(cdp, "DGTest.openResults(" + JSON.stringify(today) + "," + JSON.stringify(SCORES[5]) + ")");
      const info = await evalJson(cdp, `(() => { const g1 = document.getElementById('results-g1'), g2 = document.getElementById('results-g2'); return { order: g1.compareDocumentPosition(g2) & Node.DOCUMENT_POSITION_FOLLOWING, path: !!g2.querySelector('path'), off: g1.getAttribute('data-collection'), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, w: document.documentElement.clientWidth }; })()`);
      if (!info.order || !info.path || info.off !== "off") fail("mobile graph", info); else pass("mobile 360 line still drawn");
      if (info.w !== 360) fail("mobile width", info.w); else pass("mobile width 360");
      if (info.overflow > 1) fail("mobile overflow", info); else pass("mobile no horizontal overflow");
      forbid(cdp, "mobile");
      await shot(cdp, "mobile-360-en.png");
    }

    // Spanish mobile, including the completion popup.
    {
      const cdp = await scenario("es", "/index.html?dgtest", { entries: pack, lang: "es" }, phone);
      await evalJson(cdp, "DGTest.completionPopup(" + JSON.stringify(today) + "," + JSON.stringify(SCORES[5]) + ")");
      const popup = await evalJson(cdp, `(() => { const see = document.querySelector('[data-action=see-results]'); const share = document.querySelector('[data-action=share-results]'); return { see: see && see.textContent, share: share && share.textContent, calls: window.__shareCalls, modal: !!document.querySelector('.result-modal') }; })()`);
      if (popup.see !== "Ver resultados" || popup.calls !== 0 || !popup.modal) fail("es popup", popup); else pass("es see results without share");
      await evalJson(cdp, "document.querySelector('[data-action=see-results]').click()");
      const info = await evalJson(cdp, `(() => { const g1 = document.getElementById('results-g1'), g2 = document.getElementById('results-g2'); return { order: !!(g1 && g2) && (g1.compareDocumentPosition(g2) & Node.DOCUMENT_POSITION_FOLLOWING), title: g2.querySelector('h2').textContent, sub: g2.querySelector('.g-sub').textContent, opts: [...document.querySelectorAll('#g2-metric option')].map(o => o.textContent), off: g1.textContent, calls: window.__shareCalls, modal: !!document.querySelector('.result-modal'), mean: g2.getAttribute('data-all-mean') }; })()`);
      if (!info.order || info.title !== "Tu historial" || info.calls !== 0 || info.modal) fail("es results", info); else pass("es history after see results");
      if (info.opts.join("|") !== ["General", "Vuelta al Mundo", "Máquina del Tiempo", "MVP", "Palabrólogo", "Rompecocos"].join("|")) fail("es options", info.opts); else pass("es categories");
      if (!/No está en vivo/.test(info.off) || !/Comparación no disponible/.test(info.off) || !/recolección del campo diario está apagada/.test(info.off)) fail("es g1 copy", info.off); else pass("es collection-off copy");
      if (info.mean !== String(H.roundTenths(expected.allMean))) fail("es mean", info.mean); else pass("es same math");
      if (!/a hoy|más antiguo/.test(info.sub)) fail("es subtitle", info.sub); else pass("es subtitle");
      forbid(cdp, "es");
      await shot(cdp, "mobile-360-es.png");
    }

    // Home reentry keeps the category graph and does not rewrite storage.
    {
      const cdp = await scenario("home", "/index.html", { entries: pack }, desk);
      const before = await snap(cdp);
      await shot(cdp, "home-kept.png");
      const home = await evalJson(cdp, `(() => { const g = document.querySelector('.score-graph'); const btn = document.querySelector('[data-action=view-results]'); const names = ['World Rush','Time Warp','MVP','Word Nerd','Brain Teaser']; const scores = ${JSON.stringify(SCORES[5])}; const want = scores.map((n,i) => names[i] + ': ' + Math.round(n).toLocaleString()); const labels = g ? [...g.querySelectorAll('li')].map(li => li.getAttribute('aria-label')) : []; return { graph: !!g, btn: btn && btn.textContent, match: JSON.stringify(labels) === JSON.stringify(want), labels, want }; })()`);
      if (!home.graph || home.btn !== "View results") fail("home graph", home); else pass("home category graph kept");
      if (!home.match) fail("home labels", home); else pass("home labels are today's scores");
      await evalJson(cdp, "document.querySelector('[data-action=view-results]').click()");
      const info = await evalJson(cdp, `(() => { const g2 = document.getElementById('results-g2'); return { viewed: g2.getAttribute('data-viewed-day'), prior: g2.getAttribute('data-prior-count'), all: g2.getAttribute('data-all-count'), off: document.getElementById('results-g1').getAttribute('data-collection') }; })()`);
      if (info.viewed !== today || info.prior !== "5" || info.all !== "6" || info.off !== "off") fail("home reentry", info); else pass("home view results reentry");
      const after = await snap(cdp);
      const changed = sameScores(before, after);
      if (changed) fail("home storage changed", { changed, before: before[changed], after: after[changed] }); else pass("home reentry storage unchanged");
      forbid(cdp, "home");
    }

    // Pinned previous NY day does not mix a later completed day.
    {
      const yday = shift(today, -1);
      const cdp = await scenario("pin", "/index.html?dgtest", { entries: pack }, desk);
      const before = await snap(cdp);
      await evalJson(cdp, "DGTest.openResults(" + JSON.stringify(yday) + "," + JSON.stringify(SCORES[4]) + ")");
      const info = await evalJson(cdp, `(() => { const g2 = document.getElementById('results-g2'); const days = [...g2.querySelectorAll('tbody td:first-child')].map(td => td.textContent); return { viewed: g2.getAttribute('data-viewed-day'), includes: g2.getAttribute('data-includes-viewed'), later: g2.getAttribute('data-later'), prior: g2.getAttribute('data-prior-count'), all: g2.getAttribute('data-all-count'), kicker: g2.querySelector('.g2-kicker').textContent, allk: g2.querySelector('.g2-all-kicker').textContent, days, text: g2.textContent }; })()`);
      const pinView = H.summarize(H.completedGames(entries, yday, null).games, "overall", yday);
      if (info.viewed !== yday || info.includes !== "1" || info.later !== "1" || info.all !== String(pinView.allCount) || info.prior !== String(pinView.priorCount)) fail("pinned counts", { info, pinView }); else pass("pinned day counts");
      if (/Today ·/.test(info.kicker) || /includes today/i.test(info.allk)) fail("pinned says today", info); else pass("pinned day is not labeled today");
      if (!/not mixed in here/.test(info.text)) fail("pinned later note", info.text); else pass("later day kept separate");
      if (info.days.some(d => d.indexOf(String(+today.slice(8))) >= 0 && d.indexOf(today.slice(0, 4)) >= 0)) {
        // The table uses a localized date, so compare via data and point count rather than the clock day's digits only.
      }
      const pointDays = await evalJson(cdp, "BCHistory.summarize(BCHistory.completedGames(BCHistory.readLocalEntries(localStorage)," + JSON.stringify(yday) + ", null).games,'overall'," + JSON.stringify(yday) + ").points.map(p => p.day)");
      if (pointDays.includes(today) || !pointDays.includes(yday)) fail("pinned points", pointDays); else pass("pinned points exclude the later day");
      const after = await snap(cdp);
      if (sameScores(before, after)) fail("pinned storage", sameScores(before, after)); else pass("pinned storage unchanged");
      forbid(cdp, "pinned");
    }

    // One completed game: no dashed prior average.
    {
      const only = {};
      only["dg-" + today] = pack["dg-" + today];
      only["dg-stats"] = pack["dg-stats"];
      const cdp = await scenario("one", "/index.html?dgtest", { entries: only }, phone);
      await evalJson(cdp, "DGTest.openResults(" + JSON.stringify(today) + "," + JSON.stringify(SCORES[5]) + ")");
      const info = await evalJson(cdp, `(() => { const g2 = document.getElementById('results-g2'); return { prior: g2.getAttribute('data-prior-count'), all: g2.getAttribute('data-all-count'), mean: g2.getAttribute('data-all-mean'), dash: !!g2.querySelector('[data-prior-line]'), text: g2.textContent, big: g2.querySelector('.g2-big').textContent }; })()`);
      if (info.prior !== "0" || info.all !== "1" || info.dash || info.mean !== String(SCORES[5].reduce((a, b) => a + b, 0)) || !/No earlier completed games/.test(info.text)) fail("one game", info); else pass("one game honest prior");
      await shot(cdp, "one-game.png");
      forbid(cdp, "one");
    }

    // No history, practice excluded, malformed neighbor kept.
    {
      const practiceKey = "dg-" + shift(today, -2);
      const shortKey = "dg-" + shift(today, -4);
      const validKey = "dg-" + shift(today, -9);
      const validRaw = pack[validKey];
      const cdp = await scenario("empty", "/index.html?dgtest", { entries: { [practiceKey]: JSON.stringify({ practice: true, scores: [9, 9, 9, 9, 9] }), [shortKey]: JSON.stringify({ scores: [1, 2, 3] }), "dg-not-a-date": "x", "dg-2026-02-31": "{not-json", "dg-stats": pack["dg-stats"] } }, phone);
      const before = await snap(cdp);
      await evalJson(cdp, "DGTest.openResults(" + JSON.stringify(today) + "," + JSON.stringify([10, 20, 30, 40, 50]) + ",{practice:true})");
      const info = await evalJson(cdp, `(() => { const g1 = document.getElementById('results-g1'), g2 = document.getElementById('results-g2'); return { state: g2.getAttribute('data-g2-state'), practice: g2.getAttribute('data-practice'), text: g2.textContent, g1: g1.textContent, yours: (g1.querySelector('.g1-yours b') || {}).textContent || '' }; })()`);
      if (info.state !== "empty" || info.practice !== "1" || !/No completed games/.test(info.text) || !/Practice runs are not saved/.test(info.text)) fail("empty history", info); else pass("empty history");
      if (!/This run/.test(info.g1) || info.yours !== "150" || /Player average|Top \d+%/.test(info.g1)) fail("practice g1", info); else pass("practice g1 shows this run only");
      const after = await snap(cdp);
      if (sameScores(before, after) || after["dg-" + today]) fail("practice wrote storage", { changed: sameScores(before, after), today: after["dg-" + today] }); else pass("practice wrote nothing");
      await shot(cdp, "empty-practice.png");
      // A stored valid day still renders beside malformed keys, and a different in-memory score does not replace it.
      await evalJson(cdp, "localStorage.setItem(" + JSON.stringify(validKey) + "," + JSON.stringify(validRaw) + ")");
      await evalJson(cdp, "DGTest.openResults(" + JSON.stringify(shift(today, -9)) + "," + JSON.stringify([1, 1, 1, 1, 1]) + ")");
      const kept = await evalJson(cdp, `(() => { const g2 = document.getElementById('results-g2'); return { all: g2.getAttribute('data-all-count'), big: g2.querySelector('.g2-big').textContent, sum: g2.getAttribute('data-all-sum') }; })()`);
      const storedTotal = SCORES[0].reduce((a, b) => a + b, 0);
      if (kept.all !== "1" || kept.big !== String(storedTotal) || kept.sum !== String(storedTotal)) fail("malformed neighbor", kept); else pass("malformed storage skipped, valid day kept");
      const finalSnap = await snap(cdp);
      if (finalSnap[validKey] !== validRaw) fail("valid day rewritten", finalSnap[validKey]); else pass("valid day not rewritten");
      forbid(cdp, "empty");
    }

    console.log(bad ? bad + " browser failures" : "graph-results.browser.js: all pass");
  } finally {
    chrome.kill("SIGKILL");
    srv.close();
  }
  process.exit(bad ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
