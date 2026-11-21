/* Operator tool for the public nickname board. Lives on admin.html, which is
   unlisted and noindex, the same place as the other operator actions.
   Rename and remove also need the operator key. The key is not stored. */
(function () {
  "use strict";
  const root = document.getElementById("board-admin");
  if (!root || !window.NameFilter) return;
  const tr = window.BC_I18N && window.BC_I18N.t ? window.BC_I18N.t.bind(window.BC_I18N) : function (s) { return s; };
  const cfg = window.LEADERBOARD || {};
  const shot = /[?&]lbshot=1\b/.test(location.search);
  const MAIL = "mailto:thedailydosetrivia@gmail.com";

  function esc(s) { return String(s == null ? "" : s); }
  function node(tag, attrs, text) {
    const el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(k => { if (attrs[k] != null) el.setAttribute(k, attrs[k]); });
    if (text != null) el.textContent = text;
    return el;
  }
  function msg(text) {
    const p = root.querySelector(".msg");
    if (p) p.textContent = text || "";
  }
  function endpoint(op) {
    return String(cfg.url || "").replace(/\/$/, "") + "/functions/v1/leaderboard/" + op;
  }
  async function call(op, body) {
    const key = (root.querySelector("[data-operator-key]") || {}).value || "";
    const res = await fetch(endpoint(op), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: cfg.publishableKey || "",
        authorization: "Bearer " + (cfg.publishableKey || ""),
        "x-board-operator": key
      },
      body: JSON.stringify(body)
    });
    let payload = {};
    try { payload = await res.json(); } catch (e) { payload = {}; }
    return { status: res.status, body: payload };
  }
  function rowView(row) {
    const box = node("div", { class: "nrow", "data-board-id": row.id });
    const title = node("b", null, (row.name || "") + " · " + Number(row.score || 0).toLocaleString());
    const input = node("input", { type: "text", maxlength: "20", "aria-label": tr("New nickname"), autocomplete: "off" });
    input.value = row.name || "";
    const rename = node("button", { type: "button", class: "ok" }, tr("Rename"));
    const remove = node("button", { type: "button", class: "no" }, tr("Remove"));
    const line = node("div", { class: "row" });
    line.append(rename, remove);
    rename.addEventListener("click", async () => {
      const checked = window.NameFilter.checkName(input.value);
      if (!checked.ok || checked.skip) { msg(tr("That name isn't allowed. Choose another.")); return; }
      if (shot && window.BOARD_ADMIN_FIXTURE) { title.textContent = checked.name + " · " + Number(row.score || 0).toLocaleString(); msg(tr("Saved.")); return; }
      const got = await call("rename", { id: row.id, name: checked.name }).catch(() => null);
      if (!got || got.body.ok !== true) { msg(tr("That name isn't allowed. Choose another.")); return; }
      title.textContent = checked.name + " · " + Number(row.score || 0).toLocaleString();
      msg(tr("Saved."));
    });
    remove.addEventListener("click", async () => {
      if (shot && window.BOARD_ADMIN_FIXTURE) { box.remove(); msg(tr("Removed.")); return; }
      const got = await call("remove", { id: row.id }).catch(() => null);
      if (!got || got.body.ok !== true) { msg(tr("The leaderboard isn't available right now.")); return; }
      box.remove();
      msg(tr("Removed."));
    });
    box.append(title, input, line);
    return box;
  }
  function paint(rows) {
    const list = root.querySelector("[data-board-rows]");
    list.textContent = "";
    (rows || []).forEach(row => list.append(rowView(row)));
    if (!rows || !rows.length) msg(tr("No public names for this day yet."));
  }
  function shell() {
    root.append(
      node("h2", { id: "board-admin-title" }, tr("Display names")),
      node("p", null, tr("Rename or remove a public nickname. The same name rules apply.")),
      node("label", { for: "board-operator-key" }, tr("Operator key")),
      node("input", { id: "board-operator-key", type: "password", "data-operator-key": "1", autocomplete: "off" }),
      node("label", { for: "board-admin-day" }, tr("Date")),
      node("input", { id: "board-admin-day", type: "date", "data-board-day": "1" }),
      (function () { const b = node("button", { type: "button", id: "board-load", class: "sec" }, tr("Load names")); return b; })(),
      node("div", { "data-board-rows": "1" }),
      node("p", { class: "msg", role: "status" }),
      (function () {
        const p = node("p");
        const a = node("a", { href: MAIL }, tr("Report a name"));
        p.append(a);
        return p;
      })()
    );
    const day = root.querySelector("[data-board-day]");
    if (window.BCDaily && window.BCDaily.todayKey) day.value = window.BCDaily.todayKey();
    root.querySelector("#board-load").addEventListener("click", async () => {
      if (shot && window.BOARD_ADMIN_FIXTURE) { paint(window.BOARD_ADMIN_FIXTURE.rows || []); msg(""); return; }
      const got = await call("admin-list", { day: day.value }).catch(() => null);
      if (!got || got.body.ok !== true) { msg(tr("The leaderboard isn't available right now.")); return; }
      paint(got.body.rows || []);
      if (got.body.rows && got.body.rows.length) msg("");
    });
  }
  shell();
  if (shot && window.BOARD_ADMIN_FIXTURE) paint(window.BOARD_ADMIN_FIXTURE.rows || []);
})();
