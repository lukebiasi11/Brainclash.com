/* Daily Gauntlet — lenient typed-answer checking (shared by app.js and tools/answers.test.js).
   checkAnswer(input, answers, { aliases, wrong, noSurname, person, q }) -> true/false
   Order: explicit answer/alias -> listed wrong -> unit-aware number -> nickname/surname -> typo (never toward a wrong).
   - answers : accepted spellings from content.js (unchanged format)
   - aliases : OPTIONAL extra accepted spellings (nicknames, abbreviations, other languages)
   - wrong   : OPTIONAL known wrong answers / MC options; typo tolerance never lands on these */
(function (root) {
  "use strict";
  const ARTICLE = /^(the|a|an) /;
  const SMALL = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000, million: 1e6, half: 0.5, dozen: 12 };
  // First-name nicknames -> canonical name (applied to the FIRST word only).
  const NICK = { mike: "michael", mick: "michael", bill: "william", will: "william", billy: "william", bob: "robert", rob: "robert", bobby: "robert", bert: "robert",
    tom: "thomas", tommy: "thomas", jim: "james", jimmy: "james", joe: "joseph", joey: "joseph", dave: "david", dan: "daniel", danny: "daniel",
    chris: "christopher", matt: "matthew", nick: "nicholas", tony: "anthony", steve: "steven", stephen: "steven", rick: "richard", dick: "richard",
    rich: "richard", ed: "edward", eddie: "edward", ted: "edward", ken: "kenneth", larry: "lawrence", pete: "peter", sam: "samuel", ben: "benjamin",
    alex: "alexander", andy: "andrew", drew: "andrew", greg: "gregory", jeff: "jeffrey", jon: "jonathan", tim: "timothy", charlie: "charles", chuck: "charles",
    hank: "henry", harry: "henry", jack: "john", johnny: "john", fred: "frederick", liz: "elizabeth", beth: "elizabeth", kate: "katherine", katie: "katherine",
    jen: "jennifer", jenny: "jennifer", sue: "susan", patty: "patricia", pat: "patrick", peggy: "margaret", maggie: "margaret", meg: "margaret", abby: "abigail" };

  // Surnames too ambiguous to accept on their own, even if content lists them.
  const AMBIGUOUS_SURNAMES = new Set(["ronaldo", "james", "bonds", "payton", "schumacher", "gore", "ali",
    "williams", "johnson", "smith", "jones", "brown", "davis", "jackson", "manning", "griffey", "ripken", "watt", "harrison", "curry"]);
  // First words that signal a place/team, not a person ("New York" must not accept "york").
  const NOT_A_FIRST_NAME = new Set(["new", "san", "los", "las", "st", "saint", "fort", "north", "south", "east", "west", "united", "real", "el", "la", "le", "de", "port", "mount", "lake", "great", "old", "upper", "lower", "central", "golden", "green", "red", "blue", "white", "black", "kansas", "tampa", "green", "dallas", "boston", "chicago", "miami", "denver", "houston", "seattle", "atlanta", "detroit"]);
  // Unicode vulgar fractions -> " a/b" so "7½" = "7 1/2" = "7.5".
  const VULGAR = { "½": "1/2", "¼": "1/4", "¾": "3/4", "⅓": "1/3", "⅔": "2/3", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8", "⅕": "1/5" };
  function norm(s) {
    return String(s == null ? "" : s).replace(/[½¼¾⅓⅔⅛⅜⅝⅞⅕]/g, c => " " + VULGAR[c] + " ").replace(/\u2044/g, "/").replace(/¢/g, " cents").replace(/(\d),(?=\d{3}\b)/g, "$1").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/&/g, " and ").replace(/['’`]/g, "")
      // Keep a leading minus sign on numbers ("-20", "−20", "-$20", "minus 20", "negative 20") as \u0001 through the
      // punctuation strip, then restore it as "-". Dashes inside words/ranges ("1990-95", "jean-luc") still become spaces.
      .replace(/(^|[\s($])(?:[-−–]|(?:minus|negative) )\s?(?=\$?\s?\.?\d|(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|half|dozen)\b)/gi, "$1\u0001")
      .replace(/[^a-z0-9$.%/ \u0001]+/g, " ")           // keep $ . % / for numbers and fractions
      .replace(/(^|\s)\.(?!\d)|\.(?=\s|$)/g, " ")   // drop sentence dots, keep ".05"
      .replace(/\s+/g, " ").trim().replace(ARTICLE, "").replace(/\u0001\s?/g, "-").replace(/\$-/g, "-$");
  }
  // Unit-aware quantity: { n, money, unit } where unit is "usd" ($ / dollar(s) / bucks / usd), "cents", or null (bare).
  // Money values are in DOLLARS: "$5" = 5, "5 cents" = 0.05. The unit is read from the raw text, never stripped first.
  function parseQty(raw) {
    const s = norm(raw).replace(/,/g, "");
    const unit = /^-?\$|\$$|(dollars?|bucks|usd)$/.test(s) ? "usd" : (/(cents?|c)$/.test(s) && !/percent$/.test(s)) ? "cents" : null;
    const n = parseNum(raw);
    return n === null ? null : { n, money: unit !== null, unit };
  }
  // Returns a number (fractions and mixed numbers evaluated: "2/15", "7 1/2"), or null.
  function parseNum(raw) {
    let s = norm(raw).replace(/,/g, "");
    const neg = /^-/.test(s); if (neg) s = s.slice(1);   // sign kept by norm(): "-20", "minus 20", "negative twenty"
    const v = parseUnsigned(s);
    return v === null ? null : neg ? -v : v;
  }
  function parseUnsigned(s) {
    let m = s.match(/^(?:(\d+) )?(\d+) ?\/ ?(\d+)$/);
    if (m) return +m[3] ? (+(m[1] || 0)) + m[2] / m[3] : null;
    let scale = 1;
    if (/(\d|\b(?!per)[a-z]+) ?(cents?|c|¢)$/.test(s) && !/percent$/.test(s)) { scale = 0.01; s = s.replace(/ ?(cents?|c|¢)$/, ""); }
    s = s.replace(/ ?(percent|per cent|%)$/, "").replace(/ ?(dollars?|bucks|usd|\$)$/, "").replace(/^\$ ?/, "").trim();
    if (/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return +s * scale;
    const w = s.replace(/-/g, " ").replace(/ and /g, " ").split(" ").filter(Boolean);
    if (!w.length || !w.every(x => x in SMALL)) return null;
    let total = 0, cur = 0;
    for (const x of w) { const v = SMALL[x]; if (v === 100) cur = (cur || 1) * 100; else if (v >= 1000) { total += (cur || 1) * v; cur = 0; } else cur += v; }
    return (total + cur) * scale;
  }
  const numEq = (a, b) => typeof a === "number" && typeof b === "number" && Math.abs(a - b) < 1e-9;
  // A3: typo leniency for spelled-out number words. 4+ letters: 1 edit; <=3 letters: only an adjacent swap.
  // A typo must resolve to exactly ONE number word (by value), else it is left alone.
  function fuzzyNumWord(x) {
    if (x in SMALL || !/^[a-z]+$/.test(x) || x.length < 3) return x;
    const hits = new Set();
    for (const k of Object.keys(SMALL)) {
      if (k.length < 3) continue;
      const d = dl(x, k);
      const ok = x.length <= 3 || k.length <= 3 ? (d === 1 && x.length === k.length && [...x].sort().join("") === [...k].sort().join("")) : d <= 1;
      if (ok) hits.add(k);
    }
    return hits.size === 1 ? [...hits][0] : x;
  }
  const fuzzyNumText = s => { const t = norm(s).split(" "), f = t.map(fuzzyNumWord); return f.some((w, i) => w !== t[i]) ? f.join(" ") : s; };
  // Optimal-string-alignment Damerau–Levenshtein.
  function dl(a, b) {
    const d = [];
    for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (let j = 0; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
  }
  const allowed = len => len <= 3 ? 0 : len <= 7 ? 1 : 2;
  // Different real words that differ only at the END of a short word (iran/iraq) or by a swapped-in suffix
  // (austria/australia) are distinct answers, not typos.
  function nearMiss(a, b) {
    let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++;
    const ta = a.slice(p), tb = b.slice(p);
    if (Math.min(a.length, b.length) <= 5 && p >= a.length - 1 && p >= b.length - 1 && ta && tb && ta !== tb) return true; // last-letter swap on short words
    return p >= 4 && Math.abs(a.length - b.length) >= 2;   // same stem, different 2+ letter ending
  }
  const canonName = s => { const w = s.split(" "); if (w.length > 1 && NICK[w[0]]) w[0] = NICK[w[0]]; return w.join(" "); };
  const isNumeric = s => parseNum(s) !== null || /\d/.test(s);

  // Person questions: explicit `person: true`, or auto-detected from the question wording
  // ("Silhouette clue", "Who ...", "Which man/player/QB/swimmer ..."), and never when it asks about a team, place or event.
  const PERSON_Q = /silhouette clue|\bwho\b|\bwhich (man|woman|player|qb|quarterback|swimmer|pitcher|athlete|driver|boxer|golfer|skater|gymnast|coach|runner|sprinter|cyclist|jockey|tennis player|footballer|batter|goalkeeper|goalie)\b/i;
  const NOT_PERSON_Q = /\b(team|teams|nation|country|city|club|franchise|stadium|event|tournament|venue|logo clue)\b/i;
  function isPersonQuestion(o) {
    if (o.person === true) return true;
    if (o.person === false) return false;
    const q = typeof o.q === "string" ? o.q : "";
    return PERSON_Q.test(q) && !NOT_PERSON_Q.test(q);
  }
  // ---- Units with a dimension (Luke: same value in another unit counts; a wrong unit is wrong) ----
  // Time and length convert to a base unit; percent is its own dimension; money keeps the dedicated $/cents logic below.
  // "m" is minutes when the expected dimension is time, metres otherwise.
  const UNITS = {
    time: { s: 1, sec: 1, secs: 1, second: 1, seconds: 1, min: 60, mins: 60, minute: 60, minutes: 60, h: 3600, hr: 3600, hrs: 3600, hour: 3600, hours: 3600,
      day: 86400, days: 86400, week: 604800, weeks: 604800, year: 31536000, years: 31536000 },
    length: { mm: 0.001, cm: 0.01, meter: 1, meters: 1, metre: 1, metres: 1, km: 1000, kilometer: 1000, kilometers: 1000, kilometre: 1000, kilometres: 1000,
      in: 0.0254, inch: 0.0254, inches: 0.0254, ft: 0.3048, foot: 0.3048, feet: 0.3048, yd: 0.9144, yard: 0.9144, yards: 0.9144, mi: 1609.344, mile: 1609.344, miles: 1609.344 },
    percent: { "%": 1, percent: 1, "per cent": 1, pct: 1 } };
  // number then unit: digits may touch the unit ("15m", "25%"); a spelled-out number needs a space ("fifteen min").
  const UNIT_RE = /^(.*?\d\s*|.*?[a-z]\s+)(%|per cent|percent|pct|seconds?|secs?|s|minutes?|mins?|min|m|hours?|hrs?|hr|h|days?|weeks?|years?|mm|cm|meters?|metres?|kilometers?|kilometres?|km|inch(?:es)?|in|feet|foot|ft|yards?|yd|miles?|mi)$/;
  const FRAC_WORD = { quarter: 0.25, half: 0.5, "three quarter": 0.75, "three quarters": 0.75 };
  // -> { n, dim, base } (base = value in seconds / metres / percent points) or null when there is no time/length/percent unit.
  function parseDim(raw, expDim) {
    const s = norm(raw).replace(/,/g, "");
    let m = s.match(/^(?:an? )?(quarter|half|three quarters?) (?:of )?(?:an? )?(hour|minute|day|week|year|mile|meter|metre|kilometer|kilometre)$/);
    if (m) { const u = m[2] + "s", dim = UNITS.time[u] ? "time" : "length"; return { n: FRAC_WORD[m[1]], dim, base: FRAC_WORD[m[1]] * UNITS[dim][u] }; }
    m = s.match(/^(\d+(?:\.\d+)?) and an? half (hours?|minutes?|days?|miles?)$/);
    if (m) { const dim = UNITS.time[m[2]] ? "time" : "length", n = +m[1] + 0.5; return { n, dim, base: n * UNITS[dim][m[2]] }; }
    m = s.match(UNIT_RE);
    if (!m) return null;
    const n = parseNum(m[1].trim()); if (n === null || /cents?$|\$|dollars?$/.test(m[1].trim())) return null;
    let u = m[2], dim = UNITS.time[u] ? "time" : UNITS.length[u] ? "length" : UNITS.percent[u] ? "percent" : null;
    if (u === "m") dim = expDim === "time" ? "time" : "length";
    if (!dim) return null;
    const f = u === "m" ? (dim === "time" ? 60 : 1) : UNITS[dim][u];
    return { n, dim, base: n * f };
  }
  const Q_UNIT = /\b(?:how many|in|number of) (seconds|minutes|hours|days|weeks|years|percent|dollars|cents|meters|metres|km|kilometers|kilometres|miles|feet|inches)\b/;
  // Expected dimension + accepted base values, from the listed answers (and the puzzle's unit / question wording for bare answers).
  function expectedDims(good, opts) {
    const parsed = good.map(g => ({ d: parseDim(g), q: parseQty(g) }));
    let dim = null, unitBase = null;
    for (const p of parsed) if (p.d) { dim = p.d.dim; unitBase = p.d.n ? p.d.base / p.d.n : 1; break; }
    if (!dim && parsed.some(p => p.q && p.q.money)) dim = "money";
    const hint = (opts.unit && String(opts.unit)) || ((String(opts.q || "").toLowerCase().match(Q_UNIT) || [])[1]);
    if (!dim && hint) { const d = parseDim("1 " + hint); if (d) { dim = d.dim; unitBase = d.base; } else if (/dollar|cent|\$/.test(hint)) dim = "money"; }
    if (!dim && parsed.some(p => p.q)) dim = "count";
    const bases = [];
    parsed.forEach((p, i) => { const d = p.d || (dim === "time" || dim === "length" ? parseDim(good[i], dim) : null);
      if (d && d.dim === dim) bases.push(d.base); else if (p.q && !p.q.money && unitBase != null && !d) bases.push(p.q.n * unitBase); });
    return { dim, bases };
  }
  function checkAnswer(input, answers, opts) {
    opts = opts || {};
    const good = [].concat(answers || [], opts.aliases || []).filter(x => x != null && String(x).trim());
    const v = norm(input); if (!v) return false;
    const goodN = good.map(norm);
    // Anything content lists explicitly (answer or alias) is always accepted, ambiguous surnames included.
    if (goodN.includes(v)) return true;
    // Known wrong answers are checked BEFORE numbers, nicknames and typos ("mick schumacher" stays wrong).
    const wrongN = [].concat(opts.wrong || []).map(norm).filter(w => w && !goodN.includes(w));
    if (wrongN.includes(v)) return false;
    // Units with a dimension: an explicit unit must match the expected dimension ("70 percent" for a count, "15 minutes"
    // for money -> wrong); same dimension compares converted values ("900 seconds" = "15 minutes"). Bare numbers fall through.
    const textOnly = !!opts.textOnly;   // content flag: no number parsing at all ("9" is not "N"/"nine")
    if (!textOnly && good.some(isNumeric) && parseQty(input) === null && !/\d/.test(v)) { const fx = fuzzyNumText(input); if (fx !== input && parseQty(fx) !== null) input = fx; }
    if (!textOnly && good.some(g => parseQty(g) || parseDim(g))) {
      const exp = expectedDims(good, opts), vd = parseDim(input, exp.dim), vMoney = (parseQty(input) || {}).money;
      if (vd && exp.dim && vd.dim !== exp.dim) return false;
      if (vMoney && exp.dim && exp.dim !== "money" && !(exp.dim === "count" && good.some(g => { const q = parseQty(g); return q && !Number.isInteger(q.n); }))) return false;   // explicit $/dollars/cents/bucks only for money answers (bare counts reject it too)
      if (vd && vd.dim === exp.dim && exp.dim !== "money") return exp.bases.some(b => Math.abs(b - vd.base) <= 1e-9 * Math.max(1, Math.abs(b))) && !wrongN.some(w => { const wd = parseDim(w, exp.dim); return wd && Math.abs(wd.base - vd.base) < 1e-9; });
    }
    // Numbers: unit-aware value compare; never typo-tolerant. "$5" != "5 cents"; bare "5" != 0.05.
    const vq = textOnly ? null : parseQty(input);
    if (vq !== null) {
      // A wrong entry with the same value and unit kind ("$5" wrong, "5 dollars" typed) is rejected.
      if (wrongN.some(w => { const wq = parseQty(w); return wq && wq.money === vq.money && numEq(wq.n, vq.n); })) return false;
      // Money is normalized to dollars, so "$5" (5) never equals "5 cents" (0.05), and bare "5" never equals 0.05.
      // Cents answers (any listed form carries a cents unit, e.g. bat-and-ball "5" / "5 cents" / "$0.05"):
      // bare "5"/"five" still match the listed bare "5", but a DOLLAR input must equal the cents value in dollars ($0.05).
      const gqs = good.map(parseQty).filter(Boolean), centsAns = gqs.filter(g => g.unit === "cents");
      if (vq.unit === "usd" && centsAns.length) return centsAns.some(g => numEq(g.n, vq.n)) || gqs.some(g => g.unit === "usd" && numEq(g.n, vq.n));
      return gqs.some(g => numEq(g.n, vq.n));
    }
    if (textOnly ? /\d/.test(v) : (good.some(isNumeric) && /\d/.test(v))) return false;
    // Names: nickname on the first word ("Mike Jordan" = "Michael Jordan").
    const vc = canonName(v), goodC = goodN.map(canonName);
    if (goodC.includes(vc)) return true;
    // Last name alone ("Barry Bonds" -> "bonds") ONLY when the question is about a person (see isPersonQuestion),
    // never for ambiguous surnames, and never when the question opts out.
    if (!opts.noSurname && isPersonQuestion(opts)) goodN.forEach(g => {
      const w = g.split(" ");
      if (w.length >= 2 && w.length <= 3 && w.every(x => /^[a-z]+$/.test(x)) && !NOT_A_FIRST_NAME.has(w[0])) {
        const last = w[w.length - 1];
        if (last.length >= 3 && !AMBIGUOUS_SURNAMES.has(last) && !goodC.includes(last)) goodC.push(last);
      }
    });
    // Typos, scaled by length; only for non-numeric answers, and never toward a listed wrong answer.
    const wrongC = wrongN;
    const vs = vc.replace(/ /g, "");
    let best = Infinity, ok = false;
    goodC.forEach(g => {
      if (!textOnly && isNumeric(g)) return;
      // Allowance from the SHORTER string ("mal" vs "mali" gets 0), and on short words the first letter must match
      // (blocks home/rome); also never accept a typo that is itself the start of a different, longer name
      // pattern like iran/iraq or austria/australia: a substitution in the last two letters of a short word, or a 2+ letter tail change.
      const gs = g.replace(/ /g, ""), dist = dl(vs, gs);
      if (!dist) { ok = true; best = 0; return; }
      if (vs[0] !== gs[0] && Math.min(vs.length, gs.length) < 6) return;   // short words: first letter must match
      if (dist <= allowed(Math.min(vs.length, gs.length)) && !nearMiss(vs, gs)) { ok = true; best = Math.min(best, dist); }
    });
    if (!ok) return false;
    const vr = v.replace(/ /g, "");   // compare the typed form too, so a typo of "mick schumacher" is not rescued by mick->michael
    return !wrongC.some(w => { const ws = w.replace(/ /g, ""); return Math.min(dl(vs, ws), dl(vr, ws)) <= best; });
  }
  // ---- Think Fast guesstimates ----
  // Parses an estimate: "1,200", "1.2k", "3 million", "2.5bn", "$40", "40 dollars", "5 cents", "-12", "1/2".
  // Unit-aware for money via parseNum/parseQty: if the expected unit is "cents", dollar input is converted ($0.05 -> 5).
  const MULT = { k: 1e3, thousand: 1e3, m: 1e6, mil: 1e6, mn: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9, t: 1e12, trillion: 1e12 };
  function parseEstimate(raw, unit) {
    const s0 = norm(raw).replace(/,/g, "").replace(/^(about|around|approx|approximately|roughly|~)\s*/, "").replace(/^~/, "");
    let mult = 1, s = s0;
    const uDim = unit && unit !== "cents" ? (parseDim("1 " + unit) || {}).dim : null;
    const m = s.match(/^(.*?\d)\s*(k|thousand|m|mil|mn|million|b|bn|billion|t|trillion)\b\s*(.*)$/);
    if (m && !(m[2] === "m" && (uDim || /^(iles?|eters?|etres?)$/.test(m[3])))) { mult = MULT[m[2]]; s = (m[1] + " " + m[3]).trim(); }
    // Same value in another unit counts: "365 days" for an answer in hours -> 8,760 (time/length via parseDim).
    const ud = unit && unit !== "cents" ? parseDim("1 " + unit) : null, d = parseDim(s, ud && ud.dim);
    if (d && ud && d.dim === ud.dim) return d.base / ud.base * mult;
    if (d && ud) return null;   // wrong dimension ("5 km" for a number of hours)
    s = s.replace(/\s*(kg|kilograms?|lbs?|pounds?|people|keys|times)$/, "").replace(/\s+[a-z]+$/, m => !(m.trim() in SMALL) && (!unit || norm(unit).startsWith(m.trim().replace(/s$/, ""))) ? "" : m);
    const q = parseQty(s);
    if (!q) return null;
    let n = q.n * mult;
    if (unit === "cents" && (q.unit === "usd")) n *= 100;
    else if (unit === "cents" && q.unit === "cents") n *= 100;  // parseNum already scaled "5 cents" to 0.05 dollars
    return Number.isFinite(n) ? n : null;
  }
  // Closeness score: full points within 5% of the answer, sliding linearly to 0 at 50% off (and 0 beyond).
  // Error is relative to |answer| so negative answers work; an answer of 0 needs an exact 0 (no relative scale).
  function closenessScore(guess, answer, max) {
    if (typeof guess !== "number" || typeof answer !== "number" || !isFinite(guess) || !isFinite(answer)) return 0;
    if (answer === 0) return Math.abs(guess) < 1e-9 ? max : 0;
    const err = Math.abs(guess - answer) / Math.abs(answer);
    if (err <= 0.05 + 1e-9) return max;
    if (err >= 0.5) return 0;
    return Math.round(max * (0.5 - err) / 0.45);
  }
  // Year / absolute-band scoring for Sports year-guess (and any guess with exactYear / yearBand).
  // exactYear:true → full points only on the exact year (band 0). yearBand:N → full if |guess−answer| ≤ N, else 0.
  // When neither flag is set, callers keep using closenessScore (relative %). Default yearBand unused (= omit the field).
  function yearScore(guess, answer, max, opts) {
    if (typeof guess !== "number" || typeof answer !== "number" || !isFinite(guess) || !isFinite(answer)) return 0;
    const o = opts || {};
    const band = typeof o.yearBand === "number" && isFinite(o.yearBand) ? Math.max(0, o.yearBand) : 0;
    const g = Math.round(guess), a = Math.round(answer);
    return Math.abs(g - a) <= band ? max : 0;
  }
  const api = { checkAnswer, parseDim, parseEstimate, closenessScore, yearScore, isPersonQuestion, norm, parseNum, parseQty, dl, NICK, AMBIGUOUS_SURNAMES };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Answers = api;
})(typeof window !== "undefined" ? window : globalThis);
