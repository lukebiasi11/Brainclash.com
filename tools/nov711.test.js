/* Nov 7–11 English batch: date slots, one choice-based Sports question,
   exact approved wording, typed answers, and no legacy diagram left on a revised question.
   Spanish is not expanded. */
const fs = require("fs"), path = require("path"), vm = require("vm");
const A = require("../answers.js");
const root = path.join(__dirname, "..");
let pass = 0, fail = 0;
const t = (ok, why) => { if (ok) pass++; else { fail++; console.log("FAIL", why); } };
const eq = (got, exp, why) => t(JSON.stringify(got) === JSON.stringify(exp), why + " (got " + JSON.stringify(got) + ")");
const win = {};
vm.runInNewContext(fs.readFileSync(path.join(root, "content.js"), "utf8"), { window: win });
vm.runInNewContext(fs.readFileSync(path.join(root, "content.es.js"), "utf8"), { window: win });
vm.runInNewContext(fs.readFileSync(path.join(root, "anagrams.js"), "utf8"), { window: win });
const src = fs.readFileSync(path.join(root, "app.js"), "utf8");
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < 0) throw Error("missing " + a); return src.slice(i, j); };
const code = [cut("const WORD_GAMES = [", "];") + "];", cut("function keyOf(day)", "\n"), cut("function dayOfKey(k)", "\n"), cut("const pick =", "\n"),
  cut("const FROZEN = {", "// Practice replays")].join("\n");
const ctx = { window: win, C: win.CONTENT };
vm.runInNewContext(code + "\nthis.getDailySet = getDailySet;", ctx);
const day = k => ctx.getDailySet(k);
const d7 = day("2026-11-07"), d8 = day("2026-11-08"), d9 = day("2026-11-09"), d10 = day("2026-11-10"), d11 = day("2026-11-11");
const C = win.CONTENT;
eq(d7.wordGame.id, "anag", "Nov 7 word game");
eq(C.worldRush.indexOf(d7.worldRush), 38, "Nov 7 world index");
eq(C.sports.indexOf(d7.sports), 38, "Nov 7 sports index");
eq(d8.wordGame.id, "flip", "Nov 8 word game");
eq(C.wordFlip.indexOf(d8.wordFlip), 10, "Nov 8 wordFlip index");
eq(C.thinkFast.indexOf(d8.thinkFast), 19, "Nov 8 thinkFast index");
eq(d9.wordGame.id, "bridge", "Nov 9 word game");
eq([C.history.indexOf(d9.history), C.sports.indexOf(d9.sports), C.wordBridge.indexOf(d9.wordBridge), C.thinkFast.indexOf(d9.thinkFast)], [40, 40, 10, 20], "Nov 9 indexes");
eq(d10.wordGame.id, "conn", "Nov 10 word game");
eq([C.history.indexOf(d10.history), C.sports.indexOf(d10.sports), C.connections.indexOf(d10.connections), C.thinkFast.indexOf(d10.thinkFast)], [41, 41, 10, 21], "Nov 10 indexes");
eq(d11.wordGame.id, "odd", "Nov 11 word game");
eq([C.history.indexOf(d11.history), C.sports.indexOf(d11.sports), C.oddOneOut.indexOf(d11.oddOneOut), C.thinkFast.indexOf(d11.thinkFast)], [42, 42, 5, 22], "Nov 11 indexes");

const TZF = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hourCycle: "h23" });
function zoneKey(ms) {
  const p = {}; for (const x of TZF.formatToParts(new Date(ms))) if (x.type !== "literal") p[x.type] = x.value;
  return p.year + "-" + p.month + "-" + p.day;
}
eq(zoneKey(Date.parse("2026-11-07T04:59:59Z")), "2026-11-06", "NY still Nov 6 at 04:59Z");
eq(zoneKey(Date.parse("2026-11-07T05:00:00Z")), "2026-11-07", "NY Nov 7 at 05:00Z");
eq(zoneKey(Date.parse("2026-11-12T04:59:59Z")), "2026-11-11", "NY still Nov 11 at Nov 12 04:59Z");
eq(zoneKey(Date.parse("2026-11-12T05:00:00Z")), "2026-11-12", "NY Nov 12 at 05:00Z");

