/* Nov 7–8 2026 English batch. Exact approved wording, one choice-based Sports
   question per day, America/New_York date slots, and the typed tennis answer.
   Spanish is not updated here: stale ES slots are reported, not translated. */
const fs = require("fs"), path = require("path"), vm = require("vm");
const A = require("../answers.js");
const root = path.join(__dirname, "..");
let pass = 0, fail = 0;
const t = (ok, why) => { if (ok) pass++; else { fail++; console.log("FAIL", why); } };
const eq = (got, exp, why) => t(got === exp, why + " (got " + JSON.stringify(got) + ")");

const win = {};
vm.runInNewContext(fs.readFileSync(path.join(root, "content.js"), "utf8"), { window: win });
vm.runInNewContext(fs.readFileSync(path.join(root, "content.es.js"), "utf8"), { window: win });
vm.runInNewContext(fs.readFileSync(path.join(root, "anagrams.js"), "utf8"), { window: win });
const src = fs.readFileSync(path.join(root, "app.js"), "utf8");
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < 0) throw Error("missing " + a); return src.slice(i, j); };
const code = [cut("const WORD_GAMES = [", "];") + "];", cut("function keyOf(day)", "\n"), cut("function dayOfKey(k)", "\n"), cut("const pick =", "\n"),
  cut("const FROZEN = {", "// Practice replays")].join("\n");
const ctx = { window: win, C: win.CONTENT, console };
vm.runInNewContext(code + "\nthis.getDailySet = getDailySet; this.dayOfKey = dayOfKey; this.keyOf = keyOf;", ctx);

const nov7 = ctx.getDailySet("2026-11-07"), nov8 = ctx.getDailySet("2026-11-08");
const nov6 = ctx.getDailySet("2026-11-06"), nov9 = ctx.getDailySet("2026-11-09");
eq(nov7.wordGame.id, "anag", "Nov 7 word game");
eq(nov8.wordGame.id, "flip", "Nov 8 word game");
eq(win.CONTENT.worldRush.indexOf(nov7.worldRush), 38, "Nov 7 worldRush index");
eq(win.CONTENT.sports.indexOf(nov7.sports), 38, "Nov 7 sports index");
eq(win.CONTENT.worldRush.indexOf(nov8.worldRush), 39, "Nov 8 worldRush index");
eq(win.CONTENT.sports.indexOf(nov8.sports), 39, "Nov 8 sports index");
eq(win.CONTENT.thinkFast.indexOf(nov8.thinkFast), 19, "Nov 8 thinkFast index");
eq(win.CONTENT.wordFlip.indexOf(nov8.wordFlip), 10, "Nov 8 wordFlip index");
eq(win.CONTENT.thinkFast.indexOf(nov7.thinkFast), 47, "Nov 7 thinkFast index unchanged slot");

// America/New_York. Nov 7–8 2026 are EST (UTC−5); DST ended 2026-11-01.
const TZF = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
function zoneKey(ms) {
  const p = {}; for (const x of TZF.formatToParts(new Date(ms))) p[x.type] = x.value;
  if (p.hour === "24") p.hour = "00";
  return p.year + "-" + p.month + "-" + p.day;
}
eq(zoneKey(Date.parse("2026-11-07T04:59:59Z")), "2026-11-06", "04:59Z Nov 7 is still Nov 6 in New York");
eq(zoneKey(Date.parse("2026-11-07T05:00:00Z")), "2026-11-07", "05:00Z Nov 7 is Nov 7 in New York");
eq(zoneKey(Date.parse("2026-11-08T04:59:59Z")), "2026-11-07", "04:59Z Nov 8 is still Nov 7 in New York");
eq(zoneKey(Date.parse("2026-11-08T05:00:00Z")), "2026-11-08", "05:00Z Nov 8 is Nov 8 in New York");
eq(zoneKey(Date.parse("2026-11-09T04:59:59Z")), "2026-11-08", "04:59Z Nov 9 is still Nov 8 in New York");
eq(zoneKey(Date.parse("2026-11-09T05:00:00Z")), "2026-11-09", "05:00Z Nov 9 is Nov 9 in New York");

