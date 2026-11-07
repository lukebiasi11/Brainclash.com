/* Request checks for a future Supabase Edge Function.
   The secret key stays in the function environment. This file has no key and no project URL.
   Postgres functions in private are the authority for writes. */
"use strict";
function validateFinish(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_input" };
  if (typeof body.runId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.runId)) return { ok: false, error: "invalid_input" };
  if (typeof body.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.day)) return { ok: false, error: "invalid_input" };
  if (typeof body.playerDayHash !== "string" || body.playerDayHash.includes("@") || !/^[A-Za-z0-9_-]{16,128}$/.test(body.playerDayHash)) return { ok: false, error: "invalid_input" };
  if (!Array.isArray(body.scores) || body.scores.length !== 5 || body.scores.some(n => typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 1000)) return { ok: false, error: "invalid_input" };
  return { ok: true };
}
module.exports = { validateFinish };
