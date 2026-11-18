/* Admin feedback helpers (admin.html + preview-only in-game flag button).
   Builds prefilled GitHub new-issue URLs. Inert on normal visits. */
(() => {
const REPO = "https://github.com/lukebiasi11/Brainclash.com/issues/new";
const MAX = 7000;
const cut = (s, n) => { s = String(s ?? ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
function issueUrl(title, body, labels) {
  const mk = b => REPO + "?title=" + encodeURIComponent(cut(title, 200)) + "&body=" + encodeURIComponent(b) + "&labels=" + encodeURIComponent(labels || "admin-feedback");
  let b = String(body ?? ""), u = mk(b);
  while (u.length > MAX && b.length > 50) { b = b.slice(0, Math.floor(b.length * 0.85)) + "\n…(truncated)"; u = mk(b); }
  return u;
}
const ansOf = q => !q ? "" : q.type === "order" && q.items ? q.items.join(" → ") : q.type === "match" && q.left ? q.left.map((l, i) => l + " = " + (q.right || [])[(q.pairs || [])[i]]).join("; ") : q.matchup && q.a != null ? (q.matchup[q.a] ?? "") : q.options && q.a != null ? (q.options[q.a] ?? "") : q.answers ? q.answers.join(" / ") + (q.aliases && q.aliases.length ? " (also: " + q.aliases.join(" / ") + ")" : "") : q.answer != null ? q.answer + (q.unit && q.unit !== "year" ? " " + q.unit : "") : "";
function textOf(v) {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const en = typeof v.en === "string" ? v.en.trim() : "";
    const es = typeof v.es === "string" ? v.es.trim() : "";
    return en || es;
  }
  return "";
}
function pairAns(q) {
  if (!q || !Array.isArray(q.rounds)) return "";
  return q.rounds.map(r => r && (r.correct === "left" || r.correct === "right") ? textOf(r[r.correct]) : "").filter(Boolean).join(" | ");
}
// Flatten a day's set into reviewable items: {id, cat, prompt, answer}.
// A missing or odd piece becomes one "unrecognized item" instead of throwing.
function items(set) {
  const out = [], add = (cat, n, prompt, answer) => out.push({ id: cat.toLowerCase().replace(/[^a-z]+/g, "-") + "-" + n, cat, prompt: String(prompt ?? ""), answer: String(answer ?? "") });
  const odd = (cat, n) => add(cat, n, "unrecognized item", "");
  const w = set && set.worldRush;
  if (!w || typeof w !== "object" || !Array.isArray(w.pins)) odd("World Rush", 1);
  else w.pins.forEach((p, i) => p && typeof p.name === "string" ? add("World Rush", i + 1, "Pin: " + p.name, p.name) : odd("World Rush", i + 1));
  const base = w && Array.isArray(w.pins) ? w.pins.length : 0;
  if (w && w.mc && textOf(w.mc.q)) add("World Rush", base + 1, textOf(w.mc.q), ansOf(w.mc));
  else if (w && w.pair && (textOf(w.pair.prompt) || pairAns(w.pair))) add("World Rush", base + 1, textOf(w.pair.prompt) || "Pair", pairAns(w.pair));
  else odd("World Rush", base + 1);
  ["r1", "r2"].forEach((r, i) => {
    const rd = set && set.history && set.history[r];
    try {
      if (!rd || !Array.isArray(rd.events) || !rd.theme) return odd("Time Warp", i + 1);
      add("Time Warp", i + 1, "Order: " + rd.theme + " — " + rd.events.map(e => e[1]).join(" · "), rd.events.slice().sort((a, b) => a[2] - b[2]).map(e => e[1] + " (" + e[2] + ")").join(" → "));
    } catch (e) { odd("Time Warp", i + 1); }
  });
  if (!set || !Array.isArray(set.sports)) odd("MVP", 1);
  else set.sports.forEach((q, i) => {
    try {
      if (!q || typeof q !== "object") return odd("MVP", i + 1);
      const prompt = textOf(q.q != null ? q.q : q.prompt);
      if (!prompt) return odd("MVP", i + 1);
      const ans = q.type === "pair" ? pairAns(q) : q.type === "reveal" ? textOf(q.answer) : (ansOf(q) || (q.pairs ? JSON.stringify(q.pairs) : q.order ? q.order.join(" → ") : ""));
      add("MVP", i + 1, prompt, ans);
    } catch (e) { odd("MVP", i + 1); }
  });
  try {
    const g = set && set.wordGame;
    if (!g || !g.id) odd("Word Nerd", 1);
    else {
      const wn = "Word Nerd (" + (g.name || g.id) + ")";
      if (g.id === "flip" && Array.isArray(set.wordFlip)) set.wordFlip.forEach((x, i) => Array.isArray(x) ? add(wn, i + 1, x[1] + " — " + x[2], x[0]) : odd(wn, i + 1));
      else if (g.id === "bridge" && Array.isArray(set.wordBridge)) set.wordBridge.forEach((x, i) => Array.isArray(x) ? add(wn, i + 1, x[0] + " ___ " + x[1], x[2] + " (" + x[0] + x[2] + " / " + x[2] + x[1] + ")") : odd(wn, i + 1));
      else if (g.id === "conn" && set.connections && Array.isArray(set.connections.groups)) add(wn, 1, set.connections.groups.flatMap(x => x.words).sort().join(", "), set.connections.groups.map(x => x.name + ": " + x.words.join(", ")).join("; "));
      else if (g.id === "odd" && Array.isArray(set.oddOneOut)) set.oddOneOut.forEach((o, i) => o && Array.isArray(o.words) ? add(wn, i + 1, o.words.join(", "), o.words[o.odd] + " — " + o.why) : odd(wn, i + 1));
      else if (g.id === "anag") { const a = set.anagram || {}; add(wn, 1, "Letters: " + (a.letters || ""), (a.valid || []).slice(0, 40).join(", ")); }
      else odd(wn, 1);
    }
  } catch (e) { odd("Word Nerd", 1); }
  if (!set || !Array.isArray(set.thinkFast)) odd("Brain Teaser", 1);
  else set.thinkFast.forEach((q, i) => {
    try {
      if (!q || typeof q !== "object") return odd("Brain Teaser", i + 1);
      const prompt = textOf(q.q != null ? q.q : q.prompt);
      if (!prompt) return odd("Brain Teaser", i + 1);
      const explain = textOf(q.explain);
      add("Brain Teaser", i + 1, prompt, (q.type === "pair" ? pairAns(q) : ansOf(q)) + (explain ? " — " + explain : ""));
    } catch (e) { odd("Brain Teaser", i + 1); }
  });
  return out;
}
function itemUrl(date, it, note, verdict) {
  verdict = verdict || "Disapproved";
  const body = `**${verdict}** from admin preview\n\n- **Date:** ${date}\n- **Category:** ${it.cat}\n- **Question id:** \`${date}/${it.id}\`\n\n**Prompt:**\n> ${cut(it.prompt, 1500).replace(/\n/g, "\n> ")}\n\n**Answer:**\n> ${cut(it.answer, 1500).replace(/\n/g, "\n> ")}\n\n**Luke's note:**\n${cut(note, 2500) || "_(no note)_"}\n\nPreview: https://dailydosetrivia.com/index.html?preview=${date}`;
  return issueUrl(`[${verdict}] ${date} · ${it.cat} · ${cut(it.prompt, 60)}`, body, "admin-feedback");
}
window.BCFeedback = Object.freeze({ issueUrl, items, itemUrl, cut, MAX });

// In-game flag button: only when the game booted in preview mode (window.BCPreview set by app.js).
document.addEventListener("DOMContentLoaded", () => {
  const P = window.BCPreview; if (!P || !P.key) return;
  const st = document.createElement("style");
  st.textContent = `#bc-flag{position:fixed;right:12px;bottom:12px;z-index:9999;font:800 14px "Bricolage Grotesque",system-ui,sans-serif;border:0;border-radius:12px;padding:10px 14px;background:#c0262d;color:#fff;box-shadow:0 3px 0 #7d1419;cursor:pointer}
@media (max-width:600px){#bc-flag{top:calc(6px + env(safe-area-inset-top));bottom:auto;left:6px;right:auto;padding:5px 9px;font-size:12px;border-radius:9px}#bc-flagbox{bottom:auto;top:44px;right:auto;left:6px}}
#bc-flagbox{position:fixed;right:12px;bottom:62px;z-index:9999;width:min(340px,calc(100vw - 24px));background:#fff;border:3px solid #1F2C7A;border-radius:16px;padding:12px;box-shadow:0 5px 0 #1F2C7A;font:14px "Bricolage Grotesque",system-ui,sans-serif;color:#1F2C7A}
#bc-flagbox textarea{width:100%;min-height:80px;font:inherit;border:2px solid #F2C230;border-radius:10px;padding:8px;box-sizing:border-box}
#bc-flagbox p{margin:0 0 6px}#bc-flagbox .r{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}
#bc-flagbox button{font:800 14px inherit;border:0;border-radius:10px;padding:8px 12px;cursor:pointer;background:#F2C230;color:#1F2C7A}#bc-flagbox button.go{background:#c0262d;color:#fff}`;
  document.head.append(st);
  const btn = document.createElement("button"); btn.id = "bc-flag"; btn.type = "button"; btn.textContent = "👎 Disapprove"; document.body.append(btn);
  const current = () => {
    const ci = Math.min(P.cat(), 4), names = ["World Rush", "Time Warp", "MVP", "Word Nerd", "Brain Teaser"];
    const list = items(window.BCDaily.getDailySet(P.key)).filter(x => x.cat.startsWith(names[ci]));
    const screen = [...document.querySelectorAll("#app .prompt, #app h2")].map(e => e.textContent.trim()).filter(Boolean).join(" | ");
    const core = x => x.prompt.replace(/^(Pin|Order): /, "").split(" — ")[0].slice(0, 40);
    const hit = screen && list.find(x => screen.includes(core(x)));
    return hit ? { ...hit, prompt: hit.prompt } : { id: names[ci].toLowerCase().replace(/ /g, "-") + "-screen", cat: names[ci], prompt: screen || "(category screen)", answer: list.map(x => x.answer).join(" | ") };
  };
  btn.onclick = () => {
    let bx = document.getElementById("bc-flagbox"); if (bx) { bx.remove(); return; }
    const it = current();
    bx = document.createElement("div"); bx.id = "bc-flagbox";
    bx.innerHTML = `<p><b>Flag: ${it.cat}</b></p><p style="font-size:12px;opacity:.8"></p><textarea placeholder="What's wrong with it?"></textarea><div class="r"><button type="button" class="x">Cancel</button><button type="button" class="go">Open issue ↗</button></div>`;
    bx.querySelector("p:nth-child(2)").textContent = cut(it.prompt, 140);
    document.body.append(bx); bx.querySelector("textarea").focus();
    bx.querySelector(".x").onclick = () => bx.remove();
    bx.querySelector(".go").onclick = () => { window.open(itemUrl(P.key, it, bx.querySelector("textarea").value), "_blank", "noopener"); bx.remove(); };
  };
});
})();
