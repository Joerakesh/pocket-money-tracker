import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import * as route from "../src/app/api/ai/mcp/route";

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
});