function choices(sports) { return sports.filter(q => ["mc", "bracket", "order", "match"].includes(q.type)).length; }
for (const [name, set] of [["Nov7", d7], ["Nov8", d8], ["Nov9", d9], ["Nov10", d10], ["Nov11", d11]]) {
  eq(set.sports.filter(q => q.type === "mc").length, 1, name + " one sports MC");
  eq(choices(set.sports), 1, name + " one choice-based sports question");
}

eq(d9.history.r1.events.map(e => [e[1], e[2]]), [
  ["Marco Polo leaves medieval Venice on his journey to Asia", 1271],
  ["The expedition begun by Magellan completes the first voyage around the world", 1522],
  ["Charles Darwin sets sail on HMS Beagle, before publishing his theory of evolution", 1831],
  ["Sojourner, NASA\u2019s first Mars rover, explores the Red Planet", 1997]
], "Nov 9 explorer events");
eq(d9.history.r2.events.map(e => [e[1], e[2]]), [
  ["Bunker Hill: colonial militia face British troops near Boston early in the American Revolution.", 1775],
  ["Yorktown: British surrender in the American Revolutionary War", 1781],
  ["Gettysburg: Union and Confederate armies clash in the U.S. Civil War", 1863],
  ["The Somme: a major battle of World War I", 1916],
  ["Midway: a major U.S.\u2013Japan naval battle in World War II", 1942]
], "Nov 9 battle events");
t(!/1775|1781|1863|1916|1942/.test(d9.history.r2.events.map(e => e[1]).join(" ")), "Nov 9 battle years stay off the card text");
eq(d9.history.r2.events.map(e => e[2]).slice().sort((a, b) => a - b), [1775, 1781, 1863, 1916, 1942], "Nov 9 battle chronology");
t(d9.history.r1.events.concat(d9.history.r2.events).every(e => e.length === 3), "Nov 9 history has no photo id");
eq(d9.sports[0].options, ["Vince Carter", "Michael Jordan", "Julius Erving", "Kobe Bryant"], "Nov 9 dunk options");
eq(d9.sports[0].a, 1, "Nov 9 dunk answer");
eq(d9.sports[1].answers.concat(d9.sports[1].aliases), ["olajuwon", "hakeem olajuwon", "akeem olajuwon", "olajuwan", "hakeem olajuwan"], "Nov 9 Olajuwon accepts");
eq(d9.sports[2].answers.concat(d9.sports[2].aliases), ["bo jackson", "bo", "vincent jackson", "vincent bo jackson"], "Nov 9 Bo accepts");
eq(d9.wordBridge, [["NEWS", "CLIP", "PAPER"], ["RAIN", "BOX", "CHECK", "DROP"], ["QUICK", "PIT", "SAND"], ["WING", "TOE", "TIP"], ["BUS", "WATCH", "STOP"], ["SPACE", "WRECK", "SHIP"]], "Nov 9 bridges");
eq(d9.thinkFast[0].answers.concat(d9.thinkFast[0].aliases), ["5", "five", "5 corners", "five corners"], "Nov 9 corners accepts");
eq(d9.thinkFast[1].answers.concat(d9.thinkFast[1].aliases), ["queue", "a queue", "the word queue"], "Nov 9 queue accepts");
t(d9.sports.every(q => !q.img), "Nov 9 sports has no legacy image");

