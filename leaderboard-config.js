/* Public daily leaderboard. The publishable key is public by design.
   LEADERBOARD_ENABLED lets the page ask for the board. The server stays
   closed until LEADERBOARD_PUBLIC is on. This file has no secret. */
(function (root) {
  "use strict";
  function createClient(url, key, opts) {
    const id = String(url) + "\n" + String(key);
    if (root.__bcSupabaseClient && root.__bcSupabaseSig === id) return root.__bcSupabaseClient;
    const factory = root.supabase && root.supabase.createClient;
    if (typeof factory !== "function") throw new Error("sdk");
    root.__bcSupabaseSig = id;
    root.__bcSupabaseClient = factory(url, key, opts);
    return root.__bcSupabaseClient;
  }
  root.LEADERBOARD_ENABLED = true;
  root.LEADERBOARD = {
    url: "https://xhgrcbsshhpvmfwzjtmp.supabase.co",
    publishableKey: "sb_publishable_GStrE3VKk-Luv6pip_FCzA_qgxszxaS",
    createClient: createClient
  };
})(typeof window !== "undefined" ? window : globalThis);
