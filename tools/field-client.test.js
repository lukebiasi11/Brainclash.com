// node tools/field-client.test.js — field client stays quiet and does not touch dg- history.
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
require(path.join(root, "field-config.js"));
const FC = require(path.join(root, "field-compare.js"));

let bad = 0;
const ok = (name, cond) => { if (!cond) { bad++; console.log("FAIL", name); } else console.log("ok", name); };
const t = (name, got, exp) => {
  const same = JSON.stringify(got) === JSON.stringify(exp);
  if (!same) { bad++; console.log("FAIL", name, "\n  got ", JSON.stringify(got), "\n  exp ", JSON.stringify(exp)); }
  else console.log("ok", name);
};

const day = "2026-11-09";
const scores = [100, 200, 300, 400, 500];
function liveSession(extra) { return Object.assign({ key: day, practice: false, scores: scores.slice() }, extra || {}); }

global.FIELD_COMPARE_ENABLED = false;
global.FIELD_COMPARE.publishableKey = "";
delete global.FIELD_COMPARE.createClient;
let hits = [];
global.fetch = async (url, init) => { hits.push({ url: String(url), method: init && init.method, body: init && init.body }); return { status: 500, async text() { return "{}"; } }; };

(async () => {
  const cfgSrc = fs.readFileSync(path.join(root, "field-config.js"), "utf8");
  const fcSrc = fs.readFileSync(path.join(root, "field-compare.js"), "utf8");
  ok("live flag is on", /FIELD_COMPARE_ENABLED = true/.test(cfgSrc));
  ok("live key is present", /publishableKey:\s*"sb_publishable_[^"]+"/.test(cfgSrc));
  ok("live project url", cfgSrc.includes('url: "https://xhgrcbsshhpvmfwzjtmp.supabase.co"'));
  ok("live function path", fcSrc.includes('"/functions/v1/field-compare/"'));
  ok("notice date is the go-live day", cfgSrc.includes('NOTICE_LAST_UPDATED: "2026-11-22"') && !cfgSrc.includes("GO_LIVE_DATE_TBD") && !cfgSrc.includes('NOTICE_LAST_UPDATED: "2026-11-09"'));
  ok("off mode is an override", global.FIELD_COMPARE_ENABLED === false);

  FC.onPlay(liveSession({ scores: [] }));
  FC.onFinish(liveSession());
  const off = await FC.dayFor(liveSession());
  t("flag off reason", off, { state: "quiet", reason: "flag" });
  t("flag off makes no network calls", hits, []);

  global.FIELD_COMPARE_ENABLED = true;
  const bare = await FC.dayFor(liveSession());
  t("blank key fails closed", bare.reason, "config");
  t("blank key makes no network calls", hits, []);
  ok("blank key does not post", FC.blocked(liveSession()) === "config");

  global.FIELD_COMPARE.publishableKey = "sb_publishable_test_key";
  global.FIELD_COMPARE.createClient = () => ({
    auth: {
      getSession: async () => ({ data: { session: null } }),
      signInAnonymously: async () => ({ data: { session: { access_token: "tok" } } })
    }
  });

  ok("practice blocked", FC.blocked(liveSession({ practice: true })) === "practice");
  const prevStore = global.localStorage;
  global.localStorage = { getItem: (k) => k === "bc-board-eligible" ? "no" : null, setItem() {}, removeItem() {}, key() { return null; }, get length() { return 0; } };
  ok("under 13 blocks field calls", FC.blocked(liveSession({ practice: false })) === "under13");
  global.localStorage = prevStore;
  ok("preview blocked", FC.blocked(liveSession(), { location: { pathname: "/index.html", search: "?preview=2026-11-01" } }) === "preview");
  ok("admin path blocked", FC.blocked(liveSession(), { location: { pathname: "/admin.html", search: "" }, boot: false }) === "admin");
  ok("admin boot blocked", FC.blocked(liveSession(), { location: { pathname: "/index.html", search: "" }, boot: true }) === "admin");
  FC.onPlay(liveSession({ practice: true, scores: [] }));
  FC.onFinish(liveSession({ practice: true }));
  const prac = await FC.dayFor(liveSession({ practice: true }));
  t("practice does not post", [hits.length, prac.reason], [0, "practice"]);
  global.location = { pathname: "/index.html", search: "?preview=" + day };
  const previewLive = await FC.dayFor(liveSession());
  t("preview search does not post", [hits.length, previewLive.reason], [0, "preview"]);
  global.BC_NO_BOOT = true;
  const admin = await FC.dayFor(liveSession());
  t("admin boot does not post", [hits.length, admin.reason], [0, "admin"]);
  global.BC_NO_BOOT = false;
  global.location = { pathname: "/index.html", search: "" };

  const failures = [
    [{ error: new Error("offline") }, "network"],
    [{ status: 503, body: { ok: false, error: "collection_off" } }, "collection_off"],
    [{ status: 200, body: { ok: false, error: "collection_off", comparison_available: false } }, "collection_off"],
    [{ status: 200, body: { ok: true, comparison_available: false, reason: "threshold_unresolved" } }, "threshold_unresolved"],
    [{ status: 200, body: { ok: true, comparison_available: false, reason: "below_threshold", rest_finishes: 2 } }, "below_threshold"],
    [{ status: 429, body: { ok: false, error: "rate_limited" } }, "rate_limited"],
    [{ status: 403, body: { ok: false, error: "origin_denied" } }, "origin_denied"]
  ];
  failures.forEach(([input, reason]) => t("quiet " + reason, FC.interpret(input), { state: "quiet", reason: reason }));

  const one = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0];
  const readyBody = { ok: true, comparison_available: true, reason: "ok", rest_average: 1500, rest_category_average: [100, 200, 300, 400, 500], rest_finishes: 4, score_bins: one.slice(), category_bins: [one.slice(), one.slice(), one.slice(), one.slice(), one.slice()], others_at_or_above: 1, category_at_or_above: [1, 1, 1, 1, 1] };
  const ready = FC.interpret({ status: 200, body: readyBody });
  t("ready shape", [ready.state, ready.restAverage, ready.restCategoryAverage, ready.scoreBins.join(","), ready.othersAtOrAbove], ["ready", 1500, [100, 200, 300, 400, 500], one.join(","), 1]);
  t("ready without numbers stays quiet", FC.interpret({ status: 200, body: { ok: true, comparison_available: true, rest_average: 1, rest_category_average: [1, 2, 3] } }).state, "quiet");
  t("ready without bins stays quiet", FC.interpret({ status: 200, body: { ok: true, comparison_available: true, rest_average: 1500, rest_category_average: [100, 200, 300, 400, 500], rest_finishes: 4 } }).state, "quiet");
  t("percentile", [FC.percentile(39, 100), FC.percentile(0, 4), FC.percentile(1, 1), FC.percentile(null, 4)], [39, 0, 100, null]);
  t("score bins", [FC.scoreBin(0), FC.scoreBin(3360), FC.scoreBin(4999), FC.scoreBin(5000), FC.categoryBin(700), FC.categoryBin(1000)], [0, 6, 9, 9, 7, 9]);

  const raw = [1.2, 0, 1000, 4, 5];
  const wired = FC.wireScores(raw);
  t("scores rounded for the wire", wired, [1, 0, 1000, 4, 5]);
  ok("wire does not mutate", raw[0] === 1.2);
  ok("rejects a string score", FC.wireScores([1, 2, 3, 4, "5"]) === null);
  ok("rejects 1000.6", FC.wireScores([1, 2, 3, 4, 1000.6]) === null);

  const bag = {};
  global.localStorage = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(bag, k) ? bag[k] : null; },
    setItem(k, v) { bag[k] = String(v); },
    removeItem(k) { delete bag[k]; }
  };
  bag["dg-" + day] = JSON.stringify({ scores: scores });
  const store = FC.fieldStorage();
  store.setItem("auth", "{\"x\":1}");
  t("auth storage prefix", Object.keys(bag).filter(k => k.indexOf("dg-") !== 0), ["sb-field-auth"]);
  ok("dg history untouched by auth storage", bag["dg-" + day] === JSON.stringify({ scores: scores }));

  const posts = [];
  let releaseStart;
  const startGate = new Promise(r => { releaseStart = r; });
  global.fetch = async (url, init) => {
    const hit = { url: String(url), method: init.method, body: init.body || "" };
    posts.push(hit);
    if (hit.url.endsWith("/start")) await startGate;
    const body = hit.url.indexOf("/day?") >= 0 ? readyBody : { ok: true, idempotent: false };
    return { status: 200, async text() { return JSON.stringify(body); } };
  };
  const played = { key: "2026-11-08", practice: false, scores: [] };
  FC.onPlay(played);
  FC.onFinish({ key: "2026-11-08", practice: false, scores: scores.slice() });
  await new Promise(r => setTimeout(r, 30));
  t("finish waits for start", posts.map(p => p.url.split("/").pop()), ["start"]);
  releaseStart();
  await new Promise(r => setTimeout(r, 30));
  const paths = posts.map(p => p.method + " " + p.url.split("/field-compare/")[1]);
  t("start then finish", paths, ["POST start", "POST finish"]);
  const startBody = JSON.parse(posts[0].body);
  const finishBody = JSON.parse(posts[1].body);
  ok("same run id", startBody.runId === finishBody.runId && /^[0-9a-f-]{36}$/i.test(startBody.runId));
  t("finish scores", finishBody.scores, scores);
  ok("played object gained no run id", played.runId == null);
  const seen = await FC.dayFor({ key: "2026-11-08", practice: false, scores: scores });
  t("day snapshot ready", [seen.state, seen.restAverage], ["ready", 1500]);
  ok("day request is a get", posts.some(p => p.method === "GET" && p.url.indexOf("day=2026-11-08") >= 0));

  global.fetch = async () => { throw new TypeError("Failed to fetch"); };
  const down = await FC.dayFor({ key: "2026-11-07", practice: false, scores: scores });
  t("network error is quiet", down, { state: "quiet", reason: "network" });

  const saved = JSON.stringify({ key: "2026-11-09", practice: false, counted: true, scores: [700, 680, 660, 640, 680] });
  bag["dg-2026-11-09"] = saved;
  const fillPosts = [];
  global.fetch = async (url, init) => {
    fillPosts.push({ url: String(url), method: init && init.method, body: init && init.body || "" });
    const op = String(url).split("/field-compare/")[1] || "";
    const body = op.indexOf("day") === 0 ? readyBody : { ok: true, idempotent: fillPosts.filter(p => p.url === String(url)).length > 1 };
    return { status: 200, async text() { return JSON.stringify(body); } };
  };
  const today = { key: "2026-11-09", practice: false, scores: [700, 680, 660, 640, 680] };
  const first = await FC.backfillToday(today, "2026-11-09");
  const second = await FC.backfillToday(today, "2026-11-09");
  const fillPaths = fillPosts.map(p => p.method + " " + p.url.split("/field-compare/")[1]);
  t("backfill posts start then finish once", [first.ok, second.skipped, fillPaths.join(",")], [true, true, "POST start,POST finish"]);
  ok("backfill keeps the same run id", JSON.parse(fillPosts[0].body).runId === JSON.parse(fillPosts[1].body).runId);
  t("backfill finish uses the stored scores", JSON.parse(fillPosts[1].body).scores, [700, 680, 660, 640, 680]);
  ok("backfill does not rewrite the saved result", bag["dg-2026-11-09"] === saved);
  ok("posted flag is separate from the score", JSON.parse(bag["dg-field-meta"])["2026-11-09"].posted === true);
  const beforePractice = fillPosts.length;
  const practice = await FC.backfillToday({ key: "2026-11-09", practice: true, scores: today.scores }, "2026-11-09");
  global.location = { pathname: "/admin.html", search: "" };
  const adminFill = await FC.backfillToday(today, "2026-11-09");
  global.location = { pathname: "/index.html", search: "?preview=2026-11-09" };
  const previewFill = await FC.backfillToday({ key: "2026-11-09", practice: false, scores: today.scores }, "2026-11-09");
  global.location = { pathname: "/index.html", search: "" };
  const otherDay = await FC.backfillToday({ key: "2026-11-08", practice: false, scores: today.scores }, "2026-11-09");
  t("practice admin preview and other days do not post", [practice.reason, adminFill.reason, previewFill.reason, otherDay.reason, fillPosts.length], ["practice", "admin", "preview", "not_today", beforePractice]);
  const latePosts = [];
  global.fetch = async (url, init) => {
    latePosts.push(String(url));
    const finish = String(url).indexOf("/finish") >= 0;
    const body = finish ? { ok: false, error: "player_day_exists" } : { ok: true, idempotent: false };
    return { status: 200, async text() { return JSON.stringify(body); } };
  };
  const late = await FC.backfillToday({ key: "2026-11-05", practice: false, scores: today.scores }, "2026-11-05");
  const lateAgain = await FC.backfillToday({ key: "2026-11-05", practice: false, scores: today.scores }, "2026-11-05");
  t("an existing day is marked posted without another finish", [late.ok, late.idempotent, lateAgain.skipped, latePosts.length], [true, true, true, 2]);
  ok("saved result still unchanged", bag["dg-2026-11-09"] === saved);
  let ticks = 0;
  const stopWatch = FC.watch(() => { ticks++; });
  stopWatch();
  ok("refresh timer stops", ticks === 0 && /setInterval\(run, 300000\)/.test(fs.readFileSync(path.join(root, "field-compare.js"), "utf8")));

  const notice = fs.readFileSync(path.join(root, "docs", "privacy-notice-draft.md"), "utf8");
  const i18n = fs.readFileSync(path.join(root, "i18n.js"), "utf8");
  const enBits = [
    "This browser gets a random ID that isn't tied to your name or email.",
    "When the daily comparison is on, finishing a daily game automatically sends your scores. Practice games don't send anything.",
    "What is sent: the five category scores, the day, and the time of the request, with that random ID.",
    "Our hosting providers (GitHub Pages and Supabase) receive technical data such as your IP address to deliver the site.",
    "We don't sell or share this data, and there are no ads or third-party analytics.",
    "The site doesn't respond differently to Do Not Track signals.",
    "Scores are kept indefinitely, as a combined daily total and under that random ID.",
    "Rate-limit records and request metadata are deleted after 7 days.",
    "To delete your scores, email",
    "Clearing your browser data gives you a new ID but doesn't delete earlier scores.",
    "Daily Dose isn't meant for children under 13.",
    "If this changes, we'll update this notice and the date above.",
    "Players under 13 can't post a nickname or appear on a leaderboard.",
    "We ask your birth year once to check that you're 13 or older. Only a yes/no result is kept on this device; your birth year isn't sent or saved.",
    "We may remove or change nicknames that are offensive, impersonate someone, or include contact details.",
    "Your nickname and the yes/no age result are saved only on this device so you don't have to enter them each day. Use 'Change name' to replace the nickname, or clear this browser's site data to remove both.",
    "If you skip the nickname, your score and rank may still appear on the public daily leaderboard under a random tag like 'Player 4821'. The tag is new each day and isn't linked to you or to your other days."
  ];
  const esBits = [
    "un identificador al azar que no está ligado a tu nombre ni a tu correo",
    "Cuando la comparación diaria está activada, terminar el juego del día envía tus puntajes automáticamente. Las prácticas no envían nada.",
    "Nuestros proveedores de alojamiento (GitHub Pages y Supabase) reciben datos técnicos, como tu dirección IP, para entregar el sitio.",
    "No vendemos ni compartimos estos datos, y no hay anuncios ni analítica de terceros.",
    "El sitio no responde de forma distinta a las señales de No rastrear.",
    "Los puntajes se guardan de forma indefinida, como un total combinado del día y bajo ese identificador.",
    "Los registros de límite de solicitudes y los datos técnicos de la solicitud se borran a los 7 días.",
    "Para borrar tus puntajes, escribe a",
    "Si borras los datos de este navegador, obtienes un identificador nuevo, pero eso no borra los puntajes anteriores.",
    "Daily Dose no está pensado para menores de 13 años.",
    "Si esto cambia, vamos a actualizar este aviso y la fecha de arriba.",
    "Los menores de 13 años no pueden publicar un apodo ni aparecer en una clasificación.",
    "Te pedimos tu año de nacimiento una vez para confirmar que tienes 13 años o más. Solo se guarda en este dispositivo un resultado de sí o no; tu año de nacimiento no se envía ni se guarda.",
    "Podemos quitar o cambiar apodos ofensivos, que suplanten a otra persona o que incluyan datos de contacto.",
    "Tu apodo y el resultado de sí o no sobre la edad se guardan solo en este dispositivo para que no tengas que ingresarlos cada día. Usa 'Cambiar nombre' para reemplazar el apodo, o borra los datos del sitio en este navegador para eliminar ambos.",
    "Si no agregas un apodo, tu puntaje y tu lugar pueden aparecer en la clasificación pública del día con una etiqueta al azar como 'Jugador 4821'. La etiqueta cambia cada día y no está vinculada a ti ni a tus otros días."
  ];
  enBits.forEach(s => ok("notice EN " + s.slice(0, 24), notice.includes(s) && i18n.includes(s)));
  esBits.forEach(s => ok("notice ES " + s.slice(0, 24), notice.includes(s) && i18n.includes(s)));
  ok("docs header stays a lawyer draft", notice.startsWith("# Daily Dose daily comparison — privacy notice (draft)") && notice.includes("Draft pending the lawyer's review."));
  ok("contact is the mailto address", notice.includes("mailto:thedailydosetrivia@gmail.com") && fs.readFileSync(path.join(root, "field-config.js"), "utf8").includes('OPERATOR_CONTACT: "thedailydosetrivia@gmail.com"'));
  ok("notice body has no placeholder token", !notice.split("\n").slice(5).join("\n").includes("OPERATOR_CONTACT"));
  ok("quiet copy is translated", i18n.includes("No other results yet") && i18n.includes("Aún no hay otros resultados") && i18n.includes('"Loading…": "Cargando…"') && i18n.includes('"Saved": "Guardado"') && i18n.includes('"Retry comparison": "Reintentar la comparación"'));
  ok("histogram copy is translated", ["Today's Competition", "Total Score", "By Category", "Player average", "Percentile", "Top {0}%", "Your score range", "Other completed games", "vs average", "↑ Number of completed games", "Blue bars are other completed games. The orange bar includes your game."].every(s => i18n.includes('"' + s + '"') && i18n.includes(s)));

  const adminHtml = fs.readFileSync(path.join(root, "admin.html"), "utf8");
  const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
  ok("admin does not load the field client", !/field-compare|field-config/.test(adminHtml));
  ok("index loads the field client", indexHtml.includes("field-config.js?v=sb2119c") && indexHtml.includes("field-compare.js?v=g1t12") && !indexHtml.includes("<script src=\"vendor/supabase.js"));
  ok("footer reaches the notice", indexHtml.includes("privacy.html?v=sb2119"));
  ok("rankings line stays off the notice", !notice.includes("Rankings are for fun") && !fs.readFileSync(path.join(root, "privacy.html"), "utf8").includes("Rankings are for fun"));
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  ok("g1 links the same notice", app.includes('href: "privacy.html?v=sb2119"'));
  ok("empty snapshot names the status", app.includes('tr("Loading…")') && app.includes('tr("No other results yet")'));
  ok("run start is wired", /function runNext\(\) \{[\s\S]{0,220}fieldNotePlay\(/.test(app));
  ok("finish is wired", /session\.scores\.length >= 5\) fieldNoteFinish\(/.test(app));
  ok("app still has one fetch", (app.match(/\bfetch\(/g) || []).length === 1);
  ok("app has no field POST", !/functions\/v1|method:\s*["']POST["']/.test(app));
  ok("one deadline covers the sdk", /const token = await within\(started, \(\) => tokenFor\(\)\)/.test(fcSrc) && fcSrc.includes("loadSdk") && fcSrc.includes("deadlineMs"));

  function freshField() {
    delete require.cache[require.resolve(path.join(root, "field-compare.js"))];
    return require(path.join(root, "field-compare.js"));
  }
  global.FIELD_COMPARE.deadlineMs = 120;
  global.FIELD_COMPARE.createClient = () => ({
    auth: {
      getSession: () => new Promise(resolve => { setTimeout(() => resolve({ data: { session: { access_token: "late" } } }), 400); }),
      signInAnonymously: () => new Promise(() => {})
    }
  });
  const sessionHangs = [];
  global.fetch = async () => { sessionHangs.push(Date.now()); return { status: 200, async text() { return "{}"; } }; };
  const sessionClient = freshField();
  const sessionStart = Date.now();
  const sessionQuiet = await sessionClient.dayFor(liveSession({ key: "2026-11-06" }));
  t("getSession hang falls back", [sessionQuiet.state, sessionQuiet.reason, sessionHangs.length, Date.now() - sessionStart < 1000], ["quiet", "network", 0, true]);
  await new Promise(r => setTimeout(r, 500));
  t("a late session does not fetch", sessionHangs, []);

  delete global.FIELD_COMPARE.createClient;
  global.FIELD_COMPARE.loadSdk = () => new Promise(resolve => { setTimeout(() => resolve({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: "late" } } }) } }) }), 400); });
  const importHangs = [];
  global.fetch = async () => { importHangs.push(1); return { status: 200, async text() { return "{}"; } }; };
  const importClient = freshField();
  const importStart = Date.now();
  const importQuiet = await importClient.dayFor(liveSession({ key: "2026-11-05" }));
  t("sdk import hang falls back", [importQuiet.state, importQuiet.reason, importHangs.length, Date.now() - importStart < 1000], ["quiet", "network", 0, true]);
  await new Promise(r => setTimeout(r, 500));
  t("a late sdk does not fetch", importHangs, []);
  delete global.FIELD_COMPARE.loadSdk;
  delete global.FIELD_COMPARE.deadlineMs;

  function freshReal() {
    delete require.cache[require.resolve(path.join(root, "field-compare.js"))];
    delete global.FIELD_COMPARE.deadlineMs;
    return require(path.join(root, "field-compare.js"));
  }
  const readyAuth = {
    getSession: async () => ({ data: { session: { access_token: "tok" } } }),
    signInAnonymously: async () => ({ data: { session: { access_token: "tok" } } })
  };
  async function eight(label, prepare, run) {
    prepare();
    const client = freshReal();
    const started = Date.now();
    const result = await run(client);
    const ms = Date.now() - started;
    console.log(label, ms + "ms", JSON.stringify(result && result.state ? result : { reason: result && result.reason }));
    const quiet = result && (result.state === "quiet" || result.reason === "network" || result.ok === false);
    t(label, [quiet, ms < 9000, ms >= 7000], [true, true, true]);
    return ms;
  }
  await eight("sdk import stall falls back at 8s", () => {
    delete global.FIELD_COMPARE.createClient;
    global.FIELD_COMPARE.loadSdk = () => new Promise(() => {});
  }, client => client.dayFor(liveSession({ key: "2026-11-04" })));
  await eight("sign-in stall falls back at 8s", () => {
    delete global.FIELD_COMPARE.loadSdk;
    global.FIELD_COMPARE.createClient = () => ({ auth: { getSession: async () => ({ data: { session: null } }), signInAnonymously: () => new Promise(() => {}) } });
  }, client => client.dayFor(liveSession({ key: "2026-11-03" })));
  await eight("getSession stall falls back at 8s", () => {
    global.FIELD_COMPARE.createClient = () => ({ auth: { getSession: () => new Promise(() => {}), signInAnonymously: () => new Promise(() => {}) } });
  }, client => client.dayFor(liveSession({ key: "2026-11-02" })));
  {
    global.FIELD_COMPARE.deadlineMs = 220;
    global.FIELD_COMPARE.createClient = () => ({ auth: readyAuth });
    const aborts = { finish: 0, day: 0 };
    global.fetch = (url, init) => new Promise((resolve, reject) => {
      const u = String(url);
      const op = u.indexOf("/finish") >= 0 ? "finish" : u.indexOf("/day") >= 0 ? "day" : "start";
      if (op === "start") { resolve({ status: 200, async text() { return JSON.stringify({ ok: true }); } }); return; }
      const signal = init && init.signal;
      if (signal) signal.addEventListener("abort", () => { aborts[op]++; reject(new Error("abort")); });
    });
    delete require.cache[require.resolve(path.join(root, "field-compare.js"))];
    const split = require(path.join(root, "field-compare.js"));
    const session = liveSession({ key: "2026-11-01" });
    const t0 = Date.now();
    const save = await split.backfillToday(session, "2026-11-01");
    const day = await split.dayFor(session);
    const ms = Date.now() - t0;
    t("start, finish, and day each have a deadline", [save.ok, day.reason, aborts.finish, aborts.day, ms > 350, ms < 1200], [false, "network", 1, 1, true, true]);
    delete global.FIELD_COMPARE.deadlineMs;
    global.FIELD_COMPARE.createClient = () => ({ auth: readyAuth });
    let dayFails = true;
    global.fetch = async (url) => {
      const u = String(url);
      if (u.indexOf("/day") >= 0) {
        if (dayFails) throw new TypeError("Failed to fetch");
        return { status: 200, async text() { return JSON.stringify(readyBody); } };
      }
      return { status: 200, async text() { return JSON.stringify({ ok: true }); } };
    };
    delete require.cache[require.resolve(path.join(root, "field-compare.js"))];
    const retry = require(path.join(root, "field-compare.js"));
    const played = liveSession({ key: "2026-11-01" });
    const posted = await retry.backfillToday(played, "2026-11-01");
    const missed = await retry.dayFor(played);
    t("a failed day read does not undo a successful finish", [posted.ok, missed.reason, retry.saveView(posted, missed)], [true, "network", { saved: true, state: "saved", reason: "network", retry: true }]);
    dayFails = false;
    const again = await retry.dayFor(played);
    t("the day read retries on its own deadline", [again.state, again.restAverage], ["ready", 1500]);
    t("a day failure without a finish is not Saved", retry.saveView({ ok: false, reason: "network" }, missed), { saved: false, state: "quiet", reason: "network", retry: false });
    t("too few players stays quiet with no retry", retry.saveView({ ok: true }, { state: "quiet", reason: "below_threshold" }), { saved: false, state: "quiet", reason: "below_threshold", retry: false });
    t("an unresolved threshold does not re-read", retry.saveView({ ok: true }, { state: "quiet", reason: "threshold_unresolved" }), { saved: false, state: "quiet", reason: "threshold_unresolved", retry: false });
  }
  delete global.FIELD_COMPARE.loadSdk;
  delete global.FIELD_COMPARE.deadlineMs;

  const fieldId = "11111111-1111-4111-8111-111111111001";
  const boardId = "22222222-2222-4222-8222-222222222002";
  bag["sb-field-auth"] = JSON.stringify({ access_token: "field-token", user: { id: fieldId } });
  bag["sb-board-auth"] = JSON.stringify({ access_token: "board-token", user: { id: boardId } });
  const seenIds = [];
  function recordClient(which) {
    return (url, key, opts) => {
      const raw = opts.auth.storage.getItem(opts.auth.storageKey);
      const session = JSON.parse(raw);
      seenIds.push({ which: which, storageKey: opts.auth.storageKey, id: session.user.id });
      return { auth: { getSession: async () => ({ data: { session: session } }), signInAnonymously: async () => { throw new Error("new anon " + which); } } };
    };
  }
  global.FIELD_COMPARE.createClient = recordClient("field");
  global.location = { pathname: "/index.html", search: "" };
  global.FIELD_COMPARE_ENABLED = true;
  global.fetch = async () => ({ status: 200, async text() { return JSON.stringify(readyBody); } });
  delete require.cache[require.resolve(path.join(root, "field-compare.js"))];
  const splitFc = require(path.join(root, "field-compare.js"));
  await splitFc.dayFor({ key: "2026-11-09", practice: false, scores: scores });
  global.LEADERBOARD_ENABLED = true;
  global.LEADERBOARD = {
    url: "https://xhgrcbsshhpvmfwzjtmp.supabase.co",
    publishableKey: "k",
    createClient: recordClient("board")
  };
  global.document = { addEventListener() {}, removeEventListener() {}, visibilityState: "hidden", createElement() { return { append() {}, setAttribute() {}, style: {} }; }, querySelector() { return null; } };
  global.BCDaily = { todayKey: () => "2026-11-09" };
  delete require.cache[require.resolve(path.join(root, "leaderboard.js"))];
  const Board = require(path.join(root, "leaderboard.js"));
  bag["bc-board-eligible"] = "yes";
  bag["bc-board-name-skip"] = "1";
  delete bag["bc-board-name"];
  await Board.noteFinish({ key: "2026-11-09", practice: false, scores: scores });
  t("both sessions keep their own ids", seenIds.map(s => s.which + ":" + s.storageKey + ":" + s.id), ["field:sb-field-auth:" + fieldId, "board:sb-board-auth:" + boardId]);
  ok("stored sessions were not rewritten", bag["sb-field-auth"].includes(fieldId) && bag["sb-board-auth"].includes(boardId));
  ok("configs do not load supabase from jsdelivr", !fs.readFileSync(path.join(root, "field-config.js"), "utf8").includes("jsdelivr") && !fs.readFileSync(path.join(root, "leaderboard-config.js"), "utf8").includes("+esm") && !fs.readFileSync(path.join(root, "leaderboard.js"), "utf8").includes("jsdelivr"));
  ok("supabase is loaded lazily", fs.readFileSync(path.join(root, "field-config.js"), "utf8").includes('s.src = "vendor/supabase.js?v=sb2119b"') && fs.readFileSync(path.join(root, "vendor/supabase.LICENSE"), "utf8").includes("Copyright (c) 2020 Supabase") && fs.readFileSync(path.join(root, "credits.html"), "utf8").includes("vendor/supabase.LICENSE"));
  ok("leaderboard prefers createClient", /storageKey: "sb-board-auth"/.test(fs.readFileSync(path.join(root, "leaderboard.js"), "utf8")) && /storageKey: "sb-field-auth"/.test(fs.readFileSync(path.join(root, "field-compare.js"), "utf8")));

  console.log(bad ? bad + " failures" : "field-client.test.js: all pass");
  process.exit(bad ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