// World Nov 7: Tirana kept, Honolulu pin, Giza MC. Nov 8 world untouched.
eq(nov7.worldRush.pins[0].name, "Tirana, Albania", "Nov 7 pin 1 name");
eq(nov7.worldRush.pins[0].lat, 41.33, "Nov 7 pin 1 lat");
eq(nov7.worldRush.pins[0].lon, 19.82, "Nov 7 pin 1 lon");
eq(nov7.worldRush.pins[1].name, "Honolulu, Hawaii, USA", "Nov 7 pin 2 name");
eq(nov7.worldRush.pins[1].lat, 21.3069, "Nov 7 Honolulu lat");
eq(nov7.worldRush.pins[1].lon, -157.8583, "Nov 7 Honolulu lon");
eq(nov7.worldRush.mc.q, "The Pyramids of Giza are in which country?", "Nov 7 world MC prompt");
eq(JSON.stringify(nov7.worldRush.mc.options), JSON.stringify(["Egypt", "Mexico", "Greece", "India"]), "Nov 7 world MC options");
eq(nov7.worldRush.mc.a, 0, "Nov 7 world MC answer index");
eq(nov8.worldRush.pins[0].name, "Vienna, Austria", "Nov 8 world pin 1 unchanged");
eq(nov8.worldRush.mc.q, "Which is the largest island in the world?", "Nov 8 world MC unchanged");

function choiceCount(day) {
  return day.filter(q => q.type === "mc" || q.type === "bracket" || q.type === "order" || q.type === "match").length;
}
eq(nov7.sports.filter(q => q.type === "mc").length, 1, "Nov 7 exactly one sports MC");
eq(choiceCount(nov7.sports), 1, "Nov 7 exactly one choice-based sports question");
eq(nov8.sports.filter(q => q.type === "mc").length, 1, "Nov 8 exactly one sports MC");
eq(choiceCount(nov8.sports), 1, "Nov 8 exactly one choice-based sports question");
eq(nov8.sports.some(q => q.type === "bracket"), false, "Nov 8 sports has no bracket");

const s7 = nov7.sports, s8 = nov8.sports;
eq(s7[0].q, "In tennis, what is a 40\u201340 score called?", "Nov 7 sports Q1 prompt");
eq(JSON.stringify(s7[0].options), JSON.stringify(["Love", "Deuce", "Advantage", "Match point"]), "Nov 7 sports Q1 options");
eq(s7[0].a, 1, "Nov 7 sports Q1 answer is Deuce");
eq(s7[0].type, "mc", "Nov 7 sports Q1 type");
eq(s7[1].q, "Blue and orange: the NHL team from Alberta's capital. Name the team.", "Nov 7 Oilers prompt kept");
eq(JSON.stringify(s7[1].answers), JSON.stringify(["oilers", "edmonton oilers"]), "Nov 7 Oilers answers kept");
eq(JSON.stringify(s7[1].aliases), JSON.stringify(["oiler"]), "Nov 7 Oilers aliases kept");
eq(JSON.stringify(s7[1].wrong), JSON.stringify(["edmonton", "flames", "calgary flames"]), "Nov 7 Oilers wrong kept");
eq(s7[1].img, "sports-m01-d7-q2", "Nov 7 Oilers art kept");
eq(s7[2].type, "text", "Nov 7 sports Q3 typed");
eq(s7[2].kind, "common-teammate", "Nov 7 sports Q3 kind");
eq(s7[2].q, "Name the one player who was a teammate (same team, same season) of all five of these players.", "Nov 7 teammate prompt");
eq(JSON.stringify(s7[2].clues), JSON.stringify(["Kobe Bryant", "Dwyane Wade", "Steve Nash", "LeBron James", "Kevin Garnett"]), "Nov 7 teammate clues");
eq(s7[2].explain, "Bryant\u2014Lakers; Wade\u2014Heat; Nash\u2014Suns; James\u2014Cavaliers; Garnett\u2014Celtics.", "Nov 7 teammate explanation");

