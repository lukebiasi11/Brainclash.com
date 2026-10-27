/* Daily Gauntlet — swappable icon map (design-owned).
   Key -> SVG path (relative to index.html). Swap art by replacing the file
   or pointing a key at a new path. Missing key/file => emoji fallback. */
(function () {
  const A = "assets/", f = n => A + n + ".svg";
  const M = {
    // categories (app.js CATS ids)
    "cat-world": f("cat-world"), "cat-history": f("cat-history"), "cat-sports": f("cat-sports"),
    "cat-word": f("cat-word"), "cat-brain": f("cat-brain"),
    // flags
    "flag-south-korea": f("flag-south-korea"), "flag-nigeria": f("flag-nigeria"), "flag-portugal": f("flag-portugal"),
    "flag-brazil": f("flag-brazil"), "flag-colombia": f("flag-colombia"), "flag-argentina": f("flag-argentina")
  };
  // sports: sports-d<day>-q<n>  (one reusable SVG per sport, all 32 days of content.js C.sports)
  [
   ["football", "basketball-player", "baseball"], ["soccer", "mystery-logo-football", "tennis"],
   ["hockey", "golfer", "basketball"], ["basketball", "mystery-logo-baseball", "football"],
   ["sprinter", "soccer-player", "swimmer"], ["football", "mystery-logo-basketball", "skiing"],
   ["golf", "boxer", "rugby"], ["basketball", "hockey-player", "tennis"],
   ["soccer", "mystery-logo-basketball", "gymnast"], ["tennis", "mystery-logo-hockey", "cricket"],
   ["baseball", "soccer-player", "stadium"], ["badminton", "golf", "cycling"],
   ["tennis", "hockey", "horse-racing"], ["medal", "mystery-logo-football", "long-jump"],
   ["basketball", "basketball-player", "soccer"], ["trophy", "baseball", "tennis"],
   ["sprinter", "mystery-logo-baseball", "basketball"], ["wrestling", "football", "tennis"],
   ["cycling", "baseball", "soccer"], ["bowling", "racing-driver", "medal"],
   ["hockey", "mystery-logo-baseball", "baseball"], ["basketball", "mystery-logo-football", "soccer"],
   ["checkered-flag", "soccer-player", "swimmer"], ["darts", "mystery-logo-football", "baseball"],
   ["cricket", "soccer", "stadium"], ["golf", "basketball-player", "hurdles"],
   ["volleyball", "mystery-logo-football", "wheelchair"], ["billiards", "golf", "skiing"],
   ["football", "pole-vaulter", "checkered-flag"], ["racing", "mystery-logo-football", "billiards"],
   ["swimmer", "football-player", "stadium"], ["rugby", "mystery-logo-baseball", "handball"]]
    .forEach((d, i) => d.forEach((s, q) => { M[`sports-d${i + 1}-q${q + 1}`] = f("sport-" + s); }));
  // history: hist-d<day>-r<round>-e<n>
  const H = [
    [["telephone", "light-bulb", "biplane", "tv"], ["plague-rat", "sailing-ship", "declaration", "eiffel-tower", "moon-rocket"]],
    [["soda-cup", "burger", "apple", "magnifier"], ["crossed-swords", "scroll", "musket", "bastille", "medal"]],
    [["printing-press", "locomotive", "radio", "globe-www"], ["telescope", "apple-falling", "dna", "radiation", "flask"]],
    [["olympic-column", "@soccer", "@football", "@basketball"], ["pyramid", "column", "dagger", "castle", "compass"]],
    [["film-clapper", "mouse", "guitar", "gamepad"], ["ship", "explosion", "wall-built", "wall-fall", "phone"]]
  ];
  H.forEach((d, i) => d.forEach((r, j) => r.forEach((n, k) => {
    M[`hist-d${i + 1}-r${j + 1}-e${k + 1}`] = f(n[0] === "@" ? "sport-" + n.slice(1) : "hist-" + n);
  })));
  // icon(key, emoji, cls): <img> if key mapped, emoji text if not or if the file 404s.
  function icon(key, emoji, cls) {
    const src = key && M[key];
    const fb = () => { const s = document.createElement("span"); s.className = "ico-fb"; s.textContent = emoji || ""; return s; };
    if (!src) return fb();
    const im = document.createElement("img");
    im.src = src; im.alt = emoji || ""; im.className = "ico" + (cls ? " " + cls : ""); im.decoding = "async"; im.draggable = false;
    im.onerror = () => im.replaceWith(fb());
    return im;
  }
  window.ICONS = M; window.icon = icon;
})();
