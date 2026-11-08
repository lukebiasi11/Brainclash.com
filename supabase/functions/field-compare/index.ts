// Deployable entry. Local tests bundle this file and do not start the server.
// FIELD_DB_URL must log in as field_runtime. That role has no password in git.
// Each call checks session_user, then SET ROLE app_writer. A superuser URL fails
// closed. getClaims is the session check; platform verify_jwt is not.
// Anonymous sign-ins stay disabled in config.toml.
// https://supabase.com/docs/guides/auth/auth-anonymous
// https://supabase.com/docs/guides/auth/signing-keys
// https://supabase.com/docs/reference/javascript/auth-getclaims
import { createClient } from "npm:@supabase/supabase-js@2";
import postgres from "npm:postgres@3.4.5";
import { createFieldHandler } from "./handler.js";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const publishable = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const authClient = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
const allowed = (Deno.env.get("FIELD_ALLOWED_ORIGINS") ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);
const sql = postgres(Deno.env.get("FIELD_DB_URL") ?? "", { max: 1, prepare: false });

type SqlArg = string | number | number[] | null;

async function call(name: string, args: SqlArg[]) {
  if (name !== "consume_rate" && name !== "start_run" && name !== "finish_run" && name !== "day_snapshot") {
    return { ok: false, error: "db_error" };
  }
  try {
    const rows = await sql.begin(async (tx) => {
      const who = await tx`select session_user as role`;
      if (who[0]?.role !== "field_runtime") return [{ result: { ok: false, error: "db_error" } }];
      await tx`select set_config('role', 'app_writer', true)`;
      if (name === "consume_rate") return await tx`select private.consume_rate(${args[0]}::uuid) as result`;
      if (name === "start_run") return await tx`select private.start_run(${args[0]}::uuid, ${args[1]}::date, ${args[2]}::uuid) as result`;
      if (name === "finish_run") return await tx`select private.finish_run(${args[0]}::uuid, ${args[1]}::date, ${args[2]}::uuid, ${args[3]}::int[]) as result`;
      return await tx`select private.day_snapshot(${args[0]}::date, ${args[1]}::uuid, ${args[2]}::uuid) as result`;
    });
    return rows[0]?.result ?? { ok: false, error: "db_error" };
  } catch {
    return { ok: false, error: "db_error" };
  }
}

Deno.serve(createFieldHandler({
  collection: Deno.env.get("FIELD_COLLECTION") === "on" ? "on" : "off",
  allowedOrigins: allowed,
  getClaims: (jwt: string) => authClient.auth.getClaims(jwt),
  db: { call }
}));
