# Pocket AI API

Pocket exposes a read-only API for AI assistants and other trusted clients. It uses a dedicated, revocable Pocket API key rather than a Google password, Firebase refresh token, or MongoDB credential.

## Endpoints

- `GET /api/ai/openapi` — OpenAPI 3.1 specification (public, no finance data).
- `POST /api/ai/token` — create a 90-day read-only API key; requires a valid Firebase ID token.
- `DELETE /api/ai/token` — revoke a key by its returned `id`; requires a valid Firebase ID token.
- `GET /api/ai/v1/overview` — balances, monthly income/expenses and category totals.
- `GET /api/ai/v1/transactions` — transactions with `month`, `type`, `category`, `from`, `to`, and `limit` filters.
- `GET /api/ai/v1/budgets` — category budgets.
- `GET /api/ai/v1/goals` — savings goals and progress.
- `GET /api/ai/v1/recurring` — active recurring reminders.

All finance endpoints require `Authorization: Bearer pocket_live_...`. Keys are stored as SHA-256 hashes, expire after 90 days, and can be revoked. The raw key is returned only once when created.

## Create a key

Call the token endpoint from an authenticated Pocket session:

```http
POST /api/ai/token
Authorization: Bearer <Firebase ID token>
Content-Type: application/json

{ "label": "ChatGPT" }
```

Copy the returned `token` immediately. Do not commit it, paste it into source code, or share it in a prompt.

## Query data

```bash
curl -H "Authorization: Bearer $POCKET_API_KEY" \
  "https://YOUR_POCKET_HOST/api/ai/v1/overview"

curl -H "Authorization: Bearer $POCKET_API_KEY" \
  "https://YOUR_POCKET_HOST/api/ai/v1/transactions?month=2026-11&limit=100"
```

## OpenAPI / ChatGPT Actions

Import `https://YOUR_POCKET_HOST/api/ai/openapi` into a GPT Action. Configure Authentication as **API Key**, choose **Bearer**, and paste the generated Pocket API key as the secret. The API key must be kept in the GPT Action's authentication configuration, never in instructions or prompt text.

The OpenAPI document describes read-only finance operations. This is intentional: AI clients cannot create, edit, delete, transfer, or approve financial transactions.

## Security notes

- The API key maps to the Firebase UID and verified email that created it.
- Finance collection names are resolved through Pocket's existing per-user namespace logic.
- No user ID is accepted from query parameters or request bodies.
- Responses are marked `Cache-Control: no-store`.
- Transfers are not treated as income or expenses in the overview.
- The overview balance is derived from Pocket's ledger, not independently verified by a bank.
- Revoke compromised keys immediately and create a replacement.
