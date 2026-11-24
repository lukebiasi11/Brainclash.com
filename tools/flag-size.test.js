// World flag questions use withFlag(), which marks the image inline-flag.
// Phone (390x844): full card width, about 366x220 for the 5:3 Costa Rica flag.
// Desktop (1280x800): height capped so the question and all four answers stay on screen.
const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");
const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
let bad = 0;
const t = (name, ok, extra) => { if (!ok) { bad++; console.log("FAIL", name, extra == null ? "" : extra); } else console.log("ok", name); };
const rule = (css.match(/img\.ico\.inline-flag\{[^}]+\}/) || [""])[0];
t("shared flag rule is present", rule.length > 0);
t("flag width is auto", /width:auto/.test(rule));
t("flag max-width is the card", /max-width:100%/.test(rule));
t("flag keeps its aspect ratio", /height:auto/.test(rule));
t("flag height is capped", /max-height:min\(38vh,260px\)/.test(rule));
t("flag is centered", /margin-inline:auto/.test(rule));
t("flag has a thin border", /border:1px solid/.test(rule));
t("tiny 1.6em flag size is gone", !css.includes("inline-flag{width:1.6em"));
t("uncapped width:100% is gone", !/(^|[{;])width:100%/.test(rule));
t("style cache is tf26a", html.includes('style.css?v=tf26a') && !html.includes('style.css?v=ee6lb') && !html.includes('style.css?v=lb8n22') && !html.includes('style.css?v=nov22x') && !html.includes('style.css?v=nov22w') && !html.includes('style.css?v=nov18b') && !html.includes('style.css?v=lb6'));
t("withFlag still marks inline-flag", app.includes('inline-flag'));

// 38vh at 844px is 321px, so the 260px cap does not bind on a 220px-tall phone flag.
const cap = vh => Math.min(0.38 * vh, 260);
t("844px cap stays above a 220px flag", cap(844) >= 220);
t("800px cap is 260px", cap(800) === 260);

function startServer() {
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\/+/, "") || "index.html";
    const fp = path.normalize(path.join(root, rel));
    if (!fp.startsWith(root) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end("missing"); }
    const ext = path.extname(fp);
    const type = { ".html": "text/html;charset=utf-8", ".js": "text/javascript;charset=utf-8", ".css": "text/css;charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png" }[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store", Date: "Sun, 22 Nov 2026 18:00:00 GMT" });
    fs.createReadStream(fp).pipe(res);
  });
  return new Promise(resolve => srv.listen(0, "127.0.0.1", () => resolve(srv)));
}
class CDP {
  constructor(ws) { this.ws = ws; this.nextId = 0; this.pending = new Map();
    ws.addEventListener("message", ev => { const msg = JSON.parse(ev.data); if (msg.id && this.pending.has(msg.id)) { const p = this.pending.get(msg.id); this.pending.delete(msg.id); if (msg.error) p.reject(new Error(msg.error.message || JSON.stringify(msg.error))); else p.resolve(msg.result || {}); } }); }
  send(method, params = {}, ms = 20000) { const id = ++this.nextId; return new Promise((resolve, reject) => { const t = setTimeout(() => { this.pending.delete(id); reject(new Error("timeout " + method)); }, ms); this.pending.set(id, { resolve: v => { clearTimeout(t); resolve(v); }, reject: e => { clearTimeout(t); reject(e); } }); this.ws.send(JSON.stringify({ id, method, params })); }); }
}
function wsOpen(url) { const ws = new WebSocket(url); return new Promise((resolve, reject) => { ws.addEventListener("open", () => resolve(ws)); ws.addEventListener("error", () => reject(new Error("ws"))); }); }
async function evalJson(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception || {}).description || r.exceptionDetails.text);
  return r.result ? r.result.value : undefined;
}

const clock = `try { localStorage.clear(); localStorage.setItem("bc-board-name","Luna"); } catch (e) {} Date.now = function(){ return ${Date.parse("2026-11-22T18:00:00Z")}; };`;
const measureExpr = `new Promise(r => { const t0 = performance.now(); const tick = () => {
  const body = document.body;
  const main = document.querySelector("main");
  const img = document.querySelector("img.inline-flag");
  const running = main ? main.getAnimations().some(a => a.playState === "running") : true;
  const op = main ? getComputedStyle(main).opacity : "0";
  const ready = body && img && img.complete && img.naturalWidth > 0 && !running && op === "1" && (body.textContent || "").includes("Which country's flag is this?");
  if (!ready) { if (performance.now() - t0 > 12000) r(null); else setTimeout(tick, 40); return; }
  const box = img.getBoundingClientRect();
  const card = (document.querySelector(".game-body") || img.parentElement).getBoundingClientRect();
  const opts = [...document.querySelectorAll("button.opt")].map(b => { const o = b.getBoundingClientRect(); return { top: o.top, bottom: o.bottom, text: b.textContent.trim() }; });
  r({ w: box.width, h: box.height, card: card.width, opts, iw: innerWidth, ih: innerHeight, scroll: document.scrollingElement.scrollHeight, client: document.scrollingElement.clientHeight });
}; tick(); })`;

