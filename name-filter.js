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
    imp: ["admin", "dailydose", "moderator", "oficial", "official", "soporte", "staff", "support"],
    impWord: ["mod", "mods"],
    compound: ["cooladmin", "modteam", "staffer"],
    sub: ["1488", "asshole", "badass", "bastard", "beaner", "bitch", "blowjob", "bollocks", "boobs", "cabron", "cabrona", "capullo", "chinga", "chingada", "chingado", "chingar", "cocksucker", "cojones", "culero", "cunt", "dickhead", "dildo", "dumbass", "faggot", "fock", "fuck", "fvck", "gilipollas", "handjob", "hentai", "hitler", "horny", "hostia", "jackass", "jizz", "joder", "kkk", "mamaguevo", "maricon", "mierda", "nazi", "nigga", "nigg", "nigger", "niqqer", "nlgger", "nude", "orgasm", "pendeja", "pendejo", "penis", "phuck", "phuk", "pinche", "pinga", "polla", "pussy", "raghead", "rapist", "retard", "semen", "sexual", "sexy", "slut", "tranny", "twat", "vagina", "wanker", "wetback", "whore"],
    word: ["anal", "ass", "chink", "cock", "cono", "coon", "culo", "cum", "dick", "dyke", "fag", "gook", "kike", "mamon", "mamona", "marica", "nig", "paki", "perra", "pito", "porn", "pron", "puta", "puto", "rape", "sex", "sexo", "shit", "spic", "tit", "verga", "wank", "zorra"]
  };

  const ALLOW = ["actitud", "analia", "analog", "analogy", "analysis", "analyst", "aptitud", "aptitude", "attitude", "banal", "banality", "beatitude", "benedick", "canal", "certitude", "cockatoo", "cockburn", "cockerel", "cockrell", "cocktail", "cockroach", "competitor", "constitution", "cumming", "cummings", "dickens", "dickerson", "dickinson", "dickson", "document", "enigma", "esperanza", "essex", "exactitude", "fortitude", "gratitud", "gratitude", "hancock", "hitchcock", "identity", "ineptitude", "latitud", "latitude", "leacock", "middlesex", "model", "modelo", "moderno", "modest", "modestia", "modesto", "modificar", "modulo", "multitude", "night", "nightingale", "nigel", "nigeria", "peacock", "petite", "promptitude", "rectitude", "scunthorpe", "sexton", "stafford", "stitch", "sussex", "titan", "titanic", "titania", "titian", "titmouse", "tito", "titulo", "titus", "wessex", "woodcock"];
  const ALLOW_SET = new Set(ALLOW);
  const PHRASE_ALLOW = new Set(["dick van dyke"]);

  const CONF_FROM = "\u0131\u0130\u0456\u0457\u04CF\u0430\u0410\u0435\u0415\u043E\u041E\u0440\u0420\u0441\u0421\u0443\u0423\u0445\u0425\u0455\u04BB\u03B1\u0391\u03B5\u0395\u03BF\u039F\u03C1\u03A1\u03B9\u0399\u03BA\u039A\u03C4\u03A4\u03C5\u03A5\u03C7\u03A7\u039D\u00E6\u00C6\u0153\u0152";
  const CONF_TO = "iiiiiaaeeooppccyyxxshaaeeooppiikkttyyxxnaaoo";

  function clean(raw) {
    return String(raw == null ? "" : raw).replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim();
  }

  function mapConfusables(s) {
    let out = "";
    for (const ch of s) {
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

  function tagLine(prepped) {
    return prepped.replace(/[a-z0-9]+/g, part => {
      const tok = splitToken(part);
      return tok.stem + tok.trail;
    });
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
    if (/(?:player|jugador)[^a-z0-9]*\d{4}(?!\d)/.test(tagLine(prepped))) return { ok: false, reason: "tag", name: "" };
    if (!/^[\p{L}\p{N}](?:[\p{L}\p{N}'’ -]*[\p{L}\p{N}])?$/u.test(folded)) return { ok: false, reason: "chars", name: "" };
    const tokens = tokensOf(prepped);
    const phrase = tokens.map(t => t.stem).join(" ");
    if (PHRASE_ALLOW.has(phrase)) return { ok: true, skip: false, name: name };
    for (let i = 0; i < tokens.length - 1; i++) {
      if (tokens[i].stem === "daily" && tokens[i + 1].stem === "dose") return { ok: false, reason: "impersonation", name: "" };
    }
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (!tok.synthetic && !tok.trail && ALLOW_SET.has(tok.stem)) {
        const prev = tokens[i - 1];
        const next = tokens[i + 1];
        if (prev && next) {
          const joined = { raw: prev.stem + next.stem, full: prev.full + next.full, stem: prev.stem + next.stem, trail: "", synthetic: true };
          const why = classify(joined, true);
          if (why) return { ok: false, reason: why, name: "" };
        }
        continue;
      }
      if (tok.stem === "dyke" && i > 0 && tokens[i - 1].stem === "van") continue;
      const why = classify(tok, tok.synthetic === true);
      if (why) return { ok: false, reason: why, name: "" };
    }
    return { ok: true, skip: false, name: name };
  }

  function fold(raw) { return prep(raw); }

  return { TERMS: TERMS, ALLOW: ALLOW, clean: clean, fold: fold, squeeze: squeeze, checkName: checkName };
});
