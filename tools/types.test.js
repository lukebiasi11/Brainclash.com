// Scoring and schema edges for pair, reveal, and slider. Live content lists stay untouched.
const fs = require("fs"), path = require("path"), vm = require("vm");
const A = require("../answers.js");
const root = path.join(__dirname, "..");
let bad = 0;
const t = (name, got, exp) => { if (got !== exp) { bad++; console.log("FAIL", name, "->", got, "expected", exp); } };
const eq = (name, got, exp) => t(name, JSON.stringify(got), JSON.stringify(exp));

t("pair 5/5", A.pairScore(5, 5, 250), 250);
t("pair 1/5", A.pairScore(1, 5, 250), 50);
t("pair 0/5", A.pairScore(0, 5, 250), 0);
t("pair 3/5", A.pairScore(3, 5, 250), 150);
t("pair 4/5 of 100", A.pairScore(4, 5, 100), 80);
t("pair clamps extra", A.pairScore(9, 5, 250), 250);
t("pair negative", A.pairScore(-1, 5, 250), 0);
t("pair no rounds", A.pairScore(1, 0, 250), 0);
t("pair bad value", A.pairScore(1, 5, "nope"), 0);

t("reveal clue 1", A.revealScore(1, 300), 300);
t("reveal clue 2", A.revealScore(2, 300), 200);
t("reveal clue 3", A.revealScore(3, 300), 100);
t("reveal clue 2 of 250", A.revealScore(2, 250), 167);
t("reveal clue 3 of 400", A.revealScore(3, 400), 133);
t("reveal wrong", A.revealScore(0, 300), 0);
t("reveal past end", A.revealScore(4, 300), 0);

const wall = { tolerance: 0, falloff: 25 };
t("slider exact", A.sliderScore(1989, 1989, 300, wall), 300);
t("slider half", A.sliderScore(1989 + 12.5, 1989, 300, wall), 150);
t("slider edge", A.sliderScore(2014, 1989, 300, wall), 0);
t("slider outside", A.sliderScore(2015, 1989, 300, wall), 0);
t("slider defaults", A.sliderScore(88, 88, 200), 200);
t("slider default falloff", A.sliderScore(88 + 25, 88, 200), 0);
t("slider band full", A.sliderScore(90, 88, 200, { tolerance: 2, falloff: 20 }), 200);
t("slider band mid", A.sliderScore(99, 88, 200, { tolerance: 2, falloff: 20 }), 100);
t("slider band zero", A.sliderScore(108, 88, 200, { tolerance: 2, falloff: 20 }), 0);
t("slider no slope inside", A.sliderScore(10, 10, 100, { tolerance: 5, falloff: 5 }), 100);
t("slider no slope outside", A.sliderScore(16, 10, 100, { tolerance: 5, falloff: 5 }), 0);
t("slider junk", A.sliderScore("1989", 1989, 300, wall), 0);
t("slider negative value", A.sliderScore(1, 1, -5, wall), 0);

eq("split short first name", A.splitAccept(["Serena", "Bo", "Serena Williams", "  ", "S. Williams"]), { aliases: ["Serena", "Serena Williams", "S. Williams"], given: ["Bo"] });
const serena = A.splitAccept(["Serena", "Serena Williams"]);
t("accept Serena exact", A.checkAnswer("serena", ["Serena Williams"], { aliases: serena.aliases, given: serena.given, q: "Who is this?" }), true);
t("accept full name", A.checkAnswer("Serena Williams!", ["Serena Williams"], { aliases: serena.aliases, given: serena.given, q: "Who is this?" }), true);
t("accept typo of full name", A.checkAnswer("Serena Wiliams", ["Serena Williams"], { aliases: serena.aliases, given: serena.given, q: "Who is this?" }), true);
t("reject other player", A.checkAnswer("Venus Williams", ["Serena Williams"], { aliases: serena.aliases, given: serena.given, q: "Who is this?" }), false);
t("reject empty", A.checkAnswer("  ", ["Serena Williams"], { aliases: serena.aliases, given: serena.given, q: "Who is this?" }), false);
const brett = A.splitAccept(["Brett", "Bret"]);
t("short accept is exact", A.checkAnswer("Brett", ["Favre"], { aliases: brett.aliases, given: brett.given, q: "Who?" }), true);
t("short accept is not fuzzy", A.checkAnswer("brent", ["Favre"], { aliases: brett.aliases, given: brett.given, q: "Who?" }), false);

const content = fs.readFileSync(path.join(root, "content.js"), "utf8") + fs.readFileSync(path.join(root, "content.es.js"), "utf8");
t("live content has no pair", /"type"\s*:\s*"pair"/.test(content), false);
t("live content has no reveal", /"type"\s*:\s*"reveal"/.test(content), false);
t("live content has no slider", /"type"\s*:\s*"slider"/.test(content), false);

const win = {};
vm.runInNewContext(fs.readFileSync(path.join(root, "demo-types.js"), "utf8"), { window: win });
const demo = win.TYPE_DEMO;
t("demo count", demo.length, 6);
t("demo types", demo.map(q => q.type).join(","), "pair,pair,reveal,reveal,slider,slider");
t("pair rounds", demo.filter(q => q.type === "pair").every(q => q.rounds.length === 5 && q.rounds.every(r => r.correct === "left" || r.correct === "right")), true);
t("reveal clues easiest last", demo.filter(q => q.type === "reveal").every(q => q.clues.length === 3 && q.answer && q.accept.length), true);
t("slider wall", demo.find(q => q.answer === 1989).unit, "year");

console.log(bad ? bad + " failures" : "types.test.js: all pass");
process.exit(bad ? 1 : 0);
