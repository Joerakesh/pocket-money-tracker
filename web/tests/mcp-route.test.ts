import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Contract-level tests for the public MCP tool schemas and read-only surface.
const source = await import("../src/app/api/ai/mcp/route");

describe("Pocket MCP adapter", () => {
  it("exports a Streamable HTTP POST handler", () => {
    assert.equal(typeof source.POST, "function");
  });

  it("exports GET and DELETE handlers that reject unsupported session operations", async () => {
    assert.equal((await source.GET()).status, 405);
    assert.equal((await source.DELETE()).status, 405);
  });
});
