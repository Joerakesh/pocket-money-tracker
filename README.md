# Pocket Money Tracker

Private personal finance tracker. The application runtime is Next.js App Router + TypeScript + MongoDB Atlas.

## Run

- Node.js 20+
- Set `MONGODB_URI` and optional `DB_NAME=pocket_money_tracker` in `.env.local`
- `npm install`
- `npm run dev`

The tracker is available at `http://localhost:3000`. The existing interface is served by Next.js from `public/index.html`; its relative `/api/*` requests are handled by native Next.js Route Handlers under `src/app/api/[...path]/route.ts`. No Express process is needed.

## API

The Next.js API preserves the existing API contract for health, accounts (including safe export-before-delete), settings, transactions (create/edit/soft-delete/restore/settle), budgets, goals, recurring entries, CSV preview/commit, Google Sheets sync, and dashboard summary.

## Data integrity

- Existing MongoDB database and collection names remain unchanged: `transactions`, `accounts`, `settings`, `imports`, `budgets`, `goals`, `recurring`.
- Currency storage remains integer paise; API amounts remain rupees.
- Account balances are ledger-derived. Transfers move value between accounts but are excluded from income and spending.
- Soft-deleted records and up to 20 prior transaction revisions are retained.
- Loan/borrowed-expense settlements remain linked to their original transaction.
- CSV imports are previewed, deduplicated by SHA-256 import key, and flagged for review.
- Optional Google Sheets sync failures do not roll back MongoDB writes.

## Environment

```env
MONGODB_URI=mongodb+srv://...
DB_NAME=pocket_money_tracker
GOOGLE_SHEETS_WEB_APP_URL=
GOOGLE_SHEETS_SECRET=
```

Do not commit secrets. Back up MongoDB before production deployment and validate the API against a staging copy before switching production traffic.
