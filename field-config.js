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
  // loads on demand from vendor/supabase.js. Do not import the jsDelivr +esm build.
  function sessionPresent(storageKey) {
    try {
      const raw = root.localStorage && root.localStorage.getItem(storageKey);
      if (!raw) return false;
      const o = JSON.parse(raw);
      return !!(o && typeof o === "object" && (o.access_token || o.refresh_token || (o.user && o.user.id)));
    } catch (e) { return false; }
  }
  function prefixedStorage(prefix) {
    return {
      getItem(k) { try { return root.localStorage ? root.localStorage.getItem(prefix + k) : null; } catch (e) { return null; } },
      setItem(k, v) { try { if (root.localStorage) root.localStorage.setItem(prefix + k, String(v)); } catch (e) {} },
      removeItem(k) { try { if (root.localStorage) root.localStorage.removeItem(prefix + k); } catch (e) {} }
    };
  }
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
    const id = String(url) + "\n" + String(key);
    if (root.__bcSupabaseClient && root.__bcSupabaseSig === id) return root.__bcSupabaseClient;
    if (!(root.supabase && typeof root.supabase.createClient === "function")) return loadSupabaseScript().then(() => createClient(url, key, opts));
    const auth = Object.assign({}, opts && opts.auth);
    // Keep today's board row on the anon id already stored. A new client on the
    // field key would sign in again and post a second row for the same day.
    if (sessionPresent("sb-board-auth")) { auth.storageKey = "auth"; auth.storage = prefixedStorage("sb-board-"); }
    else if (sessionPresent("sb-field-auth")) { auth.storageKey = "auth"; auth.storage = prefixedStorage("sb-field-"); }
    root.__bcSupabaseSig = id;
    root.__bcSupabaseClient = root.supabase.createClient(url, key, Object.assign({}, opts, { auth: auth }));
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
