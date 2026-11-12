import {
  createHash,
  createPrivateKey,
  createPublicKey,
  createSign,
  createVerify,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { getDatabase } from "@/lib/mongodb";

export const OAUTH_SCOPE = "finance:read";
export const ACCESS_TOKEN_TTL_SECONDS = 600;
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
export const AUTH_CODE_TTL_SECONDS = 120;
export const RESOURCE_PATH = "/api/ai/mcp";

export function publicOrigin() {
  const configured = process.env.POCKET_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (!configured) throw new Error("POCKET_PUBLIC_BASE_URL must be configured for OAuth.");
  const url = new URL(configured);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("OAuth requires an HTTPS public origin.");
  }
  return url.origin;
}

export function oauthIssuer() {
  return publicOrigin();
}

export function oauthResource() {
  return `${publicOrigin()}${RESOURCE_PATH}`;
}

export function oauthEndpoints() {
  const issuer = oauthIssuer();
  return {
    issuer,
    authorization_endpoint: `${issuer}/api/ai/oauth/authorize`,
    token_endpoint: `${issuer}/api/ai/oauth/token`,
    revocation_endpoint: `${issuer}/api/ai/oauth/revoke`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
  };
}

function privateKey() {
  const value = process.env.POCKET_OAUTH_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!value) throw new Error("POCKET_OAUTH_PRIVATE_KEY is not configured.");
  return createPrivateKey(value);
}

function keyId() {
  const value = process.env.POCKET_OAUTH_KEY_ID;
  if (!value) throw new Error("POCKET_OAUTH_KEY_ID is not configured.");
  return value;
}

export function oauthJwks() {
  const jwk = createPublicKey(privateKey()).export({ format: "jwk" });
  return {
    keys: [{
      ...jwk,
      kid: keyId(),
      use: "sig",
      alg: "RS256",
      kty: "RSA",
    }],
  };
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function randomSecret(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

export function signAccessToken(input: {
  uid: string;
  email: string;
  scope: string;
  audience: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT", kid: keyId() };
  const payload = {
    iss: oauthIssuer(),
    sub: input.uid,
    aud: input.audience,
    email: input.email,
    scope: input.scope,
    iat: now,
    nbf: now,
    exp: now + ACCESS_TOKEN_TTL_SECONDS,
    jti: randomSecret(24),
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  return { token: `${signingInput}.${signer.sign(privateKey()).toString("base64url")}`, payload };
}

export function verifyAccessJwt(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (header.alg !== "RS256" || header.typ !== "JWT" || header.kid !== keyId()) return null;
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${parts[0]}.${parts[1]}`);
    verifier.end();
    if (!verifier.verify(createPublicKey(privateKey()), Buffer.from(parts[2], "base64url"))) return null;
    const now = Math.floor(Date.now() / 1000);
    if (payload.iss !== oauthIssuer() || payload.aud !== oauthResource()) return null;
    if (!Number.isInteger(payload.exp) || payload.exp <= now) return null;
    if (Number.isInteger(payload.nbf) && payload.nbf > now) return null;
    if (typeof payload.sub !== "string" || typeof payload.jti !== "string") return null;
    if (payload.scope !== OAUTH_SCOPE || typeof payload.email !== "string") return null;
    return payload as { iss: string; sub: string; aud: string; email: string; scope: string; iat: number; nbf: number; exp: number; jti: string };
  } catch {
    return null;
  }
}

export async function verifyPocketOAuthAccessToken(token: string) {
  let payload: ReturnType<typeof verifyAccessJwt>;
  try {
    payload = verifyAccessJwt(token);
  } catch {
    return null;
  }
  if (!payload) return null;
  const db = await getDatabase();
  const record = await db.collection("pocket_oauth_access_tokens").findOne({
    jti: payload.jti,
    uid: payload.sub,
    issuer: oauthIssuer(),
    audience: oauthResource(),
    scope: OAUTH_SCOPE,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!record) return null;
  return { uid: payload.sub, email: payload.email, scopes: [OAUTH_SCOPE] };
}

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function loadOpenAIClient(clientId: string) {
  let url: URL;
  try { url = new URL(clientId); } catch { return null; }
  if (url.protocol !== "https:" || url.hostname !== "chatgpt.com" ||
      !url.pathname.startsWith("/oauth/") || url.search || url.hash || url.username || url.password) return null;
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!response.ok) return null;
    const metadata = await response.json() as { client_id?: string; redirect_uris?: unknown };
    if (metadata.client_id !== clientId || !Array.isArray(metadata.redirect_uris) || metadata.redirect_uris.length === 0) return null;
    const redirectUris = metadata.redirect_uris.filter((item): item is string => {
      if (typeof item !== "string") return false;
      try {
        const redirect = new URL(item);
        return redirect.protocol === "https:" && redirect.hostname === "chatgpt.com";
      } catch { return false; }
    });
    if (redirectUris.length !== metadata.redirect_uris.length) return null;
    return { clientId, redirectUris };
  } catch {
    return null;
  }
}

export async function issueOAuthTokens(input: {
  uid: string;
  email: string;
  clientId: string;
  audience: string;
}) {
  const db = await getDatabase();
  const now = new Date();
  const { token: accessToken, payload } = signAccessToken({
    uid: input.uid,
    email: input.email,
    scope: OAUTH_SCOPE,
    audience: input.audience,
  });
  const refreshToken = randomSecret(48);
  await Promise.all([
    db.collection("pocket_oauth_access_tokens").insertOne({
      jti: payload.jti,
      uid: input.uid,
      email: input.email,
      clientId: input.clientId,
      issuer: oauthIssuer(),
      audience: input.audience,
      scope: OAUTH_SCOPE,
      createdAt: now,
      expiresAt: new Date(payload.exp * 1000),
      revokedAt: null,
    }),
    db.collection("pocket_oauth_refresh_tokens").insertOne({
      tokenHash: sha256(refreshToken),
      uid: input.uid,
      email: input.email,
      clientId: input.clientId,
      audience: input.audience,
      scope: OAUTH_SCOPE,
      createdAt: now,
      expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      revokedAt: null,
    }),
  ]);
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: OAUTH_SCOPE,
  };
}
