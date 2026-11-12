# Pocket MCP Server

Pocket exposes a stateless MCP Streamable HTTP endpoint at:

`POST https://money.joerakesh.tech/api/ai/mcp`

The adapter is deployed as a Node.js Next.js route on Vercel. It reuses the existing authenticated read-only REST endpoints; it does not connect to MongoDB, implement finance calculations, or maintain a second authorization store.

## Authentication and scope

Send the existing Pocket API key in the HTTP header:

```http
Authorization: Bearer pocket_live_...
Content-Type: application/json
Accept: application/json, text/event-stream
```

Every MCP request validates the key by delegating to the existing `GET /api/ai/v1/budgets` endpoint. Every tool invocation then calls its corresponding authenticated REST endpoint with the same bearer key. The existing REST authentication verifies the SHA-256 token hash, expiry, revocation state, owning user and `finance:read` scope. No user ID can be supplied to select another account.

## Tools

| MCP tool | Existing REST endpoint | Optional arguments |
|---|---|---|
| `pocket_get_overview` | `GET /api/ai/v1/overview` | `month` (YYYY-MM) |
| `pocket_list_transactions` | `GET /api/ai/v1/transactions` | `month`, `type`, `category`, `from`, `to`, `limit` (1–200) |
| `pocket_list_budgets` | `GET /api/ai/v1/budgets` | none |
| `pocket_list_savings_goals` | `GET /api/ai/v1/goals` | none |
| `pocket_list_recurring_expenses` | `GET /api/ai/v1/recurring` | none |

All tools are read-only. Amounts are INR. The existing REST API remains the source of truth for calculations and data semantics.

## Protocol and deployment

- JSON-RPC 2.0 over Streamable HTTP POST.
- Supports `initialize`, `ping`, `tools/list`, and `tools/call`.
- Stateless: no MCP session ID or session storage is required; GET and DELETE are intentionally unsupported.
- Runs with the Node.js runtime required by the existing MongoDB-backed REST API.
- No new environment variables or API secrets are required.
- Existing `/api/ai/v1/*`, `/api/ai/openapi`, and API-key management routes are unchanged.

## Local validation

From `web/`:

```bash
npm install
npm run typecheck
npm test
npm run build
```

## Example initialize request

```bash
curl -i https://money.joerakesh.tech/api/ai/mcp \
  -H "Authorization: Bearer $POCKET_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"pocket-client","version":"1.0.0"}}}'
```

Never place API keys in source code, repository files, prompts, logs, or committed environment files. Configure the key only in the MCP client's secret/authentication settings.
