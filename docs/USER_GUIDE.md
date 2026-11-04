# Pocket - Personal Finance Tracker User Guide

**Website + Android companion | Release v1.0.0 | 2 November 2026**

A practical guide to setting up Pocket, recording money accurately, reviewing detected payment alerts, importing statements, and using the planning tools.

- Website: https://money.joerakesh.tech
- GitHub project: https://github.com/Joerakesh/pocket-money-tracker
- Android release: https://github.com/Joerakesh/pocket-money-tracker/releases/tag/v1.0.0

## 1. What Pocket does

Pocket has two connected interfaces:

- **Pocket Web** is the main financial workspace. Use it to manage accounts, enter and edit transactions, view balances and reports, create budgets and goals, import CSV statements, and review synced notification candidates.
- **Pocket Sync for Android** is a companion. It signs in with Google, reads notifications from supported payment/banking apps after you grant Android notification access, sends supported financial alerts to the Pocket API, and displays your Pocket summary and detected activity.

The MongoDB-backed ledger is the financial source of truth. Firebase Authentication verifies your Google identity; it is not the finance database. Android notification detections are candidates, not authoritative bank statements. Review them before they become ledger entries.

### Important release scope

The Android source includes a notification listener, authenticated notification upload, server inbox retrieval, local fallback parsing/storage, and read-only summary screens. The web app contains the review-and-approve workflow. Android does not provide transaction editing or approval in the companion UI; use the web Sync inbox to approve or ignore candidates. The app does not initiate payments.

## 2. Open Pocket on the web

1. Visit **https://money.joerakesh.tech** in a modern browser.
2. Choose **Continue with Google**.
3. Select the Google account that should own your Pocket records.
4. Wait for the dashboard to load.

Pocket's web login uses Firebase Google Authentication. The production owner account is mapped to the existing finance collections by server configuration. Other authenticated users are separated by Firebase UID. Use the intended Google account consistently on both web and Android; signing in with different accounts can make the two interfaces show different finance data.

### Profile menu

The avatar at the upper-right opens the profile menu. It shows the Google profile name and email, and provides **Sign out**. The refresh control reloads financial data; the settings control opens the More/settings area.

### Install Pocket as a web app (PWA)

Pocket can be installed from a supported HTTPS browser for a home-screen/app-like shortcut.

- **Android / desktop Chromium browsers:** open Pocket, choose **Install app** when offered, or use the browser menu or address-bar install icon and confirm **Install app** or **Add to Home screen**.
- **iPhone / iPad:** open the site in Safari, tap Share, choose **Add to Home Screen**, then tap Add.

PWA installation is optional and separate from installing Pocket Sync. The service worker provides a small offline fallback; live balances and transactions require internet. Private API responses and financial records are not cached for offline use.

## 3. Understand the web navigation

The bottom navigation contains five main areas:

| Area | What it is for |
|---|---|
| **Home** | Safe-to-spend estimate, account snapshot, month metrics, category spending, recent transactions |
| **Activity** | Search, filter, edit and delete ledger transactions |
| **Sync** | Review bank/UPI notification candidates received from the phone |
| **Accounts** | Add and manage bank, cash and wallet accounts |
| **Plan** | Budgets, savings goals, recurring reminders and financial planning |

The floating **+** button opens a new expense entry quickly. Home shortcuts can also take you to expense, income, transfer or account actions.

## 4. Set up your accounts first

Open **Accounts** and create one account for each place where you keep money, for example your main bank account, secondary bank account, cash wallet, or UPI-linked account.

For each account, select the bank/provider, optionally provide a useful nickname, and enter its **opening balance**. Use the balance as of the date you begin tracking. Avoid adding the same real-world money twice through duplicate accounts.

**Good practice:** start with the current balance you can verify from your bank app or statement. Then record only transactions from the chosen starting point. If you import a statement, make sure its period and opening balance do not overlap with manually entered transactions in a way that double-counts money.

## 5. Record transactions correctly

Tap the floating **+** button or open the transaction entry screen. Choose the matching transaction type, enter the amount in rupees, select the account, date, category and an optional note, then save.

### Transaction types

| Type | When to use it | Effect / reminder |
|---|---|---|
| **Expense** | You paid for something | Reduces account balance and counts as spending |
| **Income** | Salary, allowance or money received | Increases balance and counts as income |
| **Transfer** | Moving your own money between two accounts | Select source and destination; it is not income or spending |
| **Lend** | You gave money to a friend and expect it back | Tracks money owed to you, separately from ordinary purchases |
| **Repay** | You receive repayment of money previously lent | Records recovery against the person/loan tracking |
| **Paid for me** | Someone paid an expense on your behalf / you owe them | Tracks a borrowed expense or obligation; identify the person |
| **Collected** | Money collected from someone who owed you | Tracks collection separately from ordinary income |
| **Refund** | A merchant or service returned money | Records returned money; use a clear note/category |

