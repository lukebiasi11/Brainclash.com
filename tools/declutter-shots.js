// Home and results shots with My stats collapsed, then opened. node tools/declutter-shots.js
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const ROOT = path.resolve(__dirname, "..");
const OUT = "/opt/cursor/artifacts";
fs.mkdirSync(OUT, { recursive: true });
const SCORES = [700, 680, 660, 640, 680];

function startServer() {
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\/+/, "") || "index.html";
    const fp = path.normalize(path.join(ROOT, rel));
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end("missing"); }
    const ext = path.extname(fp);
    const type = { ".html": "text/html;charset=utf-8", ".js": "text/javascript;charset=utf-8", ".css": "text/css;charset=utf-8", ".svg": "image/svg+xml", ".webp": "image/webp" }[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(fs.readFileSync(fp));
  });
  return new Promise(resolve => srv.listen(0, "127.0.0.1", () => resolve(srv)));
}
class CDP {
  constructor(ws) { this.ws = ws; this.nextId = 0; this.pending = new Map(); ws.addEventListener("message", ev => { const msg = JSON.parse(ev.data); if (msg.id && this.pending.has(msg.id)) { const p = this.pending.get(msg.id); this.pending.delete(msg.id); if (msg.error) p.reject(new Error(msg.error.message || JSON.stringify(msg.error))); else p.resolve(msg.result || {}); } }); }
  send(method, params = {}, ms = 30000) { const id = ++this.nextId; return new Promise((resolve, reject) => { const t = setTimeout(() => { this.pending.delete(id); reject(new Error("timeout " + method)); }, ms); this.pending.set(id, { resolve: v => { clearTimeout(t); resolve(v); }, reject: e => { clearTimeout(t); reject(e); } }); this.ws.send(JSON.stringify({ id, method, params })); }); }
}
function wsOpen(url) { const ws = new WebSocket(url); return new Promise((resolve, reject) => { ws.addEventListener("open", () => resolve(ws)); ws.addEventListener("error", () => reject(new Error("ws"))); }); }
async function evalJson(cdp, expression) { const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error((r.exceptionDetails.text || "eval") + " " + ((r.exceptionDetails.exception || {}).description || "")); return r.result ? r.result.value : undefined; }
async function openPage(port, url, seed) {
  const createdRes = await fetch("http://127.0.0.1:" + port + "/json/new?" + encodeURIComponent("about:blank"), { method: "PUT" });
  const created = JSON.parse(await createdRes.text());
  const cdp = new CDP(await wsOpen(created.webSocketDebuggerUrl));
  cdp.id = created.id;
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  if (seed) await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: seed });
  await cdp.send("Page.navigate", { url });
  return cdp;
}
async function fullShot(cdp, name) {
  const height = await evalJson(cdp, "Math.ceil(document.documentElement.scrollHeight)");
  const img = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: 390, height, scale: 1 } }, 30000);
  fs.writeFileSync(path.join(OUT, name), Buffer.from(img.data, "base64"));
  console.log("wrote", name, height + "px");
}