eq(d10.history.r1.theme, "Blockbusters", "Nov 10 history r1 kept");
eq(d10.history.r1.events[0][1], "King Kong released", "Nov 10 history r1 kept");
eq(d10.history.r2.events[0][1], "Florence Nightingale opens her nursing school", "Nov 10 history r2 kept");
eq(d10.sports[0].q, "In what year did the Boston Red Sox win the World Series and end the \u201cCurse of the Bambino\u201d?", "Nov 10 Red Sox prompt");
eq(d10.sports[0].options, ["1998", "2001", "2004", "2007"], "Nov 10 Red Sox options");
eq(d10.sports[0].a, 2, "Nov 10 Red Sox answer");
eq(d10.sports[1].q, "In 1999, Brandi ___ scored the USA\u2019s winning Women\u2019s World Cup penalty against China. Fill in her surname.", "Nov 10 Chastain prompt");
eq(d10.sports[2].q, "After the Knicks and Seattle SuperSonics, Patrick Ewing finished his NBA playing career with which Orlando team?", "Nov 10 Ewing prompt");
t(d10.sports.every(q => !q.img), "Nov 10 sports does not keep the 1972 playoff diagram");
eq(d10.connections.groups.map(g => g.name), ["___ bank", "___ jacket", "Things with teeth"], "Nov 10 cluster names");
eq(d10.connections.groups.map(g => g.words), [["RIVER", "MEMORY", "PIGGY"], ["DUST", "LIFE", "STRAIT"], ["COMB", "ZIPPER", "GEAR"]], "Nov 10 cluster words");
eq(d10.thinkFast[0].answers.concat(d10.thinkFast[0].aliases), ["54", "fifty four", "fifty-four", "seat 54"], "Nov 10 seat accepts");
t(d10.thinkFast[1].q.includes("Hint: Choose a book"), "Nov 10 books hint is in the question");

eq(d11.history.r1.events[0][1], "Superman debuts in Action Comics #1", "Nov 11 r1 kept");
eq(d11.history.r2.theme, "Animated movie milestones", "Nov 11 r2 theme");
eq(d11.history.r2.events.map(e => [e[1], e[2]]), [
  ["Disney\u2019s original animated Pinocchio is released", 1940],
  ["Disney\u2019s original animated The Little Mermaid is released", 1989],
  ["Finding Nemo is released", 2003],
  ["The first Despicable Me film is released", 2010],
  ["Encanto is released", 2021]
], "Nov 11 films");
t(d11.history.r2.events.every(e => e.length === 3), "Nov 11 films have no photo id");
eq(d11.sports[0].kind, "true-false", "Nov 11 Beckham MC kept");
eq(d11.sports[1].img, "sports-m01-d11-q2", "Nov 11 unchanged Leafs swatch kept");
eq(d11.sports[1].q, "Blue and white: an Original Six NHL team from Toronto. Name the team.", "Nov 11 Leafs prompt kept");
eq(d11.sports[2].q, "Which NBA legend nicknamed \u201cThe Mailman\u201d finished with more career regular-season points than Dirk Nowitzki?", "Nov 11 Malone prompt");
t(!d11.sports[2].img, "Nov 11 Malone has no image");
eq(d11.oddOneOut[2].words, ["LEVEL", "RADAR", "CIVIC", "RIVER"], "Nov 11 imposter palindromes");
eq(d11.oddOneOut[2].odd, 3, "Nov 11 RIVER is odd");
eq(d11.oddOneOut[3].words, ["MADE", "PAID", "SAID", "LAID"], "Nov 11 imposter rhyme");
eq(d11.oddOneOut[3].odd, 2, "Nov 11 SAID is odd");
eq(d11.oddOneOut[3].prompt, "Say these words aloud. Which has a different vowel sound?", "Nov 11 sound prompt");
eq(d11.oddOneOut[3].why, "MADE, PAID and LAID rhyme, ending in /e\u026ad/. SAID is pronounced /sed/.", "Nov 11 sound explanation unchanged");
eq(d11.oddOneOut[0].why, "Chicken isn't a mammal", "Nov 11 imposter 1 kept");
eq(d11.thinkFast[0].answers.concat(d11.thinkFast[0].aliases), ["cold", "a cold", "the cold", "common cold", "a common cold", "the common cold"], "Nov 11 cold accepts");
eq(d11.thinkFast[1].q, "The day before yesterday was Thursday. What day will it be the day after tomorrow?", "Nov 11 Monday prompt kept");
eq(d11.thinkFast[1].answers, ["monday"], "Nov 11 Monday answer kept");

