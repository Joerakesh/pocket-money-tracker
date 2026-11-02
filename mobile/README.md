# Pocket Sync — Android companion

Pocket Sync is a native Kotlin Android companion for Pocket. It listens for notifications from selected UPI/banking-related apps and Google Messages, submits eligible financial-looking notification content to the authenticated Pocket API, and keeps a local parsed fallback candidate when the on-device parser recognises the alert.

## Current implementation

- [x] Native Android project and notification-listener service
- [x] Package allowlist for Google Pay, PhonePe, Paytm, BHIM, Kotak and Google Messages
- [x] Extraction of visible notification title and text, including supported MessagingStyle message fields
- [x] Recognition of successful recurring AutoPay / auto-debit alerts, including merchant and abbreviated-month date parsing
- [x] Financial-content pre-filter before server upload
- [x] Firebase Google sign-in and Firebase ID-token authentication
- [x] Authenticated upload to `POST /api/sync/notifications`
- [x] Local parsed fallback queue with duplicate suppression
- [x] Web Sync inbox for reviewing detected candidates
- [x] Approve / ignore actions in the web inbox
- [ ] Complete real-device parser validation for every supported app, bank and Android version
- [ ] Formal end-to-end regression coverage for duplicate, reversal, refund and paired-transfer cases

## Requirements

- Android SDK Platform 37 and Android Build Tools.
- Gradle 9.8.1 (or compatible wrapper configuration in the project).
- JDK 17 for the Android Gradle Plugin configuration.
- A configured `google-services.json` for the Firebase Android app.
- A valid Pocket API base URL.

On Windows, check Java:

```powershell
java -version
where.exe java
```

Set Android Studio's **Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK** to JDK 17.

## Open and build

1. Install Android Studio and the required Android SDK.
2. Open the `mobile` folder in Android Studio.
3. Set the Gradle JDK to JDK 17.
4. Add the Firebase configuration file required by the project (do not commit private credentials).
5. Sync Gradle and run the `app` configuration on a test device.

Build from PowerShell:

```powershell
cd mobile
gradle assembleDebug
```

The debug APK is produced at:

```text
app\build\outputs\apk\debug\app-debug.apk
```

The current Gradle configuration sets `versionCode = 3` and `versionName = "0.3.0"`. A GitHub release tag such as `v1.0.0` is a separate label and must not be presented as the installed Android version without checking the APK/release asset metadata.

## First-time setup

1. Install and open Pocket Sync.
2. Enable **Pocket Sync notification access** in Android Settings.
3. Return to the app and sign in with the same Google account used on the Pocket website.
4. Keep notification access enabled. Android and some phone manufacturers may restrict background activity; if notifications stop arriving, review the app's battery/background restrictions.
5. Make a small test payment and inspect the web app's **Sync** inbox before approving anything.

The current app gates its sign-in/dashboard flow behind notification access. Android may show an additional **Allow restricted settings** step for apps installed outside Google Play on newer Android versions.

## Supported notification sources

The current package allowlist is defined in `PocketNotificationListener.kt`:

| Source | Android package |
| --- | --- |
| Google Pay | `com.google.android.apps.nbu.paisa.user` |
| PhonePe | `com.phonepe.app` |
| Paytm | `net.one97.paytm` |
| BHIM | `in.org.npci.upiapp` |
| Kotak | `com.kotak811mobilebankingapp.instantsavingsupiscanandpayrecharge` |
| Google Messages | `com.google.android.apps.messaging` |

This is an app-package allowlist, not a guarantee that every alert format is parsed correctly. Bank SMS can be processed when the message appears in a Google Messages notification that Android exposes to the listener. The app does **not** request the Android SMS-reading permission or read the SMS database directly.

## How notification sync works

1. Android delivers a notification from an allow-listed package.
2. Pocket Sync extracts the notification title and visible text fields.
3. It checks for financial-looking content (currency amount plus a payment-related term).
4. When a Firebase user is signed in, it obtains a Firebase ID token and submits the eligible title/text and source metadata to `POST /api/sync/notifications` over HTTPS.
5. The Pocket server verifies the Firebase identity, parses the candidate and stores it in that user's notification inbox.
6. Open Pocket Web → **Sync**. Review the amount, direction, account and counterparty.
7. Approve only when the details match your bank/UPI record. Approval creates a ledger transaction; ignoring leaves it out of the ledger.

The Android app also attempts local parsing and stores a fallback candidate locally. Local parsing and server parsing may classify different notification formats differently. A successful upload is not proof that a transaction has been approved or added to the ledger.

## Privacy and security — read before enabling notification access

Notification access is powerful. Android may expose notification content from the selected source apps to Pocket Sync. For eligible financial-looking notifications, the current code sends these fields to the Pocket server:

- Source app package name.
- Notification title (limited to 180 characters).
- Notification text (limited to 3,000 characters).
- Android notification key (limited to 300 characters).
- Notification posted timestamp.

The upload is made only when a Firebase user is signed in and includes a Firebase ID token in the Authorization header. The server uses the verified identity to scope the user's notification inbox and financial data.

Important distinctions:

- The app does not request the SMS-reading permission and does not read the SMS database directly.
- Google Messages is on the allowlist. Therefore, visible bank-message notification content can be read and may be uploaded when it matches the financial-content filter.
- The app does not ask for UPI PINs, OTPs, banking passwords or Google passwords.
- Notification text is sensitive personal/financial information. Do not enable access unless you accept that eligible notification content is transmitted to the Pocket server.
- A notification is not a bank-verified settlement record. Always compare it with your bank/UPI app before approval.

## API and configuration

The Android build uses `POCKET_API_BASE` if supplied; otherwise it defaults to:

```text
https://money.joerakesh.tech/api
```

The notification listener appends `/sync/notifications` to this base URL. Confirm the deployed API host and environment before publishing a release. Never put MongoDB credentials or Firebase Admin private keys in the Android app.

## Updating the app

Download the intended APK from the repository's Releases page. Check the release notes and the APK's actual version before installing. Install over the existing app only when it is signed with the same signing key; otherwise Android may reject the update. Keep a copy of the previous known-good APK and do not uninstall unless you understand the effect on locally stored fallback detections.

## Testing checklist before public distribution

- Verify Google sign-in using the release-signed APK, not only a debug build.
- Verify the configured API URL responds from a real phone.
- Test one small successful payment for each supported source app.
- Confirm the inbox item appears under the correct Google account.
- Confirm ignored candidates do not affect balances.
- Confirm approval creates exactly one transaction.
- Test duplicate alerts from UPI and bank-message sources.
- Test failed, pending, refunded and reversed alerts.
- Test successful AutoPay / standing-instruction alerts from Google Messages, including `AUTOPAY of Rs.89.00 to Google Play on 02-Nov-26 was successful.`
- Test paired transfers between two of the user's own accounts.
- Reconcile the result against the bank statement.

Do not describe the integration as fully validated until these real-device tests pass.
