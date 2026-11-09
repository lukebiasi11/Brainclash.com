// Layout of the practice type demo at phone sizes. Screenshots are written for review.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const ROOT = path.resolve(__dirname, "..");
const SHOTS = "/opt/cursor/artifacts";
fs.mkdirSync(SHOTS, { recursive: true });
let bad = 0;
const fail = (n, d) => { bad++; console.log("FAIL", n, d == null ? "" : typeof d === "string" ? d : JSON.stringify(d)); };
const pass = n => console.log("ok", n);

function startServer() {
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent((req.url || "/").split("?")[0]);
    const file = rel === "/" ? "index.html" : rel.replace(/^\/+/, "");
    const fp = path.normalize(path.join(ROOT, file));
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end("missing"); }
    const ext = path.extname(fp);
    const type = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".webp": "image/webp" }[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(fs.readFileSync(fp));
  });
  return new Promise(resolve => srv.listen(0, "127.0.0.1", () => resolve(srv)));
}
class CDP {
  constructor(ws) { this.ws = ws; this.next = 0; this.pending = new Map();
    ws.addEventListener("message", ev => { const msg = JSON.parse(ev.data); if (msg.id && this.pending.has(msg.id)) { const p = this.pending.get(msg.id); this.pending.delete(msg.id); msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result || {}); } });
  }
  send(method, params = {}, ms = 15000) {
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
const fitExpr = `(() => {
  const nodes = [...document.querySelectorAll(".pair-card, .nudge, .btn, .slider-range, .txt")];
  const small = nodes.filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44); }).map(n => n.className + " " + Math.round(n.getBoundingClientRect().width) + "x" + Math.round(n.getBoundingClientRect().height));
  return {
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    title: document.title,
    prompt: (document.querySelector(".prompt") || {}).textContent || "",
    note: (document.querySelector(".pair-note") || {}).textContent || "",
    fb: (document.querySelector(".fb") || {}).textContent || "",
    clues: document.querySelectorAll(".reveal-clue").length,
    small
  };
})()`;

(async () => {
  const srv = await startServer();
  const origin = "http://127.0.0.1:" + srv.address().port;
  const userDir = fs.mkdtempSync(path.join("/tmp", "bc-types-"));
  const chrome = spawn("google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--remote-debugging-port=9344", "--user-data-dir=" + userDir, "--no-first-run", "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  chrome.stderr.on("data", d => { log += d; });
  chrome.stdout.on("data", d => { log += d; });
  const port = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("chrome\n" + log)), 20000);
    const watch = () => { const m = log.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/); if (m) { clearTimeout(t); resolve(+m[1]); } };
    chrome.stderr.on("data", watch); chrome.stdout.on("data", watch); watch();
  });
  const created = JSON.parse(await (await fetch("http://127.0.0.1:" + port + "/json/new?" + encodeURIComponent("about:blank"), { method: "PUT" })).text());
  const cdp = new CDP(await wsOpen(created.webSocketDebuggerUrl));
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  async function open(url, w, h) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: true });
    await cdp.send("Page.navigate", { url: origin + url });
    const ready = await ev(cdp, `new Promise(r => { const t = Date.now(); const tick = () => document.querySelector(".pair-card, .reveal-clue, .slider-range") ? r(true) : Date.now() - t > 8000 ? r(false) : setTimeout(tick, 40); tick(); })`);
    if (!ready) throw new Error("not ready " + url);
    await ev(cdp, "new Promise(r => setTimeout(r, 250))");
  }
  async function shot(name) {
    const img = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(SHOTS, name), Buffer.from(img.data, "base64"));
  }
  try {
    for (const [lang, label] of [["en", "en"], ["es", "es"]]) {
      for (const [w, h, tag] of [[390, 844, "844"], [360, 568, "568"]]) {
        await open("/index.html?preview=demo&shot=pair&lang=" + lang, w, h);
        const q = await ev(cdp, fitExpr);
        if (q.overflow > 1 || q.small.length) fail(label + " pair question " + tag, q); else pass(label + " pair question " + tag);
        if (tag === "844") await shot("type-pair-" + label + "-question.png");
        await ev(cdp, `document.querySelector(".pair-card").click()`);
        await ev(cdp, "new Promise(r => setTimeout(r, 200))");
        const a = await ev(cdp, fitExpr);
        if (a.overflow > 1 || a.small.length || !a.note) fail(label + " pair answered " + tag, a); else pass(label + " pair answered " + tag);
        if (tag === "844") await shot("type-pair-" + label + "-answered.png");

        await open("/index.html?preview=demo&shot=reveal&lang=" + lang, w, h);
        const rq = await ev(cdp, fitExpr);
        if (rq.overflow > 1 || rq.small.length || rq.clues < 1) fail(label + " reveal question " + tag, rq); else pass(label + " reveal question " + tag);
        if (tag === "844") await shot("type-reveal-" + label + "-question.png");
        await ev(cdp, `(() => { const i = document.querySelector(".txt"); i.value = "Serena Williams"; i.dispatchEvent(new Event("input")); document.querySelector("form.answer").requestSubmit(); return true; })()`);
        await ev(cdp, "new Promise(r => setTimeout(r, 200))");
        const ra = await ev(cdp, fitExpr);
        if (ra.overflow > 1 || !/clue 1|pista 1/i.test(ra.fb)) fail(label + " reveal answered " + tag, ra); else pass(label + " reveal answered " + tag);
        if (tag === "844") await shot("type-reveal-" + label + "-answered.png");

        await open("/index.html?preview=demo&shot=slider&lang=" + lang, w, h);
        const sq = await ev(cdp, fitExpr);
        if (sq.overflow > 1 || sq.small.length) fail(label + " slider question " + tag, sq); else pass(label + " slider question " + tag);
        if (tag === "844") await shot("type-slider-" + label + "-question.png");
        await ev(cdp, `(() => { const r = document.querySelector(".slider-range"); const typed = document.querySelector(".slider-type"); const n = r.dataset.answer; if (typed) { typed.value = n; typed.dispatchEvent(new Event("input")); } else { r.value = n; r.dispatchEvent(new Event("input")); } document.querySelector(".action-bar .btn").click(); return true; })()`);
        await ev(cdp, "new Promise(r => setTimeout(r, 200))");
        const sa = await ev(cdp, fitExpr);
        if (sa.overflow > 1 || !/437/.test(sa.fb)) fail(label + " slider answered " + tag, sa); else pass(label + " slider answered " + tag);
        if (tag === "844") await shot("type-slider-" + label + "-answered.png");
      }
    }
  } finally {
    chrome.kill("SIGKILL");
    srv.close();
  }
  console.log(bad ? bad + " layout failures" : "type-layout.browser.js: all pass");
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
