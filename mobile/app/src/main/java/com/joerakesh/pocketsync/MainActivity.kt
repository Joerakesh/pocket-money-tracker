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
import com.joerakesh.pocketsync.data.DetectedTransactionStore
import com.joerakesh.pocketsync.notification.PocketNotificationListener

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
        latestText = TextView(this).apply {
            textSize = 14f
            setPadding(0, 28, 0, 0)
        }

        root.addView(title, matchWrap())
        root.addView(statusText, matchWrap())
        root.addView(accessButton, matchWrap())
        root.addView(refreshButton, matchWrap())
        root.addView(latestText, matchWrap())
        setContentView(root)
        refreshStatus()
    }

    override fun onResume() {
        super.onResume()
        if (::statusText.isInitialized) refreshStatus()
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

        val recent = DetectedTransactionStore(this).latest(5)
        latestText.text = if (recent.isEmpty()) {
            "No transactions detected yet. Make a test payment after enabling access."
        } else {
            "Recently detected (local only):\n\n" + recent.joinToString("\n\n") {
                "${it.direction} · ₹${"%.2f".format(it.amountPaise / 100.0)}\n${it.merchant ?: "Merchant unavailable"}"
            }
        }
    }

    private fun matchWrap() = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT
    )
}
