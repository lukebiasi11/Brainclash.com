/* Public daily leaderboard. The publishable key is public by design.
   LEADERBOARD_ENABLED lets the page ask for the board. The server stays
   closed until LEADERBOARD_PUBLIC is on. This file has no secret. */
(function (root) {
  "use strict";
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
    if (sessionPresent("sb-board-auth")) { auth.storageKey = "auth"; auth.storage = prefixedStorage("sb-board-"); }
    else if (sessionPresent("sb-field-auth")) { auth.storageKey = "auth"; auth.storage = prefixedStorage("sb-field-"); }
    root.__bcSupabaseSig = id;
    root.__bcSupabaseClient = root.supabase.createClient(url, key, Object.assign({}, opts, { auth: auth }));
    return root.__bcSupabaseClient;
  }
  root.LEADERBOARD_ENABLED = true;
  root.LEADERBOARD = {
    url: "https://xhgrcbsshhpvmfwzjtmp.supabase.co",
    publishableKey: "sb_publishable_GStrE3VKk-Luv6pip_FCzA_qgxszxaS",
    createClient: createClient
  };
})(typeof window !== "undefined" ? window : globalThis);
