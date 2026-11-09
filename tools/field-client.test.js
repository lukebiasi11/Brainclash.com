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

  const readyBody = { ok: true, comparison_available: true, reason: "ok", rest_average: 1500, rest_category_average: [100, 200, 300, 400, 500], rest_finishes: 4 };
  const ready = FC.interpret({ status: 200, body: readyBody });
  t("ready shape", [ready.state, ready.restAverage, ready.restCategoryAverage], ["ready", 1500, [100, 200, 300, 400, 500]]);
  t("ready without numbers stays quiet", FC.interpret({ status: 200, body: { ok: true, comparison_available: true, rest_average: 1, rest_category_average: [1, 2, 3] } }).state, "quiet");

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

  const notice = fs.readFileSync(path.join(root, "docs", "privacy-notice-draft.md"), "utf8");
  const i18n = fs.readFileSync(path.join(root, "i18n.js"), "utf8");
  const enBits = [
    "Draft pending the lawyer's review.",
    "There is no account. This browser gets a random anonymous ID. Daily Dose does not ask for your name or email.",
    "What is sent: the five category scores, the day, and the time of the request, with that anonymous ID.",
    "Why: to show your score beside the average of everyone else who finished that day.",
    "Rate-limit records and request metadata are deleted after 7 days.",
    "Who it is for: people 13 and older in the United States."
  ];
  const esBits = [
    "Borrador pendiente de la revisión del abogado.",
    "No hay cuenta. Este navegador recibe un identificador anónimo al azar. Daily Dose no pide tu nombre ni tu correo.",
    "Qué se envía: los cinco puntajes por categoría, el día y la hora de la solicitud, junto con ese identificador anónimo.",
    "Para qué: para mostrar tu puntaje junto al promedio de las demás personas que terminaron ese día.",
    "Los registros de límite de solicitudes y los datos técnicos de la solicitud se borran a los 7 días.",
    "Para quién: personas de 13 años o más en Estados Unidos."
  ];
  enBits.forEach(s => ok("notice EN " + s.slice(0, 24), notice.includes(s) && i18n.includes(s)));
  esBits.forEach(s => ok("notice ES " + s.slice(0, 24), notice.includes(s) && i18n.includes(s)));
  ok("contact placeholder in the notice", notice.includes("Contact: OPERATOR_CONTACT") && notice.includes("Contacto: OPERATOR_CONTACT"));
  ok("contact line is rendered from config", i18n.includes("\"Contact: {0}\": \"Contacto: {0}\""));
  ok("notice has no email address", !/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(notice + fs.readFileSync(path.join(root, "field-config.js"), "utf8")));
  ok("quiet copy is translated", i18n.includes("Not enough players yet today") && i18n.includes("Todavía no hay suficientes jugadores hoy"));

  const adminHtml = fs.readFileSync(path.join(root, "admin.html"), "utf8");
  const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
  ok("admin does not load the field client", !/field-compare|field-config/.test(adminHtml));
  ok("index loads the field client", indexHtml.includes("field-config.js?v=g1field1") && indexHtml.includes("field-compare.js?v=g1field1"));
  ok("footer reaches the notice", indexHtml.includes("privacy.html?v=g1field1"));
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  ok("run start is wired", /function runNext\(\) \{[\s\S]{0,220}fieldNotePlay\(/.test(app));
  ok("finish is wired", /session\.scores\.length >= 5\) fieldNoteFinish\(/.test(app));
  ok("app still has one fetch", (app.match(/\bfetch\(/g) || []).length === 1);
  ok("app has no field POST", !/functions\/v1|method:\s*["']POST["']/.test(app));

  console.log(bad ? bad + " failures" : "field-client.test.js: all pass");
  process.exit(bad ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
