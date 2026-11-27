/* Cup Shuffle and Track the Dot, played as Think Fast's two questions on scheduled days.
   2026-11-26: Cup Shuffle tier 2 (4 cups, 375), then Track the Dot (250 + 375).
   2026-11-27: Cup Shuffle tier 2 with 3 cups (16 moves, 260 ms, 0 feints, 375), then Track the Dot (250 + 375): 1 dot at 240 px/s, then 2 dots at 230 px/s.
   Every other date stays the regular Think Fast puzzles. Tier 1 stays banked.
   Flash Count is not part of this set. Points are a proportional split of the
   Think Fast total (400 + 600), not a separate scale. The day total stays 5,000. */
(function (root) {
  "use strict";
  const DAY = "2026-11-26";
  const THINK_PARTS = [400, 600];
  const THINK_MAX = THINK_PARTS[0] + THINK_PARTS[1];
  const WEIGHTS = [0.15, 0.25, 0.35, 0.10, 0.15];
  const POINTS = WEIGHTS.map(w => Math.round(THINK_MAX * w));
  const CUPS_HOW = ["Watch the cup with the ball.", "Tap it when the cups stop."];
  const CUPS_HOW_ES = ["Mira el vaso con la pelota.", "Tócalo cuando los vasos se detengan."];
  const DOT_HOW = ["Follow the orange dots.", "Tap them when they stop."];
  const DOT_HOW_ES = ["Sigue los puntos naranjas.", "Tócalos cuando se detengan."];
  const TIERS = {
    1: { n: 3, moves: 10, ms: 450, gap: 60, rot: 0, far: 0, feints: 0, pts: POINTS[0] },
    2: { n: 4, moves: 14, ms: 330, gap: 40, rot: 0.2, far: 0.14, feints: 0, pts: POINTS[1] },
    3: { n: 5, moves: 18, ms: 260, gap: 30, rot: 0.22, far: 0.16, feints: 2, pts: POINTS[2] }
  };
  const TRACK = [
    { dots: 6, targets: 1, speed: 175, secs: 5.0, pts: POINTS[3] },
    { dots: 7, targets: 2, speed: 190, secs: 5.5, pts: POINTS[4] }
  ];
  // Per-day plan. Points and the day total live here.
  // cups + track is the Brain Teaser cap (375 + 250 + 375 = 1,000). The day total stays 5,000
  // while dayTotal is null. Set dayTotal to "sum" to show the sum of the five category caps instead.
  // 11/26 uses TIERS[2] and TRACK as written.
  // 11/27 stays on tier 2 (4 cups) but shuffles longer and faster, and both dot rounds are quicker.
  const DAY_SCORE = {
    "2026-11-26": { cups: 375, track: [250, 375], scale: 1, dayTotal: null, tier: 2 },
    "2026-11-27": {
      cups: 375, track: [250, 375], scale: 1, dayTotal: null, tier: 2,
      n: 3, moves: 16, ms: 260,
      trackPlay: [
        { dots: 7, targets: 1, speed: 240, secs: 5.5 },
        { dots: 8, targets: 2, speed: 230, secs: 6.0 }
      ]
    }
  };
  function dayPlan(key) {
    const spec = DAY_SCORE[key];
    if (!spec) return null;
    const scale = spec.scale == null ? 1 : spec.scale;
    const cups = Math.round(spec.cups * scale);
    const track = spec.track.map(n => Math.round(n * scale));
    return {
      cups: cups, track: track, cap: cups + track.reduce((a, b) => a + b, 0), scale: scale,
      dayTotal: spec.dayTotal || null, tier: spec.tier == null ? 2 : spec.tier,
      n: spec.n == null ? null : spec.n,
      moves: spec.moves == null ? null : spec.moves, ms: spec.ms == null ? null : spec.ms,
      trackPlay: spec.trackPlay || null
    };
  }
  function playFor(key) {
    const plan = dayPlan(key);
    if (!plan) return null;
    const tier = plan.tier;
    const base = TIERS[tier];
    const cups = {
      tier: tier, n: plan.n != null ? plan.n : base.n,
      moves: plan.moves != null ? plan.moves : base.moves,
      ms: plan.ms != null ? plan.ms : base.ms,
      gap: base.gap, rot: base.rot, far: base.far, feints: base.feints, pts: plan.cups
    };
    const track = [0, 1].map(i => {
      const b = TRACK[i];
      const over = (plan.trackPlay && plan.trackPlay[i]) || {};
      return {
        dots: over.dots != null ? over.dots : b.dots,
        targets: over.targets != null ? over.targets : b.targets,
        speed: over.speed != null ? over.speed : b.speed,
        secs: over.secs != null ? over.secs : b.secs,
        pts: plan.track[i]
      };
    });
    return { key: key, tier: tier, cups: cups, track: track, cap: plan.cap, dayTotal: plan.dayTotal };
  }
  const played = dayPlan(DAY);
  TIERS[2].pts = played.cups;
  TRACK[0].pts = played.track[0];
  TRACK[1].pts = played.track[1];

  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
    return function () { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function rngFor(seed, name) { return mulberry32(xmur3(seed + "|" + name)()); }
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  function shuffle(r, a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function on(key) { return !!DAY_SCORE[key]; }
  function onEpoch(day) { return on(new Date(day * 864e5).toISOString().slice(0, 10)); }
  function roundPoints(key) {
    const pts = POINTS.slice();
    const plan = dayPlan(key || DAY);
    if (!plan) return pts;
    pts[0] = plan.cups;
    pts[3] = plan.track[0];
    pts[4] = plan.track[1];
    return pts;
  }
  // Live seeds already include the date ("eagleeye|YYYY-MM-DD"). Leave 11/26's seed alone.
  // A later day whose seed string does not already name that day gets the day appended.
  function playSeed(env) {
    const key = (env && env.day) || DAY;
    const base = String((env && env.seed) || "");
    if (!base) return "eagleeye|" + key;
    if (key === DAY || base.indexOf(key) >= 0) return base;
    return base + "|" + key;
  }
  function activePlay(env) { return playFor(env && env.day) || playFor(DAY); }

  function applyMove(ball, m) {
    if (m.t === "swap") { if (ball === m.a) return m.b; if (ball === m.b) return m.a; return ball; }
    if (m.t === "rot") {
      const i = m.i;
      if (ball < i || ball > i + 2) return ball;
      if (m.dir === 1) return ball === i + 2 ? i : ball + 1;
      return ball === i ? i + 2 : ball - 1;
    }
    return ball;
  }
  function makeMoves(r, T, ballSlot) {
    const n = T.n, moves = [];
    let ball = ballSlot, last = "", rep = 0, real = 0;
    const feintAt = [];
    for (let k = 0; k < T.feints; k++) feintAt.push(ri(r, 3, T.moves - 2));
    while (real < T.moves) {
      while (feintAt.includes(real)) {
        feintAt.splice(feintAt.indexOf(real), 1);
        const a = ri(r, 0, n - 2);
        moves.push({ t: "feint", kind: "swap", a: a, b: a + 1, front: r() < 0.5 });
      }
      const x = r();
      let m;
      if (x < T.rot && n >= 3) m = { t: "rot", i: ri(r, 0, n - 3), dir: r() < 0.5 ? 1 : -1, front: r() < 0.5 };
      else if (x < T.rot + T.far && n >= 4) {
        const pairs = [];
        for (let a = 0; a < n; a++) for (let b = a + 3; b < n; b++) pairs.push([a, b]);
        const withBall = pairs.filter(p => p[0] === ball || p[1] === ball);
        const pool = (withBall.length && r() < 0.5) ? withBall : pairs;
        const p = pool[Math.floor(r() * pool.length)];
        m = { t: "swap", a: p[0], b: p[1], front: r() < 0.5, far: true };
      } else {
        let a, b;
        if (r() < 0.55) { a = ball; do { b = ri(r, 0, n - 1); } while (b === a || Math.abs(b - a) > 2); }
        else { a = ri(r, 0, n - 1); do { b = ri(r, 0, n - 1); } while (b === a || Math.abs(b - a) > 2); }
        if (a > b) { const s = a; a = b; b = s; }
        m = { t: "swap", a: a, b: b, front: r() < 0.5 };
      }
      const k = JSON.stringify([m.t, m.a, m.b, m.i]);
      if (k === last) { rep++; if (rep >= 2) continue; } else rep = 0;
      last = k;
      moves.push(m); ball = applyMove(ball, m); real++;
    }
    return { moves: moves, finalSlot: ball };
  }
  function planCup(seed, tier, spec) {
    const T = spec || TIERS[tier];
    const tr = rngFor(seed, "cups-tier" + tier);
    const startSlot = ri(tr, 0, T.n - 1);
    const plan = makeMoves(tr, T, startSlot);
    return { tier: tier, n: T.n, startSlot: startSlot, moves: plan.moves, finalSlot: plan.finalSlot };
  }
  function replayBall(start, moves) {
    let ball = start;
    for (let i = 0; i < moves.length; i++) ball = applyMove(ball, moves[i]);
    return ball;
  }
  // Cups as physical objects. The ball stays with the cup that covered it.
  function replayCups(n, start, moves) {
    const at = [];
    for (let i = 0; i < n; i++) at.push(i);
    const ballCup = start;
    for (let k = 0; k < moves.length; k++) {
      const m = moves[k];
      if (m.t === "swap") { const ca = at[m.a]; at[m.a] = at[m.b]; at[m.b] = ca; }
      else if (m.t === "rot") {
        const i = m.i, c0 = at[i], c1 = at[i + 1], c2 = at[i + 2];
        if (m.dir === 1) { at[i] = c2; at[i + 1] = c0; at[i + 2] = c1; }
        else { at[i] = c1; at[i + 1] = c2; at[i + 2] = c0; }
      }
    }
    return at.indexOf(ballCup);
  }
  function scoreTrack(hits, round) {
    const R = TRACK[round];
    return hits === R.targets ? R.pts : 0;
  }
  // A second tap inside this window is the rest of a double tap, not a new dot.
  function trackPick(state, index, now) {
    if (index < 0 || !Number.isFinite(now)) return false;
    if (state.lastAt != null && now - state.lastAt < 300) return false;
    if (state.picks.indexOf(index) >= 0) return false;
    state.picks.push(index);
    state.lastAt = now;
    return true;
  }

  function cupSVG(id) {
    return `<svg viewBox="0 0 100 120" preserveAspectRatio="none" aria-hidden="true">
 <defs>
  <linearGradient id="body${id}" x1="0" x2="1" y1="0" y2="0">
   <stop offset="0" stop-color="#5e0d12"/><stop offset=".12" stop-color="#9d1820"/><stop offset=".3" stop-color="#d4323a"/>
   <stop offset=".42" stop-color="#ef5a5f"/><stop offset=".55" stop-color="#d22f37"/><stop offset=".82" stop-color="#8e141c"/><stop offset="1" stop-color="#4a0a0e"/>
  </linearGradient>
  <linearGradient id="rim${id}" x1="0" x2="1" y1="0" y2="0">
   <stop offset="0" stop-color="#6a1016"/><stop offset=".3" stop-color="#e2474e"/><stop offset=".42" stop-color="#ff8a8c"/>
   <stop offset=".6" stop-color="#d33a41"/><stop offset="1" stop-color="#52090e"/>
  </linearGradient>
  <radialGradient id="top${id}" cx=".42" cy=".4" r=".7"><stop offset="0" stop-color="#e6474e"/><stop offset="1" stop-color="#7d1118"/></radialGradient>
  <linearGradient id="spec${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset=".7" stop-color="#fff" stop-opacity=".15"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <linearGradient id="shade${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".18"/><stop offset=".35" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>
 </defs>
 <path d="M23 12 L9 101 Q50 113 91 101 L77 12 Z" fill="url(#body${id})"/>
 <path d="M23 12 L9 101 Q50 113 91 101 L77 12 Z" fill="url(#shade${id})"/>
 <path d="M20.5 32 Q50 38 79.5 32" fill="none" stroke="#3d070b" stroke-opacity=".35" stroke-width="1.4"/>
 <path d="M20.3 34 Q50 40 79.7 34" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="1"/>
 <path d="M17.5 52 Q50 59 82.5 52" fill="none" stroke="#3d070b" stroke-opacity=".3" stroke-width="1.4"/>
 <path d="M17.3 54 Q50 61 82.7 54" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="1"/>
 <path d="M10.5 92 Q50 103 89.5 92 L91.5 103 Q50 116 8.5 103 Z" fill="url(#rim${id})"/>
 <path d="M8.5 103 Q50 116 91.5 103" fill="none" stroke="#3a0609" stroke-width="1.6" stroke-opacity=".7"/>
 <path d="M33 16 L27 90 Q31 91.5 35 92 L39 17 Z" fill="url(#spec${id})" opacity=".55"/>
 <path d="M70 16 L78 92 Q76 93 74 93.5 L67 17 Z" fill="#fff" opacity=".07"/>
 <ellipse cx="50" cy="12" rx="27" ry="5.5" fill="url(#top${id})" stroke="#4a0a0e" stroke-width=".8"/>
 <ellipse cx="45" cy="11" rx="12" ry="1.8" fill="#fff" opacity=".22"/>
</svg>`;
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const ease = t => -(Math.cos(Math.PI * t) - 1) / 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  function tween(ms, fn) {
    return new Promise(res => {
      const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
      function f(now) {
        let t = Math.min(1, (now - t0) / ms);
        fn(t);
        if (t < 1) requestAnimationFrame(f); else res();
      }
      requestAnimationFrame(f);
    });
  }
  function setPhase(p) {
    if (typeof document !== "undefined") document.body.dataset.phase = p;
    if (root.PERC) root.PERC.phase = p;
  }
  function node(tag, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }
  function reducedMotion() {
    try { return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch (e) { return false; }
  }
  function waitBtn(env, body, label) {
    return new Promise(res => { env.nextBtn(env.actionBar(body), label, res); });
  }
  function bindTap(el, fn) {
    // Drop only the click that repeats the same touch inside 300 ms.
    // A later click, including one from assistive tech, still counts.
    const pending = [];
    const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
    const onPointer = ev => { pending.push(now()); fn(ev); };
    const onClick = ev => {
      const t = now();
      const i = pending.findIndex(at => t - at < 300);
      if (i >= 0) { pending.splice(i, 1); return; }
      for (let j = pending.length - 1; j >= 0; j--) if (t - pending[j] >= 300) pending.splice(j, 1);
      fn(ev);
    };
    el.addEventListener("pointerup", onPointer);
    el.addEventListener("click", onClick);
    return () => { el.removeEventListener("pointerup", onPointer); el.removeEventListener("click", onClick); };
  }

  function puzzleLine(env, n, name, pts) {
    return env.tr("Puzzle {0} of 2{1} · {2} pts · one submission", String(n), " · " + env.tr(name), String(pts));
  }
  function openScreen(env, n, name, pts) {
    return env.screen(env.tr("Brain Teaser"), puzzleLine(env, n, name, pts));
  }
  function trackCue(env, n, phase) {
    if (phase === "remember") {
      if (n <= 1) return env.tr("Remember the orange dot");
      if (n === 2) return env.tr("Remember both orange dots");
      return env.tr("Remember the three orange dots");
    }
    if (phase === "follow") return n <= 1 ? env.tr("Follow it…") : env.tr("Follow them…");
    if (n <= 1) return env.tr("Tap the dot");
    if (n === 2) return env.tr("Tap both dots");
    return env.tr("Tap all three dots");
  }
  async function howto(env, kind) {
    setPhase(kind === "cups" ? "howto-cups" : "howto-dot");
    const lines = kind === "cups" ? CUPS_HOW : DOT_HOW;
    const slot = kind === "cups" ? 1 : 2;
    const name = kind === "cups" ? "Cup Shuffle" : "Track the Dot";
    const play = activePlay(env);
    const max = kind === "cups" ? play.cups.pts : play.track[0].pts + play.track[1].pts;
    const body = openScreen(env, slot, name, max);
    const p = node("p", "prompt");
    p.textContent = lines.map(line => env.tr(line)).join(" ");
    body.append(p);
    if (env.scheduleFit) env.scheduleFit();
    await waitBtn(env, body, env.tr("Start"));
  }

  async function cupRound(env, tier, idx) {
    const play = activePlay(env);
    const useDay = !!(play && play.tier === tier);
    const R = useDay ? play.cups : TIERS[tier];
    const plan = planCup(playSeed(env), tier, useDay ? R : null);
    const dbg = { tier: tier, n: R.n, startSlot: plan.startSlot, moves: plan.moves, finalSlot: plan.finalSlot, picked: null, correct: null, domFinalSlot: null, rank: null };
    root.PERC.debug.cups.push(dbg);
    setPhase("cups-" + idx + "-show");
    const body = openScreen(env, 1, "Cup Shuffle", R.pts);
    const stage = node("div", "ee-stage");
    stage.setAttribute("data-ee-logic", String(plan.finalSlot));
    const mat = node("div", "ee-mat");
    stage.append(mat);
    const st = node("div", "ee-status");
    st.textContent = env.tr("Watch the ball");
    const sub = node("div", "ee-sub");
    body.append(stage, st, sub);
    if (env.scheduleFit) env.scheduleFit();
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const n = R.n;
    let G = {};
    let animating = false;
    function geom() {
      const w = stage.clientWidth || stage.getBoundingClientRect().width || 320;
      const pad = 8, spc = (w - 2 * pad) / n;
      const W = Math.min(96, spc * 0.86), H = W * 1.2, L = W * 0.62, D = Math.max(12, W * 0.3);
      const bottomPad = D * 1.3 + 20, top = Math.max(L, D * 1.2) + 16;
      const hh = Math.round(top + H + bottomPad);
      stage.style.height = hh + "px";
      const X = [];
      for (let i = 0; i < n; i++) X.push(pad + spc * (i + 0.5));
      const base = hh - bottomPad;
      mat.style.top = (base - W * 0.42) + "px";
      mat.style.bottom = "6px";
      mat.style.height = "auto";
      G = { w: w, hh: hh, W: W, H: H, X: X, base: base, L: L, D: D };
    }
    geom();
    const ballEl = node("div", "ee-ball");
    stage.append(ballEl);
    const mark = node("div", "ee-pick");
    mark.hidden = true;
    stage.append(mark);
    const cups = [];
    const ballSlot = plan.startSlot;
    for (let i = 0; i < n; i++) {
      const c = { id: i, slot: i, x: G.X[i], lift: G.L, depth: 0, s: 1, z: 10, dim: 0 };
      c.sh = node("div", "ee-shadow");
      stage.append(c.sh);
      c.el = node("div", "ee-cup");
      c.el.dataset.cup = String(i);
      c.el.innerHTML = cupSVG("c" + idx + "_" + i);
      stage.append(c.el);
      cups.push(c);
    }
    const ballCup = cups[ballSlot];
    ballCup.el.dataset.ball = "1";
    function render(c) {
      c.el.style.width = G.W + "px";
      c.el.style.height = G.H + "px";
      c.el.style.transform = "translate(" + (c.x - G.W / 2) + "px," + (G.base - G.H - c.lift + c.depth) + "px) scale(" + c.s + ")";
      c.el.style.zIndex = String(c.z);
      c.el.style.filter = c.dim ? "brightness(" + (1 - c.dim) + ")" : "";
      const lf = Math.min(1, c.lift / G.L), sw = G.W * (0.98 - 0.25 * lf) * c.s, shh = sw * 0.22;
      c.sh.style.width = sw + "px";
      c.sh.style.height = shh + "px";
      c.sh.style.opacity = String(0.85 - 0.45 * lf);
      c.sh.style.transform = "translate(" + (c.x - sw / 2) + "px," + (G.base + c.depth - shh * 0.45) + "px)";
    }
    function renderBall(slot) {
      const d = G.W * 0.36;
      ballEl.style.width = ballEl.style.height = d + "px";
      ballEl.style.transform = "translate(" + (G.X[slot] - d / 2) + "px," + (G.base - d - 3) + "px)";
    }
    const renderAll = () => cups.forEach(render);
    renderAll();
    renderBall(ballSlot);
    let picked = null;
    function placeMark() {
      const d = G.W * 1.05;
      mark.style.width = d + "px";
      mark.style.height = (d * 0.3) + "px";
      mark.style.transform = "translate(" + (G.X[picked.slot] - d / 2) + "px," + (G.base - d * 0.15) + "px)";
    }
    function relayout() {
      if (animating) return;
      geom();
      cups.forEach(c => { c.x = G.X[c.slot]; });
      renderAll();
      renderBall(ballCup.slot);
      if (picked) placeMark();
    }
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(relayout) : null;
    if (ro) ro.observe(stage);
    const ms = R.ms, gap = R.gap;
    const reset = list => list.forEach(c => { c.depth = 0; c.s = 1; c.z = 10; c.dim = 0; });
    const at = s => cups.find(c => c.slot === s);
    if (reducedMotion()) {
      ballEl.style.visibility = "hidden";
      plan.moves.forEach(m => {
        if (m.t === "swap") {
          const a = at(m.a), b = at(m.b);
          a.slot = m.b; b.slot = m.a; a.x = G.X[m.b]; b.x = G.X[m.a]; a.lift = 0; b.lift = 0;
        } else if (m.t === "rot") {
          const i = m.i, c0 = at(i), c1 = at(i + 1), c2 = at(i + 2);
          const plan3 = m.dir === 1 ? [[c0, i, i + 1], [c1, i + 1, i + 2], [c2, i + 2, i]] : [[c0, i, i + 2], [c1, i + 1, i], [c2, i + 2, i + 1]];
          plan3.forEach(([c, , s1]) => { c.slot = s1; c.x = G.X[s1]; c.lift = 0; });
        }
      });
      cups.forEach(c => { c.lift = 0; });
      renderAll();
    } else {
    await sleep(1300);
    st.textContent = env.tr("Keep your eye on it");
    animating = true;
    await tween(480, t => { const e = ease(t); cups.forEach(c => { c.lift = G.L * (1 - e); render(c); }); });
    animating = false;
    ballEl.style.visibility = "hidden";
    await sleep(350);
    setPhase("cups-" + idx + "-shuffle");
    st.textContent = env.tr("Shuffling…");
    sub.textContent = "";
    function frontBack(front, back, D, arc) {
      front.depth = D * arc; front.s = 1 + 0.10 * arc; front.z = 30;
      back.depth = -D * 0.85 * arc; back.s = 1 - 0.12 * arc; back.z = 5; back.dim = 0.22 * arc;
    }
    for (let k = 0; k < plan.moves.length; k++) {
      const m = plan.moves[k];
      animating = true;
      if (m.t === "swap") {
        const a = at(m.a), b = at(m.b), xa = G.X[m.a], xb = G.X[m.b];
        const front = m.front ? a : b, back = m.front ? b : a, dist = m.b - m.a;
        const D = G.D * (dist > 1 ? 1.25 : 1), dur = ms * (dist >= 3 ? 1.35 : dist === 2 ? 1.15 : 1);
        await tween(dur, t => {
          const e = ease(t), arc = Math.sin(Math.PI * e);
          a.x = lerp(xa, xb, e); b.x = lerp(xb, xa, e);
          frontBack(front, back, D, arc); render(a); render(b);
        });
        reset([a, b]); a.slot = m.b; b.slot = m.a; a.x = xb; b.x = xa; render(a); render(b);
      } else if (m.t === "rot") {
        const i = m.i, c0 = at(i), c1 = at(i + 1), c2 = at(i + 2);
        const plan3 = m.dir === 1 ? [[c0, i, i + 1], [c1, i + 1, i + 2], [c2, i + 2, i]] : [[c0, i, i + 2], [c1, i + 1, i], [c2, i + 2, i + 1]];
        const long = m.dir === 1 ? c2 : c0, shorts = plan3.map(p => p[0]).filter(c => c !== long);
        await tween(ms * 1.35, t => {
          const e = ease(t), arc = Math.sin(Math.PI * e);
          plan3.forEach(([c, s0, s1]) => { c.x = lerp(G.X[s0], G.X[s1], e); });
          if (m.front) {
            long.depth = G.D * 1.2 * arc; long.s = 1 + 0.1 * arc; long.z = 30;
            shorts.forEach(c => { c.depth = -G.D * 0.6 * arc; c.s = 1 - 0.08 * arc; c.z = 6; c.dim = 0.15 * arc; });
          } else {
            long.depth = -G.D * 1.05 * arc; long.s = 1 - 0.13 * arc; long.z = 5; long.dim = 0.22 * arc;
            shorts.forEach(c => { c.depth = G.D * 0.5 * arc; c.s = 1 + 0.05 * arc; c.z = 25; });
          }
          plan3.forEach(p => render(p[0]));
        });
        reset([c0, c1, c2]);
        plan3.forEach(([c, , s1]) => { c.slot = s1; c.x = G.X[s1]; render(c); });
      } else if (m.t === "feint" && m.kind === "swap") {
        const a = at(m.a), b = at(m.b), xa = G.X[m.a], xb = G.X[m.b];
        await tween(ms * 1.1, t => {
          const e = 0.35 * Math.sin(Math.PI * ease(t));
          a.x = lerp(xa, xb, e); b.x = lerp(xb, xa, e);
          a.lift = 0; b.lift = 0; render(a); render(b);
        });
        reset([a, b]); a.x = xa; b.x = xb; a.lift = 0; b.lift = 0; render(a); render(b);
      }
      animating = false;
      if (gap) await sleep(gap);
    }
    }
    dbg.domFinalSlot = ballCup.slot;
    const rank = cups.slice().sort((a, b) => a.x - b.x).indexOf(ballCup);
    dbg.rank = rank;
    stage.setAttribute("data-ee-final", String(ballCup.slot));
    stage.setAttribute("data-ee-rank", String(rank));
    if (ballCup.slot !== plan.finalSlot || rank !== plan.finalSlot) console.error("cup slot mismatch", { dom: ballCup.slot, rank: rank, logic: plan.finalSlot });
    setPhase("cups-" + idx + "-pick");
    st.textContent = env.tr("Tap the cup with the ball");
    picked = await new Promise(res => {
      let done = false;
      const keys = [];
      const finish = cup => {
        if (done) return;
        done = true;
        cups.forEach(c => { c.el.tabIndex = -1; c.el.removeAttribute("role"); if (c.el.blur) c.el.blur(); });
        off();
        keys.forEach(fn => fn());
        res(cup);
      };
      const off = bindTap(stage, ev => {
        const rc = stage.getBoundingClientRect();
        const x = ev.clientX - rc.left;
        let best = cups[0];
        cups.forEach(c => { if (Math.abs(c.x - x) < Math.abs(best.x - x)) best = c; });
        finish(best);
      });
      cups.forEach(c => {
        c.el.setAttribute("role", "button");
        c.el.tabIndex = 0;
        const cupName = env.tr("Cup {0} of {1}", String(c.slot + 1), String(R.n));
        c.el.setAttribute("aria-label", cupName);
        c.el.style.pointerEvents = "auto";
        const cap = document.createElement("span");
        cap.className = "sr-only";
        cap.textContent = cupName;
        c.el.append(cap);
        const onKey = ev => {
          if (ev.key !== "Enter" && ev.key !== " ") return;
          ev.preventDefault();
          finish(c);
        };
        c.el.addEventListener("keydown", onKey);
        keys.push(() => c.el.removeEventListener("keydown", onKey));
      });
    });
    const correct = picked === ballCup;
    dbg.picked = picked.slot;
    dbg.correct = correct;
    placeMark();
    mark.classList.toggle("bad", !correct);
    mark.hidden = false;
    renderBall(ballCup.slot);
    ballEl.style.visibility = "visible";
    animating = true;
    await tween(380, t => { picked.lift = G.L * ease(t); render(picked); });
    const others = cups.filter(c => c !== picked);
    await tween(380, t => { others.forEach(c => { c.lift = G.L * ease(t); render(c); }); });
    animating = false;
    setPhase("cups-" + idx + "-reveal");
    st.textContent = correct ? env.tr("Got it! +{0}", String(R.pts)) : env.tr("Not that one");
    st.classList.toggle("ok", correct);
    st.classList.toggle("no", !correct);
    sub.textContent = correct ? env.tr("You tracked the ball the whole way.") : env.tr("The ball ended up under a different cup.");
    if (ro) ro.disconnect();
    return { pts: correct ? R.pts : 0, body: body };
  }

  async function trackRound(env, idx) {
    const play = activePlay(env);
    const R = (play && play.track && play.track[idx]) || TRACK[idx];
    // One stream for both rounds, drawn in order. Round 2 continues where round 1 stopped.
    if (!env._trackRng) env._trackRng = rngFor(playSeed(env), "track");
    const rng = env._trackRng;
    const AW = 340, AH = 300, RAD = 15;
    const dots = [];
    let guard = 0;
    while (dots.length < R.dots && guard++ < 5000) {
      const x = RAD + 6 + rng() * (AW - 2 * RAD - 12), y = RAD + 6 + rng() * (AH - 2 * RAD - 12);
      if (dots.every(d => Math.hypot(d.x - x, d.y - y) > RAD * 2 + 14)) { const a = rng() * Math.PI * 2; dots.push({ x: x, y: y, a: a }); }
    }
    const targets = shuffle(rng, dots.map((_, i) => i)).slice(0, R.targets);
    const speed = R.speed;
    dots.forEach(d => { d.vx = Math.cos(d.a) * speed; d.vy = Math.sin(d.a) * speed; });
    const dbg = { targets: targets.slice(), picks: [], correct: null, final: null };
    root.PERC.debug.track.push(dbg);
    setPhase("track-" + idx + "-show");
    const dotMax = play ? play.track[0].pts + play.track[1].pts : TRACK[0].pts + TRACK[1].pts;
    const body = openScreen(env, 2, "Track the Dot", dotMax);
    const NS = "http://www.w3.org/2000/svg";
    const arena = document.createElementNS(NS, "svg");
    arena.setAttribute("class", "ee-arena");
    arena.setAttribute("viewBox", "0 0 " + AW + " " + AH);
    const defs = document.createElementNS(NS, "defs");
    defs.innerHTML = '<radialGradient id="eeDot" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#f3e6cc"/><stop offset="1" stop-color="#b9a47e"/></radialGradient><radialGradient id="eeDotT" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#ffd0b8"/><stop offset=".55" stop-color="#E85A2B"/><stop offset="1" stop-color="#9c3412"/></radialGradient>';
    arena.append(defs);
    dots.forEach((d, i) => {
      const g = document.createElementNS(NS, "g");
      g.setAttribute("data-dot", String(i));
      const ring = document.createElementNS(NS, "circle");
      ring.setAttribute("class", "ee-ring");
      ring.setAttribute("r", String(RAD + 6));
      const bodyC = document.createElementNS(NS, "circle");
      bodyC.setAttribute("class", "ee-dot");
      bodyC.setAttribute("r", String(RAD));
      bodyC.setAttribute("fill", "url(#eeDot)");
      g.append(ring, bodyC);
      arena.append(g);
    });
    const st = node("div", "ee-status");
    st.textContent = trackCue(env, R.targets, "remember");
    const sub = node("div", "ee-sub");
    body.append(arena, st, sub);
    if (env.scheduleFit) env.scheduleFit();
    const gs = [...arena.querySelectorAll("g[data-dot]")];
    const draw = () => dots.forEach((d, i) => gs[i].setAttribute("transform", "translate(" + d.x.toFixed(2) + "," + d.y.toFixed(2) + ")"));
    draw();
    targets.forEach(i => {
      gs[i].querySelector(".ee-dot").setAttribute("fill", "url(#eeDotT)");
      const rg = gs[i].querySelector(".ee-ring");
      rg.classList.add("on", "ee-pulse");
    });
    await sleep(1800);
    targets.forEach(i => {
      gs[i].querySelector(".ee-dot").setAttribute("fill", "url(#eeDot)");
      gs[i].querySelector(".ee-ring").classList.remove("on", "ee-pulse");
    });
    await sleep(350);
    setPhase("track-" + idx + "-move");
    st.textContent = trackCue(env, R.targets, "follow");
    const DT = 1 / 120, steps = Math.round(R.secs / DT);
    let done = 0;
    function step() {
      for (const d of dots) {
        d.x += d.vx * DT; d.y += d.vy * DT;
        if (d.x < RAD) { d.x = RAD; d.vx = Math.abs(d.vx); }
        if (d.x > AW - RAD) { d.x = AW - RAD; d.vx = -Math.abs(d.vx); }
        if (d.y < RAD) { d.y = RAD; d.vy = Math.abs(d.vy); }
        if (d.y > AH - RAD) { d.y = AH - RAD; d.vy = -Math.abs(d.vy); }
      }
      for (let i = 0; i < dots.length; i++) for (let j = i + 1; j < dots.length; j++) {
        const a = dots[i], b = dots[j];
        const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
        if (dist < RAD * 2 && dist > 0) {
          const nx = dx / dist, ny = dy / dist, ov = (RAD * 2 - dist) / 2;
          a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
          const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (rel > 0) { a.vx -= rel * nx; a.vy -= rel * ny; b.vx += rel * nx; b.vy += rel * ny; }
        }
      }
    }
    if (reducedMotion()) {
      while (done < steps) { step(); done++; }
      draw();
    } else {
    await new Promise(res => {
      const t0 = performance.now();
      function f(now) {
        const want = Math.min(steps, Math.floor((now - t0) / 1000 / DT));
        while (done < want) { step(); done++; }
        draw();
        if (done < steps) requestAnimationFrame(f); else res();
      }
      requestAnimationFrame(f);
    });
    }
    dbg.final = dots.map(d => [+d.x.toFixed(2), +d.y.toFixed(2)]);
    setPhase("track-" + idx + "-pick");
    st.textContent = trackCue(env, R.targets, "tap");
    const pickState = { picks: [], lastAt: null };
    gs.forEach((g, i) => {
      g.setAttribute("role", "button");
      g.setAttribute("tabindex", "0");
      g.setAttribute("aria-label", env.tr("Dot {0} of {1}", String(i + 1), String(R.dots)));
    });
    await new Promise(res => {
      let done = false;
      const finish = () => { if (done) return; done = true; off(); gs.forEach(g => g.removeEventListener("keydown", onKey)); res(); };
      const choose = (best, now, x, y) => {
        if (done || best < 0) return;
        if (!trackPick(pickState, best, now)) return;
        const tp = document.createElementNS(NS, "circle");
        tp.setAttribute("class", "ee-tap");
        tp.setAttribute("cx", String(x));
        tp.setAttribute("cy", String(y));
        tp.setAttribute("r", "6");
        arena.append(tp);
        setTimeout(() => tp.remove(), 600);
        gs[best].querySelector(".ee-dot").setAttribute("fill", "#9fb3d9");
        const left = R.targets - pickState.picks.length;
        if (left <= 0) finish();
        else if (left === 1) sub.textContent = env.tr("One more");
        else if (left === 2) sub.textContent = env.tr("Two more");
        else sub.textContent = env.tr("{0} more", String(left));
      };
      const onKey = ev => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        ev.preventDefault();
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        const i = Number(ev.currentTarget.getAttribute("data-dot"));
        const d = dots[i];
        if (!d) return;
        choose(i, now, d.x, d.y);
      };
      gs.forEach(g => g.addEventListener("keydown", onKey));
      const off = bindTap(arena, ev => {
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        if (pickState.lastAt != null && now - pickState.lastAt < 300) return;
        const pt = arena.createSVGPoint();
        pt.x = ev.clientX; pt.y = ev.clientY;
        const ctm = arena.getScreenCTM();
        if (!ctm) return;
        const p = pt.matrixTransform(ctm.inverse());
        let best = -1, bd = 1e9;
        dots.forEach((d, i) => {
          const dd = Math.hypot(d.x - p.x, d.y - p.y);
          if (dd < bd) { bd = dd; best = i; }
        });
        if (best < 0 || bd > RAD * 2.6) return;
        choose(best, now, p.x, p.y);
      });
    });
    const picks = pickState.picks;
    dbg.picks = picks.slice();
    const hits = picks.filter(p => targets.includes(p)).length;
    dbg.correct = hits === R.targets;
    targets.forEach(i => {
      gs[i].querySelector(".ee-dot").setAttribute("fill", "url(#eeDotT)");
      const rg = gs[i].querySelector(".ee-ring");
      rg.classList.add("on");
      rg.classList.remove("ee-pulse");
      rg.style.stroke = "#1F9D55";
    });
    picks.filter(p => !targets.includes(p)).forEach(i => {
      const rg = gs[i].querySelector(".ee-ring");
      rg.classList.add("on");
      rg.classList.remove("ee-pulse");
      rg.style.stroke = "#D7263D";
    });
    const pts = hits === R.targets ? R.pts : 0;
    setPhase("track-" + idx + "-reveal");
    const roundNo = String(idx + 1);
    st.textContent = hits === R.targets
      ? env.tr("Round {0} · Locked on! +{1}", roundNo, String(pts))
      : env.tr("Round {0} · Lost it · +0", roundNo);
    st.classList.toggle("ok", hits === R.targets);
    st.classList.toggle("no", hits !== R.targets);
    sub.textContent = R.targets > 1 ? env.tr("The orange dots were the ones to follow.") : env.tr("The orange dot was the one to follow.");
    return { pts: pts, body: body };
  }

  async function run(env) {
    root.PERC = { state: { seed: env.seed }, debug: { cups: [], track: [] }, phase: "ee-start", applyMove: applyMove, makeMoves: makeMoves, planCup: planCup };
    env._trackRng = null;
    let total = 0;
    const log = [];
    const play = activePlay(env);
    await howto(env, "cups");
    {
      const res = await cupRound(env, play.tier, 0);
      total += res.pts;
      log.push(res.pts);
      if (env.onRound) env.onRound(total);
      await waitBtn(env, res.body, env.tr("Final puzzle →"));
    }
    await howto(env, "dot");
    let dots = 0;
    for (let i = 0; i < 2; i++) {
      const res = await trackRound(env, i);
      dots += res.pts;
      total += res.pts;
      if (env.onRound) env.onRound(total);
      if (i === 0) await waitBtn(env, res.body, env.tr("Next round →"));
      else {
        log.push(dots);
        const subLine = res.body.querySelector(".ee-sub");
        if (subLine) subLine.textContent = env.tr("Track the Dot · +{0}", String(dots));
        if (env.onDone) env.onDone(total, log.join("/"), res.body);
      }
    }
    return total;
  }

  const api = {
    DAY: DAY, THINK_PARTS: THINK_PARTS, THINK_MAX: THINK_MAX, WEIGHTS: WEIGHTS,
    CUPS_HOW: CUPS_HOW, CUPS_HOW_ES: CUPS_HOW_ES,
    DOT_HOW: DOT_HOW, DOT_HOW_ES: DOT_HOW_ES,
    TIERS: TIERS, TRACK: TRACK, POINTS: POINTS,
    on: on, onEpoch: onEpoch, roundPoints: roundPoints,
    rngFor: rngFor, applyMove: applyMove, makeMoves: makeMoves,
    planCup: planCup, replayBall: replayBall, replayCups: replayCups, scoreTrack: scoreTrack, trackPick: trackPick,
    dayPlan: dayPlan, playFor: playFor, DAY_SCORE: DAY_SCORE,
    run: run
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.EagleEye = api;
})(typeof window !== "undefined" ? window : globalThis);
