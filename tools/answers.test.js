// node tools/answers.test.js — regression checks for answers.js (typo hardening + unit-aware estimates).
const fs = require("fs"), path = require("path");
const A = require("../answers.js");
let bad = 0;
const t = (name, got, exp) => { if (got !== exp) { bad++; console.log("FAIL", name, "->", got, "expected", exp); } };
[["Slovenia", ["slovakia"], false], ["Slovakia", ["slovenia"], false], ["Slovakai", ["slovakia"], true], ["Slovkia", ["slovakia"], true], ["Sweeden", ["sweden"], true], ["Austraila", ["australia"], true],
 ["Austria", ["australia"], false], ["Iran", ["iraq"], false], ["Iraq", ["iran"], false], ["Home", ["rome"], false], ["Mal", ["mali"], false],
 ["Niger", ["nigeria"], false], ["Jokovic", ["novak djokovic", "djokovic"], true], ["Mail", ["mali"], true], ["Olso", ["oslo"], true],
 ["Wodds", ["tiger woods", "woods"], true], ["Djokovich", ["djokovic"], true], ["Cowboy", ["cowboys"], true], ["Gogle", ["google"], true],
 ["Tigr Woodz", ["tiger woods"], true], ["edison", ["thomas edison"], true, { person: true }], ["Bobby Bonds", ["barry bonds", "bonds"], false, { wrong: ["bobby bonds"] }]]
  .forEach(([i, a, e, o]) => t(`check ${i} vs ${a[0]}`, A.checkAnswer(i, a, o || {}), e));
[["2 hours", "minutes", 120], ["90", "minutes", 90], ["1.5 hours", "minutes", 90], ["5 km", "minutes", null], ["$0.05", "cents", 5], ["1.2k", null, 1200]]
  .forEach(([s, u, e]) => t(`estimate ${s} (${u})`, A.parseEstimate(s, u), e));
// nov2es: accent-insensitive + leading article (en/es) dropped before matching; nearMiss rules unchanged
[["Mexico", ["méxico"], true], ["méxico", ["mexico"], true], ["Peru", ["Perú"], true], ["sao paulo", ["São Paulo"], true], ["Bogota", ["bogotá"], true],
 ["el Salvador", ["salvador"], true], ["la Habana", ["habana"], true], ["los andes", ["andes"], true], ["Las Malvinas", ["malvinas"], true],
 ["the Beatles", ["beatles"], true], ["a Tale of Two Cities", ["tale of two cities"], true], ["el Peru", ["perú"], true], ["Austria", ["Australia"], false], ["la Iran", ["iraq"], false]]
  .forEach(([i, a, e, o]) => t(`es ${i} vs ${a[0]}`, A.checkAnswer(i, a, o || {}), e));
