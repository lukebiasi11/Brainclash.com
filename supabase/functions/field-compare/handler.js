/* Local Edge-style HTTP adapter. Not deployed.
   Trust limits: playerDayHash is an opaque client token, not a verified person.
   Scores are client-reported range checks, not proof the game was played.
   The rate limit is per process and resets when the process restarts.
   Own-score exclusion, histogram, and the unset minimum-other-finishes gate
   are decided in private SQL. This file never reads a secret from the request. */
"use strict";
const { validateStart, validateFinish, validateDay } = require("../../field-api.js");
const MAX_BODY = 2048;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

function cors(origin, allowed) {
  if (!origin || !allowed.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "600"
  };
}
function json(status, body, headers) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}
function limited(buckets, key, now) {
  const bucket = buckets.get(key) || { start: now, n: 0 };
  if (now - bucket.start >= WINDOW_MS) { bucket.start = now; bucket.n = 0; }
  bucket.n += 1;
  buckets.set(key, bucket);
  return bucket.n > MAX_PER_WINDOW;
}

function createFieldHandler(options = {}) {
  const allowed = new Set(options.allowedOrigins || []);
  const collection = options.collection === "on";
  const db = options.db || null;
  const buckets = new Map();
  const now = options.now || (() => Date.now());
  return async function handle(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    const headers = cors(origin, allowed);
    if (!origin || !allowed.has(origin)) return json(403, { ok: false, error: "origin_denied" }, headers);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const op = url.pathname.endsWith("/finish") ? "finish" : url.pathname.endsWith("/start") ? "start" : url.pathname.endsWith("/day") ? "day" : "";
    if (!op || (op === "day" && request.method !== "GET") || (op !== "day" && request.method !== "POST")) return json(405, { ok: false, error: "method_not_allowed" }, headers);
    if (!collection) return json(503, { ok: false, error: "collection_off" }, headers);
    if (!db) return json(503, { ok: false, error: "not_configured" }, headers);
    let body = {};
    if (request.method === "POST") {
      if (!String(request.headers.get("content-type") || "").includes("application/json")) return json(400, { ok: false, error: "invalid_input" }, headers);
      const text = await request.text();
      if (text.length > MAX_BODY) return json(413, { ok: false, error: "body_too_large" }, headers);
      try { body = JSON.parse(text); } catch { return json(400, { ok: false, error: "invalid_input" }, headers); }
    } else body = { day: url.searchParams.get("day"), runId: url.searchParams.get("runId") };
    const key = origin + ":" + (body.runId || body.playerDayHash || "");
    if (limited(buckets, key, now())) return json(429, { ok: false, error: "rate_limited" }, headers);
    if (op === "start") {
      const check = validateStart(body);
      if (!check.ok) return json(400, check, headers);
      return json(200, await db.call("start_run", [body.runId, body.day, body.playerDayHash]), headers);
    }
    if (op === "finish") {
      const check = validateFinish(body);
      if (!check.ok) return json(400, check, headers);
      return json(200, await db.call("finish_run", [body.runId, body.day, body.playerDayHash, body.scores]), headers);
    }
    const check = validateDay(body);
    if (!check.ok) return json(400, check, headers);
    return json(200, await db.call("day_snapshot", [body.day, body.runId]), headers);
  };
}
module.exports = { createFieldHandler };
