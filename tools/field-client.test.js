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
  ok("notice date stays 2026-11-09", cfgSrc.includes('NOTICE_LAST_UPDATED: "2026-11-09"'));
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
    "If this changes, we'll update this notice and the date above."
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
    "Si esto cambia, vamos a actualizar este aviso y la fecha de arriba."
  ];
  enBits.forEach(s => ok("notice EN " + s.slice(0, 24), notice.includes(s) && i18n.includes(s)));
  esBits.forEach(s => ok("notice ES " + s.slice(0, 24), notice.includes(s) && i18n.includes(s)));
  ok("docs header stays a lawyer draft", notice.startsWith("# Daily Dose daily comparison — privacy notice (draft)") && notice.includes("Draft pending the lawyer's review."));
  ok("contact is the mailto address", notice.includes("mailto:thedailydosetrivia@gmail.com") && fs.readFileSync(path.join(root, "field-config.js"), "utf8").includes('OPERATOR_CONTACT: "thedailydosetrivia@gmail.com"'));
  ok("notice body has no placeholder token", !notice.split("\n").slice(5).join("\n").includes("OPERATOR_CONTACT"));
  ok("quiet copy is translated", i18n.includes("No other results yet") && i18n.includes("Todavía no hay otros resultados"));
  ok("histogram copy is translated", ["Today's Competition", "Total Score", "By Category", "Player average", "Percentile", "Top {0}%", "Your score range", "Other completed games", "vs average", "↑ Number of completed games", "These bars count today's completed games, not including yours."].every(s => i18n.includes('"' + s + '"') && i18n.includes(s)));

  const adminHtml = fs.readFileSync(path.join(root, "admin.html"), "utf8");
  const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
  ok("admin does not load the field client", !/field-compare|field-config/.test(adminHtml));
  ok("index loads the field client", indexHtml.includes("field-config.js?v=g1live1") && indexHtml.includes("field-compare.js?v=g1hist1"));
  ok("footer reaches the notice", indexHtml.includes("privacy.html?v=g1live1"));
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  ok("g1 links the same notice", app.includes('href: "privacy.html?v=g1live1"'));
  ok("run start is wired", /function runNext\(\) \{[\s\S]{0,220}fieldNotePlay\(/.test(app));
  ok("finish is wired", /session\.scores\.length >= 5\) fieldNoteFinish\(/.test(app));
  ok("app still has one fetch", (app.match(/\bfetch\(/g) || []).length === 1);
  ok("app has no field POST", !/functions\/v1|method:\s*["']POST["']/.test(app));

  console.log(bad ? bad + " failures" : "field-client.test.js: all pass");
  process.exit(bad ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