(async () => {
  const srv = await startServer();
  const origin = "http://127.0.0.1:" + srv.address().port;
  const userDir = fs.mkdtempSync(path.join("/tmp", "bc-declutter-"));
  const chrome = spawn("google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--remote-debugging-port=9241", "--user-data-dir=" + userDir, "--no-first-run", "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
  let chromeLog = "";
  chrome.stderr.on("data", d => { chromeLog += d.toString(); });
  const port = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("chrome\n" + chromeLog)), 20000);
    const watch = () => { const m = chromeLog.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/); if (m) { clearTimeout(t); resolve(+m[1]); } };
    chrome.stderr.on("data", watch); watch();
  });
  const probe = await openPage(port, origin + "/index.html?lbshot=1", "");
  const today = await evalJson(probe, `new Promise(resolve => { const start = Date.now(); const tick = () => { if (window.BCDaily && BCDaily.todayKey()) resolve(BCDaily.todayKey()); else if (Date.now()-start>8000) resolve(""); else setTimeout(tick, 40); }; tick(); })`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error("today " + today);
  await fetch("http://127.0.0.1:" + port + "/json/close/" + probe.id).catch(() => {});
  const fixture = JSON.stringify({ overall: { served: true, rows: [{ rank: 1, name: "Luna", score: 4200 }, { rank: 2, name: "Nico", score: 3100 }] }, world: { served: true, rows: [] } });
  try {
    for (const lang of ["en", "es"]) {
      const word = lang === "es" ? "Mis estadísticas" : "My stats";
      const saved = JSON.stringify({ key: today, practice: false, counted: true, scores: SCORES, details: [] });
      const seed = "localStorage.clear(); localStorage.setItem('bc-lang','" + lang + "'); localStorage.setItem('bc-board-eligible','yes'); localStorage.setItem('bc-board-name','Luna'); localStorage.setItem('dg-" + today + "'," + JSON.stringify(saved) + "); window.LEADERBOARD_FIXTURE = " + fixture + ";";
      const home = await openPage(port, origin + "/index.html?lbshot=1&lang=" + lang, seed);
      const homeInfo = await evalJson(home, `new Promise(resolve => { const start = Date.now(); const tick = () => {
        const box = document.querySelector('.my-stats');
        const board = document.querySelector('[data-day-board]');
        const g = document.querySelector('.score-graph');
        if (box && board && g) resolve({ closed: !box.open, summary: box.querySelector('summary').textContent, inside: !!g.closest('.my-stats'), g1: !!document.getElementById('results-g1'), board: board.querySelectorAll('.board-row').length });
        else if (Date.now()-start>8000) resolve({ missing: true });
        else setTimeout(tick, 40);
      }; tick(); })`);
      if (!homeInfo.closed || homeInfo.summary !== word || !homeInfo.inside || homeInfo.g1 || homeInfo.board < 1) throw new Error("home " + lang + " " + JSON.stringify(homeInfo));
      const bars = await evalJson(home, `(async () => { const box = document.querySelector('.my-stats'); box.open = true; await new Promise(r => setTimeout(r, 900)); const el = document.querySelector('.sg-bar'); const h = el ? el.getBoundingClientRect().height : 0; box.open = false; return { h: h, cls: (document.querySelector('.score-graph') || {}).className || '' }; })()`);
      if (!(bars.h > 20)) throw new Error("home bars " + lang + " " + JSON.stringify(bars));
      await fullShot(home, "declutter-home-" + lang + "-390.png");
      await fetch("http://127.0.0.1:" + port + "/json/close/" + home.id).catch(() => {});

      const results = await openPage(port, origin + "/index.html?dgtest&lbshot=1&lang=" + lang, "localStorage.setItem('bc-lang','" + lang + "');");
      const ready = await evalJson(results, `new Promise(resolve => { const start = Date.now(); const tick = () => { if (window.DGTest) resolve(true); else if (Date.now()-start>8000) resolve(false); else setTimeout(tick, 40); }; tick(); })`);
      if (!ready) throw new Error("dgtest " + lang);
      await evalJson(results, `(() => {
        const scores = ${JSON.stringify(SCORES)};
        const shift = (day, off) => { const d = new Date(day + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + off); return d.toISOString().slice(0, 10); };
        [-6, -3, -1, 0].forEach((off, i) => {
          const key = shift(${JSON.stringify(today)}, off);
          localStorage.setItem("dg-" + key, JSON.stringify({ key: key, practice: false, counted: true, scores: scores.map(n => Math.max(0, n - i * 40)), details: [] }));
        });
        DGTest.openResults(${JSON.stringify(today)}, ${JSON.stringify(SCORES)});
      })()`);
      const info = await evalJson(results, `new Promise(resolve => { const start = Date.now(); const tick = () => {
        const g1 = document.getElementById('results-g1');
        const g2 = document.getElementById('results-g2');
        const box = document.querySelector('.my-stats');
        if (g1 && g2 && box) resolve({ closed: !box.open, summary: box.querySelector('summary').textContent, g2in: !!g2.closest('.my-stats'), g1out: !g1.closest('.my-stats'), g1h: g1.getBoundingClientRect().height });
        else if (Date.now()-start>8000) resolve({ missing: true });
        else setTimeout(tick, 40);
      }; tick(); })`);
      if (!info.closed || info.summary !== word || !info.g2in || !info.g1out || !(info.g1h > 40)) throw new Error("results " + lang + " " + JSON.stringify(info));
      await evalJson(results, `new Promise(resolve => { const start = Date.now(); const tick = () => { const n = ((document.getElementById('finalnum') || {}).textContent || '').replace(/\\D/g, ''); if (n === '3360' || Date.now() - start > 2500) resolve(n); else setTimeout(tick, 40); }; tick(); })`);
      await fullShot(results, "declutter-results-" + lang + "-390.png");
      const drawn = await evalJson(results, `(async () => { document.querySelector('.my-stats').open = true; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); const svg = document.querySelector('#results-g2 svg'); const box = svg.getBoundingClientRect(); return { w: box.width, h: box.height, path: !!svg.querySelector('path') }; })()`);
      if (!(drawn.w > 100) || !(drawn.h > 40) || !drawn.path) throw new Error("opened history " + lang + " " + JSON.stringify(drawn));
      await fullShot(results, "mystats-open-" + lang + "-390.png");
      await fetch("http://127.0.0.1:" + port + "/json/close/" + results.id).catch(() => {});
    }
  } finally {
    chrome.kill("SIGKILL");
    srv.close();
  }
})().catch(err => { console.error(err); process.exit(1); });
