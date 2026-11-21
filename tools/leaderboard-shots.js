// Local screenshots of the nickname board. No hosted Supabase calls: ?lbshot=1 uses fixtures.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const ROOT = path.resolve(__dirname, "..");
const OUT = "/opt/cursor/artifacts";
fs.mkdirSync(OUT, { recursive: true });
const NAMES = ["Luna", "Nico", "Sol", "Paz", "Rio", "Luz", "Max", "Ana", "Leo", "Kia", "Otis", "Nia", "Remy", "Cleo", "Ivo", "Noa", "Teo", "Uma", "Cal", "Dex", "Eve", "Gil", "Hap", "Ivy", "Jem", "Kit", "Noe", "Omar"];
function rows(section) {
  return NAMES.map((name, i) => ({ rank: i + 1, name, score: section === "world" ? 1000 - i * 25 : 4800 - i * 90 }));
}
const BUSY = { overall: { served: true, rows: rows("overall") }, world: { served: true, rows: rows("world") } };
const QUIET = { overall: { served: true, rows: [{ rank: 1, name: "Luna", score: 4200 }, { rank: 2, name: "Nico", score: 3100 }] }, world: { served: true, rows: [] } };
const ADMIN = { rows: [{ id: "11111111-1111-4111-8111-111111111111", name: "Luna", score: 4200 }, { id: "22222222-2222-4222-8222-222222222222", name: "Nico", score: 3100 }, { id: "33333333-3333-4333-8333-333333333333", name: "Sol", score: 2500 }] };

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
  const ready = await evalJson(cdp, `new Promise(resolve => { const start = Date.now(); const tick = () => { if (document.querySelector('#app') && document.querySelector('#app').children.length || document.querySelector('#board-admin')) resolve(true); else if (Date.now() - start > 8000) resolve(false); else setTimeout(tick, 40); }; tick(); })`);
  if (!ready) throw new Error("page did not render " + url);
  await evalJson(cdp, "document.fonts && document.fonts.ready");
  return cdp;
}
async function shot(cdp, name, sel, width) {
  await evalJson(cdp, `document.querySelector(${JSON.stringify(sel)}).scrollIntoView({block:'start'})`);
  await evalJson(cdp, "new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))");
  const box = await evalJson(cdp, `(() => { const e = document.querySelector(${JSON.stringify(sel)}); const r = e.getBoundingClientRect(); const overlap = [...document.querySelectorAll('body *')].filter(el => { const s = getComputedStyle(el); if (s.position !== 'fixed' || s.pointerEvents === 'none') return false; const b = el.getBoundingClientRect(); if (b.height > innerHeight * 0.8 || b.height < 20) return false; const hit = !(b.bottom < r.top || b.top > r.bottom); return hit && b.top > innerHeight * 0.45; }).map(el => el.className || el.id); return { x: 0, y: Math.max(0, r.top + scrollY - 8), h: Math.max(120, r.height + 24), wide: r.width - document.documentElement.clientWidth, overlap, text: e.innerText.slice(0, 240) }; })()`);
  if (box.wide > 1) throw new Error(name + " element wider than the viewport " + box.wide);
  if (box.overlap.length) throw new Error(name + " overlaps a bottom bar " + JSON.stringify(box.overlap));
  const img = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: box.y, width, height: Math.min(2200, Math.ceil(box.h)), scale: 1 } }, 30000);
  const file = path.join(OUT, name);
  fs.writeFileSync(file, Buffer.from(img.data, "base64"));
  console.log("wrote", name, box.text.replace(/\n/g, " | ").slice(0, 120));
  return file;
}

