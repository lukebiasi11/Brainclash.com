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
    await fetch("http://127.0.0.1:" + port + "/json/close/" + created.id).catch(() => {});

    async function openSeed(source) {
      const createdRes2 = await fetch("http://127.0.0.1:" + port + "/json/new?" + encodeURIComponent("about:blank"), { method: "PUT" });
      const created2 = JSON.parse(await createdRes2.text());
      const page = new CDP(await wsOpen(created2.webSocketDebuggerUrl));
      await page.send("Page.enable");
      await page.send("Runtime.enable");
      await page.send("Network.enable");
      await page.send("Page.addScriptToEvaluateOnNewDocument", { source: source });
      await page.send("Page.navigate", { url: origin + "/index.html?lbshot=1" });
      const ok = await evalJson(page, `new Promise(resolve => { const start = Date.now(); const tick = () => { if (document.querySelector('.cta .btn.primary')) resolve(true); else if (Date.now()-start>8000) resolve(false); else setTimeout(tick, 40); }; tick(); })`);
      if (!ok) throw new Error("home did not render");
      return page;
    }
    const checkMock = `window.fetch = function(url, opts) {
      const body = opts && opts.body ? JSON.parse(opts.body) : {};
      window.__net = window.__net || [];
      window.__net.push({ url: String(url), method: (opts && opts.method) || "GET", body: opts && opts.body || "" });
      if (String(url).indexOf("/leaderboard/check") >= 0) {
        if (body.name === "Sol") return Promise.resolve({ ok: false, status: 400, async json() { return { ok: false, error: "name_rejected" }; } });
        return Promise.resolve({ ok: true, status: 200, async json() { return { ok: true, name: body.name }; } });
      }
      return Promise.resolve({ ok: true, status: 200, async json() { return { ok: true, served: true, rows: [] }; } });
    };`;
    const keysOf = `(() => { const keys = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf("bc-board") === 0) keys.push(k + "=" + localStorage.getItem(k)); } return keys.sort(); })()`;

    const under = await openSeed("localStorage.clear(); localStorage.setItem('bc-board-eligible','no');");
    const underInfo = await evalJson(under, `({ name: !!document.querySelector('[data-board-name]'), saved: !!document.querySelector('[data-board-saved]'), change: !!document.querySelector('[data-board-change]'), gate: !!document.querySelector('[data-board-gate]') })`);
    if (underInfo.name || underInfo.saved || underInfo.change || underInfo.gate) fail("under 13 name ui", underInfo); else pass("under 13 never sees a name or change control");

    const skip = await openSeed("localStorage.clear(); localStorage.setItem('bc-board-eligible','yes');");
    const skipState = await evalJson(skip, `(async () => { document.querySelector('.cta .btn.primary').click(); await new Promise(r => setTimeout(r, 200)); return { game: document.body.classList.contains('in-game'), keys: ${keysOf} }; })()`);
    if (!skipState.game || JSON.stringify(skipState.keys) !== JSON.stringify(["bc-board-eligible=yes"])) fail("skip stores only the flag", skipState); else pass("skip keeps today's behaviour and stores no name");

    const back = await openSeed("localStorage.clear(); localStorage.setItem('bc-board-eligible','yes'); localStorage.setItem('bc-board-name','Luna'); " + checkMock);
    const backInfo = await evalJson(back, `(async () => { const used = await window.DailyBoard.beforeStart({ started: false }); return { gate: !!document.querySelector('[data-board-gate]'), entry: !!document.querySelector('[data-board-name]'), saved: (document.querySelector('[data-board-current]')||{}).textContent || '', change: !!document.querySelector('[data-board-change]'), used, stored: localStorage.getItem('bc-board-name') }; })()`);
    if (backInfo.gate || backInfo.entry || backInfo.saved !== "Luna" || !backInfo.change || backInfo.used !== true || backInfo.stored !== "Luna") fail("returning player", backInfo); else pass("returning player skips the age gate and name entry");
    await evalJson(back, `(async () => { document.querySelector('[data-board-change]').click(); document.querySelector('[data-board-name-input]').value = 'Daily Dose'; document.querySelector('[data-board-save]').click(); await new Promise(r => setTimeout(r, 40)); })()`);
    const clientNo = await evalJson(back, `({ name: (document.querySelector('[data-board-current]')||{}).textContent, stored: localStorage.getItem('bc-board-name'), err: (document.querySelector('[data-board-error]')||{}).textContent || '', gate: !!document.querySelector('[data-board-gate]') })`);
    if (clientNo.name !== "Luna" || clientNo.stored !== "Luna" || !clientNo.err || clientNo.gate) fail("rejected change", clientNo); else pass("a blocked change keeps the old name");
    await evalJson(back, `(async () => { document.querySelector('[data-board-name-input]').value = 'Sol'; document.querySelector('[data-board-save]').click(); await new Promise(r => setTimeout(r, 40)); })()`);
    const serverNo = await evalJson(back, `({ name: (document.querySelector('[data-board-current]')||{}).textContent, stored: localStorage.getItem('bc-board-name') })`);
    if (serverNo.name !== "Luna" || serverNo.stored !== "Luna") fail("server rejected change", serverNo); else pass("a server rejection keeps the old name");
    await evalJson(back, `(async () => { document.querySelector('[data-board-name-input]').value = 'Nico'; document.querySelector('[data-board-save]').click(); await new Promise(r => setTimeout(r, 40)); })()`);
    const accepted = await evalJson(back, `({ name: (document.querySelector('[data-board-current]')||{}).textContent, stored: localStorage.getItem('bc-board-name'), gate: !!document.querySelector('[data-board-gate]'), keys: ${keysOf} })`);
    if (accepted.name !== "Nico" || accepted.stored !== "Nico" || accepted.gate || JSON.stringify(accepted.keys) !== JSON.stringify(["bc-board-eligible=yes", "bc-board-name=Nico"])) fail("accepted change", accepted); else pass("an accepted change replaces only the current name");

    console.log(bad ? bad + " failures" : "age-gate.browser.js: all pass");
  } finally {
    chrome.kill("SIGKILL");
    srv.close();
  }
  process.exit(bad ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
