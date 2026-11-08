const { createFieldHandler } = require("../supabase/functions/field-compare/handler.js");
let bad = 0;
const t = (name, ok) => { if (!ok) { bad++; console.log("FAIL", name); } };
const origin = "https://lukebiasi11.github.io";
const run = "11111111-1111-4111-8111-111111111111";
const hash = "player-a-isolated-1";
function req(path, { method = "POST", body, headers = {} } = {}) {
  return new Request("http://local" + path, { method, headers: { origin, "content-type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined });
}
const calls = [];
const db = { async call(name, args) { calls.push({ name, args }); return { ok: true, from: name }; } };

(async () => {
  const on = createFieldHandler({ collection: "on", allowedOrigins: [origin], db });
  const off = createFieldHandler({ collection: "off", allowedOrigins: [origin], db });
  const denied = await off(req("/field-compare/start", { body: { runId: run, day: "2026-11-07", playerDayHash: hash } }));
  t("default off does not call sql", denied.status === 503 && (await denied.json()).error === "collection_off" && calls.length === 0);
  const badOrigin = await on(req("/field-compare/start", { headers: { origin: "https://evil.example" }, body: { runId: run, day: "2026-11-07", playerDayHash: hash } }));
  t("origin allowlist", badOrigin.status === 403);
  const preflight = await on(new Request("http://local/field-compare/start", { method: "OPTIONS", headers: { origin } }));
  t("preflight", preflight.status === 204 && preflight.headers.get("access-control-allow-origin") === origin);
  const method = await on(req("/field-compare/start", { method: "PUT", body: {} }));
  t("method", method.status === 405);
  const schema = await on(req("/field-compare/finish", { body: { runId: run, day: "2026-02-31", playerDayHash: hash, scores: [1, 1, 1, 1, 1], secret: "nope" } }));
  t("schema and privilege field", schema.status === 400 && calls.length === 0);
  const big = await on(new Request("http://local/field-compare/finish", { method: "POST", headers: { origin, "content-type": "application/json" }, body: "x".repeat(3000) }));
  t("bounded body", big.status === 413);
  const started = await on(req("/field-compare/start", { body: { runId: run, day: "2026-11-07", playerDayHash: hash } }));
  t("start reaches sql only when on", started.status === 200 && calls.at(-1).name === "start_run");
  const rate = createFieldHandler({ collection: "on", allowedOrigins: [origin], db });
  let limited = 0;
  for (let i = 0; i < 21; i++) {
    const res = await rate(req("/field-compare/day?day=2026-11-07&runId=" + run, { method: "GET" }));
    if (res.status === 429) limited++;
  }
  t("rate limit", limited === 1);
  console.log(bad ? bad + " failures" : "field-http.test.js: all pass");
  process.exit(bad ? 1 : 0);
})();
