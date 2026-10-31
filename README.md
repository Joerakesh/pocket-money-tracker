# Pocket Money Tracker

Private personal finance tracker. The application runtime is Next.js App Router + TypeScript + MongoDB Atlas. An optional, separate Python FastAPI service provides spending forecasts.

## Run the application

- Node.js 20+
- Set `MONGODB_URI` and optional `DB_NAME=pocket_money_tracker` in `.env.local`
- `npm install`
- `npm run dev`

The tracker is available at `http://localhost:3000`. The existing interface is served by Next.js from `public/index.html`; its relative `/api/*` requests are handled by native Next.js Route Handlers under `src/app/api/[...path]/route.ts`. No Express process is needed.

## Python ML forecasting service

The ML service is an optional, independent FastAPI application under `ml-service/`. Node.js remains responsible for authentication, transaction access, account scoping, and aggregation. It sends only daily integer-paise expense totals to Python; no transaction notes, categories, account IDs, or MongoDB credentials are sent.

### Models and selection

The service compares three forecasting candidates:

1. **Moving Average** — baseline based on the most recent 14 daily observations.
2. **Linear Regression** — least-squares trend over chronological daily spending.
3. **Random Forest Regression** — nonlinear candidate, enabled when there are at least 30 training observations.

It evaluates candidates with a chronological holdout split and mean absolute error (MAE), without shuffling time-series data. The model with the lowest holdout MAE is used for the forecast. Forecast values are clipped at zero. The API returns the selected model, per-model MAE, daily predictions, total prediction, observation count, and a coarse history-length indicator.

The Node.js insights route builds a complete 180-day series, including zero-spend days. Transfers and income are excluded. All-accounts forecasts include expense and unassigned borrowed-expense entries; an account-specific forecast includes only expenses attributed to that account. At least seven observations are required.

### Run locally

Python 3.11+ is recommended.

```bash
cd ml-service
python -m venv .venv
# Windows PowerShell: .venv\\Scripts\\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

In the Next.js application's `.env.local`, configure:

```env
ML_SERVICE_URL=http://127.0.0.1:8000
```

Restart Next.js after changing environment variables. Check the service at `GET /health`; interactive API docs are at `/docs`. The forecast appears in Reports & Insights once the service is reachable. If `ML_SERVICE_URL` is absent or the service is unavailable, the rest of the finance dashboard continues to work and the forecast is shown as unavailable.

### Docker

Build and run the ML service:

```bash
docker build -t pocket-money-ml ./ml-service
docker run --rm -p 8000:8000 pocket-money-ml
```

If Next.js also runs in Docker, set `ML_SERVICE_URL=http://ml-service:8000` on the Next.js container and place both containers on the same Docker network (or Compose network). Do not use `127.0.0.1` from one container to reach another.

See [ml-service/README.md](ml-service/README.md) for the service API contract and details.

## API

The Next.js API preserves the existing API contract for health, accounts (including safe export-before-delete), settings, transactions (create/edit/soft-delete/restore/settle), budgets, goals, recurring entries, CSV preview/commit, Google Sheets sync, and dashboard summary. The `/api/insights` route also requests the optional ML forecast.

## Data integrity and privacy

- Existing MongoDB database and collection names remain unchanged: `transactions`, `accounts`, `settings`, `imports`, `budgets`, `goals`, `recurring`.
- Currency storage remains integer paise; API amounts remain rupees.
- Account balances are ledger-derived. Transfers move value between accounts but are excluded from income and spending.
- Soft-deleted records and up to 20 prior transaction revisions are retained.
- Loan/borrowed-expense settlements remain linked to their original transaction.
- CSV imports are previewed, deduplicated by SHA-256 import key, and flagged for review.
- Optional Google Sheets sync failures do not roll back MongoDB writes.
- ML predictions are informational only. The Python service has no database connection or ledger write capability; forecast failures do not block finance reporting.

## Environment

```env
MONGODB_URI=mongodb+srv://...
DB_NAME=pocket_money_tracker
GOOGLE_SHEETS_WEB_APP_URL=
GOOGLE_SHEETS_SECRET=
ML_SERVICE_URL=http://127.0.0.1:8000
```

Do not commit secrets. Back up MongoDB before production deployment and validate the API against a staging copy before switching production traffic. Restrict network access to the ML service; do not expose it publicly without authentication, rate limits, and appropriate request controls.
