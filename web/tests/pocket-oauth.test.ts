import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

let oauth: typeof import("../src/lib/pocket-oauth");

before(async () => {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  process.env.POCKET_PUBLIC_BASE_URL = "https://money.joerakesh.tech";
  process.env.POCKET_OAUTH_PRIVATE_KEY = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  process.env.POCKET_OAUTH_KEY_ID = "test-key";
  oauth = await import("../src/lib/pocket-oauth");
});

describe("Pocket OAuth 2.1 token primitives", () => {
  it("issues RS256 access tokens with the exact issuer, audience and read-only scope", () => {
    const issued = oauth.signAccessToken({
      uid: "firebase-user-1",
      email: "user@example.com",
      scope: "finance:read",
      audience: "https://money.joerakesh.tech/api/ai/mcp",
    });
    const decoded = oauth.verifyAccessJwt(issued.token);
    assert.ok(decoded);
    assert.equal(decoded.iss, "https://money.joerakesh.tech");
    assert.equal(decoded.aud, "https://money.joerakesh.tech/api/ai/mcp");
    assert.equal(decoded.sub, "firebase-user-1");
    assert.equal(decoded.scope, "finance:read");
  });

  it("rejects modified JWT payloads and invalid signatures", () => {
    const issued = oauth.signAccessToken({
      uid: "firebase-user-1",
      email: "user@example.com",
      scope: "finance:read",
      audience: oauth.oauthResource(),
    });
    const parts = issued.token.split(".");
    parts[1] = Buffer.from(JSON.stringify({ ...issued.payload, scope: "finance:write" })).toString("base64url");
    assert.equal(oauth.verifyAccessJwt(parts.join(".")), null);
  });

  it("publishes only the public RSA key in JWKS", () => {
    const jwks = oauth.oauthJwks();
    assert.equal(jwks.keys.length, 1);
    assert.equal(jwks.keys[0].kid, "test-key");
    assert.equal(jwks.keys[0].alg, "RS256");
    assert.equal("d" in jwks.keys[0], false);
  });

  it("uses constant-time equality and hashes refresh/code secrets", () => {
    assert.equal(oauth.safeEqual("same-value", "same-value"), true);
    assert.equal(oauth.safeEqual("same-value", "other-value"), false);
    assert.equal(oauth.sha256("secret").length, 64);
  });

  it("rejects a non-HTTPS or non-ChatGPT CIMD client URL before fetching", async () => {
    assert.equal(await oauth.loadOpenAIClient("http://chatgpt.com/oauth/client.json"), null);
    assert.equal(await oauth.loadOpenAIClient("https://attacker.example/oauth/client.json"), null);
  });
});
