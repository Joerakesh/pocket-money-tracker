package com.joerakesh.pocketsync.notification

import android.app.Notification
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.google.android.gms.tasks.Tasks
import com.joerakesh.pocketsync.BuildConfig
import com.google.firebase.auth.FirebaseAuth
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import com.joerakesh.pocketsync.data.DetectedTransactionStore

class PocketNotificationListener : NotificationListenerService() {
    companion object {
        private const val TAG = "PocketNotificationListener"
    }

    private val supportedPackages = setOf(
        "com.google.android.apps.nbu.paisa.user",
        "com.phonepe.app",
        "net.one97.paytm",
        "in.org.npci.upiapp",
        "com.kotak811mobilebankingapp.instantsavingsupiscanandpayrecharge",
        "com.google.android.apps.messaging"
    )

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName !in supportedPackages) return

        val notification = sbn.notification
        val extras = notification.extras ?: return
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
        val bodyParts = linkedSetOf<String>()

        fun add(value: CharSequence?) {
            value?.toString()?.trim()?.takeIf { it.isNotBlank() }?.let(bodyParts::add)
        }

        listOf(
            Notification.EXTRA_TEXT,
            Notification.EXTRA_BIG_TEXT,
            Notification.EXTRA_SUB_TEXT,
            Notification.EXTRA_INFO_TEXT,
            Notification.EXTRA_SUMMARY_TEXT,
            Notification.EXTRA_CONVERSATION_TITLE
        ).forEach { key -> add(extras.getCharSequence(key)) }

        // MessagingStyle notifications keep SMS text in a Parcelable array of Bundles.
        listOf(Notification.EXTRA_MESSAGES, Notification.EXTRA_HISTORIC_MESSAGES).forEach { key ->
            val messages = extras.getParcelableArray(key)
            messages?.forEach messageLoop@{ item ->
                val bundle = item as? Bundle ?: return@messageLoop
                add(bundle.getCharSequence("text"))
                add(bundle.getCharSequence("sender"))
            }
        }

        extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.forEach(::add)

        val body = bodyParts.joinToString(" ")
        Log.d(TAG, "Notification received: package=${sbn.packageName}, keys=${extras.keySet()}, titlePresent=${!title.isNullOrBlank()}, bodyFields=${bodyParts.size}")

        val combined = listOfNotNull(title, body).joinToString(" ")
        val looksFinancial = Regex("""(?:₹|Rs\.?|INR)\s*[0-9]""", RegexOption.IGNORE_CASE).containsMatchIn(combined) &&
            Regex("""\b(credited|debited|received|sent|paid|payment|UPI|transaction|withdrawn|transferred)\b""", RegexOption.IGNORE_CASE).containsMatchIn(combined)
        if (looksFinancial) uploadForServerParsing(sbn, title.orEmpty(), body)

        val parsed = TransactionParser.parse(title, body)
        if (parsed == null) {
            Log.d(TAG, "Notification queued for backend parsing; local parser did not classify it")
            return
        }

        val inserted = DetectedTransactionStore(applicationContext).use { store ->
            store.insertIfNew(
                amountPaise = parsed.amountPaise,
                direction = parsed.direction,
                merchant = parsed.merchant,
                sourcePackage = sbn.packageName,
                reference = parsed.reference,
                detectedAt = sbn.postTime,
                accountSuffix = parsed.accountSuffix,
                counterparty = parsed.counterparty
            )
        }
        Log.d(TAG, "Local fallback parsed transaction: direction=${parsed.direction}, amountPaise=${parsed.amountPaise}, referencePresent=${!parsed.reference.isNullOrBlank()}, inserted=$inserted")
    }

    private fun uploadForServerParsing(sbn: StatusBarNotification, title: String, text: String) {
        Thread {
            var connection: HttpURLConnection? = null
            try {
                val user = FirebaseAuth.getInstance().currentUser
                if (user == null) {
                    Log.w(TAG, "Skipped server sync: no signed-in Firebase user")
                    return@Thread
                }
                val token = Tasks.await(user.getIdToken(false)).token
                    ?: throw IllegalStateException("Firebase ID token unavailable")
                val event = JSONObject()
                    .put("sourcePackage", sbn.packageName)
                    .put("title", title.take(180))
                    .put("text", text.take(3000))
                    .put("notificationKey", sbn.key.take(300))
                    .put("postedAt", sbn.postTime)
                val payload = JSONObject().put("events", JSONArray().put(event))
                connection = URL(BuildConfig.API_BASE + "/sync/notifications")
                    .openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.connectTimeout = 12000
                connection.readTimeout = 12000
                connection.doOutput = true
                connection.setRequestProperty("Authorization", "Bearer $token")
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.setRequestProperty("Accept", "application/json")
                connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
                val code = connection.responseCode
                if (code in 200..299) {
                    val response = connection.inputStream.bufferedReader().use { it.readText() }
                    val result = JSONObject(response)
                    Log.i(TAG, "Backend notification parse complete: accepted=${result.optInt("accepted")}, duplicates=${result.optInt("duplicates")}, ignored=${result.optInt("ignored")}")
                } else {
                    Log.e(TAG, "Backend notification sync failed with HTTP $code")
                    connection.errorStream?.close()
                }
            } catch (error: Exception) {
                Log.e(TAG, "Backend notification sync failed", error)
            } finally {
                connection?.disconnect()
            }
        }.apply { name = "PocketNotificationUpload" }.start()
    }
}
