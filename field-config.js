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
  // One GoTrue client for field-compare and the leaderboard. The UMD build
  // is vendor/supabase.js (window.supabase). Do not import the jsDelivr +esm build.
  function createClient(url, key, opts) {
    const id = String(url) + "\n" + String(key);
    if (root.__bcSupabaseClient && root.__bcSupabaseSig === id) return root.__bcSupabaseClient;
    const factory = root.supabase && root.supabase.createClient;
    if (typeof factory !== "function") throw new Error("sdk");
    root.__bcSupabaseSig = id;
    root.__bcSupabaseClient = factory(url, key, opts);
    return root.__bcSupabaseClient;
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
