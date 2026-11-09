/* Daily field comparison. Public site settings only.
   FIELD_COMPARE_ENABLED is the single kill switch. true means a daily run
   may call field-compare. publishableKey is the dailydose dashboard key
   (sb_publishable_…). It is public by design: it cannot read scores and it
   is not a session. A blank key still fails closed.
   OPERATOR_CONTACT is the public contact address. NOTICE_LAST_UPDATED is the
   notice date (YYYY-MM-DD). Bump it when the notice text changes. */
(function (root) {
  "use strict";
  root.FIELD_COMPARE_ENABLED = true;
  root.FIELD_COMPARE = {
    url: "https://xhgrcbsshhpvmfwzjtmp.supabase.co",
    publishableKey: "sb_publishable_GStrE3VKk-Luv6pip_FCzA_qgxszxaS",
    OPERATOR_CONTACT: "thedailydosetrivia@gmail.com",
    NOTICE_LAST_UPDATED: "2026-11-09",
    supabaseJs: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm"
  };
})(typeof window !== "undefined" ? window : globalThis);