eq(day("2026-11-06").sports[0].q, "In what year did Atlanta host the Summer Olympics?", "Nov 6 sports untouched");
eq(day("2026-11-12").sports[0].type, "pair", "Nov 12 sports Q1 is the approved pair");
eq(day("2026-11-12").sports[0].prompt.en, "Over or Under? Pick the true side.", "Nov 12 sports Q1 prompt");

function opts(q) { return { aliases: q.aliases, wrong: q.wrong, noSurname: q.noSurname, textOnly: q.textOnly, person: q.person, given: q.given, q: q.q }; }
function check(q, input, exp) {
  t(A.checkAnswer(input, q.answers, opts(q)) === exp, (exp ? "accept " : "reject ") + JSON.stringify(input));
}
[["olajuwon", true], ["Hakeem Olajuwon", true], ["Akeem Olajuwon", true], ["olajuwan", true], ["Hakeem", false], ["Dream Shake", false]].forEach(([i, e]) => check(d9.sports[1], i, e));
[["Bo Jackson", true], ["bo", true], ["Vincent Jackson", true], ["Vincent Bo Jackson", true], ["Jackson", false], ["Deion Sanders", false]].forEach(([i, e]) => check(d9.sports[2], i, e));
[["queue", true], ["a queue", true], ["the word queue", true], ["Q", false], ["cue", false], ["line", false]].forEach(([i, e]) => check(d9.thinkFast[1], i, e));
[["Chastain", true], ["Brandi Chastain", true], ["Brandy Chastain", true], ["Brandi", false], ["Mia Hamm", false]].forEach(([i, e]) => check(d10.sports[1], i, e));
[["Magic", true], ["Orlando Magic", true], ["Orlando", false], ["Knicks", false]].forEach(([i, e]) => check(d10.sports[2], i, e));
[["54", true], ["fifty four", true], ["fifty-four", true], ["seat 54", true], ["45", false], ["9", false]].forEach(([i, e]) => check(d10.thinkFast[0], i, e));
[["120", true], ["one hundred twenty", true], ["one hundred and twenty", true], ["120 orders", true], ["120 ways", true], ["5", false]].forEach(([i, e]) => check(d10.thinkFast[1], i, e));
[["Karl Malone", true], ["Malone", true], ["Carl Malone", true], ["Karl", false], ["Moses Malone", false], ["Dirk Nowitzki", false]].forEach(([i, e]) => check(d11.sports[2], i, e));
[["cold", true], ["a cold", true], ["the common cold", true], ["flu", false], ["hot", false]].forEach(([i, e]) => check(d11.thinkFast[0], i, e));
check(d11.thinkFast[1], "Monday", true);
check(d8.sports[2], "opponent", true);
check(d8.sports[2], "your opponent", true);
check(d8.sports[2], "you", false);

const E = win.CONTENT_ES;
t(E.sports[40] == null && E.sports[41] == null && E.sports[42] == null, "no new Spanish sports for Nov 9–11");
t(E.history[40] == null && E.history[42] == null, "no new Spanish history for the revised days");
t(E.thinkFast[20] == null && E.thinkFast[21] == null && E.thinkFast[22] == null, "no new Spanish brain teasers for Nov 9–11");
t(!fs.readFileSync(path.join(root, "content.es.js"), "utf8").includes("Olajuwon"), "Spanish file was not given the new Olajuwon wording");
eq(d9.wordBridge[1].slice(0, 3), ["RAIN", "BOX", "CHECK"], "Nov 9 bridge round 2 clues stay RAIN / BOX");
eq(d9.wordBridge[1][3], "DROP", "Nov 9 bridge round 2 also accepts DROP");
eq(d11.oddOneOut[3].words, ["MADE", "PAID", "SAID", "LAID"], "Nov 11 sound round words unchanged");
eq(d11.oddOneOut[3].odd, 2, "Nov 11 sound round still marks SAID");
console.log("Existing parser notes (not changed): letter Q is rejected for queue; bare Jackson, Brandi, Orlando, Karl, and you are rejected.");
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
