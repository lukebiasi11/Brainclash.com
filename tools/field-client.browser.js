// node tools/field-client.browser.js — flag off, practice, admin, failure copy, mocked G1 bars.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SHOTS = "/opt/cursor/artifacts";
fs.mkdirSync(SHOTS, { recursive: true });
let bad = 0;
const fail = (name, detail) => { bad++; console.log("FAIL", name, detail == null ? "" : typeof detail === "string" ? detail : JSON.stringify(detail)); };
const pass = name => console.log("ok", name);

function contentType(fp) {
  const ext = path.extname(fp);
  return { ".html": "text/html;charset=utf-8", ".js": "text/javascript;charset=utf-8", ".css": "text/css;charset=utf-8", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png" }[ext] || "application/octet-stream";
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
class CDP {
  constructor(ws) {
    this.ws = ws; this.nextId = 0; this.pending = new Map(); this.handlers = [];
    this.reqs = []; this.errors = []; this.logs = [];
    ws.addEventListener("message", ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id); this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message || JSON.stringify(msg.error))); else p.resolve(msg.result || {});
        return;
      }
      if (!msg.method) return;
      this.handlers.forEach(fn => fn(msg.method, msg.params || {}));
    });
    this.on((m, p) => {
      if (m === "Network.requestWillBeSent") this.reqs.push({ url: p.request.url, method: p.request.method });
      if (m === "Runtime.exceptionThrown") this.errors.push((p.exceptionDetails && (p.exceptionDetails.exception && p.exceptionDetails.exception.description || p.exceptionDetails.text)) || "exception");
      if (m === "Runtime.consoleAPICalled" && p.type && p.type !== "log" && p.type !== "info" && p.type !== "debug") this.logs.push(p.type + " " + ((p.args || []).map(a => a.value || a.description || "").join(" ")).slice(0, 180));
    });
  }
  on(fn) { this.handlers.push(fn); }
  send(method, params = {}, ms = 30000) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { this.pending.delete(id); reject(new Error("timeout " + method)); }, ms);
      this.pending.set(id, { resolve: v => { clearTimeout(t); resolve(v); }, reject: e => { clearTimeout(t); reject(e); } });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}
