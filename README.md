# Pocket Money Tracker

A private personal finance tracker being migrated from Express + static HTML to a unified Next.js application.

## Current migration status

**Phase 1 — Next.js foundation**

- Next.js App Router with TypeScript and React.
- Node.js runtime MongoDB connection pool in `src/lib/mongodb.ts`.
- Database-backed health endpoint at `/api/health`.
- Existing Express backend (`server.js`) and static tracker (`public/index.html`) are intentionally retained as a compatibility fallback during migration.
- The root page links to the existing tracker at `/index.html`.

**Not yet migrated:** finance API routes and the React interface. Do not remove or disable the legacy Express service until the equivalent Next.js routes have been ported and verified.

## Requirements

- Node.js 20 or newer
- MongoDB Atlas

## Environment

Copy `.env.example` to `.env.local` for Next.js development. Configure:

```env
MONGODB_URI=mongodb+srv://...
DB_NAME=pocket_money_tracker
```

Keep credentials out of Git. The legacy Express service continues to read `.env`; Next.js reads `.env.local` (and also supports `.env`).

## Run the Next.js foundation

```bash
npm install
npm run dev
```

Open http://localhost:3000. The database health endpoint is http://localhost:3000/api/health.

## Legacy fallback

Until the finance routes have been migrated, the previous backend can still be run separately:

```bash
npm run legacy:start
```

Use a separate port for the legacy service if running both servers simultaneously. The legacy frontend currently calls relative `/api/*` URLs, so it should continue to be served by the legacy Express process until the React UI and Next.js API migration is complete.

## Financial data safety

- The existing MongoDB database and collections are not renamed or recreated.
- Monetary values remain integer paise in storage.
- The ledger remains the source of truth for account balances.
- Transfers must not be counted as income or spending.
- Soft-deleted history, transaction revisions, settlement links, import deduplication and account export safeguards must be preserved during API migration.
- Back up the database before testing future migration steps against real records.

## Planned migration

1. Port every Express endpoint to Next.js Route Handlers using the shared MongoDB connection.
2. Preserve request/response contracts and accounting semantics.
3. Add API regression tests for balances, transfers, settlements, corrections, restore, imports and exports.
4. Convert the existing interface into React components page by page.
5. Run parity checks against the legacy implementation before switching production traffic.
6. Remove Express only after all routes and UI workflows pass verification.
