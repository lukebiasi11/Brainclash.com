// node tools/area-score.test.js — park-wide pin scoring.
// Inside an area is 450. Outside uses great-circle km to the nearest boundary point.
// A pin with no area keeps round(450 × max(0, 1 − km/4000)) from its center.
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "app.js"), "utf8");
const start = src.indexOf("function haversine(");
const end = src.indexOf("window.DGScore");
if (start < 0 || end < start) throw new Error("scoring block not found");
const lineEnd = src.indexOf("\n", end);
const win = {};
vm.runInNewContext(src.slice(start, lineEnd), { window: win });
vm.runInNewContext(fs.readFileSync(path.join(root, "content.js"), "utf8"), { window: win });
const DG = win.DGScore;
const AREA = win.BANFF_NATIONAL_PARK_AREA;
const banff = { name: "Banff National Park, Alberta", lat: 51.5, lon: -116.0, area: AREA };
let bad = 0;
const t = (name, got, exp) => {
  const ok = typeof exp === "number" ? Object.is(got, exp) : got === exp;
  if (!ok) { bad++; console.log("FAIL", name, "->", got, "expected", exp); }
};
const formula = km => Math.round(450 * Math.max(0, 1 - km / 4000));

function sampledKm(guess, area) {
  let best = Infinity;
  for (let i = 0; i < area.length; i++) {
    const a = area[i], b = area[(i + 1) % area.length];
    for (let s = 0; s <= 40; s++) {
      const u = s / 40;
      const p = { lat: a[0] + (b[0] - a[0]) * u, lon: a[1] + (b[1] - a[1]) * u };
      best = Math.min(best, DG.haversine(guess, p));
    }
  }
  return best;
}
function expectEdge(name, guess) {
  const r = DG.pinResult(guess, banff);
  const sample = sampledKm(guess, AREA);
  const center = DG.haversine(guess, banff);
  t(name + " outside", r.inside, false);
  t(name + " uses the edge formula", r.pts, formula(r.km));
  t(name + " km matches the boundary", Math.abs(r.km - sample) < 1.5, true);
  t(name + " km is not the center", r.km < center - 1, true);
  t(name + " beats the center score", r.pts > formula(center), true);
  return r;
}

t("ring length", AREA.length >= 15 && AREA.length <= 40, true);
t("inside the park", DG.pinResult({ lat: 51.5, lon: -116.0 }, banff).pts, 450);
t("inside km", DG.pinResult({ lat: 51.5, lon: -116.0 }, banff).km, 0);
t("town of Banff", DG.pinResult({ lat: 51.1784, lon: -115.5708 }, banff).pts, 450);
t("town of Banff km", DG.pinResult({ lat: 51.1784, lon: -115.5708 }, banff).km, 0);
t("Lake Louise", DG.pinResult({ lat: 51.4254, lon: -116.1773 }, banff).pts, 450);
t("Lake Louise km", DG.pinResult({ lat: 51.4254, lon: -116.1773 }, banff).km, 0);

const calgary = expectEdge("Calgary", { lat: 51.0447, lon: -114.0719 });
const edmonton = expectEdge("Edmonton", { lat: 53.5461, lon: -113.4938 });
const vancouver = expectEdge("Vancouver", { lat: 49.2827, lon: -123.1207 });
const far = expectEdge("far away", { lat: 40.71, lon: -74.01 });
t("far scores less than Vancouver", far.pts < vancouver.pts, true);
t("Vancouver scores less than Calgary", vancouver.pts < calgary.pts, true);
t("Calgary is under 450", calgary.pts < 450, true);

const bare = { name: "Tokyo, Japan", lat: 35.68, lon: 139.69 };
const same = DG.pinResult({ lat: 35.68, lon: 139.69 }, bare);
t("no area on the pin is 450", same.pts, 450);
t("no area on the pin is 0 km", same.km, 0);
const off = { lat: 36.68, lon: 140.69 };
const offR = DG.pinResult(off, bare);
const offKm = DG.haversine(off, bare);
t("no area km is the center", offR.km, offKm);
t("no area pts is the old formula", offR.pts, formula(offKm));
t("no area is not an area hit", offR.inside, false);

const box = [[0, 0], [0, 2], [2, 2], [2, 0]];
const boxPin = { lat: 1, lon: 1, area: box };
t("box inside", DG.pinResult({ lat: 1, lon: 1 }, boxPin).pts, 450);
const north = DG.pinResult({ lat: 3, lon: 1 }, boxPin);
t("box outside formula", north.pts, formula(north.km));
t("box nearest is the north edge", Math.abs(north.nearest.lat - 2) < 0.02 && Math.abs(north.nearest.lon - 1) < 0.02, true);

let banffPins = 0;
(win.CONTENT.worldRush || []).forEach(day => (day.pins || []).forEach(p => {
  if (!p || !/banff/i.test(p.name || "")) return;
  banffPins++;
  t("Banff pin carries the area", JSON.stringify(p.area), JSON.stringify(AREA));
}));

console.log("samples", JSON.stringify({
  inside: 450,
  calgary: { km: Math.round(calgary.km * 10) / 10, pts: calgary.pts },
  edmonton: { km: Math.round(edmonton.km * 10) / 10, pts: edmonton.pts },
  vancouver: { km: Math.round(vancouver.km * 10) / 10, pts: vancouver.pts },
  far: { km: Math.round(far.km * 10) / 10, pts: far.pts },
  banffPins
}));
console.log(bad ? bad + " failures" : "area-score.test.js: all pass");
process.exit(bad ? 1 : 0);
