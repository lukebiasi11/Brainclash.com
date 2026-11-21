// Weekly board screenshots at 390. ?lbshot=1 uses fixtures. No hosted Supabase.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const ROOT = path.resolve(__dirname, "..");
const OUT = "/opt/cursor/artifacts";
fs.mkdirSync(OUT, { recursive: true });
const NAMES = ["Luna", "Nico", "Sol", "Paz", "Rio", "Luz", "Max", "Ana", "Leo", "Kia", "Otis", "Nia", "Remy", "Cleo", "Ivo", "Noa", "Teo", "Uma", "Cal", "Dex", "Eve", "Gil", "Hap", "Ivy", "Jem", "Kit", "Noe", "Omar"];
function rows(section, count) {
  return NAMES.slice(0, count).map((name, i) => ({ rank: i + 1, name, score: section === "think" ? 900 - i * 20 : 4200 - i * 80 }));
}
const BUSY = { overall: { served: true, rows: rows("overall", 28) }, think: { served: true, rows: rows("think", 28) } };
const QUIET = { overall: { served: true, rows: rows("overall", 2) }, think: { served: true, rows: rows("think", 1) } };

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
  constructor(ws) {
    this.ws = ws; this.nextId = 0; this.pending = new Map();
    ws.addEventListener("message", ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id); this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message || JSON.stringify(msg.error))); else p.resolve(msg.result || {});
      }
    });
  }
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
  await cdp.send("Emulation.setDeviceMetricsOverride", viewport);
  if (seed) await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: seed });
  await cdp.send("Page.navigate", { url });
  const ready = await evalJson(cdp, `new Promise(resolve => { const start = Date.now(); const tick = () => { if (document.querySelector('#app') && document.querySelector('#app').children.length) resolve(true); else if (Date.now() - start > 8000) resolve(false); else setTimeout(tick, 40); }; tick(); })`);
  if (!ready) throw new Error("page did not render " + url);
  await evalJson(cdp, "document.fonts && document.fonts.ready");
  return cdp;
}
async function shot(cdp, name, width) {
  await evalJson(cdp, "document.querySelector('[data-day-board]').scrollIntoView({block:'start'})");
  await evalJson(cdp, "new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))");
  const box = await evalJson(cdp, `(() => { const e = document.querySelector('[data-day-board]'); const r = e.getBoundingClientRect(); const overlap = [...document.querySelectorAll('body *')].filter(el => { const s = getComputedStyle(el); if (s.position !== 'fixed' || s.pointerEvents === 'none') return false; const b = el.getBoundingClientRect(); if (b.height > innerHeight * 0.8 || b.height < 20) return false; const hit = !(b.bottom < r.top || b.top > r.bottom); return hit && b.top > innerHeight * 0.45; }).map(el => el.className || el.id); return { x: 0, y: Math.max(0, r.top + scrollY - 8), h: Math.max(120, r.height + 24), wide: r.width - document.documentElement.clientWidth, overlap, text: e.innerText.slice(0, 280) }; })()`);
  if (box.wide > 1) throw new Error(name + " element wider than the viewport " + box.wide);
  if (box.overlap.length) throw new Error(name + " overlaps a bottom bar " + JSON.stringify(box.overlap));
  const img = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: box.y, width, height: Math.min(2200, Math.ceil(box.h)), scale: 1 } }, 30000);
  const file = path.join(OUT, name);
  fs.writeFileSync(file, Buffer.from(img.data, "base64"));
  console.log("wrote", name, box.text.replace(/\n/g, " | ").slice(0, 160));
  return file;
}

(async () => {
  const srv = await startServer();
  const origin = "http://127.0.0.1:" + srv.address().port;
  const userDir = fs.mkdtempSync(path.join("/tmp", "bc-wk-shots-"));
  const chrome = spawn("google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--remote-debugging-port=9228", "--user-data-dir=" + userDir, "--no-first-run", "--disable-background-networking", "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
  let chromeLog = "";
  chrome.stderr.on("data", d => { chromeLog += d.toString(); });
  chrome.stdout.on("data", d => { chromeLog += d.toString(); });
  const port = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("chrome did not listen\n" + chromeLog)), 20000);
    const watch = () => { const m = chromeLog.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/); if (m) { clearTimeout(t); resolve(+m[1]); } };
    chrome.stderr.on("data", watch); chrome.stdout.on("data", watch); watch();
  });
  const width = 390;
  const vp = { width, height: 844, deviceScaleFactor: 1, mobile: true };
  try {
    for (const lang of ["en", "es"]) {
      for (const [kind, fix, overallCount, sectionCount] of [["busy", BUSY, 28, 28], ["quiet", QUIET, 2, 1]]) {
        const seed = "localStorage.clear(); localStorage.setItem('bc-board-eligible','yes'); window.LEADERBOARD_FIXTURE = " + JSON.stringify(fix) + ";";
        const cdp = await openPage(port, origin + "/index.html?lbshot=1&lang=" + lang, seed, vp);
        await evalJson(cdp, "document.querySelector('[data-board-span=week]').click()");
        const info = await evalJson(cdp, `(() => { const bounds = DailyBoard.weekBounds(BCDaily.todayKey()); const want = DailyBoard.formatWeek(bounds.from, bounds.to); const weekBtn = document.querySelector('[data-board-span=week]'); const todayBtn = document.querySelector('[data-board-span=day]'); const range = document.querySelector('[data-board-range]'); return { week: weekBtn.textContent, today: todayBtn.textContent, weekOn: weekBtn.classList.contains('on'), todayOn: todayBtn.classList.contains('on'), range: range.textContent, hidden: range.hidden, want, rows: document.querySelectorAll('.board-row').length, section: (document.querySelector('.board-tab.on')||{}).textContent || '' }; })()`);
        const weekWord = lang === "es" ? "Esta semana" : "This Week";
        const todayWord = lang === "es" ? "Hoy" : "Today";
        if (info.week !== weekWord || info.today !== todayWord || !info.weekOn || info.todayOn || info.hidden || info.range !== info.want || info.rows !== overallCount) {
          throw new Error(kind + " overall " + lang + " " + JSON.stringify(info));
        }
        await shot(cdp, "wk-" + kind + "-overall-" + lang + "-390.png", width);
        await evalJson(cdp, "document.querySelector('[data-board-section=think]').click()");
        const section = await evalJson(cdp, `(() => { const range = document.querySelector('[data-board-range]'); return { rows: document.querySelectorAll('.board-row').length, section: (document.querySelector('.board-tab.on')||{}).textContent || '', weekOn: document.querySelector('[data-board-span=week]').classList.contains('on'), hidden: range.hidden, range: range.textContent }; })()`);
        const sectionWord = lang === "es" ? "Rompecocos" : "Brain Teaser";
        if (section.rows !== sectionCount || section.section !== sectionWord || !section.weekOn || section.hidden || section.range !== info.want) {
          throw new Error(kind + " section " + lang + " " + JSON.stringify(section));
        }
        await shot(cdp, "wk-" + kind + "-section-" + lang + "-390.png", width);
        await fetch("http://127.0.0.1:" + port + "/json/close/" + cdp.id).catch(() => {});
      }
    }
    console.log("weekly board shots ok");
  } finally {
    chrome.kill("SIGKILL");
    srv.close();
  }
})().catch(err => { console.error(err); process.exit(1); });
