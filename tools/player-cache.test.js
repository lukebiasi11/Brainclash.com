// Returning client: old app.js?v=g2local1 and content*.js?v=nov3k stay cached.
// New HTML must request app, answers, and i18n at v=nov12, and English and Spanish content at v=nov8player.
// Spanish content is a static index.html script, not a dynamic loader. Admin has no Spanish file.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn, execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const APP_V = "nov12";
const CONTENT_V = "nov8player";
const ANSWERS_V = "nov12";
const V = CONTENT_V;
let bad = 0;
const fail = (name, detail) => { bad++; console.log("FAIL", name, detail == null ? "" : typeof detail === "string" ? detail : JSON.stringify(detail)); };
const pass = name => console.log("ok", name);

function srcs(file) {
  return [...fs.readFileSync(path.join(ROOT, file), "utf8").matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]);
}
function has(list, s) { return list.includes(s); }

const indexSrc = srcs("index.html");
const adminSrc = srcs("admin.html");
const appSrc = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
[["index app", indexSrc, "app.js?v=" + APP_V], ["index content", indexSrc, "content.js?v=" + CONTENT_V], ["index es", indexSrc, "content.es.js?v=" + CONTENT_V], ["index answers", indexSrc, "answers.js?v=" + ANSWERS_V],
 ["admin app", adminSrc, "app.js?v=" + APP_V], ["admin content", adminSrc, "content.js?v=" + CONTENT_V], ["admin answers", adminSrc, "answers.js?v=" + ANSWERS_V]].forEach(([n, list, s]) => {
  if (!has(list, s)) fail(n, s); else pass(n);
});
[["index old app", indexSrc, "app.js?v=g2local1"], ["index old content", indexSrc, "content.js?v=nov3k"], ["index old es", indexSrc, "content.es.js?v=nov3k"],
 ["admin old app", adminSrc, "app.js?v=g2local1"], ["admin old content", adminSrc, "content.js?v=nov3k"]].forEach(([n, list, s]) => {
  if (has(list, s)) fail(n + " still present", s); else pass(n + " gone");
});
if (adminSrc.some(s => s.includes("content.es.js"))) fail("admin loads Spanish content"); else pass("admin has no Spanish content loader");
if (/content\.es\.js|import\(/.test(appSrc)) fail("app.js loads Spanish content dynamically"); else pass("Spanish content is only the index.html script");
[["style", "style.css?v=nov12"], ["i18n", "i18n.js?v=nov12"], ["graph", "graph-history.js?v=g2local1"], ["map", "map.js?v=nov3k"], ["field", "field-compare.js?v=g1hist1"], ["field-config", "field-config.js?v=g1live1"]].forEach(([n, s]) => {
  if (!has(indexSrc, s)) fail("kept " + n, s); else pass("kept " + n);
});
if (!has(adminSrc, "feedback.js?v=nov3k") || !has(adminSrc, "map.js?v=nov3k")) fail("admin kept unrelated keys"); else pass("admin kept unrelated keys");

const OLD = {};
for (const f of ["app.js", "content.js", "content.es.js", "answers.js"]) OLD[f] = execFileSync("git", ["show", "origin/main:" + f]);

function oldBody(file, version) {
  if (file === "app.js" && version === "g2local1") return OLD["app.js"];
  if ((file === "content.js" || file === "content.es.js" || file === "answers.js") && version === "nov3k") return OLD[file];
  return null;
}
const served = [];
function startServer() {
  const srv = http.createServer((req, res) => {
    const raw = req.url || "/";
    const q = raw.split("?")[1] || "";
    const version = (q.match(/(?:^|&)v=([^&]+)/) || [])[1] || "";
    const rel = decodeURIComponent(raw.split("?")[0]);
    if (rel === "/old-cache.html") {
      const html = `<!doctype html><html><body><main id="app"></main>
<script>window.BC_NO_BOOT=true;</script>
<script src="content.js?v=nov3k"></script>
<script src="content.es.js?v=nov3k"></script>
<script src="answers.js?v=nov3k"></script>
<script src="i18n.js?v=g2local1"></script>
<script src="app.js?v=g2local1"></script></body></html>`;
      served.push({ url: raw, tag: "old-html" });
      res.writeHead(200, { "Content-Type": "text/html;charset=utf-8", "Cache-Control": "no-store" });
      return res.end(html);
    }
    const file = rel.replace(/^\/+/, "");
    const cached = oldBody(file, version);
    const fp = path.normalize(path.join(ROOT, file));
    if (!cached && (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory())) { res.writeHead(404); return res.end("missing"); }
    const body = cached || fs.readFileSync(fp);
    served.push({ url: raw.split("?")[0] + (version ? "?v=" + version : ""), tag: cached ? "old" : "new" });
    const ext = path.extname(file);
    const type = { ".html": "text/html;charset=utf-8", ".js": "text/javascript;charset=utf-8", ".css": "text/css;charset=utf-8" }[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": cached ? "public, max-age=86400" : "public, max-age=600" });
    res.end(body);
  });
  return new Promise(resolve => srv.listen(0, "127.0.0.1", () => resolve(srv)));
}

class CDP {
  constructor(ws) {
    this.ws = ws; this.nextId = 0; this.pending = new Map(); this.reqs = [];
    ws.addEventListener("message", ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id); this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message || JSON.stringify(msg.error))); else p.resolve(msg.result || {});
      } else if (msg.method === "Network.requestWillBeSent") this.reqs.push(msg.params.request.url);
    });
  }
  send(method, params = {}, ms = 15000) {
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
const judge = `(() => {
  const q = BCDaily.getDailySet("2026-11-08").sports[1];
  const opts = { aliases: q.aliases, wrong: q.wrong, noSurname: q.noSurname, textOnly: q.textOnly, person: q.person, given: q.given, q: q.q };
  const hit = s => Answers.checkAnswer(s, q.answers, opts);
  return { given: q.given || null, wrong: q.wrong, brett: hit("Brett"), bret: hit("Bret"), brent: hit("brent"), favre: hit("Favre"), prompt: q.q.slice(0, 24) };
})()`;
const storeDump = `(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith("dg-")) o[k] = localStorage.getItem(k); } return o; })()`;

(async () => {
  const srv = await startServer();
  const origin = "http://127.0.0.1:" + srv.address().port;
  const userDir = fs.mkdtempSync(path.join("/tmp", "bc-player-cache-"));
  const chrome = spawn("google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--remote-debugging-port=9336", "--user-data-dir=" + userDir, "--no-first-run", "--disable-background-networking", "--disable-sync", "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
  let chromeLog = "";
  chrome.stderr.on("data", d => { chromeLog += d; });
  chrome.stdout.on("data", d => { chromeLog += d; });
  const port = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("chrome did not listen\n" + chromeLog)), 20000);
    const watch = () => { const m = chromeLog.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/); if (m) { clearTimeout(t); resolve(+m[1]); } };
    chrome.stderr.on("data", watch); chrome.stdout.on("data", watch); watch();
  });
  const createdRes = await fetch("http://127.0.0.1:" + port + "/json/new?" + encodeURIComponent("about:blank"), { method: "PUT" });
  const created = JSON.parse(await createdRes.text());
  const cdp = new CDP(await wsOpen(created.webSocketDebuggerUrl));
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  const saved = JSON.stringify({ key: "2026-11-06", practice: false, scores: [250, 350, 400, 600, 800], details: ["saved", "saved", "saved", "saved", "saved"], marker: "saved-result" });
  const stats = JSON.stringify({ played: 4, best: 2400, streak: 2, last: "2026-11-06", marker: "saved-result" });
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `localStorage.setItem("dg-2026-11-06", ${JSON.stringify(saved)}); localStorage.setItem("dg-stats", ${JSON.stringify(stats)});` });

  async function go(url, ready) {
    const from = cdp.reqs.length;
    await cdp.send("Page.navigate", { url: origin + url });
    const ok = await evalJson(cdp, ready);
    if (!ok) throw new Error("not ready " + url);
    return cdp.reqs.slice(from);
  }
  try {
    await go("/old-cache.html", `new Promise(r => { const t = Date.now(); const tick = () => window.BCDaily && window.Answers ? r(true) : Date.now() - t > 8000 ? r(false) : setTimeout(tick, 40); tick(); })`);
    const oldJudge = await evalJson(cdp, judge);
    if (JSON.stringify(oldJudge.given) !== JSON.stringify(["brett", "bret"]) || oldJudge.brett !== true || oldJudge.bret !== true || oldJudge.brent !== false || oldJudge.favre !== true) fail("old cached stack", oldJudge); else pass("old cached stack accepts Brett and Bret");
    const oldStore = await evalJson(cdp, storeDump);

    const enReqs = await go("/index.html", `new Promise(r => { const t = Date.now(); const tick = () => document.querySelector("#app") && document.querySelector("#app").children.length && window.BCDaily ? r(true) : Date.now() - t > 8000 ? r(false) : setTimeout(tick, 40); tick(); })`);
    const enFiles = enReqs.map(u => u.replace(origin, "")).filter(u => /\/(app|content|content\.es|answers)\.js/.test(u));
    const want = ["/app.js?v=" + APP_V, "/content.js?v=" + CONTENT_V, "/content.es.js?v=" + CONTENT_V, "/answers.js?v=" + ANSWERS_V];
    if (want.every(s => enFiles.includes(s)) && !enFiles.some(s => s.includes("v=g2local1") || s.includes("content.js?v=nov3k") || s.includes("content.es.js?v=nov3k") || s.includes("answers.js?v=nov3k"))) pass("new HTML reloads app, content, Spanish content, answers");
    else fail("new HTML requests", enFiles);
    const enJudge = await evalJson(cdp, judge);
    if (JSON.stringify(enJudge.given) === JSON.stringify(["brett", "bret"]) && enJudge.brett === true && enJudge.bret === true && enJudge.brent === false && enJudge.favre === true) pass("EN Brett and Bret accepted");
    else fail("EN judge", enJudge);
    const enStore = await evalJson(cdp, storeDump);
    if (enStore["dg-2026-11-06"] === oldStore["dg-2026-11-06"] && enStore["dg-stats"] === oldStore["dg-stats"]) pass("EN saved results untouched");
    else fail("EN storage", { before: oldStore, after: enStore });

    const esReqs = await go("/index.html?lang=es", `new Promise(r => { const t = Date.now(); const tick = () => document.querySelector("#app") && document.querySelector("#app").children.length && window.BCDaily ? r(true) : Date.now() - t > 8000 ? r(false) : setTimeout(tick, 40); tick(); })`);
    const esFiles = esReqs.map(u => u.replace(origin, "")).filter(u => /\/(app|content|content\.es|answers)\.js/.test(u));
    if (esFiles.some(s => s.includes("v=g2local1") || s.includes("v=nov3k"))) fail("ES navigation reused an old cache key", esFiles); else pass("ES navigation does not reuse the old cache keys");
    const esJudge = await evalJson(cdp, judge);
    if (esJudge.brett === true && esJudge.bret === true && esJudge.brent === false && /mariscal|N\.º 4/.test(esJudge.prompt)) pass("ES Brett and Bret accepted");
    else fail("ES judge", esJudge);
    const esStore = await evalJson(cdp, storeDump);
    if (esStore["dg-2026-11-06"] === oldStore["dg-2026-11-06"] && esStore["dg-stats"] === oldStore["dg-stats"]) pass("ES saved results untouched");
    else fail("ES storage", { before: oldStore, after: esStore });

    const tags = served.filter(s => /\/(app|content|content\.es|answers)\.js/.test(s.url));
    const oldHits = tags.filter(s => s.tag === "old").map(s => s.url);
    const newHits = tags.filter(s => s.tag === "new").map(s => s.url);
    if (oldHits.some(u => u.includes("v=g2local1") || u.includes("v=nov3k")) && newHits.some(u => u.includes("app.js?v=" + APP_V)) && newHits.some(u => u.includes("content.es.js?v=" + CONTENT_V))) pass("server served old bytes only for the old cache keys");
    else fail("serve tags", { oldHits, newHits });
  } finally {
    chrome.kill("SIGKILL");
    srv.close();
  }
  console.log(bad ? bad + " failures" : "player-cache.test.js: all pass");
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