async function openQuestion(cdp, origin) {
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: clock });
  await cdp.send("Page.navigate", { url: origin + "/index.html" });
  const home = await evalJson(cdp, `new Promise(r => { const t0 = performance.now(); const tick = () => { const b = document.body; if (b && (b.textContent || "").includes("Start the Clash")) r(true); else if (performance.now() - t0 > 8000) r(false); else setTimeout(tick, 40); }; tick(); })`);
  if (!home) throw new Error("home not ready");
  const click = async bit => {
    const ok = await evalJson(cdp, `(() => { const b = [...document.querySelectorAll("button")].find(el => (el.textContent || "").toLowerCase().includes(${JSON.stringify(bit.toLowerCase())}) && !el.disabled); if (!b) return false; b.click(); return true; })()`);
    if (!ok) throw new Error("click failed " + bit);
    await new Promise(res => setTimeout(res, 450));
  };
  await click("Start the Clash");
  await click("Start World Rush");
  await click("Lock in pin");
  await click("Next pin");
  await click("Lock in pin");
  await click("Geography Q");
  const m = await evalJson(cdp, measureExpr);
  if (!m) throw new Error("flag question did not settle");
  return m;
}

(async () => {
  const srv = await startServer();
  const origin = "http://127.0.0.1:" + srv.address().port;
  const userDir = fs.mkdtempSync(path.join("/tmp", "bc-flag-size-"));
  const chrome = spawn("google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--remote-debugging-port=9344", "--user-data-dir=" + userDir, "--no-first-run", "--disable-background-networking", "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
  let chromeLog = "";
  chrome.stderr.on("data", d => { chromeLog += d; });
  chrome.stdout.on("data", d => { chromeLog += d; });
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("chrome did not listen\n" + chromeLog)), 20000);
    const watch = () => { const m = chromeLog.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/); if (m) { clearTimeout(timer); resolve(+m[1]); } };
    chrome.stderr.on("data", watch); chrome.stdout.on("data", watch); watch();
  });
  async function page(w, h) {
    const createdRes = await fetch("http://127.0.0.1:" + port + "/json/new?" + encodeURIComponent("about:blank"), { method: "PUT" });
    const created = JSON.parse(await createdRes.text());
    const cdp = new CDP(await wsOpen(created.webSocketDebuggerUrl));
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
    return openQuestion(cdp, origin);
  }
  try {
    const phone = await page(390, 844);
    console.log("phone", JSON.stringify(phone));
    const ratio = phone.w / phone.h;
    t("390x844 flag is full card width", Math.abs(phone.w - phone.card) <= 2, phone.w + " card " + phone.card);
    t("390x844 flag is about 366px wide", phone.w >= 350 && phone.w <= 380, phone.w);
    t("390x844 flag stays about 220px tall", phone.h >= 200 && phone.h <= 245, phone.h);
    t("390x844 flag keeps 5:3", Math.abs(ratio - 1000 / 600) < 0.04, ratio);
    t("390x844 shows four answers", phone.opts.length === 4 && phone.opts.every(o => o.bottom <= phone.ih + 1 && o.top >= 0), JSON.stringify(phone.opts.map(o => Math.round(o.bottom))));

    const desk = await page(1280, 800);
    console.log("desk", JSON.stringify(desk));
    const dr = desk.w / desk.h;
    t("1280x800 flag height is capped at 260", desk.h <= 260.5 && desk.h >= 180, desk.h);
    t("1280x800 flag is not the old 741px width", desk.w < 520, desk.w);
    t("1280x800 flag keeps 5:3", Math.abs(dr - 1000 / 600) < 0.04, dr);
    t("1280x800 shows the question and all four answers", desk.opts.length === 4 && desk.opts.every(o => o.bottom <= desk.ih + 1 && o.top >= 0), JSON.stringify(desk.opts.map(o => [Math.round(o.top), Math.round(o.bottom)])));
  } finally {
    chrome.kill("SIGKILL");
    srv.close();
  }
  console.log(bad ? bad + " failed" : "flag-size.test.js: all pass");
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
