// Chrome check: the birth year is not sent and not stored.
// node tools/age-gate.browser.js
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const YEAR = "1977";
let bad = 0;
const fail = (name, detail) => { bad++; console.log("FAIL", name, detail == null ? "" : typeof detail === "string" ? detail : JSON.stringify(detail)); };
const pass = name => console.log("ok", name);

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
    this.ws = ws; this.nextId = 0; this.pending = new Map(); this.reqs = []; this.logs = [];
    ws.addEventListener("message", ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id); this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message || JSON.stringify(msg.error))); else p.resolve(msg.result || {});
        return;
      }
      if (!msg.method) return;
      const p = msg.params || {};
      if (msg.method === "Network.requestWillBeSent") this.reqs.push({ url: p.request.url, method: p.request.method, body: (p.request.postData || "") });
      if (msg.method === "Runtime.consoleAPICalled") this.logs.push((p.args || []).map(a => a.value || a.description || "").join(" "));
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

const hook = `(() => {
  window.__net = [];
  window.__logs = [];
  const push = (url, method, body) => { window.__net.push({ url: String(url), method: method || "GET", body: body == null ? "" : String(body) }); };
  const orig = window.fetch;
  window.fetch = function(url, opts) { push(url, opts && opts.method, opts && opts.body); return orig.apply(this, arguments); };
  const XO = XMLHttpRequest.prototype.open, XS = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(m, u) { this.__m = m; this.__u = u; return XO.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function(b) { push(this.__u, this.__m, b); return XS.apply(this, arguments); };
  if (navigator.sendBeacon) navigator.sendBeacon = function(u, b) { push(u, "BEACON", b); return true; };
  ["log", "info", "warn", "error", "debug"].forEach(k => {
    const prev = console[k].bind(console);
    console[k] = function() { window.__logs.push(Array.from(arguments).join(" ")); return prev.apply(null, arguments); };
  });
})();`;

(async () => {
  const srv = await startServer();
  const origin = "http://127.0.0.1:" + srv.address().port;
  const userDir = fs.mkdtempSync(path.join("/tmp", "bc-age-"));
  const chrome = spawn("google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--remote-debugging-port=9233", "--user-data-dir=" + userDir, "--no-first-run", "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
  let chromeLog = "";
  chrome.stderr.on("data", d => { chromeLog += d.toString(); });
  const port = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("chrome\n" + chromeLog)), 20000);
    const watch = () => { const m = chromeLog.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/); if (m) { clearTimeout(t); resolve(+m[1]); } };
    chrome.stderr.on("data", watch); watch();
  });
  try {
    const createdRes = await fetch("http://127.0.0.1:" + port + "/json/new?" + encodeURIComponent("about:blank"), { method: "PUT" });
    const created = JSON.parse(await createdRes.text());
    const cdp = new CDP(await wsOpen(created.webSocketDebuggerUrl));
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: hook + "localStorage.clear(); sessionStorage.clear();" });
    await cdp.send("Page.navigate", { url: origin + "/index.html?lbshot=1" });
    const ready = await evalJson(cdp, `new Promise(resolve => { const start = Date.now(); const tick = () => { if (document.getElementById('board-year')) resolve(true); else if (Date.now()-start>8000) resolve(false); else setTimeout(tick, 40); }; tick(); })`);
    if (!ready) throw new Error("age gate did not render");
    const shape = await evalJson(cdp, `(() => { const gate = document.querySelector('[data-board-gate]'); const input = document.getElementById('board-year'); return { tag: gate.tagName, form: !!(gate.closest && gate.closest('form')), type: input.type, mode: input.getAttribute('inputmode'), auto: input.getAttribute('autocomplete'), readOnly: input.readOnly }; })()`);
    if (shape.tag !== "DIV" || shape.form || shape.type !== "text" || shape.mode !== "numeric" || shape.auto !== "off") fail("year control", shape); else pass("year control is a numeric text field outside a form");
    await evalJson(cdp, `(() => { const input = document.getElementById('board-year'); input.readOnly = false; input.value = ${JSON.stringify(YEAR)}; document.querySelector('.board-year-go').click(); })()`);
    await evalJson(cdp, "new Promise(r => setTimeout(r, 400))");
    const stored = await evalJson(cdp, `(() => {
      const bag = {};
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); bag[k] = localStorage.getItem(k); }
      const session = {};
      for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); session[k] = sessionStorage.getItem(k); }
      const field = document.getElementById('board-year');
      return { bag, session, cookie: document.cookie, href: location.href, field: field ? field.value : "", net: window.__net || [], logs: window.__logs || [] };
    })()`);
    let idb = "";
    try { idb = JSON.stringify(await evalJson(cdp, "indexedDB.databases ? indexedDB.databases() : []") || []); } catch (e) { idb = ""; }
    const dump = JSON.stringify(stored.bag) + JSON.stringify(stored.session) + stored.cookie + stored.href + JSON.stringify(stored.net) + JSON.stringify(stored.logs) + JSON.stringify(cdp.reqs) + idb + stored.field;
    if (stored.bag["bc-board-eligible"] !== "yes") fail("flag", stored.bag); else pass("only the yes flag is stored");
    if (dump.includes(YEAR)) fail("year leaked", dump.slice(0, 500)); else pass("birth year is absent from storage, cookies, URL, logs, and every request");
    if (stored.field) fail("input still holds a value", stored.field); else pass("year field is cleared");
    const offHost = (stored.net || []).filter(r => { try { return new URL(r.url, origin).hostname !== "127.0.0.1"; } catch (e) { return true; } });
    if (offHost.some(r => String(r.url).includes(YEAR) || String(r.body).includes(YEAR))) fail("off-host year", offHost); else pass("no off-host request carries the year");
    console.log(bad ? bad + " failures" : "age-gate.browser.js: all pass");
  } finally {
    chrome.kill("SIGKILL");
    srv.close();
  }
  process.exit(bad ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
