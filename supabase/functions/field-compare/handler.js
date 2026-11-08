/* Local HTTP adapter for a future Edge Function. Not deployed.
   Identity comes only from verifyAnonymousClaims. A client hash is not accepted.
   Durable rate slots are private.consume_rate. The process does not keep its own counter.
   FIELD_COLLECTION and the SQL gate both default off. */
"use strict";
const { validateStart, validateFinish, validateDay } = require("../../field-api.js");
const { verifyAnonymousClaims } = require("./auth.js");
const MAX_BODY = 2048;

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

function createFieldHandler(options = {}) {
  const allowed = new Set(options.allowedOrigins || []);
  const collection = options.collection === "on";
  const db = options.db || null;
  const getClaims = options.getClaims || null;
  return async function handle(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    const headers = cors(origin, allowed);
    if (!origin || !allowed.has(origin)) return json(403, { ok: false, error: "origin_denied" }, headers);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const op = url.pathname.endsWith("/finish") ? "finish" : url.pathname.endsWith("/start") ? "start" : url.pathname.endsWith("/day") ? "day" : "";
    if (!op || (op === "day" && request.method !== "GET") || (op !== "day" && request.method !== "POST")) return json(405, { ok: false, error: "method_not_allowed" }, headers);
    let body = {};
    if (request.method === "POST") {
      const raw = await readCappedBody(request);
      if (raw.error) return json(raw.error === "body_too_large" ? 413 : 400, { ok: false, error: raw.error }, headers);
      if (!String(request.headers.get("content-type") || "").includes("application/json")) return json(400, { ok: false, error: "invalid_input" }, headers);
      try { body = JSON.parse(raw.text || "{}"); } catch { return json(400, { ok: false, error: "invalid_input" }, headers); }
    } else body = { day: url.searchParams.get("day"), runId: url.searchParams.get("runId") };
    if (!collection) return json(503, { ok: false, error: "collection_off" }, headers);
    if (!db || !getClaims) return json(503, { ok: false, error: "not_configured" }, headers);
    const identity = await verifyAnonymousClaims(getClaims, request.headers.get("authorization"));
    if (!identity.ok) return json(401, identity, headers);
    const rate = await db.call("consume_rate", [identity.uid]);
    if (!rate.ok) return json(429, { ok: false, error: "rate_limited" }, headers);
    if (op === "start") {
      const check = validateStart(body);
      if (!check.ok) return json(400, check, headers);
      return json(200, await db.call("start_run", [body.runId, body.day, identity.uid]), headers);
    }
    if (op === "finish") {
      const check = validateFinish(body);
      if (!check.ok) return json(400, check, headers);
      return json(200, await db.call("finish_run", [body.runId, body.day, identity.uid, body.scores]), headers);
    }
    const check = validateDay(body);
    if (!check.ok) return json(400, check, headers);
    return json(200, await db.call("day_snapshot", [body.day, body.runId, identity.uid]), headers);
  };
}
module.exports = { createFieldHandler };
