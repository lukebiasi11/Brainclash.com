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
    sub: ["1488", "asshat", "asshole", "asswipe", "badass", "bastard", "bitch", "blowjob", "bollocks", "boobs", "bullshit", "cabron", "cabrona", "capullo", "chinga", "chingada", "chingado", "chingar", "cockhead", "cocksucker", "cojones", "coonass", "culero", "cunt", "dickface", "dickhead", "dildo", "dumbass", "dumbshit", "fagg", "faggy", "faggot", "fock", "fuck", "fvck", "gilipollas", "handjob", "hentai", "hitler", "horny", "hostia", "jackass", "jizz", "joder", "kkk", "mamaguevo", "maricon", "mierda", "nazi", "nigga", "nigg", "nigger", "nignog", "niqqer", "nlgger", "nude", "orgasm", "pendeja", "pendejo", "penis", "phuck", "phuk", "pinche", "pinga", "polla", "pornhub", "pornstar", "pussy", "raghead", "rapist", "retard", "semen", "sexual", "sexy", "shithead", "shitty", "slut", "spick", "titty", "tranny", "twat", "vagina", "wanker", "wanking", "wetback", "whore"],
    word: ["anal", "ass", "beaner", "chink", "cock", "cono", "coon", "culo", "cum", "dick", "dyke", "fag", "gook", "kike", "mamon", "mamona", "marica", "nig", "paki", "perra", "pito", "porn", "pron", "puta", "puto", "raghead", "rape", "sex", "sexo", "shit", "spic", "tit", "verga", "wank", "wetback", "zorra"]
  };

  const ALLOW = ["actitud", "analia", "analog", "analogy", "analysis", "analyst", "aptitud", "aptitude", "ashkenazi", "attitude", "badminton", "banal", "banality", "beatitude", "benedick", "canal", "certitude", "cockatoo", "cockburn", "cockerel", "cockrell", "cocktail", "cockroach", "commodore", "competitor", "constitution", "cumming", "cummings", "dickens", "dickerson", "dickinson", "dickson", "document", "dykes", "enigma", "esperanza", "essex", "exactitude", "fortitude", "gratitud", "gratitude", "hancock", "hitchcock", "identity", "ineptitude", "latitud", "latitude", "leacock", "mammon", "middlesex", "model", "modelo", "moderna", "moderno", "modest", "modestia", "modesto", "modificar", "modulo", "multitude", "nazia", "nazir", "night", "nightingale", "nigel", "nigeria", "peacock", "penistone", "petite", "promptitude", "rectitude", "scunthorpe", "semenov", "sexton", "stafford", "stitch", "sussex", "therapist", "titan", "titanic", "titania", "titian", "titmouse", "tito", "titulo", "titus", "wessex", "woodcock"];
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
    return s.replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t").replace(/8/g, "b").replace(/9/g, "g");
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
    const joined = alnumForm(prepped, false);
    const squeezed = squeezeLetters(joined);
    const leetJoined = leetAll(joined);
    const spaced = singlesOnly(prepped);
    const tokens = tokensOf(prepped);
    const phrase = tokens.map(t => t.stem).join(" ");
    if (!spaced && (PHRASE_ALLOW.has(phrase) || ALLOW_SET.has(joined))) return { ok: true, skip: false, name: name };
    const subs = TERMS.sub.concat(TERMS.compound, TERMS.imp);
    const reasonFor = (term) => TERMS.imp.indexOf(term) >= 0 || TERMS.compound.indexOf(term) >= 0 ? "impersonation" : "profanity";
    const longOn = (text) => {
      for (let i = 0; i < subs.length; i++) if (text.indexOf(subs[i]) >= 0) return subs[i];
      return "";
    };
    let hit = longOn(joined) || longOn(leetJoined);
    if (!hit && squeezed !== joined) hit = longOn(squeezed);
    if (hit) return { ok: false, reason: reasonFor(hit), name: "" };
    const shorts = TERMS.word.concat(TERMS.impWord);
    const shortWhy = (term) => TERMS.impWord.indexOf(term) >= 0 ? "impersonation" : "profanity";
    const shortOn = (text, loose) => {
      for (let i = 0; i < shorts.length; i++) {
        const term = shorts[i];
        const ok = loose ? text.indexOf(term) >= 0 : (wholeTerm(text, term) || (squeezeLetters(text) !== text && squeezeLetters(text) === squeezeLetters(term)));
        if (ok) return shortWhy(term);
      }
      return "";
    };
    if (!spaced) {
      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].stem === "dyke" && tokens[i - 1] && tokens[i - 1].stem === "van") continue;
        const why = shortOn(tokens[i].stem, false) || shortOn(leetAll(tokens[i].stem), false);
        if (why && !ALLOW_SET.has(tokens[i].stem)) return { ok: false, reason: why, name: "" };
        if (!ALLOW_SET.has(tokens[i].stem) || !tokens[i - 1] || !tokens[i + 1]) continue;
        const glue = tokens[i - 1].stem + tokens[i + 1].stem;
        const glued = longOn(glue) || subs.find(term => squeezeLetters(glue) === squeezeLetters(term));
        if (glued) return { ok: false, reason: reasonFor(glued), name: "" };
        const glueShort = shortOn(glue, false);
        if (glueShort) return { ok: false, reason: glueShort, name: "" };
      }
    }
    const loose = shortOn(joined, spaced) || shortOn(leetJoined, false) || (squeezed !== joined && shortOn(squeezed, spaced));
    if (loose) return { ok: false, reason: loose, name: "" };
    if (/^x{3,}$/.test(joined) || /^x{3,}$/.test(squeezed)) return { ok: false, reason: "profanity", name: "" };
    return { ok: true, skip: false, name: name };
  }

  function fold(raw) { return prep(raw); }

  return { TERMS: TERMS, ALLOW: ALLOW, clean: clean, fold: fold, squeeze: squeeze, checkName: checkName };
});
