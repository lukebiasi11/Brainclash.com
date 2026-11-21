/* Public daily leaderboard. The publishable key is public by design.
   LEADERBOARD_ENABLED lets the page ask for the board. The server stays
   closed until LEADERBOARD_PUBLIC is on. This file has no secret. */
(function (root) {
  "use strict";
  root.LEADERBOARD_ENABLED = true;
  root.LEADERBOARD = {
    url: "https://xhgrcbsshhpvmfwzjtmp.supabase.co",
    publishableKey: "sb_publishable_GStrE3VKk-Luv6pip_FCzA_qgxszxaS",
    supabaseJs: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm"
  };
})(typeof window !== "undefined" ? window : globalThis);
