# Pocket Money Tracker

A personal student finance tracker built with Express, MongoDB Atlas and a responsive dark frontend.

## Features

- Multiple accounts (cash, bank, UPI, other)
- Account balances derived from a ledger
- Transfers that do not count as income or spending
- Expenses, allowance/income, lending, borrowed expenses, repayments, collections and refunds
- Daily safe-to-spend estimate, emergency reserve and payday
- Category budgets, savings goals and recurring expense reminders
- CSV import preview with duplicate-key protection and a review flag
- Monthly category totals and recent transactions

## 1. Requirements

- Node.js 20 or newer
- A MongoDB Atlas cluster and database user

## 2. Setup on Windows / Git Bash

```bash
cd /j/expenses
npm install
cp .env.example .env
```

Edit `.env` and set your Atlas connection string. Do not commit `.env`.

```env
MONGODB_URI=mongodb+srv://...
DB_NAME=pocket_money_tracker
PORT=3000
HOST=127.0.0.1
```

In Atlas, create a database user with a strong password and allow access from your current IP address. Do not use `0.0.0.0/0` unless you understand the risk. Ensure your URI-encoded password is used if it contains special characters.

## 3. Run

```bash
npm start
```

Open http://localhost:3000. The first launch creates a Cash and Bank account with zero opening balances. Add your actual opening balance to the correct account when you create it, or edit the account data in MongoDB before adding transactions. Do not enter the same starting balance both as an opening balance and as an income transaction.

## Accounting rules

- Amounts are stored as integer paise.
- Transfers reduce one owned account and increase another; they do not change total money or spending.
- Lending reduces your cash balance and is shown as money owed back to you.
- A borrowed expense counts as spending and as a liability but does not reduce your cash balance at the time of purchase.
- Repayment and collection are separate ledger events.
- Refunds increase the account balance and reduce net category spending.
- CSV imports are marked `needsReview`; inspect and correct category/type/transfer classifications after import.

## Important limitations before public deployment

This initial version is for one trusted user and should remain bound to `127.0.0.1`. It does not yet include login/authentication, transaction editing, full multi-row bank-specific CSV mapping, recurring transaction automation, budget enforcement, or account reconciliation against statement closing balances. Do not expose it to the internet until authentication, authorization, rate limiting, CSRF/security headers and a backup/restore process are implemented.

The importer supports common CSV headers but cannot reliably infer every bank's format or detect every duplicate. Always reconcile the imported rows and closing balance against your original statement. Back up your database before importing a large statement.

## API overview

- `GET /api/health`
- `GET /api/summary`
- `GET|POST /api/accounts`
- `GET|PUT /api/settings`
- `GET|POST /api/transactions`
- `DELETE /api/transactions/:id`
- `POST /api/transactions/:id/settle`
- `GET|POST /api/budgets`
- `GET|POST /api/goals`
- `GET|POST /api/recurring`
- `POST /api/import/preview`
- `POST /api/import/commit`

## Data safety

Never upload `.env`, Atlas credentials, or an unredacted bank statement to a public repository. Keep private backups and test restore before trusting this for financial records.
