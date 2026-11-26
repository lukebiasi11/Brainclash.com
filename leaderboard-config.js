/* Public daily leaderboard. The publishable key is public by design.
   LEADERBOARD_ENABLED lets the page ask for the board. The server stays
   closed until LEADERBOARD_PUBLIC is on. This file has no secret. */
(function (root) {
  "use strict";
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
  root.LEADERBOARD_ENABLED = true;
  root.LEADERBOARD = {
    url: "https://xhgrcbsshhpvmfwzjtmp.supabase.co",
    publishableKey: "sb_publishable_GStrE3VKk-Luv6pip_FCzA_qgxszxaS",
    createClient: createClient
  };
})(typeof window !== "undefined" ? window : globalThis);
