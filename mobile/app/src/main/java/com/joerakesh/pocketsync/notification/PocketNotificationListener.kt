package com.joerakesh.pocketsync.notification

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.joerakesh.pocketsync.data.DetectedTransactionStore

class PocketNotificationListener : NotificationListenerService() {
    private val supportedPackages = setOf(
        "com.google.android.apps.nbu.paisa.user",
        "com.phonepe.app",
        "net.one97.paytm",
        "in.org.npci.upiapp"
    )

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName !in supportedPackages) return

        val extras = sbn.notification.extras
        val title = extras.getCharSequence("android.title")?.toString()
        val body = listOf(
            extras.getCharSequence("android.text")?.toString(),
            extras.getCharSequence("android.bigText")?.toString(),
            extras.getCharSequence("android.subText")?.toString()
        ).filterNotNull().joinToString(" ")

        val parsed = TransactionParser.parse(title, body) ?: return
        DetectedTransactionStore(applicationContext).use { store ->
            store.insertIfNew(
                amountPaise = parsed.amountPaise,
                direction = parsed.direction,
                merchant = parsed.merchant,
                sourcePackage = sbn.packageName,
                reference = parsed.reference,
                detectedAt = sbn.postTime
            )
        }
    }
}
