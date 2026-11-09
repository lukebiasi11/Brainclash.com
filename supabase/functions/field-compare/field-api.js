/* Request checks shipped with the Edge function directory.
   The secret key stays in the function environment. This file has no key and no project URL.
   Postgres functions in private are the authority for writes. */
function validDay(day) {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
function validId(id) { return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id); }
function validHash(hash) { return typeof hash === "string" && !hash.includes("@") && /^[A-Za-z0-9_-]{16,128}$/.test(hash); }
function privilegeField(body) {
  return body && typeof body === "object" && ["secret", "serviceRole", "role", "collection", "operatorContact", "authUid", "playerDayHash"].some(k => Object.prototype.hasOwnProperty.call(body, k));
}
export function validateStart(body) {
  if (!body || typeof body !== "object" || privilegeField(body)) return { ok: false, error: "invalid_input" };
  if (!validId(body.runId) || !validDay(body.day)) return { ok: false, error: "invalid_input" };
  return { ok: true };
}
export function validateFinish(body) {
  const start = validateStart(body);
  if (!start.ok) return start;
  if (!Array.isArray(body.scores) || body.scores.length !== 5 || body.scores.some(n => typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 1000)) return { ok: false, error: "invalid_input" };
  return { ok: true };
}
export function validateDay(query) {
  if (!query || !validDay(query.day) || !validId(query.runId)) return { ok: false, error: "invalid_input" };
  return { ok: true };
}
