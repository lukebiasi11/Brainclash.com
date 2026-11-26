/* Daily field comparison. Public site settings only.
   FIELD_COMPARE_ENABLED is the single kill switch. true means a daily run
   may call field-compare. publishableKey is the dailydose dashboard key
   (sb_publishable_…). It is public by design: it cannot read scores and it
   is not a session. A blank key still fails closed.
   OPERATOR_CONTACT is the public contact address. NOTICE_LAST_UPDATED is the
   notice date. Launch day is 2026-11-22. The public board stays off until
   LEADERBOARD_PUBLIC is set to on. A real date is shown in English and Spanish. */
(function (root) {
  "use strict";
  // The UMD build loads on demand from vendor/supabase.js. Do not import the jsDelivr +esm build.
  // Field and the leaderboard each create their own client. Their storage keys stay distinct.
  function loadSupabaseScript() {
    if (root.supabase && typeof root.supabase.createClient === "function") return Promise.resolve(root.supabase);
    if (root.__bcSupabaseLoad) return root.__bcSupabaseLoad;
    root.__bcSupabaseLoad = new Promise((resolve, reject) => {
      const doc = root.document;
      if (!doc || !doc.createElement || !doc.head) { root.__bcSupabaseLoad = null; reject(new Error("sdk")); return; }
      const s = doc.createElement("script");
      s.src = "vendor/supabase.js?v=sb2119b";
      s.async = true;
      s.onload = () => (root.supabase && typeof root.supabase.createClient === "function") ? resolve(root.supabase) : reject(new Error("sdk"));
      s.onerror = () => { root.__bcSupabaseLoad = null; reject(new Error("sdk")); };
      doc.head.appendChild(s);
    });
    return root.__bcSupabaseLoad;
  }
  if (!root.BCLoadSupabase) root.BCLoadSupabase = loadSupabaseScript;
  function createClient(url, key, opts) {
    if (!(root.supabase && typeof root.supabase.createClient === "function")) return loadSupabaseScript().then(() => createClient(url, key, opts));
    return root.supabase.createClient(url, key, opts);
  }
  root.FIELD_COMPARE_ENABLED = true;
  root.FIELD_COMPARE = {
    url: "https://xhgrcbsshhpvmfwzjtmp.supabase.co",
    publishableKey: "sb_publishable_GStrE3VKk-Luv6pip_FCzA_qgxszxaS",
    OPERATOR_CONTACT: "thedailydosetrivia@gmail.com",
    NOTICE_LAST_UPDATED: "2026-11-22",
    createClient: createClient
  };
})(typeof window !== "undefined" ? window : globalThis);