// nov3f: es-only dot thousands separators
A.setLang("es"); t("es parseNum 5.050", A.parseNum("5.050"), 5050); t("es parseNum 1.234.567", A.parseNum("1.234.567"), 1234567); t("es parseNum 5050", A.parseNum("5050"), 5050);
t("es estimate 5.050", A.parseEstimate("5.050", null), 5050); t("es check 5.050", A.checkAnswer("5.050", ["5050"], {}), true);
[["3,5", 3.5], ["0,5", 0.5], ["2,5", 2.5], ["1.234,5", 1234.5], ["5.050", 5050], ["1.234.567", 1234567]].forEach(([i, e]) => t("es parseNum " + i, A.parseNum(i), e));
[["12.000 dólares", 12000], ["12.000 dolares", 12000], ["1 dólar", 1]].forEach(([i, e]) => t("es parseNum " + i, A.parseNum(i), e));
[["12.000 dólares", 12000], ["3 mil", 3000], ["2 millones", 2000000], ["1 millón", 1000000], ["1 millon", 1000000], ["2,5 millones", 2500000], ["3,5", 3.5]].forEach(([i, e]) => t("es estimate " + i, A.parseEstimate(i, null), e));
t("es qty 50 centavos", A.parseEstimate("50 centavos", "cents"), 50); t("es qty 12.000 dólares money", (A.parseQty("12.000 dólares") || {}).money, true);
t("es 25 por ciento", A.checkAnswer("25 por ciento", ["25%"], {}), true);
A.setLang("en"); t("en parseNum 1,234", A.parseNum("1,234"), 1234); t("en estimate 3 thousand", A.parseEstimate("3 thousand", null), 3000); t("en estimate 3 mil (unchanged: 1e6)", A.parseEstimate("3 mil", null), 3000000); t("en estimate 1,200", A.parseEstimate("1,200", null), 1200);
t("en parseNum 5.050", A.parseNum("5.050"), 5.05); t("en parseNum 5050", A.parseNum("5050"), 5050);
// Favre given-name allowlist: exact after normalization, not a fuzzy target. Shared typo bands unchanged.
const favreA = ["brett favre", "favre"];
const favreO = { aliases: ["bret favre", "brett farve", "farve"], given: ["brett", "bret"], wrong: ["packers", "green bay"], q: "Who?" };
const favreYes = ["Brett", "brett", "BRETT", "Brétt", "Bret", "bret", "Favre", "FAVRE", "Farve", "farve", "Brett Favre", "Bret Favre", "Brett Farve", "Brett-Favre", "Brett Favre!", "Fávre", "Favre.", "Brett  Favre", "brett faver", "favr", "farv", "faver"];
const favreNo = ["brent", "aaron rodgers", "Aaron Rodgers", "rodgers", "bart starr", "starr", "jordan love", "packers", "green bay", "greenbay", "", "asdf", "??", "br", "b", "karl", "hakeem", "brandi", "bo", "jackson"];
favreYes.forEach(s => t("favre accept " + s, A.checkAnswer(s, favreA, favreO), true));
favreNo.forEach(s => t("favre reject " + s, A.checkAnswer(s, favreA, favreO), false));
t("brett listed wrong still rejected", A.checkAnswer("Brett", favreA, { aliases: favreO.aliases, wrong: ["brett", "packers", "green bay"], q: "Who?" }), false);
t("bret is a typo of the first name", A.checkAnswer("Bret", favreA, { aliases: favreO.aliases, q: "Who?" }), true);
t("hakeem first name accepted", A.checkAnswer("Hakeem", ["hakeem olajuwon", "olajuwon"], { person: true, q: "Who?" }), true);
t("karl first name accepted", A.checkAnswer("Karl", ["karl malone", "malone"], { person: true, q: "Who?" }), true);
t("brandi still rejected", A.checkAnswer("Brandi", ["chastain", "brandi chastain"], { wrong: ["brandi"], q: "Fill in her surname." }), false);
// Florence Griffith Joyner and Jackie Joyner-Kersee share the surname, so a bare "joyner" is not Flo-Jo.
const flo = ["florence griffith joyner", "flo-jo", "flo jo"];
const floQ = { person: true, q: "Who is this?" };
t("joyner is ambiguous", A.AMBIGUOUS_SURNAMES.has("joyner"), true);
["joyner", "Joyner", "JOYNER", "Joyner!"].forEach(s => t("bare joyner rejected " + s, A.checkAnswer(s, flo, floQ), false));
["Jackie Joyner-Kersee", "jackie joyner kersee", "joyner-kersee", "kersee"].forEach(s => t("other joyner rejected " + s, A.checkAnswer(s, flo, floQ), false));
["Florence Griffith Joyner", "Florence Griffith-Joyner", "Flo-Jo", "Flo Jo", "flojo"].forEach(s => t("flo-jo still accepted " + s, A.checkAnswer(s, flo, floQ), true));
const joynerAccept = A.splitAccept(["joyner"]);
t("listed accept joyner", A.checkAnswer("joyner", flo, Object.assign({}, floQ, joynerAccept)), true);
const aliExact = { aliases: ["Muhammad"], exactOnly: ["Muhammad"], q: "Who is this?" };
t("exactOnly muhammad", A.checkAnswer("Muhammad", ["Muhammad Ali"], aliExact), true);
t("muhamma is not Muhammad", A.checkAnswer("muhamma", ["Muhammad Ali"], aliExact), false);
t("given cassius", A.checkAnswer("Cassius", ["Cassius Clay"], { aliases: ["Cassius"], given: ["Cassius"], q: "Who is this?" }), true);
t("cassiu is not Cassius", A.checkAnswer("cassiu", ["Cassius Clay"], { aliases: ["Cassius"], given: ["Cassius"], q: "Who is this?" }), false);
t("exactOnly willie", A.checkAnswer("Willie", ["Willie Mays"], { aliases: ["Willie"], exactOnly: ["Willie"], q: "Who is this?" }), true);
t("willi is not Willie", A.checkAnswer("willi", ["Willie Mays"], { aliases: ["Willie"], exactOnly: ["Willie"], q: "Who is this?" }), false);
A.setLang("es");
["Brett", "Bret", "Farve", "Fávre", "Brett Favre"].forEach(s => t("es favre accept " + s, A.checkAnswer(s, favreA, favreO), true));
["brent", "rodgers", "packers", "", "asdf"].forEach(s => t("es favre reject " + s, A.checkAnswer(s, favreA, favreO), false));
A.setLang("en");

