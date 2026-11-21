// World flag questions use withFlag(), which marks the image inline-flag.
// At a 390px phone the card is about 366px wide, so width:100% is past the 200px floor.
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
let bad = 0;
const t = (name, ok) => { if (!ok) { bad++; console.log("FAIL", name); } else console.log("ok", name); };
const rule = (css.match(/img\.ico\.inline-flag\{[^}]+\}/) || [""])[0];
t("shared flag rule is present", rule.length > 0);
t("flag fills the card width", /width:100%/.test(rule));
t("flag keeps its aspect ratio", /height:auto/.test(rule));
t("flag has a thin border", /border:1px solid/.test(rule));
t("tiny 1.6em flag size is gone", !css.includes("inline-flag{width:1.6em"));
t("style cache is nov22w", html.includes('style.css?v=nov22w') && !html.includes('style.css?v=nov18b'));
t("withFlag still marks inline-flag", app.includes('ic("🏳️", key, "inline-flag")') || app.includes("ic(\"🏳️\", key, \"inline-flag\")"));
console.log(bad ? bad + " failed" : "flag-size.test.js: all pass");
process.exit(bad ? 1 : 0);
