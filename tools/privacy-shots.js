// Privacy notice screenshots. node tools/privacy-shots.js
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const ROOT = path.resolve(__dirname, "..");
const OUT = "/opt/cursor/artifacts";
fs.mkdirSync(OUT, { recursive: true });

function startServer() {
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\/+/, "") || "index.html";
    const fp = path.normalize(path.join(ROOT, rel));
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end("missing"); }
    const ext = path.extname(fp);
    const type = { ".html": "text/html;charset=utf-8", ".js": "text/javascript;charset=utf-8", ".css": "text/css;charset=utf-8" }[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(fs.readFileSync(fp));
  });
  return new Promise(resolve => srv.listen(0, "127.0.0.1", () => resolve(srv)));
}
class CDP {
  constructor(ws) { this.ws = ws; this.nextId = 0; this.pending = new Map(); ws.addEventListener("message", ev => { const msg = JSON.parse(ev.data); if (msg.id && this.pending.has(msg.id)) { const p = this.pending.get(msg.id); this.pending.delete(msg.id); if (msg.error) p.reject(new Error(msg.error.message)); else p.resolve(msg.result || {}); } }); }
  send(method, params = {}, ms = 30000) { const id = ++this.nextId; return new Promise((resolve, reject) => { const t = setTimeout(() => { this.pending.delete(id); reject(new Error("timeout " + method)); }, ms); this.pending.set(id, { resolve: v => { clearTimeout(t); resolve(v); }, reject: e => { clearTimeout(t); reject(e); } }); this.ws.send(JSON.stringify({ id, method, params })); }); }
}
function wsOpen(url) { const ws = new WebSocket(url); return new Promise((resolve, reject) => { ws.addEventListener("open", () => resolve(ws)); ws.addEventListener("error", () => reject(new Error("ws"))); }); }
async function evalJson(cdp, expression) { const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result ? r.result.value : undefined; }

(async () => {
  const srv = await startServer();
  const origin = "http://127.0.0.1:" + srv.address().port;
  const userDir = fs.mkdtempSync(path.join("/tmp", "bc-privacy-"));
  const chrome = spawn("google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--remote-debugging-port=9235", "--user-data-dir=" + userDir, "--no-first-run", "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
  let chromeLog = "";
  chrome.stderr.on("data", d => { chromeLog += d.toString(); });
  const port = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("chrome\n" + chromeLog)), 20000);
    const watch = () => { const m = chromeLog.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/); if (m) { clearTimeout(t); resolve(+m[1]); } };
    chrome.stderr.on("data", watch); watch();
  });
  try {
    for (const lang of ["en", "es"]) {
      for (const width of [375, 390]) {
        const createdRes = await fetch("http://127.0.0.1:" + port + "/json/new?" + encodeURIComponent("about:blank"), { method: "PUT" });
        const created = JSON.parse(await createdRes.text());
        const cdp = new CDP(await wsOpen(created.webSocketDebuggerUrl));
        await cdp.send("Page.enable");
        await cdp.send("Runtime.enable");
        await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: 844, deviceScaleFactor: 1, mobile: true });
        await cdp.send("Page.navigate", { url: origin + "/privacy.html?lang=" + lang });
        const want = lang === "es" ? "Comparación diaria" : "Daily comparison";
        const title = await evalJson(cdp, `new Promise(resolve => { const start = Date.now(); const tick = () => { const t = document.getElementById('privacy-title'); if (t && t.textContent === ${JSON.stringify(want)}) resolve(t.textContent); else if (Date.now()-start>8000) resolve(t && t.textContent); else setTimeout(tick, 40); }; tick(); })`);
        if (title !== want) throw new Error("title " + lang + " " + title);
        const text = await evalJson(cdp, "document.querySelector('.privacy-card').innerText");
        if (lang === "en" && (!text.includes("GO_LIVE_DATE_TBD") || !text.includes("We ask your birth year once") || !text.includes("We may remove or change nicknames") || text.includes("Rankings are for fun") || text.includes("November 9, 2026"))) throw new Error("en notice " + text.slice(0, 200));
        if (lang === "es" && (!text.includes("GO_LIVE_DATE_TBD") || !text.includes("Te pedimos tu año de nacimiento una vez") || !text.includes("Podemos quitar o cambiar apodos") || text.includes("sin premios"))) throw new Error("es notice " + text.slice(0, 200));
        const view = await cdp.send("Page.captureScreenshot", { format: "png" });
        fs.writeFileSync(path.join(OUT, "privacy-" + lang + "-" + width + ".png"), Buffer.from(view.data, "base64"));
        const height = await evalJson(cdp, "Math.ceil(document.documentElement.scrollHeight)");
        const full = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height, scale: 1 } }, 30000);
        fs.writeFileSync(path.join(OUT, "privacy-" + lang + "-" + width + "-full.png"), Buffer.from(full.data, "base64"));
        console.log("wrote privacy-" + lang + "-" + width + ".png and full (" + height + "px)");
        await fetch("http://127.0.0.1:" + port + "/json/close/" + created.id).catch(() => {});
      }
    }
  } finally {
    chrome.kill("SIGKILL");
    srv.close();
  }
})().catch(err => { console.error(err); process.exit(1); });