eq(s8[0].q, "Which happened first?", "Nov 8 sports Q1 prompt");
eq(s8[0].kind, "which-first", "Nov 8 sports Q1 kind");
eq(JSON.stringify(s8[0].options), JSON.stringify(["Serena Williams wins her first US Open singles title", "Lionel Messi wins the men\u2019s World Cup with Argentina"]), "Nov 8 sports Q1 options");
eq(s8[0].a, 0, "Nov 8 sports Q1 answer index");
eq(s8[1].q, "No. 4 \u2014 Green Bay Packers quarterback, the only player to win three straight NFL MVP awards. Who?", "Nov 8 Favre prompt kept");
eq(JSON.stringify(s8[1].answers), JSON.stringify(["brett favre", "favre"]), "Nov 8 Favre answers kept");
eq(JSON.stringify(s8[1].wrong), JSON.stringify(["brett", "packers", "green bay"]), "Nov 8 Favre wrong kept");
eq(s8[1].img, "sports-m01-d8-q2", "Nov 8 Favre art kept");
eq(s8[2].type, "text", "Nov 8 sports Q3 typed");
t(s8[2].kind == null, "Nov 8 sports Q3 is not a bracket/MC kind");
eq(s8[2].q, "In an ordinary singles tennis rally (not wheelchair tennis), your opponent\u2019s shot bounces twice on your side before you return it. Who wins the point?", "Nov 8 tennis prompt");
eq(JSON.stringify(s8[2].answers), JSON.stringify(["your opponent", "opponent"]), "Nov 8 tennis answers");

const tf = nov8.thinkFast;
eq(tf[0].q, "An ice-cream shop has vanilla, chocolate, strawberry and mint. You choose two DIFFERENT flavours. Swapping their order does not make a new pair. How many pairs can you choose?", "Nov 8 brain Q1 prompt");
eq(JSON.stringify(tf[0].answers), JSON.stringify(["6", "six", "6 pairs", "six pairs"]), "Nov 8 brain Q1 answers");
eq(tf[0].explain, "vanilla\u2013chocolate, vanilla\u2013strawberry, vanilla\u2013mint, chocolate\u2013strawberry, chocolate\u2013mint, strawberry\u2013mint.", "Nov 8 brain Q1 explanation");
eq(tf[1].q, "Ava, Ben and Cy finish a race with no ties. Ava isn\u2019t first. Ben finishes ahead of Cy. Who finishes first?", "Nov 8 brain Q2 prompt");
eq(JSON.stringify(tf[1].answers), JSON.stringify(["ben", "ben finishes first"]), "Nov 8 brain Q2 answers");
eq(tf[1].explain, "Ava cannot be first; Cy cannot be first because Ben is ahead; Ben must be first.", "Nov 8 brain Q2 explanation");

const hints = ["A harvest favourite with a tough outer shell", "A fleeting display with a full spectrum", "A spotted browser with a lofty outlook", "A tangy guest in a sandwich", "A slow grower with built-in defences", "A heavyweight that lounges near icy seas"];
const words = ["PUMPKIN", "RAINBOW", "GIRAFFE", "PICKLE", "CACTUS", "WALRUS"];
nov8.wordFlip.forEach((row, i) => {
  eq(row[0], words[i], "Nov 8 unscramble word " + (i + 1));
  eq(row[1], "definition", "Nov 8 unscramble hint type " + (i + 1));
  eq(row[2], hints[i], "Nov 8 unscramble hint " + (i + 1));
});

// Neighbor days stay on their previous questions.
eq(nov6.sports[0].q, "In what year did Atlanta host the Summer Olympics?", "Nov 6 sports Q1 unchanged");
eq(nov6.sports[0].q.includes("Atlanta"), true, "Nov 6 sports Q1 still Atlanta");
eq(nov7.thinkFast[0].q, "You have 9 coins that look the same, but one is lighter. Using a balance scale, what is the fewest weighings that always finds the light coin?", "Nov 7 brain teaser unchanged");
t(!/ice-cream|Honolulu|Deuce|your opponent/.test(JSON.stringify(nov9)), "Nov 9 does not pick up Nov 7–8 replacement text");

