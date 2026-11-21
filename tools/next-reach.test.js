// Next and Lock in stay fully on screen on narrow and short viewports, not only at width 375.
// Screenshots: /opt/cursor/artifacts/next-{w}x{h}-{en|es}.png
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SHOTS = "/opt/cursor/artifacts";
fs.mkdirSync(SHOTS, { recursive: true });
const SIZES = [[320, 568], [360, 640], [375, 667], [390, 844], [414, 736], [1280, 800]];
let bad = 0;
const fail = (n, d) => { bad++; console.log("FAIL", n, d == null ? "" : typeof d === "string" ? d : JSON.stringify(d)); };
const pass = n => console.log("ok", n);

const appSrc = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const fitSrc = appSrc.slice(appSrc.indexOf("function fitScreen"), appSrc.indexOf("function viewBottom"));
if (/inner(?:Width|Height)\s*[!=]==\s*\d+/.test(fitSrc)) fail("fitScreen uses an exact viewport size");
else pass("fitScreen has no exact viewport check");
if (!/max-width:\s*380px/.test(fitSrc) || !/max-height:\s*700px/.test(fitSrc)) fail("fitScreen missing narrow-or-short query");
else pass("fitScreen uses a narrow or short media query");

function startServer() {
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent((req.url || "/").split("?")[0]);
    const file = rel === "/" ? "index.html" : rel.replace(/^\/+/, "");
    const fp = path.normalize(path.join(ROOT, file));
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end("missing"); }
    const ext = path.extname(fp);
    const type = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png" }[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(fs.readFileSync(fp));
  });
  return new Promise(resolve => srv.listen(0, "127.0.0.1", () => resolve(srv)));
}
class CDP {
  constructor(ws) { this.ws = ws; this.next = 0; this.pending = new Map();
    ws.addEventListener("message", ev => { const msg = JSON.parse(ev.data); if (msg.id && this.pending.has(msg.id)) { const p = this.pending.get(msg.id); this.pending.delete(msg.id); msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result || {}); } });
  }
  send(method, params = {}, ms = 20000) {
    const id = ++this.next;
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { this.pending.delete(id); reject(new Error("timeout " + method)); }, ms);
      this.pending.set(id, { resolve: v => { clearTimeout(t); resolve(v); }, reject: e => { clearTimeout(t); reject(e); } });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}
function wsOpen(url) { const ws = new WebSocket(url); return new Promise((resolve, reject) => { ws.addEventListener("open", () => resolve(ws)); ws.addEventListener("error", () => reject(new Error("ws"))); }); }
async function ev(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception || {}).description || r.exceptionDetails.text);
  return r.result ? r.result.value : undefined;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

function boxExpr(re) {
  return `(() => {
    const b = [...document.querySelectorAll("button")].find(el => ${re}.test((el.textContent || "").replace(/\\s+/g, " ").trim()));
    if (!b) return null;
    const r = b.getBoundingClientRect();
    const x = Math.min(innerWidth - 2, Math.max(2, r.left + r.width / 2));
    const y = Math.min(innerHeight - 2, Math.max(2, r.top + r.height / 2));
    const hit = document.elementFromPoint(x, y);
    return {
      t: (b.textContent || "").replace(/\\s+/g, " ").trim(),
      top: r.top, left: r.left, right: r.right, bottom: r.bottom,
      w: r.width, h: r.height, scroll: b.scrollWidth, client: b.clientWidth,
      off: r.bottom - innerHeight, iw: innerWidth, ih: innerHeight,
      covered: hit && hit !== b && !b.contains(hit) ? (hit.className || hit.tagName) : ""
    };
  })()`;
}
function reachable(box, name) {
  if (!box) { fail(name + " missing"); return; }
  const problems = [];
  if (box.top < -1) problems.push("above");
  if (box.left < -1) problems.push("left");
  if (box.right > box.iw + 1) problems.push("right");
  if (box.bottom > box.ih - 8) problems.push("bottom " + Math.round(box.off));
  if (box.scroll > box.client + 2) problems.push("text " + box.scroll + ">" + box.client);
  if (box.covered) problems.push("covered by " + box.covered);
  if (problems.length) fail(name, { problems, t: box.t, off: Math.round(box.off), box: { top: Math.round(box.top), bottom: Math.round(box.bottom), left: Math.round(box.left), right: Math.round(box.right), ih: box.ih, iw: box.iw } });
  else pass(name + " " + box.t);
}

