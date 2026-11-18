// A touch tap on a match chip must select once. pointerup used to call onLeft,
// then the synthesized click called it again and cleared the selection.
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
    const type = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(fs.readFileSync(fp));
  });
  return new Promise(resolve => srv.listen(0, "127.0.0.1", () => resolve(srv)));
}
class CDP {
  constructor(ws) { this.ws = ws; this.next = 0; this.pending = new Map();
    ws.addEventListener("message", ev => { const msg = JSON.parse(ev.data); if (msg.id && this.pending.has(msg.id)) { const p = this.pending.get(msg.id); this.pending.delete(msg.id); msg.error ? p.reject(new Error(msg.error.message || JSON.stringify(msg.error))) : p.resolve(msg.result || {}); } });
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

const matchState = `(() => {
  const chip = sel => [...document.querySelectorAll(sel)].map(b => ({
    t: (b.innerText || "").replace(/\\s+/g, " ").trim(),
    sel: b.classList.contains("match-sel"),
    paired: b.classList.contains("match-paired"),
    pressed: b.getAttribute("aria-pressed")
  }));
  return { live: (document.querySelector("[aria-live]") || {}).textContent || "", left: chip(".match-left .match-chip"), right: chip(".match-right .match-chip") };
})()`;
const orderState = `(() => ({
  live: (document.querySelector("[aria-live]") || {}).textContent || "",
  chips: [...document.querySelectorAll(".order-chip")].map(b => ({ t: b.querySelector(".order-label").textContent.trim(), sel: b.classList.contains("order-sel") }))
}))()`;

(async () => {
  const srv = await startServer();
  const origin = "http://127.0.0.1:" + srv.address().port;
  const userDir = fs.mkdtempSync(path.join("/tmp", "bc-match-tap-"));
  const chrome = spawn("google-chrome", [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--remote-debugging-port=9377", "--user-data-dir=" + userDir, "--no-first-run", "about:blank"
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  chrome.stderr.on("data", d => { log += d; });
  chrome.stdout.on("data", d => { log += d; });
  const port = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("chrome\n" + log.slice(-500))), 20000);
    const watch = () => { const m = log.match(/DevTools listening on ws:\/\/(?:127\.0\.0\.1|\[::1\]):(\d+)/); if (m) { clearTimeout(t); resolve(+m[1]); } };
    chrome.stderr.on("data", watch); chrome.stdout.on("data", watch); watch();
  });
  let cdp;
  async function open(url, w, h, touch) {
    const created = JSON.parse(await (await fetch("http://127.0.0.1:" + port + "/json/new?" + encodeURIComponent(origin + url), { method: "PUT" })).text());
    cdp = new CDP(await wsOpen(created.webSocketDebuggerUrl));
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 800 });
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: !!touch, maxTouchPoints: 1 });
    const ready = await ev(cdp, `new Promise(r => { const t = Date.now(); const tick = () => (document.querySelector(".match-chip, .order-chip, .btn") ? r(true) : Date.now() - t > 8000 ? r(false) : setTimeout(tick, 40)); tick(); })`);
    if (!ready) throw new Error("not ready " + url);
    await sleep(200);
  }
  async function shot(name) {
    const img = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(SHOTS, name), Buffer.from(img.data, "base64"));
  }
  async function box(sel) {
    const b = await ev(cdp, `(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), t: (el.innerText || "").replace(/\\s+/g, " ").trim() }; })()`);
    if (!b) throw new Error("missing " + sel);
    return b;
  }
  async function tap(x, y) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
    await sleep(40);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [{ x, y, id: 1 }] });
    await sleep(180);
  }
  async function mouse(x, y) {
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await sleep(30);
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    await sleep(180);
  }
  async function key(name, code, vk) {
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: name, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
    if (name === "Enter") await cdp.send("Input.dispatchKeyEvent", { type: "char", key: "Enter", code, windowsVirtualKeyCode: vk, text: "\r" });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: name, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
    await sleep(150);
  }
  function selectedLeft(st, name) {
    const chip = st.left.find(c => c.t === name || c.t.endsWith(name));
    return chip && chip.sel && chip.pressed === "true" && /selected/.test(st.live) && !/Selection cleared/.test(st.live);
  }

  try {
    await open("/index.html?preview=slots&shot=match", 375, 667, true);
    let ada = await box(".match-left .match-chip");
    if (ada.t !== "Ada") fail("demo left starts with Ada", ada.t); else pass("demo match ready");
    await tap(ada.x, ada.y);
    let st = await ev(cdp, matchState);
    if (!selectedLeft(st, "Ada")) fail("touch tap selects Ada once at 375", st); else pass("touch tap selects Ada once at 375");
    await sleep(300);
    st = await ev(cdp, matchState);
    if (!selectedLeft(st, "Ada")) fail("selection stays after the click", st); else pass("selection stays after the click");

    ada = await box(".match-left .match-chip");
    await tap(ada.x, ada.y);
    st = await ev(cdp, matchState);
    if (st.left[0].sel || !/Selection cleared/.test(st.live)) fail("second tap clears", st); else pass("second tap clears");

    ada = await box(".match-left .match-chip");
    const rec = await box(".match-right .match-chip");
    await tap(ada.x, ada.y);
    await tap(rec.x, rec.y);
    st = await ev(cdp, matchState);
    if (!(st.left[0].paired && st.right[0].paired && /^Paired /.test(st.live))) fail("tap name then record pairs", st); else pass("tap name then record pairs");
    ada = await box(".match-left .match-chip");
    await tap(ada.x, ada.y);
    st = await ev(cdp, matchState);
    if (st.left[0].paired || st.left[0].sel || !/Unpaired /.test(st.live)) fail("tap a pair to unpair", st); else pass("tap a pair to unpair");

    await open("/index.html?preview=slots&shot=match", 375, 667, true);
    const from = await box(".match-left .match-chip");
    const to = await box(".match-right .match-chip");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from.x, y: from.y, id: 1 }] });
    await sleep(30);
    for (let i = 1; i <= 8; i++) {
      const x = Math.round(from.x + (to.x - from.x) * i / 8);
      const y = Math.round(from.y + (to.y - from.y) * i / 8);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y, id: 1 }] });
      await sleep(16);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [{ x: to.x, y: to.y, id: 1 }] });
    await sleep(250);
    st = await ev(cdp, matchState);
    if (!(st.left[0].paired && st.right[0].paired && /^Paired /.test(st.live))) fail("drag name onto record pairs", st); else pass("drag name onto record pairs");

    await open("/index.html?preview=slots&shot=match", 390, 844, true);
    ada = await box(".match-left .match-chip");
    await tap(ada.x, ada.y);
    st = await ev(cdp, matchState);
    if (!selectedLeft(st, "Ada")) fail("touch tap selects at 390", st); else pass("touch tap selects at 390");

    await open("/index.html?preview=slots&shot=match", 1280, 800, false);
    ada = await box(".match-left .match-chip");
    await mouse(ada.x, ada.y);
    st = await ev(cdp, matchState);
    if (!selectedLeft(st, "Ada")) fail("mouse click selects", st); else pass("mouse click selects");
    ada = await box(".match-left .match-chip");
    await mouse(ada.x, ada.y);
    st = await ev(cdp, matchState);
    if (st.left[0].sel || !/Selection cleared/.test(st.live)) fail("second mouse click clears", st); else pass("second mouse click clears");

    await open("/index.html?preview=slots&shot=match", 1280, 800, false);
    const focused = await ev(cdp, `(() => { const b = document.querySelector(".match-left .match-chip"); b.focus(); return document.activeElement === b; })()`);
    if (!focused) fail("match chip takes focus"); else pass("match chip takes focus");
    await key("Enter", "Enter", 13);
    st = await ev(cdp, matchState);
    if (!selectedLeft(st, "Ada")) fail("Enter selects the focused chip", st); else pass("Enter selects the focused chip");
    const spaced = await ev(cdp, `(() => { const b = document.querySelectorAll(".match-left .match-chip")[1]; b.focus(); return document.activeElement === b && (b.innerText || "").includes("Marie"); })()`);
    if (!spaced) fail("second match chip takes focus"); else pass("second match chip takes focus");
    await key(" ", "Space", 32);
    st = await ev(cdp, matchState);
    if (!selectedLeft(st, "Marie")) fail("Space selects the focused chip", st); else pass("Space selects the focused chip");

    await open("/index.html?preview=slots&shot=order", 375, 667, true);
    let chip = await box(".order-chip .order-label");
    await tap(chip.x, chip.y);
    let os = await ev(cdp, orderState);
    await sleep(250);
    const os2 = await ev(cdp, orderState);
    if (!(os.chips[0].sel && os2.chips[0].sel && /selected/.test(os2.live) && !/Selection cleared/.test(os2.live))) fail("order touch tap stays selected", os2); else pass("order touch tap stays selected");
    chip = await box(".order-chip .order-label");
    await tap(chip.x, chip.y);
    os = await ev(cdp, orderState);
    if (os.chips[0].sel || !/Selection cleared/.test(os.live)) fail("order second tap clears", os); else pass("order second tap clears");
    const down = await box(".order-chip .order-move:last-child");
    const before = (await ev(cdp, orderState)).chips.map(c => c.t).join(",");
    await tap(down.x, down.y);
    os = await ev(cdp, orderState);
    const after = os.chips.map(c => c.t).join(",");
    if (after === before || !/moved to position/.test(os.live)) fail("order down button moves a chip", { before, after, live: os.live }); else pass("order down button moves a chip");
    const beforeKey = await ev(cdp, orderState);
    const focusedOrder = await ev(cdp, `(() => { const c = document.querySelectorAll(".order-chip")[1]; c.focus(); return document.activeElement === c; })()`);
    if (!focusedOrder) fail("order chip takes focus"); else pass("order chip takes focus");
    await key("Enter", "Enter", 13);
    os = await ev(cdp, orderState);
    const orderKeyOk = beforeKey.chips.some(c => c.sel) ? /Swapped|Selection cleared/.test(os.live) : /selected/.test(os.live);
    if (!orderKeyOk) fail("order Enter selects, swaps, or clears", os); else pass("order Enter selects, swaps, or clears");

    await open("/index.html?preview=slots&shot=order", 375, 667, true);
    const chips = await ev(cdp, `[...document.querySelectorAll(".order-chip")].map(el => { const r = el.getBoundingClientRect(); return { t: el.querySelector(".order-label").textContent.trim(), x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })`);
    const top = chips[0], mid = chips[2];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: top.x, y: top.y, id: 1 }] });
    await sleep(30);
    for (let i = 1; i <= 8; i++) {
      const y = Math.round(top.y + (mid.y - top.y) * i / 8);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: top.x, y, id: 1 }] });
      await sleep(16);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [{ x: top.x, y: mid.y, id: 1 }] });
    await sleep(250);
    os = await ev(cdp, orderState);
    if (os.chips[0].t === top.t) fail("order drag reorders", os); else pass("order drag reorders");

    async function maria(w, h, file) {
      await open("/index.html?dgtest=1", w, h, true);
      const ready = await ev(cdp, `new Promise(r => { const t = Date.now(); const tick = () => window.DGTest && window.CONTENT ? r(true) : Date.now() - t > 8000 ? r(false) : setTimeout(tick, 40); tick(); })`);
      if (!ready) throw new Error("dgtest not ready");
      await ev(cdp, `(() => { const day = CONTENT.sports.find(d => (d || []).some(q => (q.left || []).includes("Maria Sharapova"))); const q = day.find(item => (item.left || []).includes("Maria Sharapova")); DGTest.sportsSet([q, day[0], day[1]]); })()`);
      await sleep(450);
      await ev(cdp, `(() => { const b = [...document.querySelectorAll("button")].find(el => /start mvp/i.test(el.textContent || "")); b.click(); })()`);
      await sleep(400);
      const name = await box(".match-left .match-chip");
      if (!/Maria Sharapova/.test(name.t)) throw new Error("expected Maria, got " + name.t);
      await tap(name.x, name.y);
      const got = await ev(cdp, matchState);
      if (!selectedLeft(got, "Maria Sharapova")) fail("Maria touch tap " + w, got); else pass("Maria touch tap " + w);
      await shot(file);
    }
    await maria(375, 667, "after-match-touch-375.png");
    await maria(390, 844, "after-match-touch-390.png");
  } catch (e) {
    fail("harness", e && e.stack || String(e));
  } finally {
    chrome.kill("SIGKILL");
    srv.close();
    console.log(bad ? bad + " failures" : "match-tap.browser.js: all pass");
    process.exit(bad ? 1 : 0);
  }
})().catch(e => { console.error(e); process.exit(1); });
