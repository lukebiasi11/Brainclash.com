// City and nickname aliases for Sports typed team answers.
// A saved score is a stored number. This only changes what a future typed answer accepts.
const fs = require("fs"), path = require("path"), vm = require("vm");
const A = require("../answers.js");
const root = path.join(__dirname, "..");
const win = {};
vm.runInNewContext(fs.readFileSync(path.join(root, "content.js"), "utf8"), { window: win });
vm.runInNewContext(fs.readFileSync(path.join(root, "content.es.js"), "utf8"), { window: win });
let bad = 0;
const t = (ok, why) => { if (!ok) { bad++; console.log("FAIL", why); } };

function questions(list) {
  const out = [];
  (list || []).forEach((day, di) => {
    if (!Array.isArray(day)) return;
    day.forEach((q, qi) => { if (q && (q.type === "text" || q.type === "typed")) out.push({ di, qi, q }); });
  });
  return out;
}
function find(list, full) {
  const hit = questions(list).filter(row => [].concat(row.q.answers || []).map(s => String(s).toLowerCase()).includes(full));
  t(hit.length === 1, full + " found once, got " + hit.length);
  return hit[0] && hit[0].q;
}
function check(q, input, exp, why) {
  const ok = A.checkAnswer(input, q.answers, { aliases: q.aliases, wrong: q.wrong, noSurname: q.noSurname, person: q.person, given: q.given, q: q.q });
  t(ok === exp, (exp ? "accept " : "reject ") + JSON.stringify(input) + " for " + why);
}

const en = win.CONTENT.sports;
const teams = [
  ["dallas cowboys", ["Dallas", "Dalls"], ["Cowboys"], []],
  ["boston celtics", ["Boston"], ["Celtics"], []],
  ["new york yankees", ["New York", "NY", "N.Y."], ["Yankees", "Yanks"], []],
  ["los angeles lakers", ["Los Angeles", "LA", "L.A.", "Los Angelos"], ["Lakers"], []],
  ["montreal canadiens", ["Montreal", "Montréal"], ["Canadiens", "Habs"], []],
  ["pittsburgh steelers", ["Pittsburgh", "Pittsburg"], ["Steelers"], []],
  ["boston red sox", ["Boston"], ["Red Sox"], []],
  ["green bay packers", ["Green Bay", "Greenbay"], ["Packers"], []],
  ["chicago cubs", ["Chicago"], ["Cubs", "Cubbies"], []],
  ["los angeles dodgers", ["Los Angeles", "LA", "L.A."], ["Dodgers"], []],
  ["indianapolis colts", ["Indianapolis", "Indy", "Indianpolis"], ["Colts"], []],
  ["los angeles chargers", ["Los Angeles", "LA", "San Diego"], ["Chargers"], []],
  ["tampa bay buccaneers", ["Tampa Bay", "Tampa"], ["Buccaneers", "Bucs"], []],
  ["minnesota vikings", ["Minnesota", "Minneapolis", "Minesota"], ["Vikings"], []],
  ["detroit tigers", ["Detroit"], ["Tigers"], []],
  ["detroit red wings", ["Detroit"], ["Red Wings"], ["Pistons", "Tigers", "Lions"]],
  ["edmonton oilers", ["Edmonton"], ["Oilers"], ["Flames", "Calgary Flames"]],
  ["orlando magic", ["Orlando", "Orlndo"], ["Magic"], ["Knicks"]],
  ["toronto maple leafs", ["Toronto"], ["Maple Leafs", "Leafs"], ["Raptors", "Blue Jays"]],
  ["cleveland browns", ["Cleveland", "Cleavland", "Clevland"], ["Browns", "Cleveland Browns", "Cleavland Browns"], ["dogs", "bengals", "Cavaliers"]]
];
teams.forEach(([full, cities, nicks, reject]) => {
  const q = find(en, full);
  if (!q) return;
  cities.concat(nicks).forEach(s => check(q, s, true, full));
  reject.forEach(s => check(q, s, false, full));
});

const es = win.CONTENT_ES.sports;
const esTeams = [
  ["detroit red wings", ["Detroit"], ["Red Wings", "Alas Rojas"], ["Pistons", "Tigers", "Lions"]],
  ["edmonton oilers", ["Edmonton"], ["Oilers", "Petroleros"], ["Flames", "Calgary Flames"]],
  ["cleveland browns", ["Cleveland", "Cleavland", "Browns de Cleveland"], ["Browns"], ["dogs", "bengals"]]
];
esTeams.forEach(([full, cities, nicks, reject]) => {
  const q = find(es, full);
  if (!q) return;
  cities.concat(nicks).forEach(s => check(q, s, true, "es " + full));
  reject.forEach(s => check(q, s, false, "es " + full));
});

function person(full) {
  return questions(en).map(row => row.q).find(q => [].concat(q.answers || []).map(s => String(s).toLowerCase()).includes(full));
}
const favre = person("brett favre");
const elway = person("john elway");
const marino = person("dan marino");
["Green Bay", "Packers"].forEach(s => check(favre, s, false, "Favre"));
["Denver", "Broncos"].forEach(s => check(elway, s, false, "Elway"));
["Miami", "Dolphins"].forEach(s => check(marino, s, false, "Marino"));
check(favre, "Brett Favre", true, "Favre");

console.log(bad ? bad + " failures" : "sports-city-alias.test.js: all pass");
process.exit(bad ? 1 : 0);