(async () => {
  const srv = await startServer();
  const origin = "http://127.0.0.1:" + srv.address().port;
  const userDir = fs.mkdtempSync(path.join("/tmp", "bc-next-"));
  const chrome = spawn("google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--remote-debugging-port=9402", "--user-data-dir=" + userDir, "--no-first-run", "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  chrome.stderr.on("data", d => { log += d; });
  const port = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("chrome\n" + log.slice(-400))), 20000);
    const watch = () => { const m = log.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/); if (m) { clearTimeout(t); resolve(+m[1]); } };
    chrome.stderr.on("data", watch); watch();
  });
  const created = JSON.parse(await (await fetch("http://127.0.0.1:" + port + "/json/new?" + encodeURIComponent("about:blank"), { method: "PUT" })).text());
  const cdp = new CDP(await wsOpen(created.webSocketDebuggerUrl));
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  async function open(lang) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 375, height: 667, deviceScaleFactor: 1, mobile: true });
    await cdp.send("Page.navigate", { url: origin + "/index.html?dgtest&lang=" + lang });
    const ok = await ev(cdp, `new Promise(r => { const t = Date.now(); const tick = () => window.DGTest ? r(true) : Date.now() - t > 8000 ? r(false) : setTimeout(tick, 30); tick(); })`);
    if (!ok) throw new Error("no DGTest " + lang);
    await sleep(200);
  }
  async function clickRe(re) {
    return ev(cdp, `(() => { const b = [...document.querySelectorAll("button")].find(el => ${re}.test((el.textContent || "").replace(/\\s+/g, " ").trim())); if (!b || b.disabled) return false; b.click(); return true; })()`);
  }
  async function setSize(w, h) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 1000 });
    await ev(cdp, `new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
    await sleep(250);
  }
  async function shot(name) {
    const img = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(SHOTS, name), Buffer.from(img.data, "base64"));
  }
  try {
    for (const lang of ["en", "es"]) {
      await open(lang);
      await ev(cdp, `DGTest.at("2026-11-21", 1)`);
      await sleep(500);
      if (!await clickRe("/^(Start |Empezar )/")) throw new Error("start " + lang);
      await sleep(400);
      if (!await clickRe("/Lock in order|Confirmar orden/")) throw new Error("lock1 " + lang);
      await sleep(450);
      if (!await clickRe("/Round 2|Ronda 2/")) throw new Error("round2 " + lang);
      await sleep(450);
      if (!await clickRe("/Lock in order|Confirmar orden/")) throw new Error("lock2 " + lang);
      await sleep(400);
      for (const [w, h] of SIZES) {
        await setSize(w, h);
        const box = await ev(cdp, boxExpr("/^(Next:|Siguiente:)/"));
        await shot("next-" + w + "x" + h + "-" + lang + ".png");
        reachable(box, "next " + w + "x" + h + " " + lang);
      }
      for (const [w, h] of SIZES) {
        await setSize(w, h);
        await ev(cdp, `DGTest.at("2026-11-21", 0)`);
        await sleep(500);
        if (!await clickRe("/^(Start |Empezar )/")) throw new Error("world start " + lang + " " + w);
        await sleep(600);
        const box = await ev(cdp, boxExpr("/Lock in pin|Confirmar pin/"));
        reachable(box, "lock " + w + "x" + h + " " + lang);
        const mapH = await ev(cdp, `Math.round((document.querySelector(".lmap") || document.createElement("div")).getBoundingClientRect().height)`);
        if (mapH < 280) fail("map collapsed " + w + "x" + h + " " + lang, mapH);
        else pass("map " + w + "x" + h + " " + lang + " " + mapH + "px");
        if (lang === "en" && [[320, 568], [375, 667], [390, 844], [1280, 800]].some(([a, b]) => a === w && b === h)) await shot("world-rush-pin-" + w + "x" + h + ".png");
      }
    }
  } catch (e) {
    fail("threw", e.stack || String(e));
  } finally {
    chrome.kill("SIGKILL");
    srv.close();
    console.log(bad ? "FAILED " + bad : "next-reach.test.js: all pass");
    process.exit(bad ? 1 : 0);
  }
})();
