/* Optional public nickname and the daily board.
   Practice, preview, admin, and ?dgtest are the tester runs already kept
   out of the daily field. They do not post and they are not counted.
   The birth year is read once and discarded. Only yes/no is stored. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.DailyBoard = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  const FLAG = "bc-board-eligible";
  const PENDING = "bc-board-pending";
  const NICK = "bc-board-nick";
  const STORAGE_PREFIX = "sb-board-";
  const SECTIONS = [
    ["overall", "Overall"],
    ["world", "World Rush"],
    ["history", "Time Warp"],
    ["sports", "MVP"],
    ["word", "Word Nerd"],
    ["think", "Brain Teaser"]
  ];
  const MAIL = "mailto:thedailydosetrivia@gmail.com";
  let clientP = null;
  let tokenP = null;

  function tr(s) {
    const i18n = root.BC_I18N;
    if (!i18n || typeof i18n.t !== "function") {
      let r = s;
      for (let n = 1; n < arguments.length; n++) r = String(r).split("{" + (n - 1) + "}").join(arguments[n]);
      return r;
    }
    return i18n.t.apply(null, arguments);
  }
  function filter() { return root.NameFilter; }
  function cfg() { return root.LEADERBOARD || {}; }
  function enabled() { return root.LEADERBOARD_ENABLED === true && !!(cfg().url); }
  function storage() {
    try { return root.localStorage || null; } catch (e) { return null; }
  }
  function search() { return String(root.location && root.location.search || ""); }
  function path() { return String(root.location && root.location.pathname || ""); }
  function shot() { return /[?&]lbshot=1\b/.test(search()); }

  function isTester(session) {
    if (root.BC_NO_BOOT === true) return true;
    if (/admin\.html$/i.test(path())) return true;
    if (/[?&]preview=/.test(search())) return true;
    if (/[?&]dgtest\b/.test(search())) return true;
    if (session && session.practice === true) return true;
    if (session && (session.key === "demo" || (session.key && !/^\d{4}-\d{2}-\d{2}$/.test(session.key)))) return true;
    return false;
  }

  function readFlag() {
    try {
      const v = storage() && storage().getItem(FLAG);
      return v === "yes" || v === "no" ? v : "";
    } catch (e) { return ""; }
  }
  function lockYear(raw, todayKey) {
    const existing = readFlag();
    if (existing === "yes" || existing === "no") return { ok: true, eligible: existing === "yes", locked: true };
    const text = String(raw == null ? "" : raw).replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
    if (!/^\d{4}$/.test(text)) return { ok: false, reason: "year" };
    const year = Number(text);
    const nowYear = Number(String(todayKey || "").slice(0, 4));
    if (!nowYear || year < 1900 || year > nowYear) return { ok: false, reason: "year" };
    const eligible = nowYear - year >= 13;
    try { if (storage()) storage().setItem(FLAG, eligible ? "yes" : "no"); } catch (e) {}
    return { ok: true, eligible: eligible };
  }
  function clearPending() {
    try { if (storage()) storage().removeItem(PENDING); } catch (e) {}
  }
  function readPending() {
    try {
      const raw = storage() && storage().getItem(PENDING);
      const o = raw ? JSON.parse(raw) : null;
      if (!o || typeof o.day !== "string" || typeof o.name !== "string") return null;
      return { day: o.day, name: o.name };
    } catch (e) { return null; }
  }
  function writePending(day, name) {
    try { if (storage()) storage().setItem(PENDING, JSON.stringify({ day: day, name: name })); } catch (e) {}
  }
  function readNick() {
    try { return (storage() && storage().getItem(NICK)) || ""; } catch (e) { return ""; }
  }
  function writeNick(name) {
    try {
      if (!storage()) return;
      if (name) storage().setItem(NICK, name);
      else storage().removeItem(NICK);
    } catch (e) {}
  }
  function todayKey() {
    try { if (root.BCDaily && root.BCDaily.todayKey) return root.BCDaily.todayKey(); } catch (e) {}
    return "";
  }
  function el(tag, attrs) {
    const node = root.document.createElement(tag);
    const kids = Array.prototype.slice.call(arguments, 2);
    Object.keys(attrs || {}).forEach(k => {
      const v = attrs[k];
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (v != null && v !== false) node.setAttribute(k, v);
    });
    kids.forEach(kid => { if (kid) node.append(kid); });
    return node;
  }
  function wireScores(scores) {
    if (!Array.isArray(scores) || scores.length !== 5) return null;
    const out = [];
    for (let i = 0; i < 5; i++) {
      const n = scores[i];
      if (typeof n !== "number" || !Number.isFinite(n)) return null;
      const r = Math.round(n);
      if (r < 0 || r > 1000) return null;
      out.push(r);
    }
    return out;
  }

  function nameInput(scope) {
    return scope && scope.querySelector ? scope.querySelector("[data-board-name-input]") : null;
  }
  function showNameError(scope) {
    const p = scope && scope.querySelector ? scope.querySelector("[data-board-error]") : null;
    if (!p) return;
    p.hidden = false;
    p.textContent = tr("That name can't be used. Try a different nickname, or play without a name.");
  }

  function beforeStart(opts) {
    opts = opts || {};
    if (opts.started) return true;
    if (isTester(null)) return true;
    if (readFlag() !== "yes") { clearPending(); return true; }
    const scope = opts.root || root.document;
    const input = opts.input || nameInput(scope);
    if (!input) { clearPending(); return true; }
    const checked = filter() ? filter().checkName(input.value) : { ok: false, reason: "chars" };
    if (checked.skip) { clearPending(); writeNick(""); return true; }
    if (!checked.ok) { showNameError(scope); return false; }
    writeNick(checked.name);
    writePending(opts.day || todayKey(), checked.name);
    return true;
  }

  function decorate(cta, opts) {
    if (!cta || !root.document || !filter()) return;
    opts = opts || {};
    if (opts.started) return;
    const flag = readFlag();
    if (flag === "no") return;
    if (flag === "yes") cta.insertBefore(nameCard(), cta.firstChild);
    else cta.insertBefore(yearCard(opts.refresh), cta.firstChild);
  }

  function yearCard(refresh) {
    // A div, not a form: Enter cannot submit or navigate. The year is read
    // into a local, the field is cleared, then only yes/no is stored.
    const input = el("input", {
      id: "board-year",
      class: "board-input",
      type: "text",
      inputmode: "numeric",
      maxlength: "4",
      autocomplete: "off",
      autocorrect: "off",
      autocapitalize: "off",
      spellcheck: "false",
      enterkeyhint: "done",
      "aria-describedby": "board-year-hint"
    });
    input.readOnly = true;
    const unlock = () => { input.readOnly = false; };
    input.addEventListener("pointerdown", unlock);
    input.addEventListener("focus", unlock);
    const err = el("p", { class: "board-error", id: "board-year-hint", hidden: "hidden" });
    const button = el("button", { type: "button", class: "btn board-year-go" }, tr("Continue"));
    const evaluate = () => {
      let raw = input.value;
      input.value = "";
      const result = lockYear(raw, todayKey());
      raw = "";
      if (!result.ok) {
        err.hidden = false;
        err.textContent = tr("Enter the year you were born.");
        return;
      }
      if (typeof refresh === "function") refresh();
    };
    button.addEventListener("click", evaluate);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); evaluate(); }
    });
    return el("div", { class: "board-ask", "data-board-gate": "1", autocomplete: "off" },
      el("label", { class: "board-label", for: "board-year", text: tr("What year were you born?") }),
      input, button, err);
  }

  function nameCard() {
    const input = el("input", {
      class: "board-input",
      "data-board-name-input": "1",
      maxlength: "20",
      autocomplete: "nickname",
      autocapitalize: "off",
      spellcheck: "false",
      "aria-describedby": "board-name-help"
    });
    const nick = readNick();
    if (nick && filter().checkName(nick).ok && !filter().checkName(nick).skip) input.value = nick;
    return el("div", { class: "board-ask", "data-board-name": "1" },
      el("label", { class: "board-label", text: tr("Display name (optional)") }),
      input,
      el("p", { class: "board-help", id: "board-name-help", text: tr("This name is shown publicly. Use a nickname, not your full name.") }),
      el("p", { class: "board-error", "data-board-error": "1", hidden: "hidden" }));
  }

  function section() {
    if (!root.document) return null;
    const host = el("section", { class: "day-board", "data-day-board": "1", "aria-label": tr("Daily leaderboard") });
    const tabs = el("div", { class: "board-tabs", role: "tablist", "aria-label": tr("Daily leaderboard") });
    const list = el("ol", { class: "board-rows" });
    const empty = el("p", { class: "board-empty" });
    host.append(
      el("h2", { class: "board-title", text: tr("Daily leaderboard") }),
      tabs,
      el("p", { class: "board-note", text: tr("Rankings are for fun, with no prizes.") }),
      list,
      empty,
      el("p", { class: "board-report" }, el("a", { href: MAIL, text: tr("Report a name") }))
    );
    let current = "overall";
    SECTIONS.forEach(pair => {
      const id = pair[0];
      const button = el("button", { type: "button", class: "board-tab" + (id === current ? " on" : ""), role: "tab", "aria-pressed": id === current ? "true" : "false", "data-board-section": id, text: tr(pair[1]) });
      button.addEventListener("click", () => {
        current = id;
        Array.prototype.forEach.call(tabs.querySelectorAll(".board-tab"), tab => {
          const on = tab.getAttribute("data-board-section") === id;
          tab.classList.toggle("on", on);
          tab.setAttribute("aria-pressed", on ? "true" : "false");
        });
        load(host, id);
      });
      tabs.append(button);
    });
    load(host, current);
    return host;
  }

  function paint(host, model) {
    const list = host.querySelector(".board-rows");
    const empty = host.querySelector(".board-empty");
    list.textContent = "";
    const rows = model && Array.isArray(model.rows) ? model.rows : [];
    if (!model || model.served === false) {
      empty.hidden = false;
      empty.textContent = tr("That day's leaderboard is no longer shown.");
      return;
    }
    if (model.unavailable) {
      empty.hidden = false;
      empty.textContent = tr("The leaderboard isn't available right now.");
      return;
    }
    if (!rows.length) {
      empty.hidden = false;
      empty.textContent = tr("No public names for this day yet.");
      return;
    }
    empty.hidden = true;
    empty.textContent = "";
    rows.forEach(row => {
      const score = Number(row.score);
      const item = el("li", { class: "board-row" },
        el("span", { class: "board-rank", text: String(row.rank || "") }),
        el("span", { class: "board-name", text: String(row.name || "") }),
        el("span", { class: "board-score", text: Number.isFinite(score) ? score.toLocaleString() : "" }));
      list.append(item);
    });
  }

  function fixture(section) {
    if (!shot()) return null;
    const fix = root.LEADERBOARD_FIXTURE;
    if (!fix || typeof fix !== "object") return { served: true, rows: [] };
    return fix[section] || { served: true, rows: [] };
  }

  async function load(host, sectionId) {
    const canned = fixture(sectionId);
    if (canned) { paint(host, canned); return; }
    if (isTester(null)) { paint(host, { served: true, rows: [] }); return; }
    if (!enabled()) { paint(host, { unavailable: true, rows: [] }); return; }
    const day = todayKey();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) { paint(host, { unavailable: true, rows: [] }); return; }
    try {
      const c = cfg();
      const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = setTimeout(() => { if (ctrl) ctrl.abort(); }, 8000);
      const headers = { apikey: c.publishableKey, Authorization: "Bearer " + c.publishableKey };
      const res = await root.fetch(String(c.url).replace(/\/$/, "") + "/functions/v1/leaderboard/board?day=" + encodeURIComponent(day) + "&section=" + encodeURIComponent(sectionId), { method: "GET", headers: headers, signal: ctrl ? ctrl.signal : undefined });
      clearTimeout(timer);
      const body = await res.json();
      if (!res.ok || !body || body.ok === false) { paint(host, { unavailable: true, rows: [] }); return; }
      paint(host, { served: body.served !== false, rows: Array.isArray(body.rows) ? body.rows : [] });
    } catch (e) {
      paint(host, { unavailable: true, rows: [] });
    }
  }

  function fieldStorage() {
    const p = STORAGE_PREFIX;
    return {
      getItem(k) { try { return storage() ? storage().getItem(p + k) : null; } catch (e) { return null; } },
      setItem(k, v) { try { if (storage()) storage().setItem(p + k, String(v)); } catch (e) {} },
      removeItem(k) { try { if (storage()) storage().removeItem(p + k); } catch (e) {} }
    };
  }
  function clientFor() {
    if (clientP) return clientP;
    clientP = (async () => {
      const c = cfg();
      if (!c.url || !c.publishableKey) throw new Error("config");
      const mod = await import(c.supabaseJs);
      const create = mod && mod.createClient;
      if (typeof create !== "function") throw new Error("sdk");
      return create(c.url, c.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "auth", storage: fieldStorage() }
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

  function noteFinish(session) {
    try {
      if (!session || isTester(session) || shot() || readFlag() !== "yes") { clearPending(); return; }
      const pending = readPending();
      const scores = wireScores(session.scores);
      if (!pending || pending.day !== session.key || !scores || !filter()) return;
      const checked = filter().checkName(pending.name);
      if (!checked.ok || checked.skip) { clearPending(); return; }
      send(session.key, checked.name, scores);
    } catch (e) {}
  }

  function send(day, name, scores) {
    if (!enabled()) return;
    const c = cfg();
    tokenFor().then(token => {
      const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = setTimeout(() => { if (ctrl) ctrl.abort(); }, 8000);
      return root.fetch(String(c.url).replace(/\/$/, "") + "/functions/v1/leaderboard/post", {
        method: "POST",
        headers: { apikey: c.publishableKey, Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ day: day, name: name, scores: scores, eligible: true }),
        signal: ctrl ? ctrl.signal : undefined
      }).then(() => { clearTimeout(timer); }, () => { clearTimeout(timer); });
    }).catch(() => {});
  }

  return {
    isTester: isTester,
    readFlag: readFlag,
    lockYear: lockYear,
    beforeStart: beforeStart,
    decorate: decorate,
    section: section,
    paint: paint,
    noteFinish: noteFinish,
    clearPending: clearPending,
    readPending: readPending,
    flagKey: FLAG
  };
});
