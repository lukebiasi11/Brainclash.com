/* Actual word-bridge checker from app.js. Extra answers are exact after the
   existing case/space normalization, plus that puzzle's own left+answer and answer+right compounds. */
const fs = require("fs"), path = require("path"), vm = require("vm");
const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < 0) throw Error("missing " + a); return src.slice(i, j); };
const code = cut("const norm = ", "\n") + "\n" + cut("function bridgeHit(", "function wordBridge");
const ctx = {};
vm.runInNewContext(code + "\nthis.bridgeHit = bridgeHit;", ctx);
let pass = 0, fail = 0;
const t = (ok, why) => { if (ok) pass++; else { fail++; console.log("FAIL", why); } };
const rain = ["RAIN", "BOX", "CHECK", "DROP"];
const single = ["HOT", "HOUSE", "DOG"];
function check(puzzle, input, exp) {
  t(ctx.bridgeHit(puzzle, input) === exp, (exp ? "accept " : "reject ") + JSON.stringify(input));
}
["check", "CHECK", "Check", " check ", "rain check", "raincheck", "checkbox", "check box", "CHECK BOX"].forEach(s => check(rain, s, true));
["drop", "DROP", "Drop", "raindrop", "rain drop", "drop box", "dropbox", "DROP BOX"].forEach(s => check(rain, s, true));
["paper", "sand", "box", "rain box", "rain", "checkdrop", "hotdog"].forEach(s => check(rain, s, false));
["dog", "DOG", " dog "].forEach(s => check(single, s, true));
["hotdog", "doghouse", "hot dog", "house"].forEach(s => check(single, s, false));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
