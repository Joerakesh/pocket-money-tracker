# Pocket

A personal finance tracker with a web dashboard and an Android companion for detecting payment notifications.

## Repository layout

- **[web/](./web/)** — Next.js 16, React 19, TypeScript, Firebase Authentication and MongoDB Atlas application.
- **[mobile/](./mobile/)** — Kotlin Android companion that reads notifications from an allowlist of UPI apps and Google Messages, submits eligible payment alerts to the authenticated Pocket API, and keeps a local parsed fallback.
- **[mobile/README.md](./mobile/README.md)** — Android setup, build instructions, notification access, sync flow and privacy details.
- **[web/README.md](./web/README.md)** — Web setup, API overview, data integrity and deployment guidance.

## Web application

Requirements: Node.js 20+ and npm.

```powershell
cd web
npm ci
Copy-Item .env.example .env.local
# Configure .env.local, then:
npm run dev
```

Open http://localhost:3000.

## Deployment

The repository is a monorepo. Set the Vercel project's **Root Directory** to `web`, retain the required production environment variables in Vercel, and deploy from the intended branch. Never commit `.env.local`, Firebase Admin credentials, MongoDB credentials or signing keys.

The Android build currently defines its default API base as `https://money.joerakesh.tech/api`; it can be overridden at build time with `POCKET_API_BASE`. Confirm the public website URL from the actual deployment before distributing it—do not assume the API hostname and website hostname are the same.

## Android companion and sync

Pocket Sync is not local-only. The current notification listener:

1. Filters notifications using an explicit package allowlist (Google Pay, PhonePe, Paytm, BHIM, Kotak and Google Messages).
2. Extracts visible notification title/text and checks for financial-looking content.
3. If a signed-in Firebase user is available, sends eligible notification text to `POST /api/sync/notifications` with a Firebase ID token.
4. Keeps a locally parsed fallback candidate where the local parser can classify the alert.

The web app exposes the notification inbox in the Sync area. Detected items are candidates for review; approving an item creates a ledger transaction. Do not describe notification detection as bank-verified or claim that a notification automatically changes balances.

Notification access is a sensitive Android permission. The app can read notification content exposed by allow-listed apps, including message notifications from Google Messages. The app does not request the Android SMS-reading permission, but that does **not** mean SMS notification content is never processed: visible notification content from Google Messages may be submitted to the Pocket server for parsing. Tell users this before they enable notification access.

## Financial-data safety

- MongoDB is the source of truth for Pocket's finance records.
- Every finance API request must be authenticated and scoped to the verified Firebase identity.
- Notification-derived candidates remain separate from the ledger until the user reviews and approves them.
- The server performs deduplication and transfer matching; these mechanisms still require real-device and statement reconciliation tests.
- Never collect UPI PINs, OTPs, passwords or full banking credentials.
- Keep database credentials, Firebase Admin keys and signing keys out of the APK and repository.

## Development checks

Web:

```powershell
cd web
npm run typecheck
npm test
npm run build
```

Android build and device instructions are documented in [mobile/README.md](./mobile/README.md). A successful deployment status alone does not prove that every workflow or real-device notification parser test has passed.
