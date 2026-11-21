/* Public daily display-name board.
   Reads and posts stay off until LEADERBOARD_PUBLIC is on.
   Rename and remove need the operator key. The birth year is not a field. */
import { verifyAnonymousClaims } from "./auth.js";
import { reportDbFailure } from "./db-log.js";

const MAX_BODY = 4096;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECTIONS = new Set(["overall", "world", "history", "sports", "word", "think"]);

export const PUBLIC_ORIGINS = [
  "https://lukebiasi11.github.io",
  "https://dailydosetrivia.com",
  "https://www.dailydosetrivia.com"
];

function cors(origin, allowed) {
  if (!origin || !allowed.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-board-operator",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "600"
  };
}
function json(status, body, headers) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}
function safeEqual(a, b) {
  const x = String(a || "");
  const y = String(b || "");
  if (!x || x.length !== y.length) return false;
  let mismatch = 0;
  for (let i = 0; i < x.length; i++) mismatch |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return mismatch === 0;
}
function validDay(day) {
  if (typeof day !== "string" || !DAY.test(day)) return false;
  const p = day.split("-").map(Number);
  const dt = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return dt.getUTCFullYear() === p[0] && dt.getUTCMonth() === p[1] - 1 && dt.getUTCDate() === p[2];
}
function validScores(scores) {
  if (!Array.isArray(scores) || scores.length !== 5) return null;
  const out = [];
  for (let i = 0; i < 5; i++) {
    const n = scores[i];
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 1000) return null;
    out.push(n);
  }
  return out;
}
function forbiddenKeys(body) {
  if (!body || typeof body !== "object") return false;
  return ["year", "birthYear", "birth_year", "age", "dob", "secret", "serviceRole", "authUid"].some(k => Object.prototype.hasOwnProperty.call(body, k));
}

async function readCappedBody(request) {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY)) {
    if (request.body) await request.body.cancel().catch(() => {});
    return { error: "body_too_large" };
  }
  if (!request.body) return { text: "" };
  const reader = request.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY) {
        await reader.cancel();
        return { error: "body_too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { error: "invalid_input" };
  }
  const buf = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { buf.set(chunk, offset); offset += chunk.byteLength; }
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(buf) };
  } catch {
    return { error: "invalid_input" };
  }
}

async function callDb(db, stage, name, args) {
  let result;
  try {
    result = await db.call(name, args);
  } catch (error) {
    reportDbFailure(stage, error);
    return { kind: "down" };
  }
  if (!result || typeof result !== "object" || result.error === "db_error" || result.error === "db_unavailable") return { kind: "down" };
  if (result.error === "rate_limited") return { kind: "limited" };
  return { kind: "ok", result };
}

function opOf(pathname, method) {
  if (pathname.endsWith("/board") && method === "GET") return "board";
  if (pathname.endsWith("/post") && method === "POST") return "post";
  if (pathname.endsWith("/admin-list") && method === "POST") return "admin-list";
  if (pathname.endsWith("/rename") && method === "POST") return "rename";
  if (pathname.endsWith("/remove") && method === "POST") return "remove";
  return "";
}

