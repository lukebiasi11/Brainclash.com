// Deployable entry. Local tests load this file without bundling it.
// BOARD_DB_URL must log in as board_runtime. That role has no password in git.
// Each call checks session_user. It does not become app_writer.
// LEADERBOARD_PUBLIC must be the string on. Anything else keeps reads and posts closed.
// LEADERBOARD_OPERATOR_KEY is required for rename and remove. It is not committed.
import { createClient } from "npm:@supabase/supabase-js@2";
import postgres from "npm:postgres@3.4.5";
import { createBoardHandler } from "./handler.js";
import { reportDbFailure } from "./db-log.js";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const publishable = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const authClient = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
const allowed = (Deno.env.get("BOARD_ALLOWED_ORIGINS") ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);
const sql = postgres(Deno.env.get("BOARD_DB_URL") ?? "", { max: 1, prepare: false, ssl: "require" });

type SqlArg = string | number | number[] | null;

const NAMES = new Set(["board_consume_rate", "board_post", "board_public", "board_me", "board_admin_list", "board_rename", "board_remove", "board_check_name"]);

async function call(name: string, args: SqlArg[]) {
  if (!NAMES.has(name)) return { ok: false, error: "db_unavailable" };
  let stage = "connect";
  try {
    const rows = await sql.begin(async (tx) => {
      stage = "connect";
      const who = await tx`select session_user as role`;
      const role = who[0]?.role;
      if (role !== "board_runtime") {
        const rejected = new Error(typeof role === "string" && /^[a-z_][a-z0-9_]{0,62}$/.test(role)
          ? `session role was not the runtime login (${role})`
          : "session role was not the runtime login");
        throw rejected;
      }
      stage = name;
      if (name === "board_consume_rate") return await tx`select private.board_consume_rate(${args[0]}::uuid) as result`;
      if (name === "board_post") return await tx`select private.board_post(${args[0]}::uuid, ${args[1]}::date, ${args[2]}::text, ${args[3]}::int[]) as result`;
      if (name === "board_public") return await tx`select private.board_public(${args[0]}::date, ${args[1]}::text) as result`;
      if (name === "board_me") return await tx`select private.board_me(${args[0]}::date, ${args[1]}::text, ${args[2]}::uuid) as result`;
      if (name === "board_admin_list") return await tx`select private.board_admin_list(${args[0]}::date) as result`;
      if (name === "board_rename") return await tx`select private.board_rename(${args[0]}::uuid, ${args[1]}::text) as result`;
      if (name === "board_check_name") return await tx`select private.board_check_name(${args[0]}::text) as result`;
      return await tx`select private.board_remove(${args[0]}::uuid) as result`;
    });
    const result = rows[0]?.result;
    if (!result || typeof result !== "object") {
      reportDbFailure(stage, new Error("empty database result"));
      return { ok: false, error: "db_unavailable" };
    }
    return result;
  } catch (error) {
    reportDbFailure(stage, error);
    return { ok: false, error: "db_unavailable" };
  }
}

Deno.serve(createBoardHandler({
  publicBoard: Deno.env.get("LEADERBOARD_PUBLIC") === "on" ? "on" : "off",
  operatorKey: Deno.env.get("LEADERBOARD_OPERATOR_KEY") ?? "",
  allowedOrigins: allowed,
  getClaims: (jwt: string) => authClient.auth.getClaims(jwt),
  db: { call }
}));
