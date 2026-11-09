const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
let bad = 0;
const t = (name, ok, extra) => { if (!ok) { bad++; console.log("FAIL", name, extra || ""); } };
const origin = "https://lukebiasi11.github.io";
const run = "11111111-1111-4111-8111-111111111111";
const uid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const root = path.join(__dirname, "..");
function req(pathname, { method = "POST", body, headers = {} } = {}) {
  return new Request("http://local" + pathname, {
    method,
    headers: { origin, "content-type": "application/json", authorization: "Bearer session", ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body)
  });
}
function dbFor(counts) {
  const calls = [];
  return {
    calls,
    async call(name, args) {
      calls.push({ name, args });
      if (name === "consume_rate") {
        const key = args[0];
        counts.set(key, (counts.get(key) || 0) + 1);
        if (counts.get(key) > 20) return { ok: false, error: "rate_limited" };
      }
      return { ok: true, from: name };
    }
  };
}
const claims = {
  async session() { return { data: { claims: { role: "authenticated", is_anonymous: true, sub: uid } } }; },
  async publishable() { return { data: { claims: { role: "anon", sub: uid } } }; },
  async broken() { return { error: { message: "rejected" } }; }
};

(async () => {
  const { createFieldHandler } = await import(pathToFileURL(path.join(__dirname, "../supabase/functions/field-compare/handler.js")).href);
  const counts = new Map();
  const db = dbFor(counts);
  const on = createFieldHandler({ collection: "on", allowedOrigins: [origin], db, getClaims: claims.session });
  const off = createFieldHandler({ collection: "off", allowedOrigins: [origin], db, getClaims: claims.session });
  const denied = await off(req("/field-compare/start", { body: { runId: run, day: "2026-11-07" } }));
  t("default off does not call sql", denied.status === 503 && (await denied.json()).error === "collection_off" && db.calls.length === 0);
  const badOrigin = await on(req("/field-compare/start", { headers: { origin: "https://evil.example" }, body: { runId: run, day: "2026-11-07" } }));
  t("origin allowlist", badOrigin.status === 403);
  const preflight = await on(new Request("http://local/field-compare/start", { method: "OPTIONS", headers: { origin } }));
  t("preflight", preflight.status === 204 && preflight.headers.get("access-control-allow-origin") === origin);
  const method = await on(req("/field-compare/start", { method: "PUT", body: {} }));
  t("method", method.status === 405);
  const remove = await on(req("/field-compare/start", { method: "DELETE" }));
  t("no deletion route", remove.status === 405 && !db.calls.some(call => call.name === "deletion_request"));
  const missing = await on(req("/field-compare/start", { headers: { authorization: "" }, body: { runId: run, day: "2026-11-07" } }));
  t("missing session", missing.status === 401 && (await missing.json()).error === "identity_required");
  const keyOnly = createFieldHandler({ collection: "on", allowedOrigins: [origin], db, getClaims: claims.publishable });
  const publicKey = await keyOnly(req("/field-compare/start", { headers: { authorization: "Bearer publishable-key" }, body: { runId: run, day: "2026-11-07" } }));
  t("publishable key is not a session", publicKey.status === 401 && (await publicKey.json()).error === "anonymous_required");
  const rejected = createFieldHandler({ collection: "on", allowedOrigins: [origin], db, getClaims: claims.broken });
  const badToken = await rejected(req("/field-compare/start", { body: { runId: run, day: "2026-11-07" } }));
  t("rejected claims", badToken.status === 401);
  const schema = await on(req("/field-compare/finish", { body: { runId: run, day: "2026-02-31", playerDayHash: "player-a", scores: [1, 1, 1, 1, 1], secret: "nope" } }));
  t("schema and privilege field", schema.status === 400 && !db.calls.some(call => call.name === "finish_run"));
  const big = await on(req("/field-compare/finish", { body: "x".repeat(3000) }));
  t("declared body cap", big.status === 413);
  const wide = await on(req("/field-compare/finish", { body: "é".repeat(1100) }));
  t("utf-8 byte cap", wide.status === 413 && "é".repeat(1100).length < 2048);
  let pulled = false;
  const early = await on(new Request("http://local/field-compare/finish", {
    method: "POST",
    duplex: "half",
    headers: { origin, "content-type": "application/json", "content-length": "99999", authorization: "Bearer session" },
    body: new ReadableStream({ pull(controller) { pulled = true; controller.enqueue(new Uint8Array([123])); controller.close(); } })
  }));
  t("content-length rejects before read", early.status === 413 && pulled === false);
  let cancelled = false;
  const chunked = await on(new Request("http://local/field-compare/finish", {
    method: "POST",
    duplex: "half",
    headers: { origin, "content-type": "application/json", authorization: "Bearer session" },
    body: new ReadableStream({
      pull(controller) { controller.enqueue(new Uint8Array(1500)); },
      cancel() { cancelled = true; }
    })
  }));
  t("chunked oversize cancels", chunked.status === 413 && cancelled === true);
  let lied = false;
  const untrusted = await on(new Request("http://local/field-compare/finish", {
    method: "POST",
    duplex: "half",
    headers: { origin, "content-type": "application/json", "content-length": "10", authorization: "Bearer session" },
    body: new ReadableStream({
      pull(controller) { controller.enqueue(new Uint8Array(3000)); },
      cancel() { lied = true; }
    })
  }));
  t("short content-length is not trusted", untrusted.status === 413 && lied === true);
  const invalidUtf = await on(new Request("http://local/field-compare/finish", {
    method: "POST",
    duplex: "half",
    headers: { origin, "content-type": "application/json", authorization: "Bearer session" },
    body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([0xff, 0xfe])); controller.close(); } })
  }));
  t("invalid utf-8", invalidUtf.status === 400 && (await invalidUtf.json()).error === "invalid_input");
  const started = await on(req("/field-compare/start", { body: { runId: run, day: "2026-11-07" } }));
  t("start reaches sql only when on", started.status === 200 && db.calls.at(-1).name === "start_run" && db.calls.at(-1).args[2] === uid);
  const rateDb = dbFor(new Map());
  const rate = createFieldHandler({ collection: "on", allowedOrigins: [origin], db: rateDb, getClaims: claims.session });
  let limited = 0;
  for (let i = 0; i < 25; i++) {
    const id = `22222222-2222-4222-8222-${String(i).padStart(12, "0")}`;
    const res = await rate(req("/field-compare/day?day=2026-11-07&runId=" + id, { method: "GET" }));
    if (res.status === 429) limited++;
  }
  t("rotated run ids share the identity ceiling", limited === 5 && rateDb.calls.filter(call => call.name === "consume_rate").every(call => call.args[0] === uid));
  const handler = fs.readFileSync(path.join(root, "supabase/functions/field-compare/handler.js"), "utf8");
  const entry = fs.readFileSync(path.join(root, "supabase/functions/field-compare/index.ts"), "utf8");
  t("no process-local counter", !handler.includes("new Map") && !handler.includes("request.text("));
  t("entry verifies claims as the writer role", entry.includes("Deno.serve") && entry.includes("app_writer") && entry.includes("getClaims"));
  console.log(bad ? bad + " failures" : "field-http.test.js: all pass");
  process.exit(bad ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
