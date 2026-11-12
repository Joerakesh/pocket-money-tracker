import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { issueOAuthTokens, loadOpenAIClient, oauthResource, OAUTH_SCOPE, safeEqual, sha256 } from "@/lib/pocket-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
const oauthError = (error: string, description: string, status = 400) => json({ error, error_description: description }, status);

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  if (!form) return oauthError("invalid_request", "Expected application/x-www-form-urlencoded.");
  const grantType = String(form.get("grant_type") || "");
  const clientId = String(form.get("client_id") || "");
  const resource = String(form.get("resource") || "");
  if (!clientId || resource !== oauthResource()) return oauthError("invalid_target", "client_id and the exact Pocket MCP resource are required.");
  const client = await loadOpenAIClient(clientId);
  if (!client) return oauthError("invalid_client", "The OAuth client metadata document could not be verified.", 401);

  const db = await getDatabase();
  if (grantType === "authorization_code") {
    const code = String(form.get("code") || "");
    const redirectUri = String(form.get("redirect_uri") || "");
    const verifier = String(form.get("code_verifier") || "");
    if (!code || !redirectUri || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return oauthError("invalid_request", "code, redirect_uri and a valid PKCE verifier are required.");
    if (!client.redirectUris.includes(redirectUri)) return oauthError("invalid_grant", "The redirect URI is not registered.");
    const record = await db.collection("pocket_oauth_codes").findOneAndDelete({
      codeHash: sha256(code),
      clientId,
      redirectUri,
      audience: resource,
      expiresAt: { $gt: new Date() },
    });
    const saved = record && "value" in record ? record.value : record;
    if (!saved) return oauthError("invalid_grant", "The authorization code is invalid, expired or already used.");
    if (saved.scope !== OAUTH_SCOPE || saved.codeChallengeMethod !== "S256") return oauthError("invalid_grant", "The authorization grant has an unsupported scope or PKCE method.");
    const challenge = Buffer.from(sha256(verifier), "hex").toString("base64url");
    if (saved.codeChallengeMethod !== "S256" || !safeEqual(challenge, saved.codeChallenge)) return oauthError("invalid_grant", "PKCE verification failed.");
    const tokens = await issueOAuthTokens({ uid: saved.uid, email: saved.email, clientId, audience: resource });
    return json(tokens);
  }

  if (grantType === "refresh_token") {
    const refreshToken = String(form.get("refresh_token") || "");
    if (!refreshToken) return oauthError("invalid_request", "refresh_token is required.");
    const record = await db.collection("pocket_oauth_refresh_tokens").findOneAndDelete({
      tokenHash: sha256(refreshToken),
      clientId,
      audience: resource,
      scope: OAUTH_SCOPE,
      expiresAt: { $gt: new Date() },
      revokedAt: null,
    });
    const saved = record && "value" in record ? record.value : record;
    if (!saved) return oauthError("invalid_grant", "The refresh token is invalid, expired, revoked or already rotated.");
    const tokens = await issueOAuthTokens({ uid: saved.uid, email: saved.email, clientId, audience: resource });
    return json(tokens);
  }

  return oauthError("unsupported_grant_type", "Only authorization_code and refresh_token grants are supported.");
}
