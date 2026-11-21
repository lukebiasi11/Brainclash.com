/* Daily field comparison. Public site settings only.
   FIELD_COMPARE_ENABLED is the single kill switch. true means a daily run
   may call field-compare. publishableKey is the dailydose dashboard key
   (sb_publishable_…). It is public by design: it cannot read scores and it
   is not a session. A blank key still fails closed.
   OPERATOR_CONTACT is the public contact address. NOTICE_LAST_UPDATED is the
   notice date. GO_LIVE_DATE_TBD is the sentinel until the real go-live day
   (YYYY-MM-DD) replaces it, before LEADERBOARD_PUBLIC is set to on.
   A real date is shown in English and Spanish date formats. */
(function (root) {
  "use strict";
  root.FIELD_COMPARE_ENABLED = true;
  root.FIELD_COMPARE = {
    url: "https://xhgrcbsshhpvmfwzjtmp.supabase.co",
    publishableKey: "sb_publishable_GStrE3VKk-Luv6pip_FCzA_qgxszxaS",
    OPERATOR_CONTACT: "thedailydosetrivia@gmail.com",
    // GO_LIVE_DATE_TBD — replace with the go-live day (YYYY-MM-DD) before LEADERBOARD_PUBLIC=on.
    NOTICE_LAST_UPDATED: "GO_LIVE_DATE_TBD",
    supabaseJs: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm"
  };
})(typeof window !== "undefined" ? window : globalThis);
