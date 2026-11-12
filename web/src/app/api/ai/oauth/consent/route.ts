import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";
import { AUTH_CODE_TTL_SECONDS, oauthIssuer, randomSecret, sha256 } from "@/lib/pocket-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const requestId = typeof body?.requestId === "string" ? body.requestId : "";
  const approved = body?.approved === true;
  if (!requestId || typeof body?.approved !== "boolean") return json({ error: "Invalid consent request." }, 400);

  const identity = approved
    ? await verifyFirebaseIdToken(typeof body?.firebaseIdToken === "string" ? body.firebaseIdToken : "")
    : null;
  if (approved && !identity) return json({ error: "Sign in with a verified Google account to continue." }, 401);

  const db = await getDatabase();
  const authRequest = await db.collection("pocket_oauth_requests").findOneAndDelete({
    requestId,
    expiresAt: { $gt: new Date() },
  });
  const saved = authRequest && "value" in authRequest ? authRequest.value : authRequest;
  if (!saved) return json({ error: "This authorization request expired or was already used. Start again from ChatGPT." }, 400);

  const target = new URL(saved.redirectUri);
  target.searchParams.set("iss", oauthIssuer());
  if (!approved) {
    target.searchParams.set("error", "access_denied");
    target.searchParams.set("error_description", "The Pocket user denied access.");
    target.searchParams.set("state", saved.state);
    return json({ redirectTo: target.toString() });
  }

  const code = randomSecret(32);
  const now = new Date();
  await db.collection("pocket_oauth_codes").insertOne({
    codeHash: sha256(code),
    uid: identity!.uid,
    email: identity!.email,
    clientId: saved.clientId,
    redirectUri: saved.redirectUri,
    audience: saved.resource,
    scope: saved.scope,
    codeChallenge: saved.codeChallenge,
    codeChallengeMethod: saved.codeChallengeMethod,
    createdAt: now,
    expiresAt: new Date(now.getTime() + AUTH_CODE_TTL_SECONDS * 1000),
    usedAt: null,
  });
  target.searchParams.set("code", code);
  target.searchParams.set("state", saved.state);
  return json({ redirectTo: target.toString() });
}
