# Pocket Sync — Android companion

Pocket Sync is a small native Kotlin Android app that detects payment notifications from selected UPI apps and stores a minimal transaction candidate locally. It is a companion to the Pocket web app in `../web`.

> **Current scope:** local notification detection only. This initial scaffold does not send transactions to the server, does not read SMS, and does not change Pocket balances. Cloud sync will be added only after an authenticated API contract and reconciliation rules are implemented.

## Project status

- [x] Native Android project structure
- [x] Notification-listener service declaration
- [x] UPI notification package allowlist
- [x] Basic amount, direction, merchant and UPI reference parser
- [x] Local SQLite queue with basic duplicate suppression
- [x] Screen to enable notification access and view recent detections
- [ ] Real-device parser validation for each supported UPI app
- [ ] Authenticated sync API and device registration
- [ ] Server-side idempotency and transaction review flow
- [ ] Bank SMS support (separate permission/policy review)
- [ ] Reversal, refund and own-account transfer reconciliation

## Requirements

- Android SDK Platform 37 and Android Build Tools installed.
- Gradle 9.6 or later; the project is configured for Gradle 9.8.1.
- Android Gradle Plugin 9.5.0.
- **JDK 17 to run Android Gradle Plugin 9.5.0.**

### About your Oracle JDK 27

Gradle 9.8.x itself supports running on Java 27, but Android Gradle Plugin 9.5.0 documents JDK 17 as its required/default runtime. Install a JDK 17 distribution (or use a compatible JDK bundled with Android Studio) for this Android project. You can keep Oracle JDK 27 installed for other projects.

On Windows, check the active Java:

```powershell
java -version
where.exe java
```

Temporarily point the current PowerShell session to your JDK 17 installation (adjust the path):

```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
java -version
```

In Android Studio, set **Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK** to JDK 17.

The warning shown by running `kotlin` in your terminal is about the deprecated interactive Kotlin REPL. It is not a project build error. Build this Android app with Gradle, not the Kotlin REPL.

## Open and build

1. Install Android Studio and Android SDK Platform 37 / Build Tools.
2. Open the `mobile` folder in Android Studio.
3. Set the Gradle JDK to JDK 17.
4. Allow Gradle sync to download the Android Gradle Plugin and dependencies.
5. Connect your Android phone with USB debugging enabled, or create an emulator.
6. Run the `app` configuration.

If Gradle 9.8.1 is installed on your PATH, you can build from PowerShell:

```powershell
cd mobile
gradle --version
gradle assembleDebug
```

The APK is produced at:

```text
app\build\outputs\apk\debug\app-debug.apk
```

If you prefer the Gradle Wrapper, generate it once from this directory after installing Gradle 9.8.1:

```powershell
gradle wrapper --gradle-version 9.8.1
.\gradlew.bat assembleDebug
```

## Enable notification access

1. Install and open Pocket Sync.
2. Tap **Open notification access settings**.
3. Select **Pocket Sync notification access** and enable it.
4. Return to Pocket Sync.
5. Make a small test UPI payment and inspect the locally detected entries.

Android requires the user to grant notification access explicitly. Detection depends on the notification text exposed by the payment app and may vary by app version, Android version and notification settings.

## Supported package names

The initial allowlist includes:

- Google Pay: `com.google.android.apps.nbu.paisa.user`
- PhonePe: `com.phonepe.app`
- Paytm: `net.one97.paytm`
- BHIM: `in.org.npci.upiapp`

Package names and notification formats should be verified on the target phone. Add or remove packages only after testing.

## Privacy and safety

- The service processes only notifications from the allowlisted packages.
- It stores parsed fields only; it does not persist full notification text.
- No SMS permission is requested in this initial build.
- No UPI PIN, OTP, password or Google credential is requested.
- Detected notifications are not authoritative bank settlement records.
- Failed, pending, reversed and refunded messages are ignored by the starter parser, but parser rules require real-device testing.
- Local duplicate suppression is best-effort. The server must enforce idempotency using a bank/UPI reference and reconciliation rules.
- The companion does not currently upload data or update financial balances.

## Next integration milestone

Implement an authenticated endpoint in the Next.js API under `web/src/app/api/[...path]/route.ts` (or a dedicated route). The companion should send a normalized candidate with a device-scoped credential. The server must validate the Firebase identity, map the user to their own finance namespace, deduplicate, classify internal transfers, and create a reviewable candidate rather than silently posting unverified notification data.

Only after that endpoint is tested should the app add a background sync worker. Do not embed MongoDB credentials or Firebase Admin credentials in the APK.