The friend-related types require a person name. For a transfer, choose both source and destination accounts. A transfer between your own accounts should never be recorded as an expense followed by income; use **Transfer** so total money is not distorted.

### Editing and deleting

Open **Activity**, search for a note/category/person or choose a month, then use **Edit** to correct an entry. **Delete** moves the transaction into deleted history (soft-delete behavior); confirm the prompt. Correct mistakes promptly because balances and planning numbers are derived from ledger activity.

## 6. Read the Home dashboard

Home combines your ledger data into a quick financial picture:

- **Safe to spend / per day:** the current amount available under configured payday and allocation rules, divided across the days remaining until the next allowance.
- **Total balances:** balances across your Pocket accounts.
- **Owe friends / Owed to you:** tracked obligations and receivables.
- **This month:** net spending, income and today's spending.
- **Spending by category:** where recorded expenses are going.
- **Recent transactions:** the latest ledger entries.

### Understand safe-to-spend

This is a planning estimate, not a bank balance or a guarantee that the money is available in one account. It uses the ledger balance, reserve and saved allocation plan, then calculates a daily guide until the next allowance date. Keep the payday and transactions current. If the displayed number looks wrong, check account opening balances, missing/duplicate transactions, reserve settings, unpaid obligations and allocation percentages before relying on it.

## 7. Use Pocket Sync on Android

### Download from GitHub Releases

