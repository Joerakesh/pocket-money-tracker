package com.joerakesh.pocketsync.notification

import android.app.Notification
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.joerakesh.pocketsync.data.DetectedTransactionStore

class PocketNotificationListener : NotificationListenerService() {
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
        if (sbn.isGroup) return

        val extras = sbn.notification.extras ?: return
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
        val bodyParts = mutableListOf<String>()

        listOf(
            Notification.EXTRA_TEXT,
            Notification.EXTRA_BIG_TEXT,
            Notification.EXTRA_SUB_TEXT,
            Notification.EXTRA_INFO_TEXT
        ).forEach { key ->
            extras.getCharSequence(key)?.toString()?.takeIf { it.isNotBlank() }?.let(bodyParts::add)
        }

        // Some SMS apps put the real SMS body in MessagingStyle bundles instead
        // of EXTRA_TEXT / EXTRA_BIG_TEXT.
        listOf(Notification.EXTRA_MESSAGES, Notification.EXTRA_HISTORIC_MESSAGES).forEach { key ->
            val messages = extras.getParcelableArray(key)
            messages?.forEach { item ->
                val messageBundle = item as? Bundle ?: return@forEach
                messageBundle.getCharSequence("text")?.toString()
                    ?.takeIf { it.isNotBlank() }?.let(bodyParts::add)
                messageBundle.getCharSequence("sender")?.toString()
                    ?.takeIf { it.isNotBlank() }?.let(bodyParts::add)
            }
        }

        // Also include expanded inbox lines used by some banking/SMS notification layouts.
        extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.forEach { line ->
            line?.toString()?.takeIf { it.isNotBlank() }?.let(bodyParts::add)
        }

        val body = bodyParts.distinct().joinToString(" ")
        val parsed = TransactionParser.parse(title, body) ?: return

        DetectedTransactionStore(applicationContext).use { store ->
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
    }
}
