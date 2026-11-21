// Results page uses the same daily board as home. node tools/board-results.browser.js
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const ROOT = path.resolve(__dirname, "..");
let bad = 0;
const fail = (n, d) => { bad++; console.log("FAIL", n, d == null ? "" : JSON.stringify(d)); };
const pass = n => console.log("ok", n);
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

(async () => {
  const srv = await startServer();
  const origin = "http://127.0.0.1:" + srv.address().port;
  const userDir = fs.mkdtempSync(path.join("/tmp", "bc-board-results-"));
  const chrome = spawn("google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--remote-debugging-port=9266", "--user-data-dir=" + userDir, "--no-first-run", "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
  let chromeLog = "";
  chrome.stderr.on("data", d => { chromeLog += d.toString(); });
  const port = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("chrome\n" + chromeLog)), 20000);
    const watch = () => { const m = chromeLog.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/); if (m) { clearTimeout(t); resolve(+m[1]); } };
    chrome.stderr.on("data", watch); watch();
  });
  async function open(url, seed) {
    const createdRes = await fetch("http://127.0.0.1:" + port + "/json/new?" + encodeURIComponent("about:blank"), { method: "PUT" });
    const created = JSON.parse(await createdRes.text());
    const cdp = new CDP(await wsOpen(created.webSocketDebuggerUrl));
    cdp.id = created.id;
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    if (seed) await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: seed });
    await cdp.send("Page.navigate", { url: origin + url });
    return cdp;
  }
  try {
    const probe = await open("/index.html?lbshot=1", "");
    const today = await evalJson(probe, `new Promise(resolve => { const start = Date.now(); const tick = () => { if (window.BCDaily) resolve(BCDaily.todayKey()); else if (Date.now()-start>8000) resolve(""); else setTimeout(tick, 40); }; tick(); })`);
    await fetch("http://127.0.0.1:" + port + "/json/close/" + probe.id).catch(() => {});
    const saved = JSON.stringify({ key: today, practice: false, counted: true, scores: [700, 680, 660, 640, 680], details: [] });
    const rows = [{ rank: 1, name: "Luna", score: 4000, token: "other" }, { rank: 2, name: "Luna", score: 4000, token: "own-row" }];
    const fixture = JSON.stringify({ overall: { served: true, rows: rows }, world: { served: true, rows: rows } });
    const base = "localStorage.clear(); localStorage.setItem('dg-" + today + "'," + JSON.stringify(saved) + "); window.LEADERBOARD_FIXTURE = " + fixture + ";";
    async function results(extra) {
      const cdp = await open("/index.html?lbshot=1", base + extra);
      const ok = await evalJson(cdp, `new Promise(resolve => { const start = Date.now(); const tick = () => { const b = document.querySelector('[data-action=view-results]'); if (b) { b.click(); resolve(true); } else if (Date.now()-start>8000) resolve(false); else setTimeout(tick, 40); }; tick(); })`);
      if (!ok) throw new Error("no results button");
      return cdp;
    }
    const named = await results("localStorage.setItem('bc-board-eligible','yes'); localStorage.setItem('bc-board-name','Luna'); localStorage.setItem('bc-board-entry'," + JSON.stringify(JSON.stringify({ day: today, token: "own-row" })) + ");");
    const namedInfo = await evalJson(named, `new Promise(resolve => { const start = Date.now(); const tick = () => {
      const g1 = document.getElementById('results-g1');
      const board = document.querySelector('#app [data-day-board]');
      const stats = document.querySelector('.my-stats');
      if (g1 && board && stats) resolve({ note: (board.querySelector('.board-note') || {}).textContent || '', report: !!board.querySelector('a[href^=\"mailto:\"]'), yous: board.querySelectorAll('.board-row.you').length, rank: (document.querySelector('[data-board-rank]') || {}).textContent || '', see: !!document.querySelector('[data-see-board]'), order: !!(g1.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING) && !!(board.compareDocumentPosition(stats) & Node.DOCUMENT_POSITION_FOLLOWING), off: board.hasAttribute('data-board-off') });
      else if (Date.now()-start>8000) resolve({ missing: true }); else setTimeout(tick, 40);
    }; tick(); })`);
    if (!namedInfo.order || namedInfo.note.indexOf("Rankings are for fun") < 0 || !namedInfo.report || namedInfo.yous !== 1 || namedInfo.see || namedInfo.off || namedInfo.rank.indexOf("Rank #2 of 2 today") < 0) fail("results board with a name", namedInfo); else pass("results board highlights only the saved entry");
    await fetch("http://127.0.0.1:" + port + "/json/close/" + named.id).catch(() => {});

    const anon = await results("localStorage.setItem('bc-board-eligible','yes');");
    const anonInfo = await evalJson(anon, `new Promise(resolve => { const start = Date.now(); const tick = () => { const board = document.querySelector('#app [data-day-board]'); if (board && board.querySelectorAll('.board-row').length) resolve({ yous: board.querySelectorAll('.board-row.you').length, rankHidden: !document.querySelector('[data-board-rank]') || document.querySelector('[data-board-rank]').hidden, foot: !!document.querySelector('[data-results-nick]') }); else if (Date.now()-start>8000) resolve({ missing: true }); else setTimeout(tick, 40); }; tick(); })`);
    if (anonInfo.yous !== 0 || !anonInfo.rankHidden || !anonInfo.foot) fail("results board with no name", anonInfo); else pass("no name shows the board without a highlight or rank");
    await fetch("http://127.0.0.1:" + port + "/json/close/" + anon.id).catch(() => {});

    const off = await open("/index.html", "localStorage.clear(); const orig = window.fetch; window.fetch = function(url, opts) { if (String(url).indexOf('/leaderboard/board') >= 0) return Promise.resolve({ ok: false, status: 503, async json() { return { ok: false, error: 'board_off' }; } }); return orig.apply(this, arguments); };");
    const offInfo = await evalJson(off, `new Promise(resolve => { const start = Date.now(); const tick = () => { const board = document.querySelector('[data-day-board]'); if (board && board.getAttribute('data-board-off') === '1') resolve({ hidden: board.hidden }); else if (Date.now()-start>8000) resolve({ board: !!board, off: board && board.getAttribute('data-board-off') }); else setTimeout(tick, 40); }; tick(); })`);
    if (!offInfo.hidden) fail("board off hides the section", offInfo); else pass("board off hides the section");
    await fetch("http://127.0.0.1:" + port + "/json/close/" + off.id).catch(() => {});
  } finally {
    chrome.kill("SIGKILL");
    srv.close();
  }
  console.log(bad ? bad + " failures" : "board-results.browser.js: all pass");
  process.exit(bad ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
