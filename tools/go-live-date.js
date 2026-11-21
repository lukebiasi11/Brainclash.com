// Not part of the default test suite. Exits 0 when NOTICE_LAST_UPDATED is a
// YYYY-MM-DD. Exits 1 if that value is missing or still the placeholder.
// The public board stays off until LEADERBOARD_PUBLIC=on.
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "field-config.js"), "utf8");
const found = src.match(/NOTICE_LAST_UPDATED:\s*"([^"]+)"/);
if (!found) {
  console.error("NOTICE_LAST_UPDATED is missing");
  process.exit(1);
}
if (found[1] === "GO_LIVE_DATE_TBD") {
  console.error("GO_LIVE_DATE_TBD is still unset. Set NOTICE_LAST_UPDATED to the go-live day (YYYY-MM-DD) before LEADERBOARD_PUBLIC=on.");
  process.exit(1);
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(found[1])) {
  console.error("NOTICE_LAST_UPDATED must be YYYY-MM-DD, got " + found[1]);
  process.exit(1);
}
console.log("go-live date " + found[1]);
