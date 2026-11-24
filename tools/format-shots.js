// 390px screenshots of the format preview: 2-pin World, 5-event Time Warp, celebrity MVP.
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
    const type = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" }[ext] || "application/octet-stream";
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
async function pause(cdp, ms) { await ev(cdp, `new Promise(r => setTimeout(r, ${ms}))`); }

const read = `(() => {
  const text = (document.querySelector("#app") || document.body).innerText || "";
  const sub = (document.querySelector(".game-head .muted") || {}).textContent || "";
  const prompt = (document.querySelector(".prompt") || {}).textContent || "";
  const cards = document.querySelectorAll(".timeline .card").length;
  const clues = [...document.querySelectorAll(".ct-clues li")].map(li => ({
    text: li.textContent,
    clip: li.scrollWidth - li.clientWidth
  }));
  return { sub, prompt, cards, clues, text, undefined: text.includes("undefined"), sports: /\\bSports\\b|Deportes|team|equipo|athlete|deportista/i.test(text) };
})()`;

(async () => {
  const srv = await startServer();
  const origin = "http://127.0.0.1:" + srv.address().port;
  const userDir = fs.mkdtempSync(path.join("/tmp", "bc-formats-"));
  const chrome = spawn("google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--remote-debugging-port=9362", "--user-data-dir=" + userDir, "--no-first-run", "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
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
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  async function open(shot, lang) {
    await cdp.send("Page.navigate", { url: origin + "/index.html?preview=formats&shot=" + shot + "&lang=" + lang });
    await pause(cdp, 700);
    return ev(cdp, read);
  }
  async function shot(name) {
    const img = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(SHOTS, name), Buffer.from(img.data, "base64"));
  }
  try {
    for (const lang of ["en", "es"]) {
      const world = await open("world2", lang);
      const pin = lang === "es" ? "Pin 1 de 2 · hasta 500 pts" : "Pin 1 of 2 · up to 500 pts";
      const where = lang === "es" ? "¿Dónde está" : "Where is";
      if (world.sub !== pin || !world.prompt.includes(where) || !world.prompt.includes("Quito, Ecuador") || world.undefined || /Geography|geografía/i.test(world.text)) fail(lang + " world", world); else pass(lang + " world 2 pins");
      await shot("fmt25b-play-world-" + lang + "-390.png");

      const hist = await open("history5", lang);
      const theme = lang === "es" ? "Debut en pantalla · 5 eventos · hasta 1000 pts" : "Screen debuts · 5 events · up to 1000 pts";
      const card = lang === "es" ? "Una película muda abre un cine público" : "A silent film opens a public cinema";
      if (hist.sub !== theme || hist.cards !== 5 || !hist.text.includes(card) || hist.undefined || /Round 1 of 2|Ronda 1 de 2/.test(hist.text)) fail(lang + " history", hist); else pass(lang + " history 5 events");

      const mvp = await open("mvp", lang);
      const ask = lang === "es" ? "Nombra al actor a partir de estas pistas." : "Name the actor from these clues.";
      const line = lang === "es" ? "Nombre en los créditos: Alejandro Marin Castillo" : "Billing name: Alejandro Marin Castillo";
      const clipped = mvp.clues.filter(c => c.clip > 1);
      if (mvp.prompt !== ask || mvp.clues.length !== 4 || !mvp.text.includes(line) || mvp.undefined || mvp.sports || clipped.length) fail(lang + " mvp", { prompt: mvp.prompt, clues: mvp.clues, sports: mvp.sports, undefined: mvp.undefined }); else pass(lang + " mvp celebrity");

      const intros = {
        "intro-world": lang === "es" ? "2 pines en el mapa" : "2 map pins",
        "intro-history": lang === "es" ? "Una línea de tiempo de 5 eventos" : "One 5-event timeline",
        "intro-mvp": lang === "es" ? "Deportistas y famosos · actores, cantantes, artistas y reality" : "Athletes and celebrities · actors, singers, artists, reality TV"
      };
      for (const [name, want] of Object.entries(intros)) {
        const info = await open(name, lang);
        if (info.sub !== want) fail(lang + " " + name, info.sub); else pass(lang + " " + name);
        await shot("fmt25b-" + name + "-" + lang + "-390.png");
      }
    }
  } finally {
    chrome.kill();
    srv.close();
  }
  console.log(bad ? bad + " failures" : "format-shots.js: all pass");
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
