// Plays the practice slot demo: World Rush pair third question, Time Warp pair then reveal,
// Time Warp multiple choice then typed, and order/match hints in English and Spanish.
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
async function waitFor(cdp, expr, ms = 8000) {
  const ok = await ev(cdp, `new Promise(r => { const t = Date.now(); const tick = () => { let hit = false; try { hit = !!(${expr}); } catch (e) {} if (hit) return r(true); if (Date.now() - t > ${ms}) return r(false); setTimeout(tick, 40); }; tick(); })`);
  return ok;
}
async function clickRe(cdp, re) {
  return ev(cdp, `(() => { const b = [...document.querySelectorAll("button")].find(el => ${re}.test((el.textContent || "").replace(/\\s+/g, " ").trim())); if (!b || b.disabled) return false; b.click(); return true; })()`);
}
const stateExpr = `(() => {
  const nodes = [...document.querySelectorAll(".pair-card, .nudge, .btn, .txt, .opt")];
  const small = nodes.filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44); }).map(n => n.className + " " + Math.round(n.getBoundingClientRect().width) + "x" + Math.round(n.getBoundingClientRect().height));
  return {
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    title: (document.querySelector(".game-head h2") || {}).textContent || "",
    sub: (document.querySelector(".game-head .muted") || {}).textContent || "",
    prompt: (document.querySelector(".prompt") || {}).textContent || "",
    hint: (document.querySelector(".drag-hint") || {}).textContent || "",
    aria: (document.querySelector(".order-list") || {}).getAttribute ? (document.querySelector(".order-list").getAttribute("aria-label") || "") : "",
    note: (document.querySelector(".pair-note") || {}).textContent || "",
    fb: (document.querySelector(".fb") || {}).textContent || "",
    clues: document.querySelectorAll(".reveal-clue").length,
    cards: document.querySelectorAll(".pair-card").length,
    saved: Object.keys(localStorage).filter(k => k === "dg-stats" || /^dg-\\d{4}-/.test(k)),
    small
  };
})()`;

