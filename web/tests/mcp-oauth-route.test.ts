import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import * as route from "../src/app/api/ai/mcp/route";
import * as authorizationMetadata from "../src/app/.well-known/oauth-authorization-server/route";
import * as resourceMetadata from "../src/app/.well-known/oauth-protected-resource/route";

process.env.POCKET_PUBLIC_BASE_URL = "https://money.joerakesh.tech";

describe("Pocket OAuth-protected MCP endpoint", () => {
  it("exports Streamable HTTP handlers", () => {
    assert.equal(typeof route.POST, "function");
    assert.equal(typeof route.GET, "function");
    assert.equal(typeof route.DELETE, "function");
  });

  it("allows protocol initialization without an account token", async () => {
    const response = await route.POST(new NextRequest("https://money.joerakesh.tech/api/ai/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } }),
    }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.result.serverInfo.name, "pocket-finance-mcp");
  });

  it("advertises OAuth 2.0 security schemes on each finance tool", async () => {
    const response = await route.POST(new NextRequest("https://money.joerakesh.tech/api/ai/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    }));
    const body = await response.json();
    assert.equal(body.result.tools.length, 5);
    for (const tool of body.result.tools) {
      assert.deepEqual(tool.securitySchemes, [{ type: "oauth2", scopes: ["finance:read"] }]);
    }
  });

  it("returns an OAuth challenge when a private finance tool is called without a token", async () => {
    const response = await route.POST(new NextRequest("https://money.joerakesh.tech/api/ai/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "pocket_list_budgets", arguments: {} } }),
    }));
    const body = await response.json();
    assert.equal(body.result.isError, true);
    assert.ok(body.result._meta["mcp/www_authenticate"][0].includes("error_description="));
    assert.ok(response.headers.get("www-authenticate"));
  });
  it("parses Bearer authorization headers case-insensitively and rejects other schemes", () => {
    assert.equal(route.bearerToken("Bearer abc.def"), "abc.def");
    assert.equal(route.bearerToken("bearer   token-value "), "token-value");
    assert.equal(route.bearerToken("Basic abc"), null);
    assert.equal(route.bearerToken(null), null);
  });

  it("validates supported month and date filters without accepting malformed values", () => {
    assert.equal(route.validArgs("pocket_get_overview", { month: "2026-11" }), true);
    assert.equal(route.validArgs("pocket_get_overview", { month: "2026-13" }), false);
    assert.equal(route.validArgs("pocket_list_transactions", { from: "2026-11-01", to: "2026-11-30" }), true);
    assert.equal(route.validArgs("pocket_list_transactions", { from: "yesterday" }), false);
    assert.equal(route.validArgs("pocket_list_transactions", { limit: 201 }), false);
    assert.equal(route.validArgs("pocket_list_budgets", { uid: "another-user" }), false);
  });

  it("publishes OAuth authorization metadata with PKCE S256, CIMD and public-client auth", async () => {
    const response = await authorizationMetadata.GET();
    const body = await response.json();
    assert.equal(body.issuer, "https://money.joerakesh.tech");
    assert.equal(body.authorization_endpoint, "https://money.joerakesh.tech/api/ai/oauth/authorize");
    assert.equal(body.token_endpoint, "https://money.joerakesh.tech/api/ai/oauth/token");
    assert.deepEqual(body.code_challenge_methods_supported, ["S256"]);
    assert.deepEqual(body.token_endpoint_auth_methods_supported, ["none"]);
    assert.equal(body.client_id_metadata_document_supported, true);
    assert.equal(body.authorization_response_iss_parameter_supported, true);
    assert.deepEqual(body.scopes_supported, ["finance:read"]);
  });

  it("publishes protected-resource metadata for the exact MCP endpoint", async () => {
    const response = await resourceMetadata.GET();
    const body = await response.json();
    assert.equal(body.resource, "https://money.joerakesh.tech/api/ai/mcp");
    assert.deepEqual(body.authorization_servers, ["https://money.joerakesh.tech"]);
    assert.deepEqual(body.scopes_supported, ["finance:read"]);
  });

});
