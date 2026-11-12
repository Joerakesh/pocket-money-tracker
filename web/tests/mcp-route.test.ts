import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import * as route from "../src/app/api/ai/mcp/route";

describe("Pocket MCP Streamable HTTP route", () => {
  it("exports POST, GET and DELETE handlers", () => {
    assert.equal(typeof route.POST, "function");
    assert.equal(typeof route.GET, "function");
    assert.equal(typeof route.DELETE, "function");
  });

  it("allows unauthenticated tool discovery and advertises OAuth security requirements", async () => {
    process.env.POCKET_PUBLIC_BASE_URL = "https://money.joerakesh.tech";
    const response = await route.POST(new NextRequest("https://money.joerakesh.tech/api/ai/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.result.tools[0].securitySchemes[0].type, "oauth2");
  });

  it("rejects GET and DELETE because this stateless endpoint uses POST only", async () => {
    assert.equal((await route.GET()).status, 405);
    assert.equal((await route.DELETE()).status, 405);
  });
});
