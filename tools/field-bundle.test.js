// Typecheck and bundle the Edge entry. No server is started and no database is contacted.
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const root = path.join(__dirname, "..");
const deno = ["/tmp/deno/bin/deno", "deno"].find(bin => {
  try { return bin === "deno" || fs.existsSync(bin); } catch { return false; }
});
let bad = 0;
const t = (name, ok, extra) => { if (!ok) { bad++; console.log("FAIL", name, extra || ""); } };
if (!deno) {
  console.log("FAIL deno is not installed");
  process.exit(1);
}
const source = path.join(root, "supabase/functions/field-compare");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "field-bundle-"));
const copied = path.join(scratch, "field-compare");
fs.cpSync(source, copied, { recursive: true });
const parentApi = path.join(root, "supabase/field-api.js");
t("function directory does not require the parent validator", !fs.readFileSync(path.join(copied, "handler.js"), "utf8").includes("../"));
execFileSync(deno, ["check", path.join(copied, "index.ts")], { stdio: "inherit", cwd: copied });
const bundle = path.join(scratch, "field-compare.bundle.js");
execFileSync(deno, ["bundle", "--output", bundle, path.join(copied, "index.ts")], { stdio: "inherit", cwd: copied });
const text = fs.readFileSync(bundle, "utf8");
const sources = ["index.ts", "handler.js", "field-api.js", "auth.js"].map(name => fs.readFileSync(path.join(copied, name), "utf8")).join("\n");
t("bundle contains the handler", text.includes("readCappedBody") && text.includes("verifyAnonymousClaims") && !text.includes('"./handler.js"'));
t("bundle contains the colocated validator", text.includes("playerDayHash") && !text.includes(parentApi));
t("bundle keeps the runtime login check", text.includes("field_runtime") && text.includes("app_writer"));
t("function sources have no secret", !sources.includes("sb_secret") && !/password\s*=\s*["']/.test(sources) && !/postgres:\/\/[^"'\s]*:[^"'\s]*@/.test(text));
console.log(bad ? bad + " failures" : "field-bundle.test.js: all pass");
process.exit(bad ? 1 : 0);
