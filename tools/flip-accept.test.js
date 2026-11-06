/* Actual Unscramble checker from app.js. ARCOÍRIS and ARCOIRIS match; other games are untouched. */
const fs = require("fs"), path = require("path"), vm = require("vm");
const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const i = src.indexOf("function flipFold("), j = src.indexOf("function wordFlip(");
if (i < 0 || j < 0) throw Error("missing flipAccept");
const ctx = {};
vm.runInNewContext(src.slice(i, j) + "\nthis.flipAccept = flipAccept; this.flipFold = flipFold;", ctx);
let pass = 0, fail = 0;
const t = (ok, why) => { if (ok) pass++; else { fail++; console.log("FAIL", why); } };
const rows = [
  ["CALABAZA", "Una favorita de la cosecha con una cáscara dura."],
  ["ARCOÍRIS", "Un espectáculo pasajero de muchos colores."],
  ["JIRAFA", "Un animal de manchas con una vista desde las alturas."],
  ["PEPINILLO", "Un acompañante ácido en un sándwich."],
  ["CACTUS", "Crece despacio y tiene sus propias defensas."],
  ["MORSA", "Un peso pesado que descansa junto a mares helados."]
];
const lens = [8, 8, 6, 9, 6, 5];
rows.forEach(([w, hint], n) => {
  t(w.split("").length === lens[n], w + " has " + lens[n] + " letters");
  t(!hint.toUpperCase().includes(ctx.flipFold(w)), hint + " does not leak " + w);
  t(ctx.flipAccept(w, w, null), "accept exact " + w);
  t(ctx.flipAccept(w, ctx.flipFold(w), null), "accept unaccented " + w);
  t(!ctx.flipAccept(w, w.slice(0, -1), null), "reject truncated " + w);
});
t(ctx.flipAccept("ARCOÍRIS", "ARCOIRIS", null), "accept ARCOIRIS");
t(ctx.flipAccept("ARCOÍRIS", "arcoíris", null), "accept lowercase accented arcoíris");
t(ctx.flipAccept("ARCOÍRIS", "ARCOÍRIS", null), "accept ARCOÍRIS");
t(ctx.flipFold("ARCOÍRIS") === "ARCOIRIS", "fold ARCOÍRIS");
t(!ctx.flipAccept("PUMPKIN", "PUMPKI", null), "English word still rejects a short entry");
t(ctx.flipAccept("SILENT", "LISTEN", new Set(["LISTEN"])), "existing same-letter dictionary answer still counts");
t(!ctx.flipAccept("SILENT", "LISTEN", new Set()), "dictionary answer needs the dictionary");
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
