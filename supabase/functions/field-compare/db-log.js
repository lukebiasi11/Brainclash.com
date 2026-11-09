/* Safe line for the function logs. No URL, password, JWT, or uid. */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const URLISH = /\b(?:postgres(?:ql)?:\/\/\S+|https?:\/\/\S+)/gi;
const SECRET = /\b(?:password|pwd)\s*[:=]\s*\S+/gi;
const BEARER = /\bbearer\s+\S+/gi;

export function describeDbError(error) {
  const className = String(error && error.constructor && error.constructor.name || "Error").replace(/[^\w]/g, "").slice(0, 40) || "Error";
  const code = error && typeof error.code === "string" && /^[0-9A-Z]{5}$/.test(error.code) ? error.code : "none";
  let message = error && error.message != null ? String(error.message) : "database request failed";
  message = message.replace(URLISH, "[redacted]").replace(SECRET, "[redacted]").replace(BEARER, "[redacted]").replace(UUID, "[redacted]");
  message = message.replace(/\s+/g, " ").trim().slice(0, 160);
  if (!message) message = "database request failed";
  return { className, sqlstate: code, message };
}

export function reportDbFailure(stage, error) {
  const info = describeDbError(error);
  console.error(`field-compare db_unavailable stage=${stage} class=${info.className} sqlstate=${info.sqlstate} message=${info.message}`);
}
