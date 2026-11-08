// Content checker. Run from the site folder:  node tools/validate.js
// Checks content.js and anagrams.js for syntax errors and missing/broken fields.
// (Not needed on GitHub Pages — you don't have to upload it.)
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, ".."), errs = [];
const win = {};
for (const f of ["content.js", "anagrams.js"]) {
  try { vm.runInNewContext(fs.readFileSync(path.join(root, f), "utf8"), { window: win }, { filename: f }); }
  catch (e) { errs.push(`${f}: SYNTAX ERROR — ${e.message}${e.stack ? " (" + (e.stack.split("\n")[0]) + ")" : ""}`); }
}
const samplesPath = path.join(root, "..", "trivia-drafts", "sports-rework", "samples.js");
if (fs.existsSync(samplesPath)) {
  try { vm.runInNewContext(fs.readFileSync(samplesPath, "utf8"), { window: win }, { filename: "samples.js" }); }
  catch (e) { errs.push(`sports-rework/samples.js: SYNTAX ERROR — ${e.message}`); }
}
const C = win.CONTENT, A = win.ANAGRAM_SETS;
const E = (where, msg) => errs.push(`${where}: ${msg}`);
const str = v => typeof v === "string" && v.trim() !== "";
const list = (v, n) => Array.isArray(v) && (n == null || v.length === n);
const mc = (w, o) => { if (!str(o.q)) E(w, "missing q"); if (!list(o.options) || o.options.length < 2) E(w, "options needs 2+ choices"); else if (!(Number.isInteger(o.a) && o.a >= 0 && o.a < o.options.length)) E(w, `a must be 0..${o.options.length - 1} (position of right answer, counting from 0)`); };
const bank = (k, fn) => { const b = C && C[k]; if (!list(b) || !b.length) return E(k, "must be a non-empty list"); b.forEach((it, i) => { try { fn(`${k} day ${i + 1}`, it); } catch (e) { E(`${k} day ${i + 1}`, "malformed — " + e.message); } }); };
if (C) {
  bank("worldRush", (w, d) => {
    if (!list(d.pins, 2)) E(w, "needs exactly 2 pins");
    else d.pins.forEach((p, j) => { if (!str(p.name)) E(w, `pin ${j + 1} missing name`); if (!(typeof p.lat === "number" && Math.abs(p.lat) <= 90)) E(w, `pin ${j + 1} bad lat`); if (!(typeof p.lon === "number" && Math.abs(p.lon) <= 180)) E(w, `pin ${j + 1} bad lon`); });
    if (!d.mc) E(w, "missing mc"); else mc(w + " mc", d.mc); if (d.mc && d.mc.optionImgs && !(list(d.mc.optionImgs, (d.mc.options || []).length))) E(w + " mc", "optionImgs must have one entry per option");
  });
  bank("history", (w, d) => [["r1", 4], ["r2", 5]].forEach(([r, n]) => {
    const x = d[r]; if (!x) return E(w, `missing ${r}`);
    if (!str(x.theme)) E(`${w} ${r}`, "missing theme");
    if (!list(x.events, n)) return E(`${w} ${r}`, `needs exactly ${n} events`);
    x.events.forEach((e, j) => { if (!((list(e, 3) || (list(e, 4) && str(e[3]))) && str(e[0]) && str(e[1]) && Number.isFinite(e[2]))) E(`${w} ${r} event ${j + 1}`, 'must be ["emoji", "text", year] (optional 4th: "icon-key")'); });
    const ys = x.events.map(e => e[2]); if (new Set(ys).size !== ys.length) E(`${w} ${r}`, "two events share a year (order would be ambiguous)");
  }));
  const SPORTS_TEXT_KINDS = new Set(["fill", "stat-chart", "moment", "color-swatch", "jersey-number", "common-teammate"]);
  const sportsQ = (ww, q) => {
    const t = q.type || "text";
    if (t === "mc") {
      mc(ww, q);
      if (q.kind && !["true-false", "which-first", "higher-lower", "bracket"].includes(q.kind)) E(ww, "unknown mc kind " + q.kind);
      if (q.kind === "true-false" || q.kind === "which-first" || q.kind === "higher-lower") {
        if (!list(q.options, 2)) E(ww, q.kind + " needs exactly 2 options");
      }
    } else if (t === "text") {
      if (!str(q.q)) E(ww, "missing q");
      if (q.kind === "common-teammate") {
        if (!list(q.clues) || q.clues.length !== 5 || !q.clues.every(str)) E(ww, "common-teammate needs exactly 5 clue names");
        if (!str(q.answer) && !(list(q.answers) && q.answers.length && q.answers.every(str))) E(ww, "common-teammate needs answer");
        if (q.aliases && !(list(q.aliases) && q.aliases.every(str))) E(ww, "aliases must be a list of text");
      } else if (!list(q.answers) || !q.answers.length || !q.answers.every(str)) E(ww, "answers must be a list of text");
      if (q.given && !(list(q.given) && q.given.length && q.given.every(str))) E(ww, "given must be a list of text");
      if (q.kind && !SPORTS_TEXT_KINDS.has(q.kind)) E(ww, "unknown text kind " + q.kind);
      if (q.kind && q.kind !== "fill" && q.kind !== "common-teammate" && !str(q.img)) E(ww, q.kind + " needs img");
    } else if (t === "guess") {
      if (!str(q.q)) E(ww, "missing q");
      if (typeof q.answer !== "number" || !isFinite(q.answer)) E(ww, "guess needs numeric answer");
      if (q.kind && q.kind !== "year-guess") E(ww, "unknown guess kind " + q.kind);
      if (q.exactYear != null && typeof q.exactYear !== "boolean") E(ww, "exactYear must be boolean");
      if (q.yearBand != null && !(typeof q.yearBand === "number" && q.yearBand >= 0)) E(ww, "yearBand must be a non-negative number");
    } else if (t === "order") {
      if (!str(q.q)) E(ww, "missing q");
      if (q.kind && q.kind !== "team-path") E(ww, "unknown order kind " + q.kind);
      if (!list(q.items) || q.items.length < 3 || q.items.length > 5 || !q.items.every(str)) E(ww, "items must be 3–5 nickname strings");
      else if (new Set(q.items.map(x => x.toLowerCase())).size !== q.items.length) E(ww, "duplicate nicknames in items (return stints need an explicit prompt rule)");
    } else if (t === "bracket") {
      if (!str(q.q)) E(ww, "missing q");
      if (q.kind && q.kind !== "bracket") E(ww, "unknown bracket kind " + q.kind);
      const m = q.matchup || q.options;
      if (!list(m, 2) || !m.every(str)) E(ww, "matchup must be two nickname strings");
      if (!(Number.isInteger(q.a) && q.a >= 0 && q.a <= 1)) E(ww, "a must be 0 or 1 (winner index)");
    } else if (t === "match") {
      if (!str(q.q)) E(ww, "missing q");
      if (q.kind && q.kind !== "match-records") E(ww, "unknown match kind " + q.kind);
      if (!list(q.left, 4) || !q.left.every(str)) E(ww, "left must be 4 athlete strings");
      if (!list(q.right, 4) || !q.right.every(str)) E(ww, "right must be 4 record strings");
      if (!list(q.pairs, 4) || !q.pairs.every(p => Number.isInteger(p) && p >= 0 && p < 4)) E(ww, "pairs must be 4 ints 0–3 (right index per left)");
      else if (new Set(q.pairs).size !== 4) E(ww, "pairs must be a permutation of 0–3");
    } else E(ww, 'type must be "mc", "text", "guess", "order", "bracket", or "match"');
  };
  bank("sports", (w, d) => { if (!list(d, 3)) return E(w, "needs exactly 3 questions"); d.forEach((q, j) => sportsQ(`${w} Q${j + 1}`, q)); });
  // Optional Sports rework draft samples (fixtures only — not live content)
  if (win.SPORTS_REWORK_SAMPLES) {
    const S = win.SPORTS_REWORK_SAMPLES;
    if (!list(S) || !S.length) E("SPORTS_REWORK_SAMPLES", "must be a non-empty list of days");
    else {
      const slotKinds = [[], [], []];
      S.forEach((d, i) => {
        const w = `SPORTS_REWORK_SAMPLES day ${i + 1}`;
        if (!list(d, 3)) return E(w, "needs exactly 3 questions");
        sportsQ(w + " Q1", d[0]); sportsQ(w + " Q2", d[1]); sportsQ(w + " Q3", d[2]);
        for (let s = 0; s < 3; s++) {
          const k = d[s].kind || d[s].type || "text";
          if (slotKinds[s].length && slotKinds[s][slotKinds[s].length - 1] === k) E(w + " Q" + (s + 1), "kind " + k + " repeats previous day in same slot");
          slotKinds[s].push(k);
        }
      });
    }
  }
  bank("wordFlip", (w, d) => { if (!list(d, 6)) return E(w, "needs exactly 6 words"); d.forEach((x, j) => { if (!(list(x, 3) && /^[A-Z]+$/.test(x[0]) && str(x[1]) && str(x[2]))) E(`${w} word ${j + 1}`, 'must be ["WORD", "hint type", "hint"] with WORD in CAPITALS'); else if (new Set(x[0]).size === 1) E(`${w} word ${j + 1}`, "word can't be scrambled"); }); });
  bank("wordBridge", (w, d) => { if (!list(d, 6)) return E(w, "needs exactly 6 puzzles"); d.forEach((x, j) => { const alt = x.length === 4 && /^[A-Z]+$/.test(x[3]); if (!((list(x, 3) || alt) && x.slice(0, 3).every(str) && /^[A-Z]+$/.test(x[2]))) E(`${w} puzzle ${j + 1}`, 'must be ["FIRST", "SECOND", "ANSWER"] with ANSWER in CAPITALS, no spaces; optional 4th answer is also CAPITALS'); }); });
  bank("connections", (w, d) => { if (!list(d.groups, 3)) return E(w, "needs exactly 3 groups"); const all = []; d.groups.forEach((g, j) => { if (!str(g.name)) E(`${w} group ${j + 1}`, "missing name"); if (!list(g.words, 3) || !g.words.every(str)) E(`${w} group ${j + 1}`, "needs exactly 3 words"); else all.push(...g.words); }); if (new Set(all).size !== all.length) E(w, "a word appears twice"); const p = d.groups.map(g => g.pts).join(","); if (p !== "300,300,400") E(w, `pts must be 300,300,400 (found ${p})`); });
  bank("oddOneOut", (w, d) => { if (!list(d, 8)) return E(w, "needs exactly 8 puzzles"); d.forEach((x, j) => { const ww = `${w} puzzle ${j + 1}`; if (!list(x.words, 4) || !x.words.every(str)) E(ww, "needs exactly 4 words"); if (!(Number.isInteger(x.odd) && x.odd >= 0 && x.odd < 4)) E(ww, "odd must be 0-3 (position of odd word, counting from 0)"); if (!str(x.why)) E(ww, "missing why"); }); });
  // Think Fast (SPEC §5): typed (legacy) | type:"guess" {answer:number, unit?} | type:"mc" {options, a, kind?, img?} | Designer alias type:"illusion" {svg, options, a}.
  // When puzzles carry kind/cat: day = [thinking (math|sequence|logic), fun (guesstimate|illusion|riddle)], and no kind repeats in a slot on consecutive days.
  const TF_THINK = ["math", "sequence", "logic"], TF_FUN = ["guesstimate", "illusion", "riddle"];
  let tfPrev = null;
  bank("thinkFast", (w, d) => {
    if (!list(d, 2)) return E(w, "needs exactly 2 puzzles");
    d.forEach((q, j) => {
      const ww = `${w} puzzle ${j + 1}`; if (!str(q.q)) E(ww, "missing q");
      const t = q.type || "text";
      if (t === "guess") { if (typeof q.answer !== "number" || !isFinite(q.answer)) E(ww, "guess needs a numeric answer"); if (q.unit != null && !str(q.unit)) E(ww, "unit must be text"); }
      else if (t === "mc" || t === "illusion") {
        if (!list(q.options) || q.options.length < 2 || !q.options.every(str)) E(ww, "options must be 2+ strings");
        else if (!Number.isInteger(q.a) || q.a < 0 || q.a >= q.options.length) E(ww, "a must index options");
        if (t === "illusion" && !str(q.svg)) E(ww, "illusion alias needs svg");
      } else if (t === "text") { if (!list(q.answers) || !q.answers.length || !q.answers.every(str)) E(ww, "answers must be a list of text"); }
      else E(ww, "unknown type " + t);
      const kind = q.kind || (t === "illusion" ? "illusion" : null);
      { const art = q.img || q.svg; if (kind === "illusion" && str(art) && !fs.existsSync(path.join(root, "assets", art.replace(/\.svg$/, "") + ".svg"))) E(ww, `illusion art assets/${art}.svg is missing`); }
      if (kind && ![...TF_THINK, ...TF_FUN].includes(kind)) E(ww, "unknown kind " + kind);
      if (kind && (j === 0 ? !TF_THINK.includes(kind) : !TF_FUN.includes(kind))) E(ww, `slot ${j + 1} must be a ${j === 0 ? "thinking" : "fun"} kind (got ${kind})`);
    });
    const kinds = d.map(q => q.kind || (q.type === "illusion" ? "illusion" : null));
    if (tfPrev && kinds.every(Boolean) && tfPrev.every(Boolean)) kinds.forEach((k, j) => { if (k === tfPrev[j]) E(w, `${k} repeats from the previous day`); });
    tfPrev = kinds;
  });
} else if (!errs.length) E("content.js", "window.CONTENT not found");
if (A) {
  const sets = Object.values(A); if (!sets.length) E("anagrams.js", "no sets");
  sets.forEach((s, i) => { const w = `anagrams set ${i + 1} (${s.letters})`; if (!/^[A-Z]{6}$/.test(s.letters || "")) E(w, "letters must be 6 CAPITALS"); if (!list(s.valid) || !s.valid.length) E(w, "valid list empty"); if (!list(s.common) || !s.common.length) E(w, "common list empty"); else { const v = new Set(s.valid); s.common.forEach(c => { if (!v.has(c)) E(w, `common word "${c}" not in valid list`); }); } });
} else if (!errs.some(e => e.startsWith("anagrams"))) E("anagrams.js", "window.ANAGRAM_SETS not found");
if (errs.length) { console.log(`❌ ${errs.length} problem(s):\n - ` + errs.join("\n - ")); process.exit(1); }
console.log("✅ OK — content.js and anagrams.js look good.");
