# Google Sheets automatic sync

This integration keeps a master `Transactions` tab, a `Dashboard`, and one tab per month (`2026-10`, `2026-11`, etc.). New app transactions, imported bank-statement transactions, settlements, and app deletions sync automatically. MongoDB remains the primary database; the spreadsheet is a reporting mirror.

## 1. Create the Google Sheet and Apps Script

1. Create a new Google Sheet in Google Drive, e.g. **Pocket Money Tracker**.
2. Open **Extensions → Apps Script**.
3. Replace the starter editor contents with `apps-script/Code.gs` from this project.
4. In the first few lines, change `SHARED_SECRET` from `REPLACE_WITH_A_LONG_RANDOM_SECRET` to a long random value. Keep it private. For example, generate one locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste that value into the script.
5. Click **Save**.
6. In Apps Script, select `setupPocketMoneySpreadsheet` and click **Run**. Authorize the script. This creates the master Transactions tab and Dashboard. It does not need any transaction data yet.
7. In **Project Settings**, set the time zone to **(GMT+05:30) India Standard Time** / `Asia/Kolkata`.
8. Click **Deploy → New deployment**. Select the gear next to type and choose **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone** (the app must reach the endpoint; the shared secret is checked in code)
9. Click **Deploy**, authorize if prompted, and copy the Web app URL ending in `/exec`. Do not share it publicly. If you change the script after deployment, use **Deploy → Manage deployments → Edit → New version → Deploy**.

## 2. Configure the tracker

Open `J:\expenses\.env` and add these lines. Use the same secret value as in `Code.gs`:

```dotenv
GOOGLE_SHEETS_WEB_APP_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
GOOGLE_SHEETS_SECRET=PASTE_THE_SAME_LONG_RANDOM_SECRET_HERE
```

Do not commit `.env` to GitHub. Restart the app after editing `.env`:

```bash
# stop the running server with Ctrl+C, then
npm start
```

## 3. Backfill existing transactions

The integration only syncs new/changed transactions automatically. To copy existing MongoDB transactions into the spreadsheet once, open this URL in a browser while the local app is running, or use the command below from Git Bash:

```bash
curl -X POST http://127.0.0.1:3000/api/sheets/sync-all
```

The endpoint uses upserts keyed by transaction ID, so running it again does not duplicate rows. Check the terminal for sync errors and verify rows in the `Transactions` tab.

## What gets recorded

- Date (the transaction date chosen in the app)
- Time (when it was recorded in the app, India time)
- Type, description, category, amount, account, other account, person, notes, review/settlement status
- Income and expense columns for monthly totals
- Lending, collections, repayments, and transfers in separate columns
- Unique transaction ID for safe repeat syncs

**Accounting rules:** only `income` counts as income; `expense` and `borrowed_expense` count as expenses; refunds reduce net expenses; loans/collections/repayments/transfers are shown separately rather than incorrectly counted as income or everyday spending. A transaction date determines its month tab. Deleting a transaction in the app removes it from the mirror spreadsheet too.

## Important limitations and safety

- MongoDB is the source of truth. If Google Sheets is temporarily unreachable, the transaction still saves in the app and the server logs a sync error. Run the backfill endpoint again to reconcile.
- The web app deployment is internet-reachable, so the long random secret is important. Keep the spreadsheet private and never put the secret in frontend HTML or GitHub.
- This integration syncs transaction records; it does not copy account settings, budgets, or savings goals as separate tables.
- Imported statement rows remain marked `Needs review`; verify them before relying on totals.
