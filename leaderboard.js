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
  const NAME = "bc-board-name";
  const SKIP = "bc-board-name-skip";
  const ENTRY = "bc-board-entry";
  const STORAGE_PREFIX = "sb-board-";
  const SECTIONS = [
    ["overall", "Overall"],
    ["world", "World Rush"],
    ["history", "Time Warp"],
    ["sports", "MVP"],
    ["word", "Word Nerd"],
    ["think", "Brain Teaser"]
  ];
  // Fifth tab label. The slot id stays think. November 26 is Think Fast, same as every other day.
  // This does not call EagleEye.on.
  function fifthName() {
    return "Brain Teaser";
  }
  const MAIL = "mailto:thedailydosetrivia@gmail.com";
  let clientP = null;
  let tokenP = null;
  let boardOff = false;
  let boardProbe = null;

  function fetchBoard(url, ms) {
    const run = () => {
      const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = setTimeout(() => { if (ctrl) ctrl.abort(); }, ms);
      const c = cfg();
      return root.fetch(url, {
        method: "GET",
        headers: { apikey: c.publishableKey, Authorization: "Bearer " + c.publishableKey },
        signal: ctrl ? ctrl.signal : undefined
      }).then(async (res) => {
        clearTimeout(timer);
        const body = await res.json();
        if (body && body.error === "board_off") boardOff = true;
        return { res: res, body: body };
      }, (err) => { clearTimeout(timer); throw err; });
    };
    if (boardOff) return Promise.resolve({ off: true });
    if (!boardProbe) {
      boardProbe = run().then(got => got, (err) => { boardProbe = null; throw err; });
      return boardProbe;
    }
    return boardProbe.then(first => {
      if (boardOff || (first && first.body && first.body.error === "board_off")) return { off: true };
      return run();
    }, () => run());
  }

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
    if (!eligible) forgetIds();
    return { ok: true, eligible: eligible };
  }
  function readName() {
    try {
      const v = storage() && storage().getItem(NAME);
      return typeof v === "string" ? v : "";
    } catch (e) { return ""; }
  }
  function readEntry() {
    try {
      const raw = storage() && storage().getItem(ENTRY);
      const o = raw ? JSON.parse(raw) : null;
      if (!o || typeof o.day !== "string" || typeof o.token !== "string" || !o.token) return null;
      return { day: o.day, token: o.token };
    } catch (e) { return null; }
  }
  function writeEntry(day, token) {
    try {
      if (storage() && day && token) storage().setItem(ENTRY, JSON.stringify({ day: day, token: token }));
    } catch (e) {}
  }
  function isOwnRow(row, entry, name, day) {
    if (!entry || !row || !day) return false;
    if (entry.day !== day || typeof entry.token !== "string" || !entry.token) return false;
    return typeof row.token === "string" && row.token === entry.token;
  }
  // Highlight only the post id the server named. me.rank above 100 is not in the
  // returned list, so nothing in that list is highlighted. Name, tag, and score
  // are never compared. The name argument on isOwnRow is ignored for that reason.
  function ownPlacement(model, entry, day) {
    const me = model && model.me && typeof model.me === "object" ? model.me : null;
    const rank = me && Number.isFinite(Number(me.rank)) ? Number(me.rank) : null;
    const serverToken = me && typeof me.token === "string" ? me.token : "";
    const entryToken = entry && entry.day === day && typeof entry.token === "string" ? entry.token : "";
    if (rank != null && rank > 100) {
      return { highlight: "", below: { rank: rank, name: me.name, tag: me.tag, score: me.score, token: serverToken } };
    }
    return { highlight: serverToken || entryToken, below: null };
  }
  function readSkip() {
    try { return !!(storage() && storage().getItem(SKIP) === "1"); } catch (e) { return false; }
  }
  function writeSkip(on) {
    try {
      const store = storage();
      if (!store) return;
      if (on) store.setItem(SKIP, "1");
      else store.removeItem(SKIP);
    } catch (e) {}
  }
  function publicName(row) {
    const name = row && row.name != null ? String(row.name).trim() : "";
    if (name) return name;
    const tag = Number(row && row.tag);
    if (Number.isInteger(tag) && tag >= 1000 && tag <= 9999) return tr("Player {0}", String(tag));
    return tr("Player {0}", "----");
  }
  function forgetIds() {
    clientP = null;
    tokenP = null;
    try {
      const store = storage();
      if (store) {
        const drop = [];
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i);
          if (k && (k.indexOf("sb-board-") === 0 || k.indexOf("sb-field-") === 0)) drop.push(k);
        }
        drop.forEach(k => store.removeItem(k));
      }
    } catch (e) {}
    try { if (root.FieldCompare && root.FieldCompare.forget) root.FieldCompare.forget(); } catch (e) {}
  }
  function writeName(name) {
    try {
      const store = storage();
      if (!store) return;
      if (name) { store.setItem(NAME, name); store.removeItem(SKIP); }
      else store.removeItem(NAME);
      store.removeItem("bc-board-nick");
      store.removeItem("bc-board-pending");
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
    try { p.scrollIntoView({ block: "nearest" }); } catch (e) {}
  }
  function noteBlocked() {
    try { if (root.sessionStorage) root.sessionStorage.setItem("bc-board-name-note", "1"); } catch (e) {}
  }
  function takeNote() {
    try {
      const store = root.sessionStorage;
      if (!store || store.getItem("bc-board-name-note") !== "1") return false;
      store.removeItem("bc-board-name-note");
      return true;
    } catch (e) { return false; }
  }

  async function serverCheck(name) {
    if (!enabled()) return { ok: false, reason: "network" };
    try {
      const c = cfg();
      const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = setTimeout(() => { if (ctrl) ctrl.abort(); }, 8000);
      const res = await root.fetch(String(c.url).replace(/\/$/, "") + "/functions/v1/leaderboard/check", {
        method: "POST",
        headers: { apikey: c.publishableKey, Authorization: "Bearer " + c.publishableKey, "Content-Type": "application/json" },
        body: JSON.stringify({ name: name, eligible: true }),
        signal: ctrl ? ctrl.signal : undefined
      });
      clearTimeout(timer);
      const body = await res.json();
      if (res.ok && body && body.ok === true && typeof body.name === "string") return { ok: true, name: body.name };
      if (body && body.error === "name_rejected") return { ok: false, reason: "name_rejected" };
      return { ok: false, reason: "network" };
    } catch (e) {
      return { ok: false, reason: "network" };
    }
  }

  async function acceptName(raw) {
    const checked = filter() ? filter().checkName(raw) : { ok: false, reason: "chars" };
    if (checked.skip) return { ok: true, skip: true };
    if (!checked.ok) return { ok: false, reason: checked.reason || "chars" };
    const server = await serverCheck(checked.name);
    if (server.reason === "name_rejected") {
      writeName("");
      writeSkip(false);
      noteBlocked();
      return { ok: false, reason: "name_rejected" };
    }
    writeName(server.ok && server.name ? server.name : checked.name);
    return { ok: true, name: readName() };
  }

  let homeRefresh = null;

  function openAsk(purpose) {
    return new Promise(resolve => {
      const doc = root.document;
      const opener = doc.activeElement;
      let step = readFlag() === "yes" ? "name" : "age";
      const host = el("div", { class: "board-modal", "data-board-modal": "1" });
      const dialog = el("div", { class: "board-modal__card", role: "dialog", "aria-modal": "true", "aria-labelledby": "board-modal-title" });
      const title = el("h2", { id: "board-modal-title", class: "board-label" });
      const body = el("div", { "data-board-modal-body": "1" });
      const closeBtn = el("button", { type: "button", class: "board-modal__close", "data-board-close": "1", "aria-label": tr("Close") }, "×");
      dialog.append(closeBtn, title, body);
      host.append(dialog);
      let onKey = null;
      function finish(startGame) {
        if (onKey) doc.removeEventListener("keydown", onKey);
        if (host.parentNode) host.remove();
        const back = opener && opener.focus && doc.contains(opener) ? opener : doc.querySelector(".cta .btn.primary, [data-board-add]");
        if (back && back.focus) { try { back.focus(); } catch (e) {} }
        resolve(purpose === "start" && startGame !== false);
        if (purpose === "add" && homeRefresh) homeRefresh();
      }
      function dismiss() {
        if (step === "name") writeSkip(true);
        finish(true);
      }
      function focusables() {
        return Array.prototype.filter.call(dialog.querySelectorAll("button, input, a, [href], [tabindex]"), node => !node.disabled && node.getAttribute("tabindex") !== "-1" && !node.hidden);
      }
      onKey = (e) => {
        if (e.key === "Escape") { e.preventDefault(); dismiss(); return; }
        if (e.key !== "Tab") return;
        const list = focusables();
        if (!list.length) { e.preventDefault(); return; }
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      };
      doc.addEventListener("keydown", onKey);
      closeBtn.addEventListener("click", dismiss);
      function render() {
        body.textContent = "";
        if (step === "age") {
          dialog.setAttribute("data-board-gate", "1");
          dialog.removeAttribute("data-board-name");
          title.textContent = tr("Quick check");
          body.append(yearCard(() => {
            if (readFlag() === "no") { finish(true); return; }
            if (readFlag() === "yes") { step = "name"; render(); }
          }));
        } else {
          dialog.removeAttribute("data-board-gate");
          dialog.setAttribute("data-board-name", "1");
          title.textContent = tr("Display name (optional)");
          const fields = nameFields("");
          const go = el("button", { type: "button", class: "btn board-year-go", "data-board-save": "1" }, tr("Continue"));
          const skip = el("button", { type: "button", class: "board-skip", "data-board-skip": "1" }, tr("Play without a name"));
          const submit = async () => {
            const result = await acceptName(fields.input.value);
            if (result.skip) { writeSkip(true); finish(true); return; }
            if (!result.ok) { showNameError(body); return; }
            writeSkip(false);
            finish(true);
          };
          go.addEventListener("click", submit);
          skip.addEventListener("click", () => { writeSkip(true); finish(true); });
          fields.input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
          body.append(fields.input, fields.err, fields.help, go, skip);
          if (takeNote()) showNameError(body);
        }
        const list = focusables();
        const field = body.querySelector("input");
        if (field) { try { field.focus(); } catch (e) {} }
        else if (list[0]) { try { list[0].focus(); } catch (e) {} }
      }
      doc.body.append(host);
      render();
    });
  }

  async function beforeStart(opts) {
    opts = opts || {};
    if (opts.started || opts.practice) return true;
    if (isTester(null)) return true;
    if (readFlag() === "no") { forgetIds(); return true; }
    if (readName()) {
      const saved = filter() ? filter().checkName(readName()) : { ok: true };
      if (saved.ok && saved.skip !== true) return true;
      writeName("");
      writeSkip(false);
      noteBlocked();
    }
    if (readSkip() && !opts.add) return true;
    return openAsk(opts.add ? "add" : "start");
  }

  function underLine() {
    return el("p", { class: "board-help", "data-board-under": "1", text: tr("Leaderboard names aren't available on this device. You can still play!") });
  }
  function addLink(cta) {
    const link = el("button", { type: "button", class: "board-add", "data-board-add": "1" }, tr("Add a name"));
    link.addEventListener("click", () => { openAsk("add"); });
    const button = cta.querySelector(".btn.primary");
    if (button) button.insertAdjacentElement("afterend", link);
    else cta.append(link);
  }

  function decorate(cta, opts) {
    if (!cta || !root.document || !filter()) return;
    opts = opts || {};
    homeRefresh = opts.refresh || homeRefresh;
    const flag = readFlag();
    if (flag === "no") {
      forgetIds();
      const button = cta.querySelector(".btn.primary");
      const note = underLine();
      if (button) button.insertAdjacentElement("afterend", note);
      else cta.append(note);
      return;
    }
    if (readName()) { cta.insertBefore(savedCard(opts.refresh), cta.firstChild); return; }
    if (readSkip()) addLink(cta);
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

  function nameFields(prefill) {
    const input = el("input", {
      class: "board-input",
      "data-board-name-input": "1",
      maxlength: "20",
      autocomplete: "nickname",
      autocapitalize: "off",
      spellcheck: "false",
      "aria-describedby": "board-name-help"
    });
    if (prefill) input.value = prefill;
    return {
      input: input,
      err: el("p", { class: "board-error", "data-board-error": "1", hidden: "hidden" }),
      help: el("p", { class: "board-help", id: "board-name-help", text: tr("This name is shown publicly. Use a nickname, not your full name.") })
    };
  }

  function nameCard(withSkip) {
    const fields = nameFields("");
    const kids = [el("label", { class: "board-label", text: tr("Display name (optional)") }), fields.input, fields.err, fields.help];
    if (withSkip) {
      const skip = el("button", { type: "button", class: "board-skip", "data-board-skip": "1" }, tr("Play without a name"));
      skip.addEventListener("click", () => {
        writeSkip(true);
        const start = root.document.querySelector(".cta .btn.primary");
        if (start) start.click();
      });
      kids.push(skip);
    }
    return el("div", { class: "board-ask", "data-board-name": "1" }, ...kids);
  }

  function savedCard(refresh) {
    const current = readName();
    const shown = el("b", { "data-board-current": "1", text: current });
    const change = el("button", { type: "button", class: "board-change", "data-board-change": "1" }, tr("Change name"));
    const line = el("p", { class: "board-saved-line" }, shown, change);
    const fields = nameFields(current);
    const save = el("button", { type: "button", class: "btn board-save-change", "data-board-save": "1" }, tr("Save name"));
    const editor = el("div", { "data-board-editor": "1", hidden: "hidden" }, fields.input, fields.err, save, fields.help);
    change.addEventListener("click", () => {
      fields.input.value = readName();
      fields.err.hidden = true;
      editor.hidden = false;
    });
    save.addEventListener("click", async () => {
      const previous = readName();
      const result = await acceptName(fields.input.value);
      if (result.skip) { writeName(""); if (typeof refresh === "function") refresh(); return; }
      if (!result.ok) {
        writeName(previous);
        shown.textContent = previous;
        showNameError(editor.parentNode || editor);
        return;
      }
      if (!result.name) return;
      shown.textContent = result.name;
      fields.err.hidden = true;
      editor.hidden = true;
    });
    fields.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); save.click(); }
    });
    return el("div", { class: "board-ask", "data-board-saved": "1" }, line, editor);
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
    const refresh = () => {
      if (!host.isConnected) return;
      const think = host.querySelector("[data-board-section=think]");
      if (think) think.textContent = tr("Brain Teaser");
      load(host, host.getAttribute("data-board-current") || "overall");
    };
    if (root.document && root.document.addEventListener) {
      root.document.addEventListener("visibilitychange", () => {
        if (root.document.visibilityState === "visible") refresh();
      });
    }
    if (root.addEventListener) root.addEventListener("pageshow", refresh);
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
    const place = ownPlacement(model, readEntry(), todayKey());
    const rowEl = (row, mine) => {
      const score = Number(row.score);
      const item = el("li", { class: "board-row" + (mine ? " you" : ""), "aria-current": mine ? "true" : false },
        el("span", { class: "board-rank", text: String(row.rank || "") }),
        el("span", { class: "board-name", text: publicName(row) }),
        el("span", { class: "board-score", text: Number.isFinite(score) ? score.toLocaleString() : "" }));
      if (mine) item.append(el("span", { class: "sr-only", text: tr("(you)") }));
      return item;
    };
    rows.forEach(row => {
      list.append(rowEl(row, !!(place.highlight && row.token === place.highlight)));
    });
    if (place.below) {
      const gap = el("li", { class: "board-more", role: "separator", "aria-label": tr("More players") });
      gap.append(el("span", { "aria-hidden": "true", text: "⋯" }));
      list.append(gap);
      const item = rowEl(place.below, true);
      item.setAttribute("data-own-below", "1");
      list.append(item);
    }
  }

  function fixture(section) {
    if (!shot()) return null;
    const fix = root.LEADERBOARD_FIXTURE;
    if (!fix || typeof fix !== "object") return { served: true, rows: [] };
    return fix[section] || { served: true, rows: [] };
  }

  function hideBoard(host) {
    host.hidden = true;
    host.setAttribute("data-board-off", "1");
  }
  async function load(host, sectionId) {
    host.setAttribute("data-board-current", sectionId || "overall");
    const canned = fixture(sectionId);
    if (canned) { host.hidden = false; host.removeAttribute("data-board-off"); paint(host, canned); return; }
    if (isTester(null)) { host.hidden = false; paint(host, { served: true, rows: [] }); return; }
    if (!enabled() || boardOff) { hideBoard(host); return; }
    const day = todayKey();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) { hideBoard(host); return; }
    try {
      const c = cfg();
      const entry = readEntry();
      const tokenQ = entry && entry.day === day && entry.token ? "&token=" + encodeURIComponent(entry.token) : "";
      const got = await fetchBoard(String(c.url).replace(/\/$/, "") + "/functions/v1/leaderboard/board?day=" + encodeURIComponent(day) + "&section=" + encodeURIComponent(sectionId) + tokenQ, 8000);
      if (!got || got.off || (got.body && got.body.error === "board_off")) { hideBoard(host); return; }
      const res = got.res;
      const body = got.body;
      if (!res.ok || !body || body.ok === false) { host.hidden = false; paint(host, { unavailable: true, rows: [] }); return; }
      host.hidden = false;
      host.removeAttribute("data-board-off");
      paint(host, { served: body.served !== false, rows: Array.isArray(body.rows) ? body.rows : [], total: body.total, me: body.me || null });
    } catch (e) {
      host.hidden = false;
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
    if (readFlag() === "no") return Promise.reject(new Error("under13"));
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
      if (!session || isTester(session) || shot() || readFlag() !== "yes") return;
      const scores = wireScores(session.scores);
      if (!scores) return;
      const name = readName();
      if (name) {
        if (!filter()) return;
        const checked = filter().checkName(name);
        if (!checked.ok || checked.skip) return;
        send(session.key, checked.name, scores);
        return;
      }
      if (readSkip()) send(session.key, null, scores);
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
        body: JSON.stringify({ day: day, name: name || null, scores: scores, eligible: true }),
        signal: ctrl ? ctrl.signal : undefined
      }).then(async (res) => {
        clearTimeout(timer);
        let body = {};
        try { body = await res.json(); } catch (e) { body = {}; }
        if (body && body.error === "name_rejected") { writeName(""); writeSkip(false); noteBlocked(); }
        else if (body && typeof body.token === "string" && body.token) writeEntry(day, body.token);
      }, () => { clearTimeout(timer); });
    }).catch(() => {});
  }

  function rankFromRows(rows, token, total) {
    if (!Array.isArray(rows) || typeof token !== "string" || !token) return null;
    const count = Number.isFinite(Number(total)) ? Number(total) : rows.length;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row && row.token === token && Number.isFinite(Number(row.rank))) return { rank: Number(row.rank), total: count };
    }
    return null;
  }
  async function fetchRank() {
    if (readFlag() !== "yes" || isTester(null) || readFlag() === "no") return null;
    if (!readName() && !readSkip()) return null;
    const entry = readEntry();
    if (!entry || entry.day !== todayKey()) return null;
    const canned = fixture("overall");
    if (canned && canned.me && Number.isFinite(Number(canned.me.rank)) && Number.isFinite(Number(canned.me.total))) {
      return { rank: Number(canned.me.rank), total: Number(canned.me.total) };
    }
    if (canned && Array.isArray(canned.rows)) return rankFromRows(canned.rows, entry.token, canned.total);
    if (!enabled() || boardOff) return null;
    const day = todayKey();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
    try {
      const c = cfg();
      const got = await fetchBoard(String(c.url).replace(/\/$/, "") + "/functions/v1/leaderboard/board?day=" + encodeURIComponent(day) + "&section=overall&token=" + encodeURIComponent(entry.token), 2000);
      if (!got || got.off || !got.body || got.body.error === "board_off") return null;
      const res = got.res;
      const body = got.body;
      if (!res.ok || !body || body.ok === false || body.served === false) return null;
      if (body.me && body.me.found === true && Number.isFinite(Number(body.me.rank)) && Number.isFinite(Number(body.me.total))) {
        return { rank: Number(body.me.rank), total: Number(body.me.total) };
      }
      return rankFromRows(Array.isArray(body.rows) ? body.rows : [], entry.token, body.total);
    } catch (e) { return null; }
  }
  async function rankPhrase() {
    const got = await fetchRank();
    return got ? tr("Rank #{0} of {1} today", got.rank, got.total) : "";
  }
  function rankLine() {
    const line = el("p", { class: "board-rankline", "data-board-rank": "1", hidden: "hidden" });
    const paint = async () => {
      const text = await rankPhrase();
      line.textContent = "";
      if (!text) { line.hidden = true; return; }
      line.hidden = false;
      line.textContent = text;
    };
    paint();
    if (root.document && root.document.addEventListener) {
      root.document.addEventListener("visibilitychange", () => {
        if (root.document.visibilityState === "visible") paint();
      });
    }
    if (root.addEventListener) {
      root.addEventListener("focus", () => { paint(); });
      root.addEventListener("pageshow", () => { paint(); });
    }
    return line;
  }

  if (readFlag() === "no") forgetIds();

  return {
    isTester: isTester,
    readFlag: readFlag,
    lockYear: lockYear,
    beforeStart: beforeStart,
    decorate: decorate,
    section: section,
    paint: paint,
    noteFinish: noteFinish,
    readName: readName,
    writeName: writeName,
    acceptName: acceptName,
    nameKey: NAME,
    flagKey: FLAG,
    fifthName: fifthName,
    forgetIds: forgetIds,
    readSkip: readSkip,
    isOwnRow: isOwnRow,
    ownPlacement: ownPlacement,
    rankFromRows: rankFromRows,
    rankPhrase: rankPhrase,
    rankLine: rankLine,
    entryKey: ENTRY
  };
});
