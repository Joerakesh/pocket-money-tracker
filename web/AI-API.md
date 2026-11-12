# Pocket AI API

Pocket provides a read-only finance API for ChatGPT Actions and other trusted AI clients. It uses a dedicated API key issued from Pocket Settings; it does not expose Google passwords, Firebase refresh tokens, or MongoDB credentials.

## Enable it

1. Configure the existing web app environment variables from `.env.example`.
2. Set `POCKET_PUBLIC_BASE_URL` to the public origin of your deployed Pocket web app (for example `https://money.joerakesh.tech`, without a trailing slash).
3. Deploy the web app.
4. Sign in to Pocket with Google and open **More / Settings → Pocket AI access**.
5. Generate a key, copy it immediately, and store it in the AI client's authentication/secret configuration. The full key is shown only once.

No additional OAuth client secret or AI provider API key is required for this API-key-based GPT Action flow. Firebase Admin credentials are already required by Pocket's existing authenticated backend.

## Environment

The AI API adds one optional setting:

```dotenv
POCKET_PUBLIC_BASE_URL=https://money.joerakesh.tech
```

If omitted, the OpenAPI document derives the origin from the incoming request. Set it explicitly behind a reverse proxy or custom domain so ChatGPT receives the correct public server URL.

The existing required variables remain unchanged:

- `MONGODB_URI`, `DB_NAME`
- `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- `OWNER_GOOGLE_EMAIL`

See `.env.example` for the complete template. Do not commit `.env.local` or real credentials.

## Endpoints

- `GET /api/ai/openapi` — OpenAPI 3.1 document (public; contains no finance data).
- `GET /api/ai/token` — list your API keys (Firebase ID token required; hashes are never returned).
- `POST /api/ai/token` — create a 90-day read-only key (Firebase ID token required).
- `DELETE /api/ai/token` — revoke a key by its returned `id` (Firebase ID token required).
- `GET /api/ai/v1/overview` — current account balances, monthly income/expenses and category totals.
- `GET /api/ai/v1/transactions` — transactions; supports `month`, `type`, `category`, `from`, `to`, and `limit`.
- `GET /api/ai/v1/budgets` — category budget limits.
- `GET /api/ai/v1/goals` — savings goals and progress.
- `GET /api/ai/v1/recurring` — active recurring expenses.

Finance endpoints require `Authorization: Bearer pocket_live_...`. Keys are scoped to the Firebase user who created them, stored as SHA-256 hashes, expire after 90 days, and can be revoked in Pocket Settings. Up to five active keys are allowed per user.

## Use with ChatGPT

1. In the Pocket AI access section, generate a key named `ChatGPT`.
2. In your GPT editor, add an Action and import `https://YOUR_POCKET_HOST/api/ai/openapi` (replace the host with your deployed origin).
3. Configure authentication as **API Key → Bearer** and paste the Pocket key as the secret.
4. Save the GPT. Ask it to retrieve your Pocket overview, transactions and budgets before giving financial advice.

Keep the key in the Action's authentication settings. Never paste it into GPT instructions, a normal chat, source code, or a public repository.

## curl examples

```bash
export POCKET_API_KEY='pocket_live_REPLACE_WITH_YOUR_KEY'
export POCKET_URL='https://money.joerakesh.tech'

curl -sS -H "Authorization: Bearer $POCKET_API_KEY" \
  "$POCKET_URL/api/ai/v1/overview"

curl -sS -H "Authorization: Bearer $POCKET_API_KEY" \
  "$POCKET_URL/api/ai/v1/transactions?month=2026-11&limit=100"
```

## Security and data semantics

- API keys are generated with cryptographically secure randomness. Only their SHA-256 hashes are stored.
- API keys have the `finance:read` scope and cannot create, edit, delete, transfer, or approve financial transactions.
- The server derives the user's data namespace from the identity attached to the key. Clients cannot submit a user ID to select another account.
- Key creation, listing and revocation require a verified Firebase ID token.
- Finance responses use `Cache-Control: no-store`.
- Amounts are returned in INR rupees; Pocket stores integer paise internally.
- Transfers are excluded from income and expense totals. Borrowed expenses are included in expense totals.
- The overview balance is computed from Pocket's ledger, not independently verified by a bank.
- Revoke a key immediately if it is exposed, and create a replacement.
