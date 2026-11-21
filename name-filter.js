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
    word: ["anal", "ass", "beaner", "beyotch", "biatch", "chinc", "chink", "cock", "cono", "coon", "coonz", "culo", "cum", "cvnt", "dick", "dyk", "dyke", "fag", "faget", "fagit", "fagot", "fagz", "fck", "fcker", "fcking", "fckn", "fgt", "fkn", "fuggin", "fuk", "fuking", "fukk", "fukker", "gook", "hitlr", "jewboy", "jewfag", "kike", "kikez", "kunt", "kyke", "mamon", "mamona", "marica", "nggr", "nibba", "nig", "nigah", "niga", "nigar", "nigha", "niglet", "nigr", "nigur", "nikka", "niqqa", "paki", "paky", "perra", "phag", "phaggot", "phagot", "pito", "porn", "pron", "puta", "puto", "raghead", "raghed", "rape", "sex", "sexo", "shemale", "sht", "shtty", "slvt", "spic", "spik", "tit", "trannie", "trany", "verga", "wank", "wetback", "wetbak", "zorra"]
  };

  const ALLOW = ["acker", "actitud", "aggy", "analia", "analog", "analogy", "analysis", "analyst", "aptitud", "aptitude", "ashkenazi", "ashlee", "assess", "attitude", "badminton", "baggett", "banal", "banality", "banking", "banner", "basement", "batch", "beatitude", "beaver", "benedick", "benner", "bigger", "birch", "blocks", "canal", "caputo", "caron", "certitude", "chick", "chin", "china", "ching", "chuck", "cockatoo", "cockburn", "cockerel", "cockrell", "cockroach", "cocktail", "commodore", "competitor", "con", "cone", "conn", "conni", "conny", "constitution", "coonan", "coppola", "cora", "corny", "cumming", "cummings", "damon", "dennis", "dickens", "dickerson", "dickinson", "dickson", "dido", "dikshit", "document", "dora", "dumas", "dykes", "enigma", "ennis", "esperanza", "essex", "exactitude", "fagin", "fagotti", "fagotto", "fanny", "farica", "fatty", "fay", "fitch", "fortitude", "frannie", "franny", "fuller", "granny", "gratitud", "gratitude", "gussy", "hancock", "hestia", "hiller", "hitchcock", "horn", "horne", "hoshitani", "identity", "ignazio", "ineptitude", "inga", "jodee", "jonas", "kitty", "kora", "latitud", "latitude", "leacock", "lightwater", "lola", "lora", "macon", "madonna", "maggy", "mahon", "mammon", "manon", "maria", "marice", "marika", "marina", "marinna", "marion", "marisa", "marissa", "marita", "mariya", "marrissa", "martica", "mason", "middlesex", "model", "modelo", "moderna", "moderno", "modest", "modestia", "modesto", "modificar", "modulo", "mora", "multitude", "nagy", "nazia", "nazir", "nigar", "nigel", "niger", "nigeria", "night", "nightingale", "nike", "niki", "nikki", "nina", "nissa", "nita", "nola", "nora", "ola", "opera", "ora", "paola", "parra", "peacock", "peers", "pena", "penistone", "penni", "pennie", "perea", "peri", "peria", "perl", "perla", "perri", "perry", "peta", "petite", "petra", "pettis", "phuc", "phuket", "pina", "pitch", "pola", "polar", "polk", "pollack", "pollard", "polls", "polly", "pool", "poole", "pools", "promptitude", "puppy", "pusey", "pussycat", "ramon", "ramona", "ranking", "rectitude", "regard", "reward", "rora", "scunthorpe", "seemed", "semenov", "semenya", "seven", "sexton", "shay", "shitake", "shiteh", "shitterton", "shittu", "shore", "spice", "spicy", "spikes", "stafford", "staffordshire", "stick", "stitch", "sussex", "susy", "tennis", "tera", "terra", "therapist", "think", "tiffy", "tiger", "tilly", "timmy", "titan", "titania", "titanic", "titian", "titmouse", "tito", "titulo", "titus", "tracie", "tracy", "tran", "trance", "trans", "valina", "vega", "vera", "verla", "verna", "walker", "walking", "wanting", "wessex", "where", "whole", "whose", "witch", "woodcock", "yemen", "yoder", "yoshito", "zara", "zola", "zora", "zorah"];
  const ALLOW_SET = new Set(ALLOW);
  const PHRASE_ALLOW = new Set(["dick van dyke", "dick uan dyke"]);

  const CONF_FROM = "\u0131\u0130\u0456\u0457\u04CF\u0430\u0410\u0435\u0415\u043E\u041E\u0440\u0420\u0441\u0421\u0443\u0423\u0445\u0425\u0455\u04BB\u03B1\u0391\u03B5\u0395\u03BF\u039F\u03C1\u03A1\u03B9\u0399\u03BA\u039A\u03C4\u03A4\u03C5\u03A5\u03C7\u03A7\u039D\u00E6\u00C6\u0153\u0152";
  const CONF_TO = "iiiiiaaeeooppccyyxxshaaeeooppiikkttyyxxnaaoo";
  const EXTRA = {
    "\u03B7": "n", "\u0397": "n", "\u03BD": "v", "\u03C5": "u", "\u03A5": "u",
    "\u1D00": "a", "\u0299": "b", "\u1D04": "c", "\u1D05": "d", "\u1D07": "e", "\uA730": "f", "\u0262": "g", "\u029C": "h", "\u026A": "i", "\u1D0A": "j", "\u1D0B": "k", "\u029F": "l", "\u1D0D": "m", "\u0274": "n", "\u1D0F": "o", "\u1D18": "p", "\u0280": "r", "\uA731": "s", "\u1D1B": "t", "\u1D1C": "u", "\u1D20": "v", "\u1D21": "w", "\u028F": "y", "\u1D22": "z",
    "\u1D43": "a", "\u1D47": "b", "\u1D9C": "c", "\u1D48": "d", "\u1D49": "e", "\u1DA0": "f", "\u1D4D": "g", "\u02B0": "h", "\u2071": "i", "\u02B2": "j", "\u1D4F": "k", "\u02E1": "l", "\u1D50": "m", "\u207F": "n", "\u1D52": "o", "\u1D56": "p", "\u02B3": "r", "\u02E2": "s", "\u1D57": "t", "\u1D58": "u", "\u1D5B": "v", "\u02B7": "w", "\u02E3": "x", "\u02B8": "y", "\u1DBB": "z",
    "\u1DB0": "n", "\u1DA6": "i",
    "q": "g", "Q": "g", "v": "u", "V": "u",
    "\u0473": "u", "\u0472": "u", "\u0475": "u", "\u0474": "u",
    "\u01EB": "g", "\u01EA": "g", "\uA7AF": "g"
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

  function canon(s) {
    return String(s).replace(/q/g, "g").replace(/v/g, "u");
  }
  const ALLOW_CANON = new Set(ALLOW.map(canon));
  function allowed(token) {
    return ALLOW_SET.has(token) || ALLOW_CANON.has(token);
  }

  function edit1(a, b) {
    if (a === b) return true;
    const la = a.length;
    const lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    if (la === lb) {
      let diff = 0;
      for (let i = 0; i < la; i++) if (a.charAt(i) !== b.charAt(i) && ++diff > 1) return false;
      return diff === 1;
    }
    const longer = la > lb ? a : b;
    const shorter = la > lb ? b : a;
    let i = 0;
    let j = 0;
    let skipped = 0;
    while (i < longer.length && j < shorter.length) {
      if (longer.charAt(i) === shorter.charAt(j)) { i++; j++; }
      else if (++skipped > 1) return false;
      else i++;
    }
    return true;
  }

  const EDIT_TARGETS = [];
  (function () {
    const seen = new Set();
    TERMS.sub.concat(TERMS.word).forEach(term => {
      if (term === "boobs" || term.length < 5) return;
      const sq = squeezeLetters(canon(term));
      if (seen.has(sq)) return;
      seen.add(sq);
      EDIT_TARGETS.push(sq);
    });
  })();

  function editHit(text) {
    const sq = squeezeLetters(canon(text));
    for (let i = 0; i < EDIT_TARGETS.length; i++) if (edit1(sq, EDIT_TARGETS[i])) return true;
    return false;
  }

  function boobHit(text) {
    return /bo{2,}b(?:s|z|ies)?/.test(text);
  }

  function longTerm(text, ranges) {
    const subs = TERMS.sub.concat(TERMS.compound, TERMS.imp);
    const mapped = squeezeMap(text);
    const collapsed = mapped.sq !== text;
    for (let i = 0; i < subs.length; i++) {
      const original = subs[i];
      const term = canon(original);
      if (exposed(text, term, ranges) || (attached(text, term) && !covered(ranges, 0, text.length))) return original;
      const tsq = squeezeLetters(term);
      if (!collapsed || original === "boobs") continue;
      if (mapped.sq === tsq && !covered(ranges, 0, text.length)) return original;
      let from = 0;
      while (tsq.length >= 4 && from <= mapped.sq.length - tsq.length) {
        const at = mapped.sq.indexOf(tsq, from);
        if (at < 0) break;
        const start = mapped.map[at];
        const end = mapped.map[at + tsq.length - 1] + 1;
        if (!covered(ranges, start, end - start)) return original;
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
      const original = shorts[i];
      const term = canon(original);
      const tsq = squeezeLetters(term);
      if ((text === term || attached(text, term) || padded(text, term)) && !covered(ranges, 0, text.length)) return original;
      if (loose && exposed(text, term, ranges)) return original;
      if (!collapsed) continue;
      if ((mapped.sq === tsq || attached(mapped.sq, tsq) || padded(mapped.sq, tsq)) && !covered(ranges, 0, text.length)) return original;
      if (loose && exposed(mapped.sq, tsq, null)) return original;
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
      ranges.push({ start: at, end: at + len, allow: allowed(part.full) });
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
      if (subs[i] !== "boobs" && sq === squeezeLetters(canon(subs[i]))) return reasonFor(subs[i]);
    }
    const shorts = TERMS.word.concat(TERMS.impWord);
    for (let i = 0; i < shorts.length; i++) {
      if (sq === squeezeLetters(canon(shorts[i])) || attached(sq, squeezeLetters(canon(shorts[i])))) return reasonFor(shorts[i]);
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
    const joinedTokens = [];
    let phraseRun = [];
    function flushPhrase() {
      if (phraseRun.length) joinedTokens.push(phraseRun.map(part => part.stem).join(""));
      phraseRun = [];
    }
    parts.forEach(part => {
      const prev = phraseRun[phraseRun.length - 1];
      if (!prev || prev.raw.length <= 3 || part.raw.length <= 3) phraseRun.push(part);
      else { flushPhrase(); phraseRun = [part]; }
    });
    flushPhrase();
    const phraseForms = [stems, stems.map(stem => squeezeLetters(stem)), joinedTokens, joinedTokens.map(token => squeezeLetters(token))];
    for (let p = 0; p < PHRASE_BLOCK.length; p++) {
      if (phraseForms.some(form => hasPhrase(form, PHRASE_BLOCK[p]))) return { ok: false, reason: "impersonation", name: "" };
    }
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (allowed(part.full) || allowed(part.stem)) {
        if (part.full === part.stem || allowed(part.full)) {
          if (allowed(part.full) && parts[i - 1] && parts[i + 1]) {
            const glue = glueJudge(parts[i - 1].stem + parts[i + 1].stem);
            if (glue) return { ok: false, reason: glue, name: "" };
          }
          if (allowed(part.full)) continue;
        }
      }
      if (part.stem === "dyke" && parts[i - 1] && (parts[i - 1].stem === "van" || parts[i - 1].stem === "uan")) continue;
      const why = judge(part.full, false) || (part.leet !== part.full ? judge(part.leet, false) : "");
      if (why || boobHit(part.full) || boobHit(part.leet) || editHit(part.stem) || editHit(part.leet)) return { ok: false, reason: why || "profanity", name: "" };
    }
    let run = [];
    function flushRun() {
      if (run.length < 2) { run = []; return ""; }
      const joined = run.map(part => part.stem).join("");
      const loose = run.every(part => part.raw.length === 1);
      const ranges = rangesFor(run);
      const why = judge(joined, loose, ranges) || judge(leetAll(joined), loose, ranges);
      if (!why && (boobHit(joined) || boobHit(leetAll(joined)) || editHit(joined) || editHit(leetAll(joined)))) return "profanity";
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