(async () => {
  const srv = await startServer();
  const origin = "http://127.0.0.1:" + srv.address().port;
  const userDir = fs.mkdtempSync(path.join("/tmp", "bc-lb-shots-"));
  const chrome = spawn("google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--remote-debugging-port=9227", "--user-data-dir=" + userDir, "--no-first-run", "--disable-background-networking", "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
  let chromeLog = "";
  chrome.stderr.on("data", d => { chromeLog += d.toString(); });
  chrome.stdout.on("data", d => { chromeLog += d.toString(); });
  const port = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("chrome did not listen\n" + chromeLog)), 20000);
    const watch = () => { const m = chromeLog.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/); if (m) { clearTimeout(t); resolve(+m[1]); } };
    chrome.stderr.on("data", watch); chrome.stdout.on("data", watch); watch();
  });
  const widths = [375, 390];
  const langs = ["en", "es"];
  try {
    for (const lang of langs) {
      for (const width of widths) {
        const vp = { width, height: 844, deviceScaleFactor: 1, mobile: true };
        const tag = lang + "-" + width;
        {
          const cdp = await openPage(port, origin + "/index.html?lbshot=1&lang=" + lang, "localStorage.clear();", vp);
          const info = await evalJson(cdp, `({ gate: !!document.querySelector('[data-board-gate]'), name: !!document.querySelector('[data-board-name]'), help: (document.querySelector('.board-help')||{}).textContent || '', start: !!document.querySelector('.cta .btn.primary') })`);
          if (!info.gate || info.name || !info.start) throw new Error("age gate " + tag + " " + JSON.stringify(info));
          await shot(cdp, "lb-agegate-" + tag + ".png", "[data-board-gate]", width);
          await fetch("http://127.0.0.1:" + port + "/json/close/" + cdp.id).catch(() => {});
        }
        {
          const cdp = await openPage(port, origin + "/index.html?lbshot=1&lang=" + lang, "localStorage.clear(); localStorage.setItem('bc-board-eligible','yes');", vp);
          const help = await evalJson(cdp, `(document.querySelector('.board-help')||{}).textContent || ''`);
          const want = lang === "es" ? "Este nombre se muestra públicamente. Usa un apodo, no tu nombre completo." : "This name is shown publicly. Use a nickname, not your full name.";
          if (help !== want) throw new Error("helper " + tag + " " + help);
          await shot(cdp, "lb-name-" + tag + ".png", "[data-board-name]", width);
          await evalJson(cdp, `document.querySelector('[data-board-name-input]').value = 'Daily Dose'; document.querySelector('.cta .btn.primary').click();`);
          const blocked = await evalJson(cdp, `({ err: (document.querySelector('[data-board-error]')||{}).textContent || '', game: document.body.classList.contains('in-game'), value: document.querySelector('[data-board-name-input]').value })`);
          if (!blocked.err || blocked.game || blocked.value !== "Daily Dose") throw new Error("blocked " + tag + " " + JSON.stringify(blocked));
          await shot(cdp, "lb-blocked-" + tag + ".png", "[data-board-name]", width);
          await fetch("http://127.0.0.1:" + port + "/json/close/" + cdp.id).catch(() => {});
        }
        {
          const cdp = await openPage(port, origin + "/index.html?lbshot=1&lang=" + lang, "localStorage.clear();", vp);
          await evalJson(cdp, `document.getElementById('board-year').value = '2014'; document.querySelector('.board-year-go').click();`);
          const under = await evalJson(cdp, `({ name: !!document.querySelector('[data-board-name]'), gate: !!document.querySelector('[data-board-gate]'), start: (document.querySelector('.cta .btn.primary')||{}).textContent || '', store: JSON.stringify(localStorage) })`);
          if (under.name || under.gate || !/Clash|Continuar/.test(under.start) || under.store.includes("2014")) throw new Error("under13 " + tag + " " + JSON.stringify(under));
          await shot(cdp, "lb-under13-" + tag + ".png", ".cta", width);
          await fetch("http://127.0.0.1:" + port + "/json/close/" + cdp.id).catch(() => {});
        }
        for (const [kind, fix] of [["busy", BUSY], ["quiet", QUIET]]) {
          const seed = "localStorage.clear(); localStorage.setItem('bc-board-eligible','yes'); window.LEADERBOARD_FIXTURE = " + JSON.stringify(fix) + ";";
          const cdp = await openPage(port, origin + "/index.html?lbshot=1&lang=" + lang, seed, vp);
          const count = await evalJson(cdp, `document.querySelectorAll('.board-row').length`);
          const expect = kind === "busy" ? 28 : 2;
          if (count !== expect) throw new Error(kind + " overall " + tag + " rows " + count);
          await shot(cdp, "lb-" + kind + "-overall-" + tag + ".png", "[data-day-board]", width);
          await evalJson(cdp, `document.querySelector('[data-board-section=world]').click()`);
          const world = await evalJson(cdp, `document.querySelectorAll('.board-row').length`);
          const worldExpect = kind === "busy" ? 28 : 0;
          if (world !== worldExpect) throw new Error(kind + " world " + tag + " rows " + world);
          await shot(cdp, "lb-" + kind + "-world-" + tag + ".png", "[data-day-board]", width);
          await fetch("http://127.0.0.1:" + port + "/json/close/" + cdp.id).catch(() => {});
        }
        {
          const seed = "localStorage.clear(); window.BOARD_ADMIN_FIXTURE = " + JSON.stringify(ADMIN) + ";";
          const cdp = await openPage(port, origin + "/admin.html?lbshot=1&lang=" + lang, seed, vp);
          const info = await evalJson(cdp, `({ title: (document.getElementById('board-admin-title')||{}).textContent || '', rows: document.querySelectorAll('.nrow').length, rename: [...document.querySelectorAll('#board-admin button')].map(b => b.textContent) })`);
          if (info.rows !== 3 || info.rename.length < 2) throw new Error("admin " + tag + " " + JSON.stringify(info));
          await shot(cdp, "lb-admin-" + tag + ".png", "#board-admin", width);
          await fetch("http://127.0.0.1:" + port + "/json/close/" + cdp.id).catch(() => {});
        }
      }
    }
    console.log("leaderboard shots ok");
  } finally {
    chrome.kill("SIGKILL");
    srv.close();
  }
})().catch(err => { console.error(err); process.exit(1); });