// Same opts app.js passes into Answers.checkAnswer.
function optsFor(q, forcePerson) {
  return { aliases: q.aliases, wrong: q.wrong || q.options, noSurname: q.noSurname, textOnly: q.textOnly, person: forcePerson ? true : q.person, q: q.q };
}
function check(q, input, exp, forcePerson) {
  t(A.checkAnswer(input, q.answers, optsFor(q, forcePerson)) === exp, (exp ? "accept " : "reject ") + JSON.stringify(input) + " for " + q.q.slice(0, 42));
}
const tennis = s8[2];
["opponent", "your opponent", "Your Opponent", "YOUR OPPONENT", "the opponent", "an opponent", "opponent.", "your opponent.", "your opponent!"].forEach(s => check(tennis, s, true));
["you", "You", "your", "me", "I", "myself", "yourself"].forEach(s => check(tennis, s, false));
const shaq = s7[2];
["Shaq", "Shaquille O'Neal", "Shaquille O\u2019Neal", "Shaquille Oneal", "O'Neal", "O\u2019Neal", "Oneal", "Shaquille", "Shaquille O Neal"].forEach(s => check(shaq, s, true, true));
["Neal", "neal", "diesel", "Kobe", "Wade"].forEach(s => check(shaq, s, false, true));
const oil = s7[1];
["Oilers", "Edmonton Oilers", "Oiler", "the oilers"].forEach(s => check(oil, s, true));
["Edmonton", "Flames", "Calgary Flames"].forEach(s => check(oil, s, false));
const favre = s8[1];
["Brett Favre", "Favre", "Bret Favre", "Brett Farve", "Farve"].forEach(s => check(favre, s, true));
check(favre, "Brett", false);
["6", "six", "6 pairs", "six pairs", "Six pairs."].forEach(s => check(tf[0], s, true));
["4", "12", "24", "5"].forEach(s => check(tf[0], s, false));
["Ben", "ben", "Ben finishes first"].forEach(s => check(tf[1], s, true));
["Ava", "Cy", "Benjamin"].forEach(s => check(tf[1], s, false));

const E = win.CONTENT_ES;
eq(E.worldRush[38].pins[1].lat, 21.3069, "ES Nov 7 Honolulu latitude");
eq(E.worldRush[38].mc.a, 0, "ES Nov 7 Giza answer index");
eq(E.sports[38][0].a, 1, "ES Nov 7 deuce answer index");
eq(E.sports[38].filter(q => q.type === "mc").length, 1, "ES Nov 7 one sports MC");
eq(E.sports[39][2].type, "text", "ES Nov 8 tennis is typed, not the old bracket");
eq(E.sports[39][2].q, "En un peloteo normal de individuales (no tenis en silla de ruedas), el tiro de tu oponente bota dos veces en tu lado antes de que lo devuelvas. ¿Quién gana el punto?", "ES Nov 8 tennis prompt");
t(JSON.stringify(E.sports[39][2].answers.concat(E.sports[39][2].aliases)) === JSON.stringify(["tu oponente", "oponente", "your opponent", "opponent", "tu rival", "rival"]), "ES Nov 8 tennis accepts tu oponente, oponente, your opponent, opponent, tu rival, rival");
t(JSON.stringify(E.sports[39][2].wrong) === JSON.stringify(["tú", "yo", "you"]), "ES Nov 8 tennis still rejects tú, yo, you");
eq(E.sports[39].filter(q => ["mc", "bracket", "order", "match"].includes(q.type)).length, 1, "ES Nov 8 one sports choice");
t(JSON.stringify(E.wordFlip[10].map(w => [w[0], w[2]])) === JSON.stringify([
  ["CALABAZA", "Una favorita de la cosecha con una cáscara dura."],
  ["ARCOÍRIS", "Un espectáculo pasajero de muchos colores."],
  ["JIRAFA", "Un animal de manchas con una vista desde las alturas."],
  ["PEPINILLO", "Un acompañante ácido en un sándwich."],
  ["CACTUS", "Crece despacio y tiene sus propias defensas."],
  ["MORSA", "Un peso pesado que descansa junto a mares helados."]
]), "ES Nov 8 Unscramble approved rows");
eq(E.sports[38][1].answers[0], "oilers", "Spanish Oilers answer still present");
eq(E.sports[39][1].answers[0], "brett favre", "Spanish Favre answer still present");
eq(E.worldRush[38].pins[0].name, "Tirana, Albania", "Spanish Tirana pin still present");
t(E.sports[40] == null && E.thinkFast[20] == null, "Nov 9+ Spanish slots stay empty");
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
