/* Daily field client. Talks only to field-compare, and only when
   FIELD_COMPARE_ENABLED is true. Practice, preview, and admin never post.
   A failure resolves to a quiet result. It does not throw, log, or write dg- history. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.FieldCompare = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  const DAY = /^\d{4}-\d{2}-\d{2}$/;
  const STORAGE_PREFIX = "sb-field-";
  const sent = new Set();
  const starts = new Map();
  const runIds = new Map();
  let clientP = null;
  let tokenP = null;

  function cfg() { return root.FIELD_COMPARE || {}; }

  function validDay(day) {
    if (typeof day !== "string" || !DAY.test(day)) return false;
    const p = day.split("-").map(Number);
    const dt = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return dt.getUTCFullYear() === p[0] && dt.getUTCMonth() === p[1] - 1 && dt.getUTCDate() === p[2];
  }

  function page(extra) {
    const loc = extra && extra.location ? extra.location : (root.location || { pathname: "", search: "" });
    const boot = extra && Object.prototype.hasOwnProperty.call(extra, "boot") ? extra.boot === true : root.BC_NO_BOOT === true;
    return { loc: loc, boot: boot };
  }

  function blocked(session, extra) {
    if (root.FIELD_COMPARE_ENABLED !== true) return "flag";
    const c = cfg();
    if (!c.url || !c.publishableKey) return "config";
    const here = page(extra);
    if (here.boot) return "admin";
    const path = String(here.loc && here.loc.pathname || "");
    if (/admin\.html$/i.test(path)) return "admin";
    const search = String(here.loc && here.loc.search || "");
    if (/[?&]preview=\d{4}-\d{2}-\d{2}\b/.test(search)) return "preview";
    if (session && session.practice === true) return "practice";
    return "";
  }

  function wireScores(scores) {
    if (!Array.isArray(scores) || scores.length !== 5) return null;
    const out = [];
    for (let i = 0; i < 5; i++) {
      const n = scores[i];
      if (typeof n !== "number" || !Number.isFinite(n)) return null;
      const r = Math.round(n);
      if (r < 0 || r > 1000 || !Number.isInteger(r)) return null;
      out.push(r);
    }
    return out;
  }

  function quiet(reason) { return { state: "quiet", reason: reason || "network" }; }

  function interpret(input) {
    const src = input || {};
    if (src.error || src.status == null) return quiet("network");
    const body = src.body && typeof src.body === "object" ? src.body : {};
    const status = src.status;
    const err = typeof body.error === "string" ? body.error : "";
    const reason = typeof body.reason === "string" ? body.reason : "";
    if (status === 403 || err === "origin_denied") return quiet("origin_denied");
    if (status === 429 || err === "rate_limited") return quiet("rate_limited");
    if (status === 503 || err === "collection_off") return quiet(err || "collection_off");
    if (reason === "threshold_unresolved" || err === "threshold_unresolved") return quiet("threshold_unresolved");
    if (reason === "below_threshold" || err === "below_threshold") return quiet("below_threshold");
    if (status !== 200 || body.ok === false || body.comparison_available !== true) return quiet(reason || err || "unavailable");
    const avg = Number(body.rest_average);
    const cats = Array.isArray(body.rest_category_average) ? body.rest_category_average.map(Number) : null;
    if (!Number.isFinite(avg) || !cats || cats.length !== 5 || cats.some(n => !Number.isFinite(n))) return quiet("unavailable");
    return { state: "ready", reason: "ok", restAverage: avg, restCategoryAverage: cats, restFinishes: body.rest_finishes };
  }

  function fieldStorage() {
    const p = STORAGE_PREFIX;
    return {
      getItem(k) { try { return root.localStorage ? root.localStorage.getItem(p + k) : null; } catch (e) { return null; } },
      setItem(k, v) { try { if (root.localStorage) root.localStorage.setItem(p + k, String(v)); } catch (e) {} },
      removeItem(k) { try { if (root.localStorage) root.localStorage.removeItem(p + k); } catch (e) {} }
    };
  }

  function uuid() {
    try { if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID(); } catch (e) {}
    return null;
  }

  function runIdFor(day) {
    let id = runIds.get(day);
    if (id) return id;
    id = uuid();
    if (id) runIds.set(day, id);
    return id;
  }

  function clientFor() {
    if (clientP) return clientP;
    clientP = (async () => {
      const c = cfg();
      if (!c.url || !c.publishableKey) throw new Error("config");
      let create = c.createClient;
      if (typeof create !== "function") {
        const mod = await import(c.supabaseJs);
        create = mod && mod.createClient;
      }
      if (typeof create !== "function") throw new Error("sdk");
      return create(c.url, c.publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          storageKey: "auth",
          storage: fieldStorage()
        }
      });
    })().catch(err => { clientP = null; throw err; });
    return clientP;
  }

  function tokenFor() {
    if (tokenP) return tokenP;
    tokenP = (async () => {
      const supabase = await clientFor();
      const got = await supabase.auth.getSession();
      const existing = got && got.data && got.data.session && got.data.session.access_token;
      if (existing) return existing;
      const signed = await supabase.auth.signInAnonymously();
      const token = signed && signed.data && signed.data.session && signed.data.session.access_token;
      if (!token) throw new Error("anon");
      return token;
    })().catch(err => { tokenP = null; throw err; });
    return tokenP;
  }

  async function call(op, session, scores) {
    const timerBox = { id: null };
    try {
      const c = cfg();
      const day = session && session.key;
      const runId = runIdFor(day);
      if (!runId || !validDay(day)) return quiet("invalid");
      const token = await tokenFor();
      const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      timerBox.id = setTimeout(() => { if (ctrl) ctrl.abort(); }, 8000);
      const base = String(c.url).replace(/\/$/, "") + "/functions/v1/field-compare/";
      let url = base + op;
      const headers = { apikey: c.publishableKey, Authorization: "Bearer " + token };
      let init = { method: "GET", headers: headers };
      if (op === "day") url += "?day=" + encodeURIComponent(day) + "&runId=" + encodeURIComponent(runId);
      else {
        headers["Content-Type"] = "application/json";
        init = { method: "POST", headers: headers, body: JSON.stringify(op === "finish" ? { runId: runId, day: day, scores: scores } : { runId: runId, day: day }) };
      }
      if (ctrl) init.signal = ctrl.signal;
      const fetchFn = root.fetch;
      if (typeof fetchFn !== "function") return quiet("network");
      const res = await fetchFn(url, init);
      const text = await res.text();
      let body = {};
      try { body = text ? JSON.parse(text) : {}; } catch (e) { body = {}; }
      return interpret({ status: res.status, body: body });
    } catch (e) {
      return quiet("network");
    } finally {
      if (timerBox.id) clearTimeout(timerBox.id);
    }
  }

  function onPlay(session) {
    if (blocked(session)) return;
    if (!session || !validDay(session.key)) return;
    if (Array.isArray(session.scores) && session.scores.length >= 5) return;
    const mark = "start:" + session.key;
    if (sent.has(mark)) return;
    sent.add(mark);
    const p = call("start", session, null).then(() => {});
    starts.set(session.key, p);
    p.catch(() => {});
  }

  function onFinish(session) {
    if (blocked(session)) return;
    const scores = wireScores(session && session.scores);
    if (!scores || !session || !validDay(session.key)) return;
    const mark = "finish:" + session.key;
    if (sent.has(mark)) return;
    sent.add(mark);
    const prev = starts.get(session.key) || Promise.resolve();
    prev.then(() => call("finish", session, scores)).catch(() => {});
  }

  function dayFor(session) {
    const why = blocked(session);
    if (why) return Promise.resolve(quiet(why));
    if (!session || !validDay(session.key)) return Promise.resolve(quiet("invalid"));
    return call("day", session, null);
  }

  return {
    blocked: blocked,
    onPlay: onPlay,
    onFinish: onFinish,
    dayFor: dayFor,
    interpret: interpret,
    wireScores: wireScores,
    fieldStorage: fieldStorage,
    storagePrefix: STORAGE_PREFIX
  };
});
