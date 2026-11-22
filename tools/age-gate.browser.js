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
    const ready = await evalJson(cdp, `new Promise(resolve => { const start = Date.now(); const tick = () => { const b = document.querySelector('.cta .btn.primary'); if (b && !document.getElementById('board-year')) b.click(); if (document.getElementById('board-year') && document.querySelector('[role=dialog]')) resolve(true); else if (Date.now()-start>8000) resolve(false); else setTimeout(tick, 40); }; tick(); })`);
    if (!ready) throw new Error("age gate did not render");
    const shape = await evalJson(cdp, `(() => { const gate = document.querySelector('[role=dialog]'); const input = document.getElementById('board-year'); return { tag: gate.tagName, role: gate.getAttribute('role'), modal: gate.getAttribute('aria-modal'), labelled: !!document.getElementById(gate.getAttribute('aria-labelledby')), form: !!(input.closest && input.closest('form')), type: input.type, mode: input.getAttribute('inputmode'), auto: input.getAttribute('autocomplete'), readOnly: input.readOnly, homeCard: !!document.querySelector('.cta [data-board-gate]') }; })()`);
    if (shape.tag !== "DIV" || shape.role !== "dialog" || shape.modal !== "true" || !shape.labelled || shape.form || shape.type !== "text" || shape.mode !== "numeric" || shape.auto !== "off" || shape.homeCard) fail("year control", shape); else pass("year control is a numeric text field outside a form");
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

    async function openSeed(source, search) {
      const createdRes2 = await fetch("http://127.0.0.1:" + port + "/json/new?" + encodeURIComponent("about:blank"), { method: "PUT" });
      const created2 = JSON.parse(await createdRes2.text());
      const page = new CDP(await wsOpen(created2.webSocketDebuggerUrl));
      await page.send("Page.enable");
      await page.send("Runtime.enable");
      await page.send("Network.enable");
      await page.send("Page.addScriptToEvaluateOnNewDocument", { source: source });
      await page.send("Page.navigate", { url: origin + "/index.html?lbshot=1" + (search || "") });
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
    const underInfo = await evalJson(under, `(() => { const note = document.querySelector('[data-board-under]'); const start = document.querySelector('.cta .btn.primary'); const text = note ? note.textContent : ''; return { name: !!document.querySelector('[data-board-name]'), saved: !!document.querySelector('[data-board-saved]'), change: !!document.querySelector('[data-board-change]'), gate: !!document.querySelector('[data-board-gate]'), text, underStart: !!(note && start && start.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING), mentionsAge: /13|\\bage\\b|edad|años/i.test(text) }; })()`);
    if (underInfo.name || underInfo.saved || underInfo.change || underInfo.gate || underInfo.text !== "Leaderboard names aren't available on this device. You can still play!" || !underInfo.underStart || underInfo.mentionsAge) fail("under 13 name ui", underInfo); else pass("under 13 never sees a name or change control");

    const skip = await openSeed("localStorage.clear(); localStorage.setItem('bc-board-eligible','yes');");
    const waiting = await evalJson(skip, `(async () => { document.querySelector('.cta .btn.primary').click(); await new Promise(r => setTimeout(r, 80)); return { game: document.body.classList.contains('in-game'), timer: !!document.querySelector('.timer'), dialog: !!document.querySelector('[role=dialog][data-board-name]') }; })()`);
    if (waiting.game || waiting.timer || !waiting.dialog) fail("timer waits for the modal", waiting); else pass("timer does not start while the name modal is open");
    await evalJson(skip, `document.querySelector('[data-board-skip]').click()`);
    const skipState = await evalJson(skip, `new Promise(resolve => { const start = Date.now(); const tick = () => { const keys = ${keysOf}; if (document.body.classList.contains('in-game')) resolve({ game: true, keys }); else if (Date.now()-start>4000) resolve({ game: false, keys }); else setTimeout(tick, 40); }; tick(); })`);
    if (!skipState.game || skipState.keys.indexOf("bc-board-name-skip=1") < 0 || skipState.keys.indexOf("bc-board-name=") >= 0) fail("play without a name is remembered", skipState); else pass("play without a name is remembered");
    const again = await openSeed("localStorage.clear(); localStorage.setItem('bc-board-eligible','yes'); localStorage.setItem('bc-board-name-skip','1');");
    const againInfo = await evalJson(again, `({ add: (document.querySelector('[data-board-add]')||{}).textContent || '', dialog: !!document.querySelector('[role=dialog]'), gate: !!document.querySelector('.cta [data-board-gate]') })`);
    if (againInfo.add !== "Add a name" || againInfo.dialog || againInfo.gate) fail("skip is not asked again", againInfo); else pass("a skipped name is not asked again");

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
    if (accepted.name !== "Nico" || accepted.stored !== "Nico" || accepted.gate || accepted.keys.indexOf("bc-board-name=Nico") < 0 || accepted.keys.indexOf("bc-board-name-skip=") >= 0) fail("accepted change", accepted); else pass("an accepted change replaces only the current name");

    const trap = await openSeed("localStorage.clear();");
    const trapInfo = await evalJson(trap, `(async () => {
      document.querySelector('.cta .btn.primary').click();
      await new Promise(r => setTimeout(r, 60));
      const dialog = document.querySelector('[role=dialog]');
      const list = [...dialog.querySelectorAll('button, input')].filter(el => !el.disabled);
      list[list.length - 1].focus();
      const last = document.activeElement;
      last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      const wrapped = document.activeElement === list[0];
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise(r => setTimeout(r, 80));
      return { inside: dialog.contains(last), wrapped, role: dialog.getAttribute('role'), game: document.body.classList.contains('in-game'), flag: localStorage.getItem('bc-board-eligible'), skip: localStorage.getItem('bc-board-name-skip'), dialogGone: !document.querySelector('[role=dialog]') };
    })()`);
    if (!trapInfo.inside || !trapInfo.wrapped || trapInfo.role !== "dialog" || !trapInfo.game || trapInfo.flag || trapInfo.skip || !trapInfo.dialogGone) fail("focus trap and age dismiss", trapInfo); else pass("focus stays in the dialog and age dismiss stores nothing");

    const practice = await openSeed("localStorage.clear();");
    const practiceInfo = await evalJson(practice, `(async () => { document.querySelector('.btn.ghost').click(); await new Promise(r => setTimeout(r, 80)); return { dialog: !!document.querySelector('[role=dialog]'), game: document.body.classList.contains('in-game') }; })()`);
    if (practiceInfo.dialog || !practiceInfo.game) fail("practice bypass", practiceInfo); else pass("practice never shows the modal");

    const kid = await openSeed("localStorage.clear(); localStorage.setItem('bc-board-eligible','no'); localStorage.setItem('sb-field-auth','{\"access_token\":\"secret-user\"}'); localStorage.setItem('sb-board-auth','{\"access_token\":\"secret-user\"}'); localStorage.setItem('dg-2020-01-01','{\"key\":\"2020-01-01\",\"practice\":false,\"scores\":[1,2,3,4,5],\"details\":[]}'); window.__net=[]; const orig = window.fetch; window.fetch = function(u){ window.__net.push(String(u)); return Promise.resolve({ ok: true, status: 200, text: function(){ return Promise.resolve('{}'); }, json: function(){ return Promise.resolve({}); } }); };");
    const kidInfo = await evalJson(kid, `(async () => {
      const before = localStorage.getItem('dg-2020-01-01');
      document.querySelector('.cta .btn.primary').click();
      await new Promise(r => setTimeout(r, 50));
      const day = window.BCDaily.todayKey();
      try { await window.FieldCompare.onFinish({ key: day, practice: false, scores: [1,1,1,1,1] }); } catch (e) {}
      try { window.DailyBoard.noteFinish({ key: day, practice: false, scores: [1,1,1,1,1] }); } catch (e) {}
      await new Promise(r => setTimeout(r, 40));
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
      return { before: !!before, after: localStorage.getItem('dg-2020-01-01') === before, session: keys.filter(k => k && k.indexOf('sb-') === 0), net: window.__net || [], game: document.body.classList.contains('in-game') };
    })()`);
    const badNet = (kidInfo.net || []).filter(url => /field-compare|leaderboard\/post|signIn|grant_type|secret-user/.test(url));
    if (!kidInfo.before || !kidInfo.after || kidInfo.session.length || badNet.length || !kidInfo.game) fail("under 13 sends no id", { kidInfo, badNet }); else pass("under 13 sends no id and keeps local results");

    const blockedName = await openSeed("localStorage.clear(); localStorage.setItem('bc-board-eligible','yes');");
    const blockedInfo = await evalJson(blockedName, `(async () => { document.querySelector('.cta .btn.primary').click(); await new Promise(r => setTimeout(r, 40)); const input = document.querySelector('[role=dialog] [data-board-name-input]'); input.value = 'admin'; document.querySelector('[role=dialog] [data-board-save]').click(); await new Promise(r => setTimeout(r, 40)); const err = document.querySelector('[role=dialog] [data-board-error]'); return { text: err ? err.textContent : '', hidden: !err || err.hidden, game: document.body.classList.contains('in-game') }; })()`);
    if (!blockedInfo.text || blockedInfo.hidden || blockedInfo.game) fail("blocked name stays in the modal", blockedInfo); else pass("blocked name stays in the modal");

    console.log(bad ? bad + " failures" : "age-gate.browser.js: all pass");
  } finally {
    chrome.kill("SIGKILL");
    srv.close();
  }
  process.exit(bad ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
