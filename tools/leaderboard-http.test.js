// node tools/leaderboard-http.test.js — handler only. No hosted project.
const path = require("path");
const { pathToFileURL } = require("url");
let bad = 0;
const t = (name, ok, extra) => { if (!ok) { bad++; console.log("FAIL", name, extra || ""); } else console.log("ok", name); };
const origin = "https://dailydosetrivia.com";
const uid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function req(pathname, { method = "POST", body, headers = {}, search = "" } = {}) {
  return new Request("http://local" + pathname + search, {
    method,
    headers: { origin, "content-type": "application/json", authorization: "Bearer session", ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body)
  });
}

(async () => {
  const { createBoardHandler, PUBLIC_ORIGINS } = await import(pathToFileURL(path.join(__dirname, "../supabase/functions/leaderboard/handler.js")).href);
  t("public origins match the site", PUBLIC_ORIGINS.join(",") === "https://lukebiasi11.github.io,https://dailydosetrivia.com,https://www.dailydosetrivia.com");
  const calls = [];
  const db = {
    async call(name, args) {
      calls.push({ name, args });
      if (name === "board_consume_rate") return { ok: true };
      if (name === "board_post" && String(args[2]).toLowerCase().includes("daily")) return { ok: false, error: "name_rejected", reason: "impersonation" };
      if (name === "board_public") return { ok: true, served: true, rows: [{ rank: 1, name: "Luna", score: 100 }] };
      if (name === "board_rename") return { ok: true, name: args[1] };
      if (name === "board_remove") return { ok: true, removed: true };
      if (name === "board_admin_list") return { ok: true, rows: [{ id, name: "Luna", score: 100, scores: [20, 20, 20, 20, 20] }] };
      return { ok: true };
    }
  };
  const claims = async () => ({ data: { claims: { role: "authenticated", is_anonymous: true, sub: uid } } });
  const on = createBoardHandler({ publicBoard: "on", operatorKey: "op-secret", allowedOrigins: PUBLIC_ORIGINS, db, getClaims: claims });
  const off = createBoardHandler({ publicBoard: "off", operatorKey: "", allowedOrigins: PUBLIC_ORIGINS, db, getClaims: claims });
  const closed = await off(req("/leaderboard/board", { method: "GET", search: "?day=2026-11-21&section=overall" }));
  t("board stays closed", closed.status === 503 && (await closed.json()).error === "board_off" && calls.length === 0);
  const denied = await on(req("/leaderboard/board", { method: "GET", search: "?day=2026-11-21&section=overall", headers: { origin: "https://evil.example" } }));
  t("origin denied", denied.status === 403);
  const year = await on(req("/leaderboard/post", { body: { day: "2026-11-21", name: "Luna", scores: [1, 1, 1, 1, 1], eligible: true, year: 1990 } }));
  t("year is rejected and not stored", year.status === 400 && calls.length === 0);
  const ineligible = await on(req("/leaderboard/post", { body: { day: "2026-11-21", name: "Luna", scores: [1, 1, 1, 1, 1], eligible: false } }));
  t("ineligible does not post", ineligible.status === 400 && (await ineligible.json()).error === "not_eligible" && calls.length === 0);
  const slur = await on(req("/leaderboard/post", { body: { day: "2026-11-21", name: "Daily Dose", scores: [1, 1, 1, 1, 1], eligible: true } }));
  const slurBody = await slur.json();
  t("server rejects the name", slur.status === 400 && slurBody.error === "name_rejected" && !JSON.stringify(slurBody).includes("Daily"));
  calls.length = 0;
  const posted = await on(req("/leaderboard/post", { body: { day: "2026-11-21", name: "Luna", scores: [10, 20, 30, 40, 50], eligible: true } }));
  const postedBody = await posted.json();
  t("eligible post reaches sql", posted.status === 200 && postedBody.ok === true && calls.some(c => c.name === "board_post" && c.args[0] === uid && c.args[2] === "Luna"));
  const board = await on(req("/leaderboard/board", { method: "GET", search: "?day=2026-11-21&section=world" }));
  const boardBody = await board.json();
  t("public rows are name and score", board.status === 200 && boardBody.rows[0].name === "Luna" && boardBody.rows[0].score === 100 && !("id" in boardBody.rows[0]) && !JSON.stringify(boardBody).includes(uid));
  const noKey = await off(req("/leaderboard/rename", { body: { id, name: "Nico" }, headers: { "x-board-operator": "op-secret" } }));
  t("unset operator key stays closed", noKey.status === 503 && (await noKey.json()).error === "operator_unconfigured");
  const badKey = await on(req("/leaderboard/remove", { body: { id }, headers: { "x-board-operator": "nope" } }));
  t("wrong operator key", badKey.status === 401);
  const renamed = await on(req("/leaderboard/rename", { body: { id, name: "Nico" }, headers: { "x-board-operator": "op-secret" } }));
  t("operator rename", renamed.status === 200 && (await renamed.json()).name === "Nico");
  const removed = await on(req("/leaderboard/remove", { body: { id }, headers: { "x-board-operator": "op-secret" } }));
  t("operator remove", removed.status === 200 && (await removed.json()).removed === true);
  const src = require("fs").readFileSync(path.join(__dirname, "../supabase/functions/leaderboard/index.ts"), "utf8");
  t("runtime login is board_runtime", src.includes('role !== "board_runtime"') && !src.includes("set_config('role'") && !src.includes("SERVICE_ROLE"));
  const wf = require("fs").readFileSync(path.join(__dirname, "../.github/workflows/retain-board-names.yml"), "utf8");
  t("retention workflow is disabled", /if:\s*\$\{\{\s*false\s*\}\}/.test(wf) && !/^on:\s*\n\s*schedule:/m.test(wf) && wf.includes("select private.retain_board_names();"));
  console.log(bad ? bad + " failures" : "leaderboard-http.test.js: all pass");
  process.exit(bad ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
