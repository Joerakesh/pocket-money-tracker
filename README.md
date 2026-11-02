# Pocket

A personal finance tracker with a web dashboard and an Android companion for detecting payment notifications.

## Repository layout

- **[web/](./web/)** — Next.js 16, React 19, TypeScript, Firebase Authentication and MongoDB Atlas application.
- **[mobile/](./mobile/)** — Kotlin Android companion. The initial implementation detects supported UPI payment notifications and stores minimal parsed records locally.
- **[mobile/README.md](./mobile/README.md)** — Android setup, JDK requirements, permissions and next steps.

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

See [web/README.md](./web/README.md) for the full web setup, environment variables, API overview, data integrity and deployment guidance.

### Vercel deployment

After this repository restructure, set the Vercel project's **Root Directory** to `web`. Keep the existing environment variables configured in Vercel, then trigger a new deployment. Do not move secrets into the repository.

## Android companion

The Android project lives in [mobile/](./mobile/). It uses Kotlin and native Android APIs; it is intentionally separate from the web app.

Start with [mobile/README.md](./mobile/README.md). The first milestone is local notification detection. Cloud synchronization is not enabled yet: it must be connected to an authenticated Pocket API endpoint and tested with duplicate/reversal handling before it can affect financial balances.

## Important data-safety notes

- MongoDB remains the source of truth for Pocket's financial records.
- The companion stores detected notification metadata locally and does not change balances.
- Notification text can be incomplete or misleading. Treat detections as candidates until reconciled.
- Never collect UPI PINs, OTPs, passwords, or full notification/SMS contents.
- Internal transfers, failed payments, reversals and duplicate notifications must be handled before automatic ledger posting.

## Development checks

```powershell
cd web
npm run typecheck
npm test
npm run build
```

Android build and device instructions are documented in [mobile/README.md](./mobile/README.md).