(async () => {
  const srv = await startServer();
  const origin = "http://127.0.0.1:" + srv.address().port;
  const userDir = fs.mkdtempSync(path.join("/tmp", "bc-slots-"));
  const chrome = spawn("google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--remote-debugging-port=9352", "--user-data-dir=" + userDir, "--no-first-run", "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
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
  async function open(url) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await cdp.send("Page.navigate", { url: origin + url });
    await pause(cdp, 400);
  }
  async function shot(name) {
    const img = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(SHOTS, name), Buffer.from(img.data, "base64"));
  }
  async function playPair(which) {
    const rounds = await ev(cdp, `window.SLOT_DEMO.${which}.rounds.length`);
    for (let i = 0; i < rounds; i++) {
      const clicked = await ev(cdp, `(() => { const side = window.SLOT_DEMO.${which}.rounds[${i}].correct; const b = document.querySelector('.pair-card[data-side="' + side + '"]'); if (!b) return false; b.click(); return true; })()`);
      if (!clicked) return false;
      await pause(cdp, 80);
      const advanced = await clickRe(cdp, "/next round|see score|siguiente ronda|ver puntaje/i");
      if (!advanced) return false;
      await pause(cdp, 120);
    }
    return true;
  }
  try {
    for (const lang of ["en", "es"]) {
      await open("/index.html?preview=slots&shot=world&lang=" + lang);
      if (!await waitFor(cdp, `document.querySelector(".btn.primary") && !document.querySelector(".btn.primary").disabled`)) throw new Error("pin button " + lang);
      if (!await clickRe(cdp, "/lock in pin|confirmar pin/i")) throw new Error("pin 1 " + lang);
      await pause(cdp, 400);
      if (!await clickRe(cdp, "/next pin|siguiente pin/i")) throw new Error("next pin " + lang);
      await pause(cdp, 300);
      if (!await waitFor(cdp, `document.querySelector(".btn.primary") && /lock in pin|confirmar pin/i.test(document.querySelector(".btn.primary").textContent || "")`)) throw new Error("pin 2 button " + lang);
      if (!await clickRe(cdp, "/lock in pin|confirmar pin/i")) throw new Error("pin 2 " + lang);
      await pause(cdp, 400);
      if (!await clickRe(cdp, "/geography q|pregunta de geograf/i")) throw new Error("to pair " + lang);
      if (!await waitFor(cdp, `document.querySelector(".pair-card")`)) throw new Error("world pair " + lang);
      await pause(cdp, 1000);
      const wq = await ev(cdp, stateExpr);
      const worldOk = wq.cards === 2 && wq.overflow <= 1 && !wq.small.length && /larger by area/i.test(wq.prompt) && (lang === "en" ? /geography question/i.test(wq.sub) : /pregunta de geograf/i.test(wq.sub));
      if (!worldOk) fail(lang + " world pair question", wq); else pass(lang + " world pair question");
      await shot("slot-world-" + lang + "-question.png");
      if (!await playPair("world.pair")) throw new Error("play world pair " + lang);
      if (!await waitFor(cdp, `document.querySelector(".fb")`)) throw new Error("world score " + lang);
      const wa = await ev(cdp, stateExpr);
      const worldAnswered = wa.overflow <= 1 && /\+100/.test(wa.fb) && (lang === "en" ? /5 of 5 rounds/.test(wa.fb) : /5 de 5 rondas/.test(wa.fb)) && wa.saved.length === 0;
      if (!worldAnswered) fail(lang + " world pair answered", wa); else pass(lang + " world pair answered");
      await pause(cdp, 1100);
      await shot("slot-world-" + lang + "-answered.png");

      await open("/index.html?preview=slots&shot=warp&lang=" + lang);
      if (!await waitFor(cdp, `document.querySelector(".pair-card")`)) throw new Error("warp pair " + lang);
      const tq = await ev(cdp, stateExpr);
      const warpOk = tq.cards === 2 && tq.overflow <= 1 && !tq.small.length && /which came first/i.test(tq.prompt) && (lang === "en" ? /time warp/i.test(tq.title) : /máquina del tiempo/i.test(tq.title));
      if (!warpOk) fail(lang + " warp pair question", tq); else pass(lang + " warp pair question");
      await shot("slot-warp-" + lang + "-question.png");
      if (!await playPair("history.r1")) throw new Error("play warp pair " + lang);
      if (!await waitFor(cdp, `document.querySelector(".fb")`)) throw new Error("warp pair score " + lang);
      const ta = await ev(cdp, stateExpr);
      const warpAnswered = ta.overflow <= 1 && /\+400/.test(ta.fb) && (lang === "en" ? /5 of 5 rounds/.test(ta.fb) : /5 de 5 rondas/.test(ta.fb));
      if (!warpAnswered) fail(lang + " warp pair answered", ta); else pass(lang + " warp pair answered");
      await pause(cdp, 1100);
      await shot("slot-warp-" + lang + "-answered.png");
      await pause(cdp, 400);
      if (!await clickRe(cdp, "/round 2|ronda 2/i")) throw new Error("round 2 " + lang);
      if (!await waitFor(cdp, `document.querySelector(".reveal-clue")`)) throw new Error("reveal " + lang);
      const rq = await ev(cdp, stateExpr);
      if (rq.clues < 1 || rq.overflow > 1 || !/who is this/i.test(rq.prompt)) fail(lang + " warp reveal question", rq); else pass(lang + " warp reveal question");
      await shot("slot-warp-reveal-" + lang + "-question.png");
      await ev(cdp, `(() => { const i = document.querySelector(".txt"); i.value = "Serena Williams"; i.dispatchEvent(new Event("input")); document.querySelector("form.answer").requestSubmit(); return true; })()`);
      if (!await waitFor(cdp, `document.querySelector(".fb")`)) throw new Error("reveal score " + lang);
      const ra = await ev(cdp, stateExpr);
      const revealAnswered = ra.overflow <= 1 && /\+600/.test(ra.fb) && (lang === "en" ? /clue 1/i.test(ra.fb) : /pista 1/i.test(ra.fb)) && ra.saved.length === 0;
      if (!revealAnswered) fail(lang + " warp reveal answered", ra); else pass(lang + " warp reveal answered");
      await pause(cdp, 1100);
      await shot("slot-warp-reveal-" + lang + "-answered.png");

      await open("/index.html?preview=slots&shot=mc&lang=" + lang);
      if (!await waitFor(cdp, `document.querySelector(".opt")`)) throw new Error("mc " + lang);
      if (!await clickRe(cdp, "/^model t$/i")) throw new Error("mc choice " + lang);
      if (!await waitFor(cdp, `document.querySelector(".fb")`)) throw new Error("mc score " + lang);
      const mc = await ev(cdp, stateExpr);
      if (!/\+400/.test(mc.fb) || mc.saved.length) fail(lang + " warp mc", mc); else pass(lang + " warp mc");
      await pause(cdp, 400);
      if (!await clickRe(cdp, "/round 2|ronda 2/i")) throw new Error("typed round " + lang);
      if (!await waitFor(cdp, `document.querySelector("form.answer")`)) throw new Error("typed form " + lang);
      await ev(cdp, `(() => { const i = document.querySelector(".txt"); i.value = "bell"; i.dispatchEvent(new Event("input")); document.querySelector("form.answer").requestSubmit(); return true; })()`);
      if (!await waitFor(cdp, `document.querySelector(".fb")`)) throw new Error("typed score " + lang);
      const typed = await ev(cdp, stateExpr);
      if (!/\+600/.test(typed.fb)) fail(lang + " warp typed", typed); else pass(lang + " warp typed");

      await open("/index.html?preview=slots&shot=order&lang=" + lang);
      if (!await waitFor(cdp, `document.querySelector(".drag-hint")`)) throw new Error("order " + lang);
      const order = await ev(cdp, stateExpr);
      const orderOk = lang === "en" ? /first team at the top/.test(order.hint) && /career order/.test(order.aria) : /primer equipo/.test(order.hint);
      if (!orderOk) fail(lang + " order default hint", order); else pass(lang + " order default hint");
      await open("/index.html?preview=slots&shot=orderhint&lang=" + lang);
      if (!await waitFor(cdp, `document.querySelector(".drag-hint")`)) throw new Error("order hint " + lang);
      const orderH = await ev(cdp, stateExpr);
      const orderHintOk = lang === "en" ? orderH.hint === "Put the first stop at the top." : orderH.hint === "La primera parada va arriba.";
      if (!orderHintOk || /first team at the top|primer equipo/.test(orderH.hint) || orderH.aria !== orderH.hint) fail(lang + " order custom hint", orderH); else pass(lang + " order custom hint");
      await open("/index.html?preview=slots&shot=match&lang=" + lang);
      if (!await waitFor(cdp, `document.querySelector(".drag-hint")`)) throw new Error("match " + lang);
      const match = await ev(cdp, stateExpr);
      const matchOk = lang === "en" ? /name, then a record/.test(match.hint) : /un nombre y luego un dato/.test(match.hint);
      if (!matchOk) fail(lang + " match default hint", match); else pass(lang + " match default hint");
      await open("/index.html?preview=slots&shot=matchhint&lang=" + lang);
      if (!await waitFor(cdp, `document.querySelector(".drag-hint")`)) throw new Error("match hint " + lang);
      const matchH = await ev(cdp, stateExpr);
      const matchHintOk = lang === "en" ? matchH.hint === "Match each person to their year." : matchH.hint === "Empareja cada persona con su año.";
      if (!matchHintOk || /name, then a record|un nombre y luego un dato/.test(matchH.hint)) fail(lang + " match custom hint", matchH); else pass(lang + " match custom hint");
    }
  } catch (e) {
    fail("run", e.stack || e.message);
  } finally {
    chrome.kill("SIGKILL");
    srv.close();
  }
  console.log(bad ? bad + " failures" : "slot-layout.browser.js: all pass");
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
