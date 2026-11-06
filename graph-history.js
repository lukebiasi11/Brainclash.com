/* Personal history for the results line (Graph 2).
   Reads completed dg-YYYY-MM-DD sessions. Never writes, deletes, or sends them.
   A completed game is one stored day with scores[5], each a finite number from 0 to 1,000.
   Practice, unfinished days, dg-stats, and malformed records are skipped — never guessed. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BCHistory = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function isDayKey(k) {
    if (typeof k !== "string") return false;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k);
    if (!m) return false;
    const y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
    const dt = new Date(Date.UTC(y, mo - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
  }

  function isScore(n) {
    return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1000;
  }

  function isValidCompleted(rec) {
    if (!rec || typeof rec !== "object" || Array.isArray(rec)) return false;
    if (rec.practice === true) return false;
    if (!Array.isArray(rec.scores) || rec.scores.length !== 5) return false;
    for (let i = 0; i < 5; i++) if (!isScore(rec.scores[i])) return false;
    return true;
  }

  function totalOf(scores) {
    let t = 0;
    for (let i = 0; i < 5; i++) t += scores[i];
    return t;
  }

  function copyScores(scores) {
    return [scores[0], scores[1], scores[2], scores[3], scores[4]];
  }

  function dayOf(entry) {
    if (!entry || typeof entry !== "object") return null;
    if (isDayKey(entry.day)) return entry.day;
    if (typeof entry.key === "string" && entry.key.indexOf("dg-") === 0 && isDayKey(entry.key.slice(3))) return entry.key.slice(3);
    return null;
  }

  function recordOf(entry) {
    if (!entry || typeof entry !== "object") return null;
    if (entry.record != null) return entry.record;
    if (entry.value != null) return entry.value;
    return null;
  }

  // entries: { day } or { key:"dg-YYYY-MM-DD" } plus { record } or { value }.
  // viewedDay: pinned completed NY day. Later days are counted but not mixed into this view.
  // memory: optional { day, scores, practice } shown only when that day is not already stored. Never written.
  // One contribution per day; the first valid record wins. Inputs are not mutated.
  function completedGames(entries, viewedDay, memory) {
    const pin = viewedDay == null ? null : (isDayKey(viewedDay) ? viewedDay : null);
    const by = new Map();
    let later = 0;
    const laterSeen = new Set();
    const list = Array.isArray(entries) ? entries : [];
    for (let i = 0; i < list.length; i++) {
      const day = dayOf(list[i]);
      if (!day) continue;
      const rec = recordOf(list[i]);
      if (!isValidCompleted(rec)) continue;
      if (pin && day > pin) {
        if (!laterSeen.has(day)) { laterSeen.add(day); later++; }
        continue;
      }
      if (by.has(day)) continue;
      by.set(day, copyScores(rec.scores));
    }
    if (memory && memory.practice !== true && isDayKey(memory.day) && (!pin || memory.day <= pin) && !by.has(memory.day)) {
      if (isValidCompleted({ practice: false, scores: memory.scores })) by.set(memory.day, copyScores(memory.scores));
    }
    const days = [...by.keys()].sort();
    const games = days.map(day => {
      const scores = copyScores(by.get(day));
      return { day, scores, total: totalOf(scores) };
    });
    return { games, later };
  }

  function metricValue(game, metric) {
    if (metric === "overall") return game.total;
    const i = metric | 0;
    if (i < 0 || i > 4) return NaN;
    return game.scores[i];
  }

  function sumOf(arr) {
    let t = 0;
    for (let i = 0; i < arr.length; i++) t += arr[i].value;
    return t;
  }

  function meanOf(arr) {
    return arr.length ? sumOf(arr) / arr.length : null;
  }

  // Prior mean is strictly before viewedDay. With no pinned day (a practice visit), prior is the saved set.
  function summarize(games, metric, viewedDay) {
    const list = Array.isArray(games) ? games : [];
    const pin = viewedDay != null && isDayKey(viewedDay) ? viewedDay : null;
    const points = [];
    for (let i = 0; i < list.length; i++) {
      const g = list[i];
      if (!g || !isDayKey(g.day) || !isValidCompleted({ scores: g.scores })) continue;
      const value = metricValue(g, metric);
      if (!Number.isFinite(value)) continue;
      points.push({ day: g.day, value });
    }
    const prior = pin ? points.filter(p => p.day < pin) : points.slice();
    const viewed = pin ? (points.find(p => p.day === pin) || null) : null;
    return {
      points,
      priorMean: meanOf(prior),
      priorCount: prior.length,
      allMean: meanOf(points),
      allSum: sumOf(points),
      allCount: points.length,
      viewed
    };
  }

  function scaleFor(metric) {
    return metric === "overall" ? 5000 : 1000;
  }

  function roundTenths(n) {
    if (n == null || !Number.isFinite(n)) return null;
    return Math.round((n + Number.EPSILON) * 10) / 10;
  }

  function readLocalEntries(storage) {
    const out = [];
    if (!storage) return out;
    let n = 0;
    try { n = storage.length; } catch (e) { return out; }
    if (typeof n !== "number" || n < 0 || !Number.isFinite(n)) return out;
    for (let i = 0; i < n; i++) {
      let key = null;
      try { key = storage.key(i); } catch (e) { continue; }
      if (typeof key !== "string" || !/^dg-\d{4}-\d{2}-\d{2}$/.test(key)) continue;
      const day = key.slice(3);
      if (!isDayKey(day)) continue;
      let raw = null;
      try { raw = storage.getItem(key); } catch (e) { continue; }
      if (typeof raw !== "string") continue;
      let record = null;
      try { record = JSON.parse(raw); } catch (e) { continue; }
      out.push({ key, day, record });
    }
    return out;
  }

  return {
    isDayKey,
    isValidCompleted,
    isScore,
    totalOf,
    completedGames,
    summarize,
    scaleFor,
    roundTenths,
    readLocalEntries
  };
});
