// Load the deployable Edge files without bundling them. No database is contacted.
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const deno = ["/tmp/deno/bin/deno", "deno"].find(bin => bin === "deno" ? true : fs.existsSync(bin));
let bad = 0;
const t = (name, ok, extra) => { if (!ok) { bad++; console.log("FAIL", name, extra || ""); } };
if (!deno) {
  console.log("FAIL deno is not installed");
  process.exit(1);
}
const source = path.join(root, "supabase/functions/field-compare");
const files = ["index.ts", "handler.js", "field-api.js", "auth.js"].map(name => fs.readFileSync(path.join(source, name), "utf8")).join("\n");
t("deployable files are ESM", files.includes("export function createFieldHandler") && files.includes("export async function verifyAnonymousClaims") && files.includes("export function validateFinish") && !files.includes("module.exports") && !files.includes("require("));

const { execFileSync } = require("child_process");
execFileSync(deno, ["check", "--no-lock", "index.ts"], { stdio: "inherit", cwd: source });

const probePath = path.join(source, ".load-probe.mjs");
fs.writeFileSync(probePath, `
import { createFieldHandler } from "./handler.js";
const handler = createFieldHandler({ collection: "off", allowedOrigins: ["https://synthetic.dailydose.invalid"] });
const denied = await handler(new Request("http://local/field-compare/start", {
  method: "POST",
  headers: { origin: "https://lukebiasi11.github.io", "content-type": "application/json" },
  body: "{}"
}));
const off = await handler(new Request("http://local/field-compare/start", {
  method: "POST",
  headers: { origin: "https://synthetic.dailydose.invalid", "content-type": "application/json" },
  body: "{}"
}));
if (denied.status !== 403 || off.status !== 503) throw new Error("handler " + denied.status + " " + off.status);
console.log("unbundled handler ok");
`);
try {
  execFileSync(deno, ["run", "--no-lock", "--allow-env", "--check", probePath], { cwd: source, stdio: "inherit" });
} finally {
  fs.unlinkSync(probePath);
}

const child = spawn(deno, ["run", "--no-lock", "--allow-net", "--allow-env", "--check", "index.ts"], {
  cwd: source,
  env: {
    ...process.env,
    FIELD_COLLECTION: "off",
    FIELD_ALLOWED_ORIGINS: "https://synthetic.dailydose.invalid",
    FIELD_DB_URL: "postgres://field_runtime@127.0.0.1:1/none",
    SUPABASE_URL: "http://127.0.0.1:9",
    SUPABASE_ANON_KEY: "sb_publishable_local_test"
  }
});
let log = "";
const ready = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("index.ts did not listen\n" + log)), 20000);
  const take = chunk => {
    log += chunk.toString();
    if (/SyntaxError|does not provide an export/.test(log)) {
      clearTimeout(timer);
      reject(new Error(log));
    }
    if (/Listening on/.test(log)) {
      clearTimeout(timer);
      resolve();
    }
  };
  child.stdout.on("data", take);
  child.stderr.on("data", take);
  child.on("exit", code => {
    clearTimeout(timer);
    reject(new Error("index.ts exited " + code + "\n" + log));
  });
});
ready.then(async () => {
  const address = (log.match(/Listening on (http:\/\/\S+)/) || [])[1];
  const origin = await fetch(address + "field-compare/start", {
    method: "POST",
    headers: { origin: "https://lukebiasi11.github.io", "content-type": "application/json" },
    body: "{}"
  });
  t("unbundled index rejects the public origin", origin.status === 403);
  child.kill("SIGTERM");
}).catch(err => {
  bad++;
  console.log("FAIL unbundled index.ts", err.message);
  child.kill("SIGTERM");
}).finally(() => {
  setTimeout(() => {
    console.log(bad ? bad + " failures" : "field-bundle.test.js: all pass");
    process.exit(bad ? 1 : 0);
  }, 300);
});