1. On your Android phone, open the [Pocket Money Tracker v1.0.0 release](https://github.com/Joerakesh/pocket-money-tracker/releases/tag/v1.0.0).
2. Under **Assets**, tap **pocket-money-tracker-v1.0.0.apk**.
3. Wait for the download to finish.
4. Open the downloaded APK from the browser download notification or the Files/Downloads app.
5. Android may ask you to allow the browser or file manager to **Install unknown apps**. Allow this for the app you used to open the APK, then return to the installer.
6. Tap **Install**. When complete, tap **Open**.

Only download the APK from the project's official GitHub Releases page. Android may display a safety warning because the APK is installed outside Google Play. Do not install APKs from unknown mirrors.

**Release build note:** the currently published asset is the debug APK produced by the project's `assembleDebug` task. It is suitable for personal testing. A signed release APK with a protected signing key is preferable for wider distribution.

### First launch and permissions

1. Open **Pocket Sync**.
2. On the first screen, tap **Enable notification access** / **Open notification access settings**.
3. Android opens Notification access settings. Find **Pocket Sync notification access** and enable it.
4. Confirm Android's warning after reviewing what notification access means.
5. Return to Pocket Sync.
6. Tap **Continue with Google** and choose the same Google account used on Pocket Web.
7. Once signed in, the app loads your financial summary from the production Pocket API over HTTPS.

Notification access is a powerful Android permission: it lets the companion inspect notifications from its configured supported sources. Grant it only if you understand and accept this behavior. You can revoke it later in Android Settings > Apps/Special app access (wording varies by device) > Notification access.

### Supported notification sources in the current code

The Android listener allowlist includes Google Pay, PhonePe, Paytm, BHIM, Kotak mobile banking app, and Google Messages (for bank SMS notifications surfaced as notifications).

Detection depends on the text exposed in each notification. App versions, bank message formats, Android versions, notification privacy settings and device battery restrictions can affect detection. This is not a direct bank connection and it does not read the SMS inbox using SMS permission.

### What the Android screens do

- **Home:** read-only summary including total balance, spendable, today's spend, month income/spending, friend balances and recent transactions.
- **Activity:** displays server-parsed bank/UPI notification candidates and their current status when available.
- **Sync:** shows the signed-in Google account, API connection mode, notification-access status and local detected-entry count; refreshes the Pocket summary.
- **Settings:** shows the signed-in Google account, allows sign-out and opens notification-access settings.

The Android companion is not the place to edit the ledger. Use the web dashboard for full account and transaction management.

## 8. How phone-to-web sync works

1. **Detect:** Pocket Sync receives a notification from a supported app/package. The listener looks for financial wording and amount patterns.
2. **Authenticate:** when a Pocket user is signed in, Android obtains a Firebase ID token.
3. **Send:** the companion sends a notification event to the production API over HTTPS. The server parses and stores eligible candidates in the user's notification inbox. A local parser/SQLite store also keeps parsed fallback entries on the device.
4. **Review in web:** open Pocket Web and choose **Sync**. Tap **Refresh** if a new alert has not appeared yet.
5. **Inspect:** check source, date, amount, direction, counterparty, account suffix and reference where available.
6. **Choose the correct account:** for income/expense, choose the account affected. For a transfer, choose both the source and destination accounts.
7. **Categorise and annotate:** select a category for a normal income/expense and add a note if useful.
8. **Approve or ignore:** **Add transaction** approves the candidate and posts it to your Pocket ledger. **Ignore** marks it ignored without adding it to the ledger.
9. **Verify:** refresh Home/Activity and confirm the account balance and transaction are correct.

### Sync inbox statuses

- **Pending:** waiting for your review; not yet in the financial ledger.
- **Approved:** accepted and added to the ledger.
- **Ignored:** dismissed; not added to the ledger.

Use the inbox filters (Pending, Approved, Ignored, All) to review each group. The web inbox displays separate counts for pending, approved and ignored candidates.

### Avoid duplicate or incorrect entries

- Check the reference/UPI ID, amount, date, source and counterparty before approving.
- If the notification represents a movement between your own accounts, classify it as a transfer and choose both accounts. Do not count it as income or spending.
- Do not approve both sides of the same transfer as two unrelated expenses/incomes. The backend has logic to pair matching debit/credit alerts in supported cases, but always inspect the result.
- If an alert is incomplete, ambiguous, pending, failed, reversed or refunded, do not force it into the ledger. Wait for a final bank notification or verify against the bank app/statement.
- Reconcile approved notification entries with your actual bank statement regularly. Notification text is not proof of settlement.
- Do not assume a notification was synced while the phone was offline or while signed out. Reopen the app, confirm the account is signed in, restore network access, and inspect the web inbox. The listener's network upload is attempted when a qualifying notification arrives; this guide does not promise a durable automatic retry queue for failed uploads.

## 9. Budgets, goals and recurring reminders

Open **Plan**.

### Budgets

Create a category budget by choosing a category and monthly limit. Add realistic limits for categories you want to control (food, transport, shopping, bills, subscriptions, etc.). Edit or delete existing budgets. Compare the limit against category spending on your dashboard/planning views.

### Savings goals

Create a goal with a name, target amount and the amount already saved. Pocket shows progress toward the target. Update the saved amount as your real savings change; creating a goal does not automatically move money between bank accounts.

### Recurring expenses

Add a name, amount, due day (1-31) and category for recurring commitments such as subscriptions or regular bills. These are planning reminders/records, not automatic payments or bank mandates. Keep them current when a subscription changes or is cancelled.

## 10. Payday planner and financial intelligence

The Plan area also includes financial planning tools:

- **Payday planner:** enter the amount you want to plan for this payday, then assign percentages to Essentials, Savings, Personal spending and Future expenses. The allocation percentages must total exactly 100% before saving. The entered amount is used for the virtual allocation preview and safe-to-spend planning; it does not add income, move money or create transactions.
- **Next payday survival:** estimates a safe daily spending guide using spendable funds and days until the next allowance.
- **Emergency fund & financial floor:** set an essential-expense target and emergency-fund target, and track the reserve progress.
- **Payday history:** reviews income cycles and spending between recorded income events.
- **Lifestyle inflation:** compares income/spending changes across calendar months when sufficient history exists.
- **Financial health score:** an indicative coaching score based on savings rate, reserve progress, budget adherence and positive spendable balance. It is not a credit score or financial advice.

### Configure your allowance settings

Open the gear/settings area (More) and enter **Next allowance date** and **Emergency reserve**. Save. The next-payday calculation is only as useful as these dates and your transaction history. Update the date whenever your next allowance schedule changes.

## 11. Import a bank statement (CSV)

Use **More / Settings > Import bank statement**.

1. Export a transaction statement from your bank in CSV format. Do not upload a PDF, image or a file containing unrelated private data.
2. Choose the `.csv` file and tap **Preview CSV**.
3. Inspect the previewed rows (date, description and amount). The interface shows a preview sample and the number of rows ready.
4. Select the Pocket account that the statement belongs to.
5. Tap **Import previewed rows**.
6. Review imported transactions in Activity and correct categories/notes as needed.

The backend uses a row import key to reduce duplicate imports and reports how many rows were added or skipped. Imported rows should still be checked: verify date/amount/sign interpretation and compare totals with your bank statement. Avoid importing overlapping periods repeatedly unless you understand which rows will be skipped.

## 12. A recommended daily and monthly routine

### Each day (2-5 minutes)

1. Open Pocket Home and check total balances and safe-to-spend.
2. Add cash expenses or transactions that did not arrive as a supported notification.
3. Open Sync and clear pending candidates. Check each item before approving.
4. Check that a transfer is recorded as a transfer and not spending.
5. Add a short note for unusual purchases so Activity search is useful later.

### Each week

1. Review Activity and search for missing or suspicious entries.
2. Compare account balances with your bank/cash balances.
3. Review category spending against budgets.
4. Update savings-goal progress and recurring reminders when needed.

### Each month / allowance day

1. Reconcile Pocket with bank statements.
2. Import missing statement rows through CSV preview and commit.
3. Set the next allowance/payday date.
4. Review emergency reserve and payday allocations.
5. Check income-cycle history, lifestyle trend and the financial health score.
6. Confirm old pending sync candidates have been resolved.

## 13. Troubleshooting

| Problem | What to check |
|---|---|
| Website says Firebase configuration is missing | Production Firebase web environment variables must be configured in the hosting environment. This is a deployment/admin task. |
| Google sign-in fails on web | Check internet access, Firebase Google provider, authorised domain and that the chosen account is valid. |
| Dashboard does not load / API error | Refresh, check internet, and ask the administrator to verify the production API and MongoDB connectivity. Health endpoint: `https://money.joerakesh.tech/api/health`. |
| Web and Android show different data | Confirm both use the exact same Google account. |
| Android asks for notification access repeatedly | Reopen Android Notification access settings and confirm Pocket Sync is enabled. Device settings wording varies. |
| No alert appears in Sync | Confirm notification access, supported source app, visible notification content, network access and Google sign-in. Then refresh the web Sync inbox. |
| Android shows an authentication or summary error | Check that the same Google account can sign in on the web, that the phone has internet, and that production API is reachable. Sign out/in if the Firebase session is stale. |
| An alert is not parsed correctly | Do not approve it blindly. Compare with the bank app/statement and enter a corrected manual transaction if appropriate. |
| Safe-to-spend looks incorrect | Verify opening balances, missing/duplicate transactions, payday, reserve, unpaid obligations and allocation rules. |
| APK will not install | Re-download from the official Release asset, ensure the APK download completed, allow install permission for the browser/files app, and check Android version/device compatibility. |

### Local developer note: API URL

The Android build gets its API base URL from `POCKET_API_BASE` when that environment variable exists; otherwise it uses `https://money.joerakesh.tech/api`. A local development override such as `http://10.x.x.x:3000/api` must not be present when creating a production APK. The app requires HTTPS in the manifest (`usesCleartextTraffic=false`).

## 14. Privacy, security and data care

- Use the same personal Google account across Pocket Web and Pocket Sync.
- Never share your Google password, UPI PIN, OTP, bank password or Firebase credentials.
- Notification access lets Pocket Sync inspect notification content from its configured sources. Review Android's permission disclosure before enabling it.
- The backend receives selected notification fields to parse eligible financial alerts. Treat notification data as sensitive.
- Do not install modified APKs or APKs from unofficial mirrors.
- Keep bank statements and exports private. Upload only the CSV data needed for the account reconciliation.
- The web API verifies Firebase ID tokens server-side. Finance records are stored in MongoDB; Firebase is used for authentication.
- Keep administrator secrets (`MONGODB_URI`, Firebase Admin private key and related server credentials) out of source control and out of the APK.
- Back up important bank statements independently. A tracker should not be the only record of your money.

## 15. Useful links

- [Pocket website](https://money.joerakesh.tech)
- [GitHub repository](https://github.com/Joerakesh/pocket-money-tracker)
- [All releases](https://github.com/Joerakesh/pocket-money-tracker/releases)
- [v1.0.0 release and APK](https://github.com/Joerakesh/pocket-money-tracker/releases/tag/v1.0.0)
- [Android setup notes](https://github.com/Joerakesh/pocket-money-tracker/blob/main/mobile/README.md)
- [Web setup / developer notes](https://github.com/Joerakesh/pocket-money-tracker/blob/main/web/README.md)
- [API health check](https://money.joerakesh.tech/api/health)

## 16. Final checklist

- [ ] Sign in to the website with the intended Google account.
- [ ] Create each account and verify its opening balance.
- [ ] Set your next allowance date and emergency reserve.
- [ ] Download Pocket Sync only from GitHub Releases.
- [ ] Enable Android notification access and sign in with the same Google account.
- [ ] Make a small real-world test transaction only when appropriate, then verify its candidate appears in Sync.
- [ ] Review and approve candidates in the website; do not auto-trust notification parsing.
- [ ] Use the correct transaction type for transfers, lending, repayments and refunds.
- [ ] Reconcile ledger balances against actual statements regularly.
- [ ] Keep private credentials and financial exports secure.

**Pocket - Your money, made clear.**
