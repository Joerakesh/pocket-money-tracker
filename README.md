# Pocket

A private personal finance tracker for recording transactions, managing accounts, planning spending, and understanding how much money is safe to spend.

Built with **Next.js 16**, **React 19**, **TypeScript**, and **MongoDB**. The app is also installable as a Progressive Web App (PWA).

## Features

- **Dashboard:** total balance, safe-to-spend amount, daily allowance, monthly income and spending, and category summaries.
- **Transaction ledger:** record income, expenses, transfers, loans, repayments, collections, and refunds.
- **Multiple accounts:** track cash, bank accounts, and other accounts with ledger-derived balances.
- **Activity:** search and filter transaction history, edit entries, and soft-delete records.
- **Planning:** category budgets, savings goals, recurring payment reminders, payday settings, and financial allocation planning.
- **Financial intelligence:** protected reserve, allocation-aware safe-to-spend calculations, payday planning, and financial health insights.
- **Bank statement import:** preview CSV rows, choose an account, and import with duplicate detection and review flags.
- **Data safety:** export an account and its linked transaction history before deleting it; transaction revisions and soft-deleted entries are retained.
- **Installable PWA:** add Pocket to a supported browser or device home screen. The offline page is a fallback; live financial data requires an internet connection.

MongoDB is the source of truth. The app does not require Google Sheets or a separate Express server.

## Requirements

- Node.js 20 or later
- npm
- A MongoDB database (MongoDB Atlas or a reachable self-hosted instance)

## Getting started

1. Clone the repository and enter the project directory.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a local environment file:

   ```bash
   cp .env.example .env.local
   ```

4. Set your MongoDB connection string in `.env.local`:

   ```env
   MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/?retryWrites=true&w=majority
   DB_NAME=pocket_money_tracker
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000).

## Available commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server |
| `npm run typecheck` | Run the TypeScript compiler without emitting files |
| `npm test` | Run the ledger tests |

## API overview

The application uses Next.js Route Handlers:

- `GET /api/health` — database connectivity check
- `/api/accounts` — account listing and creation
- `/api/accounts/:id/export` — export an account and related records
- `/api/transactions` — transaction listing, creation, editing, and deletion
- `/api/budgets`, `/api/goals`, `/api/recurring` — planning data
- `/api/import/preview`, `/api/import/commit` — bank CSV import
- `/api/settings`, `/api/financial-plan` — payday, reserve, and allocation settings
- `/api/summary` — dashboard and safe-to-spend summary

## Data integrity

- Money is stored as integer paise; API and UI amounts are represented in rupees.
- Account balances are derived from ledger transactions. Transfers move money between accounts and are not counted as income or spending.
- CSV imports use a SHA-256 import key to avoid importing the same row twice.
- Imported transactions are marked for review before being treated as fully categorized records.
- Transactions support soft deletion and retain a limited revision history.
- Loan and repayment records remain linked to their originating transactions.

## PWA and offline behavior

Pocket provides a web app manifest, install prompt, app icon, and service worker. The service worker keeps a small offline fallback available and does not cache API responses or private financial records. An internet connection is required to load and update live balances and transactions.

## Privacy and deployment

Keep `.env.local` out of version control. Use HTTPS in production, restrict access to the MongoDB database, and keep database credentials private. Back up MongoDB before production changes and test deployments against a non-production database where possible.
