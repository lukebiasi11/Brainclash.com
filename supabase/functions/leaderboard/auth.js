/* Server-side check of a Supabase access token.
   A passing token is an anonymous Auth session. It is not proof of age.
   The birth year is never accepted here. */
const UID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function verifyAnonymousClaims(getClaims, authorization) {
  const match = /^Bearer\s+(\S+)$/i.exec(authorization || "");
  if (!match || typeof getClaims !== "function") return { ok: false, error: "identity_required" };
  let result;
  try { result = await getClaims(match[1]); } catch { return { ok: false, error: "identity_rejected" }; }
  const claims = result && result.data && (result.data.claims || result.data);
  if (!result || result.error || !claims) return { ok: false, error: "identity_rejected" };
  if (claims.role !== "authenticated" || claims.is_anonymous !== true || !UID.test(claims.sub || "")) {
    return { ok: false, error: "anonymous_required" };
  }
  return { ok: true, uid: claims.sub };
}
