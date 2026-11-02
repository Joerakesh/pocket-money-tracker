package com.joerakesh.pocketsync.notification

import android.app.Notification
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
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

        val parsed = TransactionParser.parse(title, body)
        if (parsed == null) {
            Log.d(TAG, "No transaction parsed from notification")
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
        Log.d(TAG, "Parsed transaction: direction=${parsed.direction}, amountPaise=${parsed.amountPaise}, referencePresent=${!parsed.reference.isNullOrBlank()}, inserted=$inserted")
    }
}