// Bare first name (Luke, Nov 16): same person path and typo band as the surname. One flag, default on.
t("first-name flag default on", A.ACCEPT_BARE_FIRST_NAME, true);
const appSrc = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
t("app passes noFirstName", appSrc.includes("noFirstName: src && src.noFirstName") && appSrc.includes("noFirstName: q.noFirstName"), true);
const schu = ["michael schumacher", "schumacher"];
const schuO = { q: "Silhouette clue: German Formula One driver. Who?", wrong: ["ralf schumacher", "mick schumacher"] };
["Michael", "michael", "MICHAEL", "Míchael", "Micheal"].forEach(s => t("schumacher first " + s, A.checkAnswer(s, schu, schuO), true));
["Ralf", "Ralf Schumacher", "Mick", "Mick Schumacher", "Gary"].forEach(s => t("schumacher other " + s, A.checkAnswer(s, schu, schuO), false));
t("hakeem typo", A.checkAnswer("Hakeen", ["hakeem olajuwon", "olajuwon"], { person: true, q: "Who?" }), true);
const opted = { q: "Silhouette clue: Who?", noFirstName: true };
t("opt-out rejects first name", A.checkAnswer("Michael", schu, opted), false);
t("opt-out keeps surname", A.checkAnswer("Schumacher", schu, opted), true);
t("opt-out keeps full name", A.checkAnswer("Michael Schumacher", schu, opted), true);
t("cowboys city unchanged", A.checkAnswer("Dallas", ["dallas cowboys", "cowboys"], { q: "Logo clue: NFL team, star on the helmet." }), false);
t("high jump unchanged", A.checkAnswer("high", ["high jump", "the high jump"], { q: "Which track and field event?", noSurname: true }), false);
t("your still rejected", A.checkAnswer("your", ["your opponent", "opponent"], { q: "Who wins the point?" }), false);
t("mononym pele stays", A.checkAnswer("Pelé", ["pele", "pelé", "edson arantes do nascimento"], { q: "Silhouette clue: Who?" }), true);
t("mononym does not grow a first name", A.checkAnswer("Edson", ["pele", "pelé", "edson arantes do nascimento"], { q: "Silhouette clue: Who?" }), false);
t("kerri stays wrong", A.checkAnswer("Kerri", ["kerri strug", "strug"], { aliases: ["kerry strug"], wrong: ["kerri"], q: "Who?" }), false);
t("kerry not rescued from kerri", A.checkAnswer("Kerry", ["kerri strug", "strug"], { aliases: ["kerry strug"], wrong: ["kerri"], q: "Who?" }), false);
A.setLang("es");
const jose = ["José Martínez", "Martínez"];
const joseO = { q: "¿Quién es este jugador?" };
["Jose", "José", "JOSE", "José Martínez", "Martínez", "Jsoe"].forEach(s => t("es jose " + s, A.checkAnswer(s, jose, joseO), true));
["García", "Carlos", "barcelona"].forEach(s => t("es jose reject " + s, A.checkAnswer(s, jose, joseO), false));
t("es team not loosened", A.checkAnswer("fc", ["fc barcelona"], { q: "¿Qué equipo es?" }), false);
t("es opt-out", A.checkAnswer("José", jose, { q: "¿Quién es este jugador?", noFirstName: true }), false);
A.setLang("en");
console.log(bad ? bad + " failures" : "answers.test.js: all pass"); process.exit(bad ? 1 : 0);