export function createBoardHandler(options = {}) {
  const allowed = new Set(options.allowedOrigins || []);
  const open = options.publicBoard === "on";
  const operatorKey = typeof options.operatorKey === "string" ? options.operatorKey : "";
  const db = options.db || null;
  const getClaims = options.getClaims || null;
  return async function handle(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    const headers = cors(origin, allowed);
    if (!origin || !allowed.has(origin)) return json(403, { ok: false, error: "origin_denied" }, headers);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const op = opOf(url.pathname, request.method);
    if (!op) return json(405, { ok: false, error: "method_not_allowed" }, headers);
    if (!db) return json(503, { ok: false, error: "not_configured" }, headers);
    const admin = op === "admin-list" || op === "rename" || op === "remove";
    if (!admin && !open) return json(503, { ok: false, error: "board_off" }, headers);
    let body = {};
    if (request.method === "POST") {
      const raw = await readCappedBody(request);
      if (raw.error) return json(raw.error === "body_too_large" ? 413 : 400, { ok: false, error: raw.error }, headers);
      if (!String(request.headers.get("content-type") || "").includes("application/json")) return json(400, { ok: false, error: "invalid_input" }, headers);
      try { body = JSON.parse(raw.text || "{}"); } catch { return json(400, { ok: false, error: "invalid_input" }, headers); }
      if (forbiddenKeys(body)) return json(400, { ok: false, error: "invalid_input" }, headers);
    }
    if (admin) {
      if (!operatorKey) return json(503, { ok: false, error: "operator_unconfigured" }, headers);
      if (!safeEqual(request.headers.get("x-board-operator") || "", operatorKey)) return json(401, { ok: false, error: "operator_required" }, headers);
    }
    if (op === "board") {
      const day = url.searchParams.get("day");
      const section = url.searchParams.get("section") || "overall";
      if (!validDay(day) || !SECTIONS.has(section)) return json(400, { ok: false, error: "invalid_input" }, headers);
      const limited = await callDb(db, "board_consume_rate", "board_consume_rate", [null]);
      if (limited.kind === "down") return json(503, { ok: false, error: "db_unavailable" }, headers);
      if (limited.kind === "limited") return json(429, { ok: false, error: "rate_limited" }, headers);
      const got = await callDb(db, "board_public", "board_public", [day, section]);
      if (got.kind === "down") return json(503, { ok: false, error: "db_unavailable" }, headers);
      if (got.kind === "limited") return json(429, { ok: false, error: "rate_limited" }, headers);
      return json(200, got.result, headers);
    }
    if (op === "post") {
      if (!getClaims) return json(503, { ok: false, error: "not_configured" }, headers);
      const identity = await verifyAnonymousClaims(getClaims, request.headers.get("authorization"));
      if (!identity.ok) return json(401, identity, headers);
      if (body.eligible !== true) return json(400, { ok: false, error: "not_eligible" }, headers);
      const scores = validScores(body.scores);
      if (!validDay(body.day) || !scores || typeof body.name !== "string") return json(400, { ok: false, error: "invalid_input" }, headers);
      const limited = await callDb(db, "board_consume_rate", "board_consume_rate", [identity.uid]);
      if (limited.kind === "down") return json(503, { ok: false, error: "db_unavailable" }, headers);
      if (limited.kind === "limited") return json(429, { ok: false, error: "rate_limited" }, headers);
      const posted = await callDb(db, "board_post", "board_post", [identity.uid, body.day, body.name, scores]);
      if (posted.kind === "down") return json(503, { ok: false, error: "db_unavailable" }, headers);
      if (posted.kind === "limited") return json(429, { ok: false, error: "rate_limited" }, headers);
      const result = posted.result || {};
      if (result.ok === false && result.error === "name_rejected") return json(400, { ok: false, error: "name_rejected" }, headers);
      const status = result.ok === false ? 400 : 200;
      return json(status, result, headers);
    }
    const limited = await callDb(db, "board_consume_rate", "board_consume_rate", [null]);
    if (limited.kind === "down") return json(503, { ok: false, error: "db_unavailable" }, headers);
    if (limited.kind === "limited") return json(429, { ok: false, error: "rate_limited" }, headers);
    if (op === "admin-list") {
      if (!validDay(body.day)) return json(400, { ok: false, error: "invalid_input" }, headers);
      const listed = await callDb(db, "board_admin_list", "board_admin_list", [body.day]);
      if (listed.kind !== "ok") return json(listed.kind === "limited" ? 429 : 503, { ok: false, error: listed.kind === "limited" ? "rate_limited" : "db_unavailable" }, headers);
      return json(200, listed.result, headers);
    }
    if (!UID.test(body.id || "")) return json(400, { ok: false, error: "invalid_input" }, headers);
    if (op === "rename") {
      if (typeof body.name !== "string") return json(400, { ok: false, error: "invalid_input" }, headers);
      const renamed = await callDb(db, "board_rename", "board_rename", [body.id, body.name]);
      if (renamed.kind !== "ok") return json(renamed.kind === "limited" ? 429 : 503, { ok: false, error: renamed.kind === "limited" ? "rate_limited" : "db_unavailable" }, headers);
      const result = renamed.result || {};
      if (result.error === "name_rejected") return json(400, { ok: false, error: "name_rejected" }, headers);
      return json(result.ok === false ? 404 : 200, result, headers);
    }
    const removed = await callDb(db, "board_remove", "board_remove", [body.id]);
    if (removed.kind !== "ok") return json(removed.kind === "limited" ? 429 : 503, { ok: false, error: removed.kind === "limited" ? "rate_limited" : "db_unavailable" }, headers);
    const result = removed.result || {};
    return json(result.ok === false ? 404 : 200, result, headers);
  };
}
