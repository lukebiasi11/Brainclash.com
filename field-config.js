/* Daily field comparison. Public site settings only.
   FIELD_COMPARE_ENABLED is the single kill switch. false means the game
   does not load the SDK, sign in, or call field-compare.
   publishableKey is the dailydose dashboard key (sb_publishable_…). It is
   public by design: it cannot read scores and it is not a session.
   Leave it blank until the dashboard key is pasted. A blank key fails closed.
   OPERATOR_CONTACT is a placeholder, not an address. */
(function (root) {
  "use strict";
  root.FIELD_COMPARE_ENABLED = false;
  root.FIELD_COMPARE = {
    url: "https://xhgrcbsshhpvmfwzjtmp.supabase.co",
    publishableKey: "",
    OPERATOR_CONTACT: "OPERATOR_CONTACT",
    supabaseJs: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm"
  };
})(typeof window !== "undefined" ? window : globalThis);
