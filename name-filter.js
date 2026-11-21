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
    sub: ["asshole", "badass", "bastard", "bitch", "blowjob", "cabron", "cabrona", "capullo", "chingada", "chingado", "chingar", "cojones", "culero", "cunt", "dickhead", "dildo", "dumbass", "faggot", "fock", "fuck", "fvck", "gilipollas", "handjob", "hentai", "horny", "hostia", "jackass", "jizz", "joder", "mamon", "mamona", "maricon", "mierda", "nigga", "nigg", "nigger", "nude", "orgasm", "pendeja", "pendejo", "penis", "phuck", "phuk", "pinche", "polla", "porn", "pussy", "rape", "rapist", "retard", "sexual", "sexy", "shit", "slut", "twat", "vagina", "wank", "whore", "xxx"],
    word: ["anal", "ass", "cock", "cono", "cum", "dick", "fag", "marica", "perra", "pito", "puta", "puto", "sex", "sexo", "tit", "verga", "zorra"]
  };

  function clean(raw) {
    return String(raw == null ? "" : raw).replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim();
  }

  function fold(raw) {
    let s = clean(raw).normalize("NFKD").replace(/\p{M}/gu, "").replace(/ß/g, "ss").toLowerCase();
    s = s.replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t").replace(/8/g, "b").replace(/9/g, "g").replace(/@/g, "a").replace(/\$/g, "s").replace(/\+/g, "t").replace(/[|!]/g, "i");
    return s;
  }

  function squeeze(raw) {
    return fold(raw).replace(/[^a-z0-9]/g, "").replace(/(.)\1+/g, "$1");
  }

  function tokens(raw) {
    const spaced = fold(raw).replace(/[^a-z0-9]+/g, " ").trim();
    return spaced ? spaced.split(" ") : [];
  }

  function squeezeDigits(raw) {
    let s = clean(raw).normalize("NFKD").replace(/\p{M}/gu, "").replace(/ß/g, "ss").toLowerCase();
    s = s.replace(/@/g, "a").replace(/\$/g, "s").replace(/\+/g, "t").replace(/[|!]/g, "i");
    return s.replace(/[^a-z0-9]/g, "").replace(/(.)\1+/g, "$1");
  }

  // Banned terms go through the same squeeze as the name. A normalized term
  // of 3+ characters is a substring. Shorter ones ("ass" -> "as", "xxx" -> "x")
  // match the whole name or a digit suffix only, so they do not ban every "as" or "x".
  const NORM = {
    imp: TERMS.imp.map(squeeze),
    impWord: TERMS.impWord.map(squeeze),
    sub: TERMS.sub.map(squeeze),
    word: TERMS.word.map(squeeze)
  };

  function hits(kind, sq, digits) {
    const list = NORM[kind];
    for (let i = 0; i < list.length; i++) {
      const term = list[i];
      if (!term) continue;
      if (sq === term) return true;
      if (term.length >= 3 && sq.indexOf(term) >= 0) return true;
      if (digits.indexOf(term) === 0 && /^\d+$/.test(digits.slice(term.length))) return true;
    }
    return false;
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
    if (/^(player|jugador)\d{4}$/.test(name.toLowerCase().replace(/\s+/g, ""))) return { ok: false, reason: "tag", name: "" };
    const chars = Array.from(name);
    if (chars.length < 3 || chars.length > 20) return { ok: false, reason: "length", name: "" };
    if (contact(name)) return { ok: false, reason: "contact", name: "" };
    if (!/^[\p{L}\p{N}](?:[\p{L}\p{N}'’ -]*[\p{L}\p{N}])?$/u.test(name)) return { ok: false, reason: "chars", name: "" };
    const sq = squeeze(name);
    const digits = squeezeDigits(name);
    if (hits("imp", sq, digits) || hits("impWord", sq, digits)) return { ok: false, reason: "impersonation", name: "" };
    if (hits("sub", sq, digits) || hits("word", sq, digits)) return { ok: false, reason: "profanity", name: "" };
    return { ok: true, skip: false, name: name };
  }

  return { TERMS: TERMS, clean: clean, fold: fold, squeeze: squeeze, tokens: tokens, checkName: checkName };
});
