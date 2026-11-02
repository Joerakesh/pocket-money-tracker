# Pocket Web

The Pocket web application is built with Next.js 16, React 19, TypeScript, Firebase Authentication and MongoDB Atlas.

## Requirements

- Node.js 20 or later
- npm
- MongoDB Atlas or a reachable MongoDB instance

## Local setup

From the repository root:

```powershell
cd web
npm ci
Copy-Item .env.example .env.local
```

Configure `.env.local` with your MongoDB and Firebase values, then run:

```powershell
npm run dev
```

Open http://localhost:3000.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm test` | Run ledger tests |

## API overview

The application uses Next.js Route Handlers:

- `GET /api/health` — database connectivity check
- `/api/accounts` — account listing and creation
- `/api/accounts/:id/export` — export an account and related records
- `/api/transactions` — transaction listing, creation, editing and deletion
- `/api/budgets`, `/api/goals`, `/api/recurring` — planning data
- `/api/import/preview`, `/api/import/commit` — bank CSV import
- `/api/settings`, `/api/financial-plan` — payday, reserve and allocation settings
- `/api/summary` — dashboard and safe-to-spend summary

The API catch-all route is in `src/app/api/[...path]/route.ts`.

## Data integrity

- Money is stored as integer paise; API and UI amounts are represented in rupees.
- Account balances are derived from ledger transactions. Transfers move money between accounts and are not counted as income or spending.
- CSV imports use a SHA-256 import key to avoid importing the same row twice.
- Imported transactions are marked for review before being treated as fully categorized records.
- Transactions support soft deletion and retain a limited revision history.
- Loan and repayment records remain linked to their originating transactions.

## Authentication and environment variables

Pocket uses Firebase Authentication with Google sign-in for identity and MongoDB Atlas for finance records. Firebase is not the finance database.

Copy `.env.example` to `.env.local` and configure:

- `MONGODB_URI`, `DB_NAME`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` (optional)
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- `OWNER_GOOGLE_EMAIL`

Enable Google sign-in in Firebase Console and authorize the production domain. Keep the Firebase Admin private key server-only. Never commit `.env.local`.

Every finance API request verifies a Firebase ID token on the server. The verified Firebase UID determines a separate MongoDB collection namespace for each non-owner account. The verified owner email continues to use the existing unscoped collections, preserving current finance records.

## PWA and offline behavior

Pocket provides a web app manifest, install prompt, app icon and service worker. The service worker keeps a small offline fallback available and does not cache API responses or private financial records. An internet connection is required for live balances and transactions.

## Deployment

The repository root is now a monorepo. Set the Vercel project's **Root Directory** to `web`, retain the existing production environment variables, and redeploy. The GitHub Actions workflow runs web checks from this directory.
