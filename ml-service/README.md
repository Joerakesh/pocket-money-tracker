# Pocket Money Tracker ML service

A separate, read-only FastAPI service for short-horizon spending forecasts.

## Models

- **Moving average**: baseline using the most recent 14 daily observations.
- **Linear Regression**: fits a least-squares trend over chronological daily observations.
- **Random Forest Regression**: optional nonlinear candidate, evaluated only when the training window has at least 30 days.

The service evaluates candidates on a chronological holdout (no random shuffle), compares mean absolute error (MAE), and forecasts with the candidate that had the lowest holdout MAE. Predictions are clipped at zero. This is a small-data personal-finance baseline, not financial advice or a guarantee.

## Run locally

Python 3.11+ is recommended.

```bash
cd ml-service
python -m venv .venv
# Windows PowerShell: .venv\\Scripts\\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health: `GET http://localhost:8000/health`

Interactive API docs: `http://localhost:8000/docs`

## Request

`POST /predict/spending`

```json
{
  "daily_spending_paise": [10000, 0, 12500, 8000, 0, 15000, 11000],
  "forecast_days": 30
}
```

Amounts are integer paise. Include every calendar day in order, including zero-spend days. Maximum input history is 365 days; forecast horizon is 1–90 days.

The response includes the selected model, per-model holdout MAE in paise, daily predictions, total prediction in paise and rupees, observation count, and a coarse history-length indicator. The Node.js application is responsible for preparing and account-scoping the series.

## Data and safety

- The ML service does not connect to MongoDB and does not receive names, notes, categories, account identifiers, or transaction-level records.
- Node.js aggregates eligible expenses into daily integer-paise totals before making the request.
- Transfers and income are not expenses. Account-specific forecasts use only that account's expenses; unassigned borrowed-expense records are included only in the all-accounts view.
- Predictions are informational only. The service has no write endpoints and never changes balances or the ledger.
- Do not expose this service publicly without network restrictions and request limits.
