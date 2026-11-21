/* Display-name check for the public daily board.
   The same rules run in the browser (this file) and in private.board_name_status.
   tools/name-filter.test.js keeps the two lists identical.
   A rejected name is not echoed. The birth year never enters this file. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.NameFilter = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const TERMS = {
    imp: ["admin", "brainclash", "dailydose", "moderator", "oficial", "official", "soporte", "staff", "support"],
    impWord: ["mod", "mods"],
    compound: ["cooladmin", "modsquad", "modteam", "staffer"],
    sub: ["1488", "assclown", "asshat", "asshole", "asslicker", "asswipe", "badass", "bastard", "bigcock", "bigdick", "bitch", "blowjob", "bollocks", "boobs", "bullshit", "cabron", "cabrona", "capullo", "chinga", "chingada", "chingado", "chingar", "cockhead", "cocksucker", "cojones", "coonass", "culero", "cumdump", "cumshot", "cunt", "dickbutt", "dickface", "dickhead", "dickweed", "dildo", "dumbass", "dumbshit", "eatshit", "fagg", "faggy", "faggot", "fock", "fuck", "fvck", "gilipollas", "handjob", "hentai", "hitler", "horny", "hostia", "jackass", "jizz", "joder", "kissmyass", "kkk", "mamaguevo", "maricon", "mierda", "nazi", "nigga", "nigg", "nigger", "nignog", "niqqer", "nlgger", "nude", "orgasm", "pendeja", "pendejo", "penis", "phuck", "phuk", "pinche", "pinga", "polla", "pornhub", "pornstar", "pussy", "raghead", "rapist", "retard", "semen", "sexual", "sexy", "shit", "shitface", "shithead", "shitty", "slut", "spick", "titty", "tranny", "twat", "vagina", "wanker", "wanking", "wetback", "whore"],
    word: ["anal", "ass", "beaner", "beyotch", "biatch", "chink", "cock", "cono", "coon", "culo", "cum", "dick", "dyke", "fag", "fck", "fuk", "fukk", "gook", "kike", "mamon", "mamona", "marica", "nibba", "nig", "niga", "nikka", "paki", "perra", "phag", "pito", "porn", "pron", "puta", "puto", "raghead", "rape", "sex", "sexo", "sht", "spic", "tit", "verga", "wank", "wetback", "zorra"]
  };

  const ALLOW = ["actitud", "analia", "analog", "analogy", "analysis", "analyst", "aptitud", "aptitude", "ashkenazi", "attitude", "badminton", "banal", "banality", "beatitude", "benedick", "canal", "certitude", "cockatoo", "cockburn", "cockerel", "cockrell", "cocktail", "cockroach", "commodore", "competitor", "constitution", "cumming", "cummings", "dickens", "dickerson", "dickinson", "dickson", "dikshit", "document", "dykes", "enigma", "esperanza", "essex", "exactitude", "fortitude", "gratitud", "gratitude", "hancock", "hitchcock", "hoshitani", "identity", "ignazio", "ineptitude", "latitud", "latitude", "leacock", "lightwater", "mammon", "middlesex", "model", "modelo", "moderna", "moderno", "modest", "modestia", "modesto", "modificar", "modulo", "multitude", "nazia", "nazir", "night", "nightingale", "nigel", "nigeria", "peacock", "penistone", "petite", "phuket", "pollack", "pollard", "promptitude", "pussycat", "rectitude", "scunthorpe", "semenov", "semenya", "sexton", "shiteh", "shitake", "shitterton", "shittu", "stafford", "staffordshire", "stitch", "sussex", "therapist", "titan", "titanic", "titania", "titian", "titmouse", "tito", "titulo", "titus", "wessex", "woodcock", "yoshito"];
  const ALLOW_SET = new Set(ALLOW);
  const PHRASE_ALLOW = new Set(["dick van dyke"]);

  const CONF_FROM = "\u0131\u0130\u0456\u0457\u04CF\u0430\u0410\u0435\u0415\u043E\u041E\u0440\u0420\u0441\u0421\u0443\u0423\u0445\u0425\u0455\u04BB\u03B1\u0391\u03B5\u0395\u03BF\u039F\u03C1\u03A1\u03B9\u0399\u03BA\u039A\u03C4\u03A4\u03C5\u03A5\u03C7\u03A7\u039D\u00E6\u00C6\u0153\u0152";
  const CONF_TO = "iiiiiaaeeooppccyyxxshaaeeooppiikkttyyxxnaaoo";
  const EXTRA = {
    "\u03B7": "n", "\u0397": "n", "\u03BD": "v", "\u03C5": "u", "\u03A5": "u",
    "\u1D00": "a", "\u0299": "b", "\u1D04": "c", "\u1D05": "d", "\u1D07": "e", "\uA730": "f", "\u0262": "g", "\u029C": "h", "\u026A": "i", "\u1D0A": "j", "\u1D0B": "k", "\u029F": "l", "\u1D0D": "m", "\u0274": "n", "\u1D0F": "o", "\u1D18": "p", "\u0280": "r", "\uA731": "s", "\u1D1B": "t", "\u1D1C": "u", "\u1D20": "v", "\u1D21": "w", "\u028F": "y", "\u1D22": "z",
    "\u1D43": "a", "\u1D47": "b", "\u1D9C": "c", "\u1D48": "d", "\u1D49": "e", "\u1DA0": "f", "\u1D4D": "g", "\u02B0": "h", "\u2071": "i", "\u02B2": "j", "\u1D4F": "k", "\u02E1": "l", "\u1D50": "m", "\u207F": "n", "\u1D52": "o", "\u1D56": "p", "\u02B3": "r", "\u02E2": "s", "\u1D57": "t", "\u1D58": "u", "\u1D5B": "v", "\u02B7": "w", "\u02E3": "x", "\u02B8": "y", "\u1DBB": "z",
    "\u1DB0": "n", "\u1DA6": "i"
  };

  function clean(raw) {
    return String(raw == null ? "" : raw).replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim();
  }

  function mapConfusables(s) {
    let out = "";
    for (const ch of s) {
      if (Object.prototype.hasOwnProperty.call(EXTRA, ch)) { out += EXTRA[ch]; continue; }
      const at = CONF_FROM.indexOf(ch);
      out += at >= 0 ? CONF_TO[at] : ch;
    }
    return out;
  }

  function prep(raw) {
    let s = clean(raw).normalize("NFKC");
    s = mapConfusables(s).toLowerCase();
    s = s.normalize("NFKD").replace(/\p{M}/gu, "").replace(/ß/g, "ss");
    return s;
  }

  function leetAll(s) {
    return s.replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/6/g, "g").replace(/7/g, "t").replace(/8/g, "b").replace(/9/g, "g");
  }

  function splitToken(token) {
    if (/^\d+$/.test(token)) return { raw: token, full: token, stem: token, trail: "" };
    const m = token.match(/^(.*[a-z])(\d+)$/);
    if (m) return { raw: token, full: leetAll(token), stem: leetAll(m[1]), trail: m[2] };
    const full = leetAll(token);
    return { raw: token, full: full, stem: full, trail: "" };
  }

  function squeeze(s) {
    return String(s).replace(/[^a-z0-9]/g, "").replace(/(.)\1+/g, "$1");
  }

  function longHit(text, loose) {
    const flat = text.replace(/[^a-z0-9]/g, "");
    const sq = squeeze(flat);
    const collapsed = sq !== flat;
    for (let i = 0; i < TERMS.sub.length; i++) {
      const term = TERMS.sub[i];
      if (text.indexOf(term) >= 0) return true;
      if (!(loose || collapsed)) continue;
      const tsq = squeeze(term);
      if (sq === tsq) return true;
      if (tsq.length >= 4 && sq.indexOf(tsq) >= 0) return true;
    }
    return false;
  }

  function wordHit(tok, loose) {
    const stem = tok.stem;
    const full = tok.full;
    if (/^x{3,}$/.test(stem) || /^x{3,}$/.test(full)) return true;
    for (let i = 0; i < TERMS.word.length; i++) {
      const term = TERMS.word[i];
      if (stem === term || full === term || stem === term + "s" || full === term + "s") return true;
      if (tok.trail && stem === term && /^\d+$/.test(tok.trail)) return true;
      if (loose && (stem.indexOf(term) >= 0 || full.indexOf(term) >= 0)) return true;
    }
    return false;
  }

  function impHit(tok) {
    const stem = tok.stem;
    const full = tok.full;
    for (let i = 0; i < TERMS.compound.length; i++) {
      const term = TERMS.compound[i];
      if (stem.indexOf(term) >= 0 || full.indexOf(term) >= 0) return true;
    }
    const list = TERMS.imp.concat(TERMS.impWord);
    for (let i = 0; i < list.length; i++) {
      const term = list[i];
      if (stem === term || full === term) return true;
      if (tok.trail && stem === term && /^\d+$/.test(tok.trail)) return true;
    }
    return false;
  }

  function classify(tok, loose) {
    if (impHit(tok)) return "impersonation";
    if (longHit(tok.stem, loose) || longHit(tok.full, loose)) return "profanity";
    if (wordHit(tok, loose)) return "profanity";
    return "";
  }

  function tokensOf(prepped) {
    const parts = prepped.split(/[^a-z0-9]+/).filter(Boolean).map(splitToken);
    const out = [];
    let run = [];
    function flush() {
      if (run.length >= 2) {
        const stem = run.map(t => t.stem).join("");
        out.push({ raw: stem, full: stem, stem: stem, trail: "", synthetic: true });
      } else if (run.length === 1) out.push(run[0]);
      run = [];
    }
    parts.forEach(tok => {
      if (/^[a-z]$/.test(tok.raw)) run.push(tok);
      else { flush(); out.push(tok); }
    });
    flush();
    return out;
  }

  function leetToken(token, digitAsL) {
    if (/^\d+$/.test(token)) return token;
    const m = token.match(/^(.*[a-z])(\d+)$/);
    let stem = m ? m[1] : token;
    const trail = m ? m[2] : "";
    if (digitAsL) stem = stem.replace(/1/g, "l").replace(/i/g, "l");
    return leetAll(stem) + trail;
  }

  function alnumForm(prepped, digitAsL) {
    return prepped.replace(/[a-z0-9]+/g, part => leetToken(part, digitAsL)).replace(/[^a-z0-9]+/g, "");
  }

  function squeezeLetters(s) {
    return String(s).replace(/([a-z])\1+/g, "$1");
  }

  function singlesOnly(prepped) {
    const parts = prepped.split(/[^a-z0-9]+/).filter(Boolean);
    return parts.length >= 2 && parts.every(part => part.length === 1 && /[a-z]/.test(part));
  }

  function wholeTerm(text, term) {
    if (!text || !term) return false;
    return text === term || text === term + "s" || text === "the" + term || text === term + "lover" || new RegExp("^" + term + "\\d+$").test(text) || new RegExp("^x+" + term + "x+$").test(text);
  }

  function contact(name) {
    const packed = name.replace(/\s+/g, "");
    if (packed.indexOf("@") >= 0 || /https?:|www\.|\/\//i.test(packed)) return true;
    if (/(^|[^\p{L}\p{N}])[\p{L}\p{N}-]+\.(?:com|net|org|io|gg|co|me|tv|app|dev|xyz|info|ly|link|site|us|uk|mx|es|gl)(?![\p{L}\p{N}])/iu.test(packed)) return true;
    if (name.replace(/\D/g, "").length >= 7) return true;
    return false;
  }

  const TAILS = ["boys", "boy", "lord", "eyes", "eye", "face", "man", "ies", "es", "s"];
  const PHRASE_BLOCK = ["brain clash", "daily dose"];

  function reasonFor(term) {
    if (TERMS.imp.indexOf(term) >= 0 || TERMS.compound.indexOf(term) >= 0 || TERMS.impWord.indexOf(term) >= 0) return "impersonation";
    return "profanity";
  }

  function attached(text, term) {
    if (!text || !term || text === term) return false;
    for (let i = 0; i < TAILS.length; i++) {
      const tail = TAILS[i];
      if (text.indexOf(term + tail) !== 0) continue;
      if (/^\d*$/.test(text.slice(term.length + tail.length))) return true;
    }
    if (text.indexOf(term) === 0 && /^\d+$/.test(text.slice(term.length))) return true;
    if (term.charAt(term.length - 1) === "y") {
      const plural = term.slice(0, -1) + "ies";
      if (text.indexOf(plural) === 0 && /^\d*$/.test(text.slice(plural.length))) return true;
    }
    return false;
  }

  function covered(ranges, start, len) {
    if (!ranges) return false;
    return ranges.some(range => range.allow && start >= range.start && start + len <= range.end);
  }

  function exposed(text, term, ranges) {
    let from = 0;
    while (from <= text.length - term.length) {
      const at = text.indexOf(term, from);
      if (at < 0) return false;
      if (!covered(ranges, at, term.length)) return true;
      from = at + 1;
    }
    return false;
  }

  function squeezeMap(text) {
    let sq = "";
    const map = [];
    for (let i = 0; i < text.length; i++) {
      const ch = text.charAt(i);
      if (sq.length && ch === sq.charAt(sq.length - 1) && ch >= "a" && ch <= "z") continue;
      map.push(i);
      sq += ch;
    }
    return { sq: sq, map: map };
  }

  function longTerm(text, ranges) {
    const subs = TERMS.sub.concat(TERMS.compound, TERMS.imp);
    const mapped = squeezeMap(text);
    const collapsed = mapped.sq !== text;
    for (let i = 0; i < subs.length; i++) {
      const term = subs[i];
      if (exposed(text, term, ranges) || (attached(text, term) && !covered(ranges, 0, text.length))) return term;
      const tsq = squeezeLetters(term);
      if (!collapsed) continue;
      if (mapped.sq === tsq && !covered(ranges, 0, text.length)) return term;
      let from = 0;
      while (tsq.length >= 4 && from <= mapped.sq.length - tsq.length) {
        const at = mapped.sq.indexOf(tsq, from);
        if (at < 0) break;
        const start = mapped.map[at];
        const end = mapped.map[at + tsq.length - 1] + 1;
        if (!covered(ranges, start, end - start)) return term;
        from = at + 1;
      }
    }
    return "";
  }

  function padded(text, term) {
    if (text === "the" + term || text === term + "lover") return true;
    return new RegExp("^x+" + term + "x+$").test(text);
  }

  function shortTerm(text, loose, ranges) {
    const shorts = TERMS.word.concat(TERMS.impWord);
    const mapped = squeezeMap(text);
    const collapsed = mapped.sq !== text;
    for (let i = 0; i < shorts.length; i++) {
      const term = shorts[i];
      const tsq = squeezeLetters(term);
      if ((text === term || attached(text, term) || padded(text, term)) && !covered(ranges, 0, text.length)) return term;
      if (loose && exposed(text, term, ranges)) return term;
      if (!collapsed) continue;
      if ((mapped.sq === tsq || attached(mapped.sq, tsq) || padded(mapped.sq, tsq)) && !covered(ranges, 0, text.length)) return term;
      if (loose && exposed(mapped.sq, tsq, null)) return term;
    }
    return "";
  }

  function judge(text, loose, ranges) {
    if (!text) return "";
    if ((/^x{3,}$/.test(text) || /^x{3,}$/.test(squeezeLetters(text))) && !covered(ranges, 0, text.length)) return "profanity";
    const longHit = longTerm(text, ranges);
    if (longHit) return reasonFor(longHit);
    const shortHit = shortTerm(text, loose, ranges);
    if (shortHit) return reasonFor(shortHit);
    return "";
  }

  function rangesFor(run) {
    const ranges = [];
    let at = 0;
    run.forEach(part => {
      const len = part.stem.length;
      ranges.push({ start: at, end: at + len, allow: ALLOW_SET.has(part.full) });
      at += len;
    });
    return ranges;
  }

  function glueJudge(text) {
    const why = judge(text, false);
    if (why) return why;
    const sq = squeezeLetters(text);
    const subs = TERMS.sub.concat(TERMS.compound, TERMS.imp);
    for (let i = 0; i < subs.length; i++) {
      if (sq === squeezeLetters(subs[i])) return reasonFor(subs[i]);
    }
    const shorts = TERMS.word.concat(TERMS.impWord);
    for (let i = 0; i < shorts.length; i++) {
      if (sq === squeezeLetters(shorts[i]) || attached(sq, squeezeLetters(shorts[i]))) return reasonFor(shorts[i]);
    }
    return "";
  }

  function hasPhrase(stems, phrase) {
    const words = phrase.split(" ");
    for (let i = 0; i + words.length <= stems.length; i++) {
      let same = true;
      for (let j = 0; j < words.length; j++) if (stems[i + j] !== words[j]) same = false;
      if (same) return true;
    }
    return false;
  }

  function checkName(raw) {
    const name = clean(raw);
    if (!name) return { ok: true, skip: true, name: "" };
    const folded = name.normalize("NFKC");
    const chars = Array.from(folded);
    if (chars.length < 3 || chars.length > 20) return { ok: false, reason: "length", name: "" };
    if (contact(folded)) return { ok: false, reason: "contact", name: "" };
    const prepped = prep(name);
    const tagged = alnumForm(prepped, true);
    if (/(?:player|jugador)\d{4}(?!\d)/.test(tagged)) return { ok: false, reason: "tag", name: "" };
    if (!/^[\p{L}\p{N}](?:[\p{L}\p{N}'’ -]*[\p{L}\p{N}])?$/u.test(folded)) return { ok: false, reason: "chars", name: "" };
    const rawParts = prepped.split(/[^a-z0-9]+/).filter(Boolean);
    const parts = rawParts.map(part => {
      const tok = splitToken(part);
      return { raw: part, stem: tok.stem, full: tok.stem + tok.trail, leet: leetAll(part) };
    });
    const stems = parts.map(part => part.stem);
    const phrase = stems.join(" ");
    if (PHRASE_ALLOW.has(phrase)) return { ok: true, skip: false, name: name };
    for (let p = 0; p < PHRASE_BLOCK.length; p++) {
      if (hasPhrase(stems, PHRASE_BLOCK[p])) return { ok: false, reason: "impersonation", name: "" };
    }
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (ALLOW_SET.has(part.full) || ALLOW_SET.has(part.stem)) {
        if (part.full === part.stem || ALLOW_SET.has(part.full)) {
          if (ALLOW_SET.has(part.full) && parts[i - 1] && parts[i + 1]) {
            const glue = glueJudge(parts[i - 1].stem + parts[i + 1].stem);
            if (glue) return { ok: false, reason: glue, name: "" };
          }
          if (ALLOW_SET.has(part.full)) continue;
        }
      }
      if (part.stem === "dyke" && parts[i - 1] && parts[i - 1].stem === "van") continue;
      const why = judge(part.full, false) || (part.leet !== part.full ? judge(part.leet, false) : "");
      if (why) return { ok: false, reason: why, name: "" };
    }
    let run = [];
    function flushRun() {
      if (run.length < 2) { run = []; return ""; }
      const joined = run.map(part => part.stem).join("");
      const loose = run.every(part => part.raw.length === 1);
      const ranges = rangesFor(run);
      const why = judge(joined, loose, ranges) || judge(leetAll(joined), loose, ranges);
      run = [];
      return why;
    }
    for (let i = 0; i < parts.length; i++) {
      const prev = run[run.length - 1];
      if (!prev || prev.raw.length <= 3 || parts[i].raw.length <= 3) run.push(parts[i]);
      else {
        const why = flushRun();
        if (why) return { ok: false, reason: why, name: "" };
        run = [parts[i]];
      }
    }
    const tail = flushRun();
    if (tail) return { ok: false, reason: tail, name: "" };
    return { ok: true, skip: false, name: name };
  }

  function fold(raw) { return prep(raw); }

  return { TERMS: TERMS, ALLOW: ALLOW, clean: clean, fold: fold, squeeze: squeeze, checkName: checkName };
});
