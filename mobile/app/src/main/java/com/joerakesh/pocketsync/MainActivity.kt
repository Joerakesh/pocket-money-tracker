package com.joerakesh.pocketsync

import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import com.joerakesh.pocketsync.data.DetectedTransactionStore
import com.joerakesh.pocketsync.notification.PocketNotificationListener
import com.joerakesh.pocketsync.notification.TransactionParser

class MainActivity : Activity() {
    private lateinit var statusText: TextView
    private lateinit var latestText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 64, 48, 48)
            gravity = Gravity.TOP
        }

        val title = TextView(this).apply {
            text = "Pocket Sync"
            textSize = 28f
        }
        statusText = TextView(this).apply {
            textSize = 16f
            setPadding(0, 28, 0, 24)
        }
        val accessButton = Button(this).apply {
            text = "Open notification access settings"
            setOnClickListener {
                startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
            }
        }
        val refreshButton = Button(this).apply {
            text = "Refresh status"
            setOnClickListener { refreshStatus() }
        }
        val simulateButton = Button(this).apply {
            text = "Run ₹1 self-transfer simulation"
            setOnClickListener { runSelfTransferSimulation() }
        }
        latestText = TextView(this).apply {
            textSize = 14f
            setPadding(0, 28, 0, 0)
        }

        root.addView(title, matchWrap())
        root.addView(statusText, matchWrap())
        root.addView(accessButton, matchWrap())
        root.addView(refreshButton, matchWrap())
        root.addView(simulateButton, matchWrap())
        root.addView(latestText, matchWrap())
        setContentView(root)
        refreshStatus()
    }

    override fun onResume() {
        super.onResume()
        if (::statusText.isInitialized) refreshStatus()
    }

    private fun runSelfTransferSimulation() {
        val reference = "667229669999"
        val debitSms = "Sent Rs.1.00 from XX0402 to Mr Joe Rakesh A on 02-Nov-26. UPI ref no. $reference. Not you? Tap https://kotk.in/example to report -Kotak"
        val creditSms = "Your A/c *3298 is credited with Rs.1.00 on 02-11-26 by JOE RAKESH A. RRN $reference. Available balance is Rs. 1.00 - Indian Bank"

        val debit = TransactionParser.parse("Kotak", debitSms)
        val credit = TransactionParser.parse("Indian Bank", creditSms)
        if (debit == null || credit == null) {
            Toast.makeText(this, "Simulation failed: parser did not recognise both sample messages", Toast.LENGTH_LONG).show()
            return
        }

        DetectedTransactionStore(this).use { store ->
            store.insertIfNew(
                debit.amountPaise, debit.direction, debit.merchant,
                "simulation.kotak", debit.reference, System.currentTimeMillis(),
                debit.accountSuffix, debit.counterparty
            )
            store.insertIfNew(
                credit.amountPaise, credit.direction, credit.merchant,
                "simulation.indianbank", credit.reference, System.currentTimeMillis() + 1,
                credit.accountSuffix, credit.counterparty
            )
        }
        Toast.makeText(this, "Simulation complete. No real payment made.", Toast.LENGTH_LONG).show()
        refreshStatus()
    }

    private fun refreshStatus() {
        val component = ComponentName(this, PocketNotificationListener::class.java)
        val enabledListeners = Settings.Secure.getString(
            contentResolver,
            "enabled_notification_listeners"
        ).orEmpty()
        val enabled = enabledListeners.split(':').any { it == component.flattenToString() }

        statusText.text = if (enabled) {
            "Notification access: enabled"
        } else {
            "Notification access: not enabled"
        }

        val recent = DetectedTransactionStore(this).latest(10)
        latestText.text = if (recent.isEmpty()) {
            "No transactions detected yet."
        } else {
            "Recently detected (local only):\\n\\n" + recent.joinToString("\\n\\n") {
                buildString {
                    append("${it.direction} · ₹${"%.2f".format(it.amountPaise / 100.0)}")
                    append("\\n${it.merchant ?: "Merchant unavailable"}")
                    it.accountSuffix?.let { suffix -> append("\\nAccount ••$suffix") }
                    it.reference?.let { ref -> append("\\nRef: $ref") }
                    append("\\nSource: ${it.sourcePackage}")
                }
            }
        }
    }

    private fun matchWrap() = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT
    )
}