function wsOpen(url) { const ws = new WebSocket(url); return new Promise((resolve, reject) => { ws.addEventListener("open", () => resolve(ws)); ws.addEventListener("error", () => reject(new Error("ws"))); }); }
async function evalJson(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + ((r.exceptionDetails.exception || {}).description || ""));
  return r.result ? r.result.value : undefined;
}
async function openPage(port, url, seed, viewport) {
  const createdRes = await fetch("http://127.0.0.1:" + port + "/json/new?" + encodeURIComponent("about:blank"), { method: "PUT" });
  const created = JSON.parse(await createdRes.text());
  const ws = await wsOpen(created.webSocketDebuggerUrl);
  const cdp = new CDP(ws);
  cdp.id = created.id;
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  if (viewport) await cdp.send("Emulation.setDeviceMetricsOverride", viewport);
  if (seed) await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: seed });
  await cdp.send("Page.navigate", { url });
  const ready = await evalJson(cdp, `new Promise(resolve => { const start = Date.now(); const tick = () => { const app = document.querySelector('#app'); if (document.querySelector('#privacy') || (app && app.children.length) || document.querySelector('#days')) resolve(true); else if (Date.now() - start > 8000) resolve(false); else setTimeout(tick, 40); }; tick(); })`);
  if (!ready) throw new Error("page did not render " + url);
  return cdp;
}
async function shot(cdp, name, sel) {
  const box = await evalJson(cdp, `(() => { const e = document.querySelector(${JSON.stringify(sel || "#results-g1")}); const r = e.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; })()`);
  const img = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.max(1, Math.ceil(box.w)), height: Math.max(1, Math.min(3200, Math.ceil(box.h))), scale: 1 } }, 30000);
  const file = path.join(SHOTS, name);
  fs.writeFileSync(file, Buffer.from(img.data, "base64"));
  console.log("wrote", file);
  return file;
}
const frame = { width: 390, height: 844, deviceScaleFactor: 1, mobile: true };
async function shotFrame(cdp, name) {
  await cdp.send("Emulation.setDeviceMetricsOverride", frame);
  await evalJson(cdp, `new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
  const box = await evalJson(cdp, `(() => { const e = document.getElementById('results-g1'); const r = e.getBoundingClientRect(); return { y: Math.max(0, r.top + scrollY), h: r.height }; })()`);
  const img = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: box.y, width: 390, height: 844, scale: 1 } }, 30000);
  const file = path.join(SHOTS, name);
  fs.writeFileSync(file, Buffer.from(img.data, "base64"));
  console.log("wrote", file);
  return file;
}
function snapExpr() {
  return `(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; })()`;
}
function sameStore(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) if (k !== "dg-field-meta" && before[k] !== after[k]) return k;
  return null;
}
const phone = { width: 360, height: 740, deviceScaleFactor: 2, mobile: true };
const SAVED = JSON.stringify({ key: "2026-11-06", practice: false, counted: true, scores: [400, 500, 450, 500, 420], details: [] });
function seed(lang) {
  return `try{localStorage.clear();}catch(e){}` +
    (lang ? `localStorage.setItem('bc-lang',${JSON.stringify(lang)});` : "") +
    `localStorage.setItem('dg-2026-11-06', ${JSON.stringify(SAVED)});` +
    `localStorage.setItem('dg-stats', ${JSON.stringify(JSON.stringify({ played: 4, best: 2400, streak: 2, last: "2026-11-06" }))});`;
}
const install = `(() => {
  const base = Date.parse("2026-11-09T17:00:00Z");
  const started = performance.now();
  Date.now = () => base + (performance.now() - started);
  window.__calls = [];
  const orig = window.fetch.bind(window);
  window.FIELD_COMPARE.createClient = () => ({ auth: {
    getSession: async () => ({ data: { session: null } }),
    signInAnonymously: async () => ({ data: { session: { access_token: "tok" } } })
  }});
  window.FIELD_COMPARE.publishableKey = "sb_publishable_test_key";
  window.__fieldMode = "off";
  const modes = {
    "503": { status: 503, body: { ok: false, error: "collection_off" } },
    threshold: { status: 200, body: { ok: true, comparison_available: false, reason: "threshold_unresolved" } },
    below: { status: 200, body: { ok: true, comparison_available: false, reason: "below_threshold", rest_finishes: 2 } },
    rate: { status: 429, body: { ok: false, error: "rate_limited" } },
    origin: { status: 403, body: { ok: false, error: "origin_denied" } },
    ready: { status: 200, body: { ok: true, comparison_available: true, reason: "ok", rest_finishes: 100, minimum: 13, maximum: 4999, histogram: [8, 8, 8, 8, 8], players: [{ id: "player-secret", total: 42 }], rest_average: 3112, rest_category_average: [480, 510, 390, 620, 411], others_at_or_above: 39, category_at_or_above: [22, 30, 18, 40, 25], score_bins: [2, 4, 8, 14, 18, 20, 16, 10, 6, 2], category_bins: [[4, 6, 10, 12, 16, 14, 12, 18, 6, 2], [2, 4, 8, 14, 18, 20, 16, 10, 6, 2], [6, 8, 12, 16, 14, 12, 10, 8, 8, 6], [1, 3, 7, 11, 15, 19, 17, 13, 9, 5], [5, 7, 9, 11, 13, 15, 13, 11, 9, 7]] } },
    under: { status: 200, body: { ok: true, comparison_available: true, reason: "ok", rest_finishes: 100, rest_average: 4000, rest_category_average: [900, 900, 900, 900, 900], others_at_or_above: 80, category_at_or_above: [80, 80, 80, 80, 80], score_bins: [20, 20, 20, 10, 10, 8, 6, 4, 2, 0], category_bins: [[20, 20, 20, 10, 10, 8, 6, 4, 2, 0], [20, 20, 20, 10, 10, 8, 6, 4, 2, 0], [20, 20, 20, 10, 10, 8, 6, 4, 2, 0], [20, 20, 20, 10, 10, 8, 6, 4, 2, 0], [20, 20, 20, 10, 10, 8, 6, 4, 2, 0]] } },
    alone: { status: 200, body: { ok: true, comparison_available: true, reason: "ok", rest_finishes: 48, rest_average: 2410, rest_category_average: [520, 480, 460, 490, 460], others_at_or_above: 2, category_at_or_above: [1, 4, 6, 3, 5], score_bins: [1, 2, 4, 7, 10, 9, 8, 5, 0, 2], category_bins: [[1, 2, 4, 6, 8, 9, 7, 6, 5, 0], [2, 3, 5, 8, 10, 8, 6, 4, 2, 0], [3, 4, 6, 8, 9, 7, 5, 4, 2, 0], [1, 2, 5, 7, 9, 8, 7, 5, 3, 1], [2, 3, 4, 7, 8, 9, 6, 5, 3, 1]] } }
  };
  window.fetch = (url, opts) => {
    const u = String(url);
    const method = (opts && opts.method) || "GET";
    window.__calls.push({ url: u, method: method, body: opts && opts.body || "" });
    if (u.indexOf("field-compare") < 0 && u.indexOf("supabase.co") < 0 && u.indexOf("jsdelivr") < 0) return orig(url, opts);
    if (window.__fieldMode === "throw") return Promise.reject(new TypeError("Failed to fetch"));
    const row = modes[window.__fieldMode] || { status: 503, body: { ok: false, error: "collection_off" } };
    return Promise.resolve(new Response(JSON.stringify(row.body), { status: row.status, headers: { "content-type": "application/json" } }));
  };
  return true;
})()`;
const YOU = [700, 680, 660, 640, 680];
const YOU_ALONE = [840, 800, 860, 820, 880];

(async () => {
  const srv = await startServer();
  const origin = "http://127.0.0.1:" + srv.address().port;
  const userDir = fs.mkdtempSync(path.join("/tmp", "bc-field-"));
  const chrome = spawn("google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--remote-debugging-port=9341", "--user-data-dir=" + userDir, "--no-first-run", "--disable-background-networking", "--disable-sync", "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
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
    async function page(url, lang, viewport) {
      const seedSrc = url.indexOf("admin") >= 0 ? "try{localStorage.clear()}catch(e){}" : url.indexOf("privacy") >= 0 ? null : seed(lang);
      const cdp = await openPage(port, origin + url, seedSrc, viewport || phone);
      if (url.indexOf("index.html") >= 0) await evalJson(cdp, "window.FIELD_COMPARE_ENABLED = false; true");
      pages.push(cdp);
      return cdp;
    }
    function fieldReqs(cdp) {
      return cdp.reqs.filter(r => {
        let host = "";
        try { host = new URL(r.url).hostname; } catch (e) { return true; }
        if (host === "127.0.0.1") return r.method !== "GET" && r.method !== "HEAD";
        return /supabase\.co|jsdelivr/i.test(host);
      });
    }
    async function closePage(cdp) {
      await fetch("http://127.0.0.1:" + port + "/json/close/" + cdp.id).catch(() => {});
    }

    {
      const cdp = await page("/index.html?dgtest", null, phone);
      const before = await evalJson(cdp, snapExpr());
      await evalJson(cdp, "DGTest.openResults('2026-11-09'," + JSON.stringify(YOU) + ")");
      const info = await evalJson(cdp, `(() => { const g1 = document.getElementById('results-g1'); return { state: g1.getAttribute('data-collection'), text: g1.textContent, rects: g1.querySelectorAll('rect').length, privacy: !!g1.querySelector('a[href^=\"privacy.html\"]') }; })()`);
      const footer = await evalJson(cdp, `(() => { const a = document.querySelector('footer a[data-privacy]'); return { href: a && a.getAttribute('href'), text: a && a.textContent, placeholder: document.body.innerText.indexOf('OPERATOR_CONTACT') >= 0 }; })()`);
      if (info.state !== "off" || info.rects !== 0 || !/Not live/.test(info.text) || !info.privacy) fail("flag off card", info); else pass("flag override off keeps the collection-off card");
      if (!footer || footer.href !== "privacy.html?v=g1live1" || footer.placeholder) fail("home footer notice", footer); else pass("homepage footer links the notice");
      const after = await evalJson(cdp, snapExpr());
      const changed = sameStore(before, after);
      if (changed) fail("flag off storage", changed); else pass("flag off storage untouched");
      if (fieldReqs(cdp).length) fail("flag off network", fieldReqs(cdp)); else pass("flag off makes no field or SDK calls");
      if (cdp.errors.length || cdp.logs.length) fail("flag off console", cdp.errors.concat(cdp.logs)); else pass("flag off no console errors");
      await closePage(cdp);
    }

    async function armed(lang) {
      const cdp = await page("/index.html?dgtest", lang, phone);
      await evalJson(cdp, install);
      return cdp;
    }
    async function show(cdp, mode, scores, practice) {
      await evalJson(cdp, "window.__calls=[]; window.__fieldMode=" + JSON.stringify(mode) + "; window.FIELD_COMPARE_ENABLED=true; DGTest.openResults('2026-11-09'," + JSON.stringify(scores || YOU) + (practice ? ",{practice:true}" : "") + ")");
      return evalJson(cdp, `new Promise(resolve => { const start = Date.now(); const tick = () => { const g1 = document.getElementById('results-g1'); const st = g1 && g1.getAttribute('data-g1-state'); if (st && st !== 'pending') resolve({ state: st, reason: g1.getAttribute('data-g1-reason'), text: g1.textContent, rects: g1.querySelectorAll('rect').length, svg: g1.querySelectorAll('svg').length, bars: g1.querySelectorAll('.g1-bin').length, you: g1.getAttribute('data-you'), rest: g1.getAttribute('data-rest'), percentile: g1.getAttribute('data-percentile'), delta: g1.getAttribute('data-delta'), bin: g1.getAttribute('data-bin'), calls: window.__calls, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, w: document.documentElement.clientWidth }); else if (Date.now() - start > 4000) resolve({ state: st || 'timeout', text: g1 ? g1.textContent : '', calls: window.__calls || [] }); else setTimeout(tick, 30); }; tick(); })`);
    }

    {
      const cdp = await armed(null);
      const before = await evalJson(cdp, snapExpr());
      const info = await show(cdp, "ready", YOU, true);
      const posts = (info.calls || []).filter(c => c.method === "POST" || /field-compare/.test(c.url));
      if (info.state !== "practice" || posts.length) fail("practice posts", info); else pass("practice never posts");
      if (sameStore(before, await evalJson(cdp, snapExpr()))) fail("practice storage", sameStore(before, await evalJson(cdp, snapExpr()))); else pass("practice storage untouched");
      if (cdp.errors.length || cdp.logs.length) fail("practice console", cdp.errors.concat(cdp.logs)); else pass("practice no console errors");
      await closePage(cdp);
    }

    const modes = [
      ["throw", "network", "No other results yet"],
      ["503", "collection_off", "No other results yet"],
      ["threshold", "threshold_unresolved", "No other results yet"],
      ["below", "below_threshold", "No other results yet"],
      ["rate", "rate_limited", "No other results yet"],
      ["origin", "origin_denied", "No other results yet"]
    ];
    {
      const cdp = await armed(null);
      const before = await evalJson(cdp, snapExpr());
      for (const [mode, reason, copy] of modes) {
        cdp.errors.length = 0; cdp.logs.length = 0;
        const info = await show(cdp, mode, YOU, false);
        if (info.state !== "quiet" || info.reason !== reason || info.text.indexOf(copy) < 0 || info.svg !== 0 || info.bars !== 0) fail("fallback " + mode, info); else pass("fallback " + mode);
        if (cdp.errors.length || cdp.logs.length) fail("console " + mode, cdp.errors.concat(cdp.logs)); else pass("no console errors " + mode);
      }
      const after = await evalJson(cdp, snapExpr());
      if (sameStore(before, after)) fail("failure storage", sameStore(before, after)); else pass("failure paths leave saved scores untouched");
      await closePage(cdp);
    }
    {
      const cdp = await armed("es");
      const info = await show(cdp, "below", YOU, false);
      if (info.state !== "quiet" || info.svg !== 0 || info.text.indexOf("Todavía no hay otros resultados") < 0) fail("es fallback", info.text); else pass("es fallback copy");
      if (cdp.errors.length || cdp.logs.length) fail("es fallback console", cdp.errors.concat(cdp.logs)); else pass("es fallback no console errors");
      await closePage(cdp);
    }
    {
      const cdp = await armed(null);
      const before = await evalJson(cdp, snapExpr());
      const info = await show(cdp, "ready", YOU, false);
      const hidden = /player-secret|4,999|4999|\bminimum\b|\bmaximum\b|2,410\.5|2410\.5/.test(info.text);
      const bars = await evalJson(cdp, `(() => { const g1 = document.getElementById('results-g1'); return [...g1.querySelectorAll('.g1-bin')].map(p => p.getAttribute('data-count') + (p.getAttribute('data-you') === '1' ? p.getAttribute('fill') : '')); })()`);
      if (info.state !== "ready" || info.bars !== 10 || info.svg !== 1 || info.you !== "3360" || info.rest !== "3112" || info.percentile !== "39" || info.delta !== "248" || info.bin !== "6" || !/Today's Competition/.test(info.text) || !/November 9/.test(info.text) || !/Top 39%/.test(info.text) || !/3,360/.test(info.text) || !/3,112/.test(info.text) || !/\+248/.test(info.text) || !/orange bar includes yours/.test(info.text) || bars.join(",") !== "2,4,8,14,18,20,17#E8774A,10,6,2" || hidden) fail("populated total", { info, bars }); else pass("populated total shows bins, average, and percentile");
      if (hidden) fail("g1 hides identities", info.text); else pass("g1 shows bin counts and no per-player row");
      if (info.w !== 360 || info.overflow > 1) fail("populated width", info); else pass("populated mobile width");
      const cat = await evalJson(cdp, `(() => { const before = window.__calls.length; document.querySelector('[data-g1-view=category]').click(); const g1 = document.getElementById('results-g1'); const bars = [...g1.querySelectorAll('.g1-bin')]; return { mode: g1.getAttribute('data-g1-mode'), bars: bars.length, youBar: bars.filter(p => p.getAttribute('data-you') === '1').map(p => p.getAttribute('data-count') + ':' + p.getAttribute('fill')).join(','), names: [...g1.querySelectorAll('#g1-cat option')].map(o => o.textContent), calls: window.__calls.length - before, you: g1.getAttribute('data-you'), rest: g1.getAttribute('data-rest'), percentile: g1.getAttribute('data-percentile'), bin: g1.getAttribute('data-bin'), svg: g1.querySelectorAll('svg').length, tenths: /410\\.5|player-secret|4999|\\bminimum\\b/.test(g1.textContent) }; })()`);
      if (cat.mode !== "category" || cat.bars !== 10 || cat.svg !== 1 || cat.calls !== 0 || cat.you !== "700" || cat.rest !== "480" || cat.percentile !== "22" || cat.bin !== "7" || cat.youBar !== "19:#E8774A" || cat.names.join("|") !== "World Rush|Time Warp|MVP|Word Nerd|Brain Teaser" || cat.tenths) fail("category toggle", cat); else pass("category histogram uses that category's bins");
      await evalJson(cdp, "document.querySelector('[data-g1-view=total]').click()");
      const again = await show(cdp, "ready", YOU, false);
      const posts = (info.calls || []).filter(c => c.method === "POST").map(c => c.url.split("/field-compare/")[1]);
      const againPosts = (again.calls || []).filter(c => c.method === "POST");
      if (posts.join(",") !== "start,finish" || againPosts.length) fail("backfill once", { posts, again: againPosts }); else pass("today's results post start then finish once");
      if (sameStore(before, await evalJson(cdp, snapExpr()))) fail("populated storage", sameStore(before, await evalJson(cdp, snapExpr()))); else pass("populated scores stay unchanged");
      const meta = await evalJson(cdp, "localStorage.getItem('dg-field-meta')");
      if (!meta || JSON.parse(meta)["2026-11-09"].posted !== true) fail("posted flag", meta); else pass("posted flag is outside the score record");
      if (cdp.errors.length || cdp.logs.length) fail("populated console", cdp.errors.concat(cdp.logs)); else pass("populated no console errors");
      await closePage(cdp);
    }
    {
      const cdp = await armed("es");
      const info = await show(cdp, "ready", YOU, false);
      if (info.state !== "ready" || info.bars !== 10 || !/La competencia de hoy/.test(info.text) || !/Puntaje total/.test(info.text) || !/Top 39%/.test(info.text) || !/Privacidad/.test(info.text) || !/3,360/.test(info.text) || !/3,112/.test(info.text) || !/\+248/.test(info.text) || !/barra naranja incluye el tuyo/.test(info.text) || /player-secret|4999/.test(info.text)) fail("es populated", info.text); else pass("es populated copy");
      const cat = await evalJson(cdp, `(() => { document.querySelector('[data-g1-view=category]').click(); const g1 = document.getElementById('results-g1'); return { names: [...g1.querySelectorAll('#g1-cat option')].map(o => o.textContent).join('|'), you: g1.getAttribute('data-you'), rest: g1.getAttribute('data-rest') }; })()`);
      if (cat.names !== "Vuelta al Mundo|Máquina del Tiempo|MVP|Palabrólogo|Rompecocos" || cat.you !== "700" || cat.rest !== "480") fail("es categories", cat); else pass("es category names and whole scores");
      const under = await show(cdp, "under", YOU, false);
      if (under.state !== "ready" || under.delta !== "-640" || !/vs el promedio/.test(under.text) || !/[\u2212-]640/.test(under.text)) fail("below average", under.text); else pass("below average uses a minus");
      await closePage(cdp);
    }

    {
      const cdp = await page("/index.html", null, phone);
      await evalJson(cdp, install + "; window.FIELD_COMPARE_ENABLED=true;");
      const before = await evalJson(cdp, snapExpr());
      await evalJson(cdp, `(() => { const b = document.querySelector('.cta .btn.primary'); if (!b) return false; b.click(); return true; })()`);
      const calls = await evalJson(cdp, `new Promise(resolve => { const start = Date.now(); const tick = () => { const hit = (window.__calls || []).find(c => c.method === 'POST' && c.url.indexOf('/start') >= 0); if (hit) resolve(window.__calls); else if (Date.now() - start > 3000) resolve(window.__calls || []); else setTimeout(tick, 30); }; tick(); })`);
      const start = (calls || []).find(c => c.method === "POST" && /\/start$/.test(c.url.split("?")[0]));
      if (!start) fail("daily start post", calls); else {
        const body = JSON.parse(start.body);
        if (body.day && body.runId && !body.scores) pass("daily run posts start"); else fail("start body", body);
      }
      const after = await evalJson(cdp, snapExpr());
      const extra = Object.keys(after).filter(k => !(k in before) && (k.startsWith("sb-field") || k.startsWith("dg-")));
      if (extra.length) fail("start wrote storage", extra); else pass("start click adds no history or auth keys");
      if (cdp.errors.length || cdp.logs.length) fail("start console", cdp.errors.concat(cdp.logs)); else pass("start no console errors");
      await closePage(cdp);
    }

    async function framed(lang, mode, view) {
      const cdp = await page("/index.html?dgtest", lang, frame);
      await evalJson(cdp, install);
      await show(cdp, mode, YOU, false);
      if (view === "category") await evalJson(cdp, "document.querySelector('[data-g1-view=category]').click()");
      return cdp;
    }
    {
      const total = await framed(null, "ready", "total");
      await shotFrame(total, "g1_hist_total_en_390.png");
      await shotFrame(total, "g1-you-shared-en-390.png");
      await evalJson(total, "document.querySelector('[data-g1-view=category]').click()");
      await shotFrame(total, "g1_hist_category_en_390.png");
      await closePage(total);
      const empty = await framed(null, "below", "total");
      const quiet = await evalJson(empty, `(() => { const g1 = document.getElementById('results-g1'); return { state: g1.getAttribute('data-g1-state'), svg: g1.querySelectorAll('svg').length, text: g1.textContent }; })()`);
      if (quiet.state !== "quiet" || quiet.svg !== 0 || quiet.text.indexOf("No other results yet") < 0) fail("empty frame", quiet); else pass("empty frame has no axes");
      await shotFrame(empty, "g1_hist_empty_en_390.png");
      await closePage(empty);
      const totalEs = await framed("es", "ready", "total");
      await shotFrame(totalEs, "g1_hist_total_es_390.png");
      await shotFrame(totalEs, "g1-you-shared-es-390.png");
      await evalJson(totalEs, "document.querySelector('[data-g1-view=category]').click()");
      await shotFrame(totalEs, "g1_hist_category_es_390.png");
      await closePage(totalEs);
      const emptyEs = await framed("es", "below", "total");
      await shotFrame(emptyEs, "g1_hist_empty_es_390.png");
      await closePage(emptyEs);
      async function aloneShot(lang, name) {
        const cdp = await page("/index.html?dgtest", lang, frame);
        await evalJson(cdp, install);
        const info = await show(cdp, "alone", YOU_ALONE, false);
        const bars = await evalJson(cdp, `(() => { const g1 = document.getElementById('results-g1'); return [...g1.querySelectorAll('.g1-bin')].map(p => ({ count: p.getAttribute('data-count'), you: p.getAttribute('data-you'), fill: p.getAttribute('fill'), d: p.getAttribute('d') })); })()`);
        const you = bars.find(p => p.you === "1");
        const others = bars.filter(p => p.you !== "1").map(p => p.count).join(",");
        const copy = lang === "es" ? "barra naranja incluye el tuyo" : "orange bar includes yours";
        const flat = !you || you.count !== "1" || you.fill !== "#E8774A" || !/Z/.test(you.d || "");
        if (info.state !== "ready" || info.you !== "4200" || info.rest !== "2410" || info.percentile !== "4" || info.bin !== "8" || info.bars !== 10 || others !== "1,2,4,7,10,9,8,5,2" || flat || info.text.indexOf(copy) < 0 || /No other results yet|Todavía no hay otros resultados/.test(info.text)) fail("alone bin " + (lang || "en"), { info, you, others }); else pass("alone bin counts this game " + (lang || "en"));
        await shotFrame(cdp, name);
        await closePage(cdp);
      }
      await aloneShot(null, "g1-you-alone-en-390.png");
      await aloneShot("es", "g1-you-alone-es-390.png");
      pass("six 390x844 histogram screenshots");
    }

    {
      const cdp = await page("/admin.html", null, phone);
      const reqs = cdp.reqs.filter(r => /field-compare|field-config|supabase\.co|jsdelivr/i.test(r.url) || r.method === "POST");
      const loaded = await evalJson(cdp, "({ field: typeof window.FieldCompare, flag: window.FIELD_COMPARE_ENABLED, boot: window.BC_NO_BOOT === true })");
      if (reqs.length || loaded.field !== "undefined" || loaded.flag !== undefined || !loaded.boot) fail("admin", { reqs, loaded }); else pass("admin never loads or posts the field client");
      if (cdp.errors.length || cdp.logs.length) fail("admin console", cdp.errors.concat(cdp.logs)); else pass("admin no console errors");
      await closePage(cdp);
    }

    {
      const cdp = await page("/privacy.html?v=g1field3", null, phone);
      await evalJson(cdp, `new Promise(resolve => { const start = Date.now(); const tick = () => { if (document.querySelectorAll('a[href^="mailto:"]').length >= 2) resolve(true); else if (Date.now() - start > 4000) resolve(false); else setTimeout(tick, 30); }; tick(); })`);
      const en = await evalJson(cdp, `(() => { const mail = [...document.querySelectorAll('a[href^="mailto:"]')].map(a => a.getAttribute('href') + ' ' + a.textContent); return { title: document.getElementById('privacy-title').textContent, updated: document.querySelector('[data-updated]').textContent, text: document.body.innerText, mail, placeholder: document.body.innerText.indexOf('OPERATOR_CONTACT') >= 0, draft: /Draft pending the lawyer/.test(document.body.innerText), anon: /anonymous/i.test(document.body.innerText) }; })()`);
      if (en.title !== "Daily comparison" || !/Last updated: November 9, 2026/.test(en.updated) || !/random ID that isn't tied to your name or email/.test(en.text) || !/GitHub Pages and Supabase/.test(en.text) || !/isn't meant for children under 13/.test(en.text) || !/To delete your scores, email thedailydosetrivia@gmail.com/.test(en.text) || en.placeholder || en.draft || en.anon || en.mail.length < 2 || en.mail.some(m => m.indexOf("mailto:thedailydosetrivia@gmail.com") < 0)) fail("privacy en", en); else pass("privacy notice EN");
      await evalJson(cdp, "document.querySelector('[data-lang=es]').click()");
      const es = await evalJson(cdp, `new Promise(resolve => { const start = Date.now(); const tick = () => { const t = document.getElementById('privacy-title'); if (t && t.textContent === 'Comparación diaria') { const text = document.body.innerText; resolve({ title: t.textContent, text, mail: [...document.querySelectorAll('a[href^=\"mailto:\"]')].map(a => a.getAttribute('href')), placeholder: text.indexOf('OPERATOR_CONTACT') >= 0, draft: /Borrador pendiente/.test(text), anon: /anónim/i.test(text) }); } else if (Date.now()-start>4000) resolve({ title: t && t.textContent, text: '' }); else setTimeout(tick, 40); }; tick(); })`);
      if (es.title !== "Comparación diaria" || !/identificador al azar que no está ligado/.test(es.text) || !/Última actualización:/.test(es.text) || !/menores de 13/.test(es.text) || !/Para borrar tus puntajes, escribe a thedailydosetrivia@gmail.com/.test(es.text) || es.placeholder || es.draft || es.anon || (es.mail || []).length < 2 || !(es.mail || []).every(h => h === "mailto:thedailydosetrivia@gmail.com")) fail("privacy es", es); else pass("privacy notice ES");
      if (cdp.reqs.some(r => /field-compare|supabase\.co/.test(r.url))) fail("privacy network", cdp.reqs.filter(r => /field-compare|supabase/.test(r.url))); else pass("privacy page makes no field calls");
    }

    console.log(bad ? bad + " browser failures" : "field-client.browser.js: all pass");
  } finally {
    for (const cdp of pages) fetch("http://127.0.0.1:" + port + "/json/close/" + cdp.id).catch(() => {});
    chrome.kill("SIGKILL");
    srv.close();
  }
  process.exit(bad ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
