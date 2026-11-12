import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { AUTH_CODE_TTL_SECONDS, loadOpenAIClient, oauthIssuer, oauthResource, randomSecret, OAUTH_SCOPE } from "@/lib/pocket-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function oauthError(request: NextRequest, error: string, description: string, redirectUri?: string, state?: string) {
  if (redirectUri) {
    const target = new URL(redirectUri);
    target.searchParams.set("error", error);
    target.searchParams.set("error_description", description);
    if (state) target.searchParams.set("state", state);
    target.searchParams.set("iss", oauthIssuer());
    return NextResponse.redirect(target);
  }
  return NextResponse.json({ error, error_description: description }, { status: 400, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const clientId = p.get("client_id") || "";
  const redirectUri = p.get("redirect_uri") || "";
  const state = p.get("state") || "";
  const responseType = p.get("response_type");
  const scope = p.get("scope") || "";
  const resource = p.get("resource") || "";
  const challenge = p.get("code_challenge") || "";
  const method = p.get("code_challenge_method");

  if (responseType !== "code") return oauthError(request, "unsupported_response_type", "Only authorization_code is supported.");
  if (!clientId || !redirectUri || !state || state.length > 512) return oauthError(request, "invalid_request", "client_id, redirect_uri and state are required.");
  const client = await loadOpenAIClient(clientId);
  if (!client || !client.redirectUris.includes(redirectUri)) return oauthError(request, "invalid_client", "The OAuth client or redirect URI is not trusted.");
  if (scope !== OAUTH_SCOPE) return oauthError(request, "invalid_scope", "Only finance:read is available.");
  if (resource !== oauthResource()) return oauthError(request, "invalid_target", "The resource parameter must exactly match the Pocket MCP endpoint.", redirectUri, state);
  if (method !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) return oauthError(request, "invalid_request", "PKCE S256 is required.", redirectUri, state);

  const requestId = randomSecret(24);
  const now = new Date();
  const db = await getDatabase();
  await db.collection("pocket_oauth_requests").insertOne({
    requestId,
    clientId,
    redirectUri,
    state,
    scope,
    resource,
    codeChallenge: challenge,
    codeChallengeMethod: "S256",
    createdAt: now,
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
  });
  const consent = new URL("/oauth/consent", request.url);
  consent.searchParams.set("request_id", requestId);
  return NextResponse.redirect(consent);
}
