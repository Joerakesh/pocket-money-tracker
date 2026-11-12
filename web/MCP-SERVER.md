# Pocket MCP OAuth 2.1

The Streamable HTTP MCP endpoint is `POST https://money.joerakesh.tech/api/ai/mcp`. It uses OAuth 2.1 authorization-code flow with PKCE S256 and OpenAI Client ID Metadata Documents (CIMD). It does not expose a custom API-key field or implement unsupported client-credentials grants.

## Discovery

- Protected resource metadata: `/.well-known/oauth-protected-resource/api/ai/mcp`
- Authorization server metadata: `/.well-known/oauth-authorization-server`
- Public signing keys: `/.well-known/jwks.json`
- Authorization endpoint: `/api/ai/oauth/authorize`
- Token endpoint: `/api/ai/oauth/token`
- Revocation endpoint: `/api/ai/oauth/revoke`

The resource identifier is the exact MCP endpoint URL. The authorization server issuer is the canonical public origin. The server advertises CIMD, public-client token exchange (`none`), authorization code and refresh-token grants, and PKCE S256. It intentionally does not publish a DCR endpoint.

## User identity and consent

The authorization screen uses Pocket's existing Firebase Authentication Google sign-in. Firebase Admin verifies the ID token (including revocation and verified email) before an authorization code is created. The user must explicitly approve the `finance:read` permission. Denial returns `access_denied` to the validated client redirect URI.

## Token security

- Authorization codes are cryptographically random, stored as SHA-256 hashes, expire quickly, and are consumed once.
- PKCE uses S256; the server verifies the code verifier before issuing tokens.
- Access tokens are short-lived RS256 JWTs (10 minutes) with issuer, exact resource audience, subject, scope, issued-at, not-before, expiry, and unique token ID claims.
- The private RSA signing key is server-only. Only the derived public key is published in JWKS.
- Every MCP request and every downstream finance REST request verifies the JWT signature, issuer, audience, expiry, scope, and revocation record.
- Refresh tokens are random, stored as SHA-256 hashes, expire after 30 days, and rotate on use.
- The revocation endpoint supports both access and refresh tokens.
- All OAuth responses are non-cacheable. Finance tools are read-only.

## Vercel environment

Keep the existing Firebase Admin and MongoDB environment variables. Add these server-only variables in Vercel for Production, Preview and Development as appropriate:

- `POCKET_OAUTH_PRIVATE_KEY`: PEM-encoded RSA private key (PKCS#8).
- `POCKET_OAUTH_KEY_ID`: stable key identifier, e.g. `pocket-rsa-2026-01`.
- `POCKET_PUBLIC_BASE_URL`: `https://money.joerakesh.tech` (already used by the AI API).

Generate a key pair locally:

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out pocket-oauth-private.pem
```

Paste the private key only into the Vercel environment variable `POCKET_OAUTH_PRIVATE_KEY`. Never commit it, paste it into ChatGPT, or expose it in logs. The public JWKS is derived automatically. Back up the private key securely; replacing it invalidates existing access tokens. For rotation, publish old and new public keys during a planned overlap before switching the active key.

## Existing API keys

The Pocket REST API continues to accept existing `pocket_live_...` keys exactly as before. OAuth tokens are additionally accepted by the read-only REST resource route for MCP delegation. The API-key management UI and endpoints are unchanged.

## Local validation

From `web/`:

```bash
npm install
npm run typecheck
npm test
npm run build
```

Before enabling the production MCP connection, configure the OAuth signing key in Vercel and verify the discovery documents and end-to-end flow on the deployed Preview URL.
