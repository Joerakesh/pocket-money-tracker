package com.joerakesh.pocketsync

import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import com.joerakesh.pocketsync.data.DetectedTransactionStore
import com.joerakesh.pocketsync.notification.PocketNotificationListener
import com.joerakesh.pocketsync.notification.TransactionParser

class MainActivity : Activity() {
    private val bg = Color.rgb(15, 20, 30)
    private val surface = Color.rgb(24, 30, 43)
    private val surfaceAlt = Color.rgb(34, 42, 56)
    private val textColor = Color.rgb(245, 247, 251)
    private val muted = Color.rgb(146, 155, 173)
    private val lime = Color.rgb(184, 243, 107)
    private val red = Color.rgb(255, 120, 135)

    private lateinit var statusValue: TextView
    private lateinit var statusDot: View
    private lateinit var countValue: TextView
    private lateinit var transactionList: LinearLayout
    private lateinit var emptyState: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = bg
        window.navigationBarColor = bg
        window.decorView.systemUiVisibility = 0

        val scroll = ScrollView(this).apply {
            setBackgroundColor(bg)
            clipToPadding = false
            isFillViewport = true
        }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(24), dp(20), dp(30))
        }
        scroll.addView(root)
        setContentView(scroll)

        val top = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val brand = column().apply {
            addView(label("POCKET  /  COMPANION", 10f, lime, true))
            addView(label("Pocket Sync", 27f, textColor, true).apply {
                setPadding(0, dp(4), 0, 0)
            })
        }
        top.addView(brand, LinearLayout.LayoutParams(0, -2, 1f))
        top.addView(pill("ANDROID BETA", lime))
        root.addView(top)
        space(root, 22)

        val hero = card()
        hero.addView(label("AUTOMATIC TRANSACTION DETECTION", 10f, muted, true))
        hero.addView(label("Your money,\nmade clear.", 28f, textColor, true).apply {
            setLineSpacing(dp(1).toFloat(), 1f)
            setPadding(0, dp(9), 0, dp(7))
        })
        hero.addView(label(
            "Pocket Sync reads supported bank and UPI notifications. Detected activity stays on this device until secure account sync is configured.",
            13f, muted, false
        ))
        space(hero, 18)
        val statusRow = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
        statusDot = View(this).apply {
            background = circle(muted)
        }
        statusRow.addView(statusDot, LinearLayout.LayoutParams(dp(9), dp(9)))
        statusValue = label("Checking notification access…", 12f, textColor, true).apply {
            setPadding(dp(9), 0, 0, 0)
        }
        statusRow.addView(statusValue)
        hero.addView(statusRow)
        space(hero, 15)
        val access = actionButton("Enable notification access", true) {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }
        hero.addView(access, match())
        root.addView(hero)
        space(root, 14)

        val metrics = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        val detectedCard = card()
        detectedCard.addView(label("DETECTED", 10f, muted, true))
        countValue = label("0", 27f, textColor, true).apply { setPadding(0, dp(5), 0, 0) }
        detectedCard.addView(countValue)
        detectedCard.addView(label("Saved locally", 11f, muted, false))
        val syncCard = card()
        syncCard.addView(label("CLOUD SYNC", 10f, muted, true))
        syncCard.addView(label("Not linked", 18f, lime, true).apply {
            setPadding(0, dp(9), 0, dp(4))
        })
        syncCard.addView(label("Firebase setup pending", 11f, muted, false))
        metrics.addView(detectedCard, LinearLayout.LayoutParams(0, -2, 1f).apply {
            marginEnd = dp(7)
        })
        metrics.addView(syncCard, LinearLayout.LayoutParams(0, -2, 1f).apply {
            marginStart = dp(7)
        })
        root.addView(metrics)
        space(root, 22)

        val section = LinearLayout(this).apply {
            gravity = Gravity.CENTER_VERTICAL
        }
        section.addView(label("Recent activity", 18f, textColor, true),
            LinearLayout.LayoutParams(0, -2, 1f))
        section.addView(actionButton("Refresh", false) { refreshData() })
        root.addView(section)
        root.addView(label(
            "Transactions detected from supported payment and bank notifications",
            11f, muted, false
        ).apply { setPadding(0, dp(5), 0, dp(12)) })

        val listCard = card()
        transactionList = column()
        emptyState = label("Nothing detected yet.\nMake or receive a UPI payment and Pocket Sync will look for its notification.",
            13f, muted, false).apply {
            gravity = Gravity.CENTER
            setPadding(dp(12), dp(24), dp(12), dp(24))
        }
        transactionList.addView(emptyState)
        listCard.addView(transactionList)
        root.addView(listCard)
        space(root, 18)

        val privacy = card()
        privacy.addView(label("PRIVATE BY DESIGN", 10f, lime, true))
        privacy.addView(label(
            "No payment is initiated by this app. Detected entries are candidates only; they are not added to your Pocket balance automatically. Cloud sync will require your Firebase sign-in.",
            12f, muted, false
        ).apply { setPadding(0, dp(8), 0, 0) })
        root.addView(privacy)

        refreshData()
    }

    override fun onResume() {
        super.onResume()
        if (::statusValue.isInitialized) refreshData()
    }

    private fun refreshData() {
        if (!::statusValue.isInitialized) return
        val component = ComponentName(this, PocketNotificationListener::class.java)
        val enabled = Settings.Secure.getString(contentResolver, "enabled_notification_listeners")
            .orEmpty().split(':').any { it == component.flattenToString() }
        statusValue.text = if (enabled) "Notification access is enabled" else "Notification access is off"
        statusDot.background = circle(if (enabled) lime else red)

        val recent = DetectedTransactionStore(this).use { it.latest(20) }
        countValue.text = recent.size.toString()
        transactionList.removeAllViews()
        if (recent.isEmpty()) {
            transactionList.addView(emptyState)
            return
        }

        recent.forEachIndexed { index, item ->
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(0, dp(11), 0, dp(11))
            }
            val incoming = item.direction.equals("INCOME", true)
            val icon = TextView(this).apply {
                text = if (incoming) "↓" else "↑"
                textSize = 20f
                gravity = Gravity.CENTER
                setTextColor(if (incoming) lime else red)
                background = rounded(surfaceAlt, 14)
            }
            row.addView(icon, LinearLayout.LayoutParams(dp(42), dp(42)))
            val details = column().apply {
                setPadding(dp(11), 0, dp(5), 0)
                addView(label(item.counterparty ?: item.merchant ?: "UPI transaction", 13f, textColor, true))
                val meta = buildList {
                    add(item.sourcePackage.substringAfterLast('.'))
                    item.accountSuffix?.let { add("••$it") }
                    item.reference?.let { add("Ref $it") }
                }.joinToString(" · ")
                addView(label(meta, 10f, muted, false).apply { setPadding(0, dp(4), 0, 0) })
            }
            row.addView(details, LinearLayout.LayoutParams(0, -2, 1f))
            val amount = label(
                (if (incoming) "+" else "−") + "₹" + "%.2f".format(item.amountPaise / 100.0),
                13f, if (incoming) lime else textColor, true
            )
            row.addView(amount)
            transactionList.addView(row)
            if (index < recent.lastIndex) transactionList.addView(View(this).apply {
                setBackgroundColor(Color.rgb(48, 56, 70))
            }, LinearLayout.LayoutParams(-1, dp(1)))
        }
    }

    private fun card() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(17), dp(17), dp(17), dp(17))
        background = rounded(surface, 20)
    }

    private fun column() = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }

    private fun label(value: String, size: Float, color: Int, bold: Boolean) =
        TextView(this).apply {
            text = value
            textSize = size
            setTextColor(color)
            if (bold) typeface = Typeface.create("sans-serif", Typeface.BOLD)
            setLineSpacing(dp(3).toFloat(), 1f)
        }

    private fun pill(value: String, color: Int) = TextView(this).apply {
        text = value
        textSize = 9f
        typeface = Typeface.DEFAULT_BOLD
        setTextColor(color)
        setPadding(dp(10), dp(7), dp(10), dp(7))
        background = rounded(surfaceAlt, 30)
    }

    private fun actionButton(value: String, primary: Boolean, onClick: () -> Unit) =
        Button(this).apply {
            text = value
            textSize = 12f
            isAllCaps = false
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(if (primary) Color.rgb(16, 22, 8) else textColor)
            background = rounded(if (primary) lime else surfaceAlt, 13)
            minHeight = dp(44)
            setPadding(dp(14), 0, dp(14), 0)
            setOnClickListener { onClick() }
        }

    private fun rounded(color: Int, radius: Int) = GradientDrawable().apply {
        setColor(color)
        cornerRadius = dp(radius).toFloat()
    }

    private fun circle(color: Int) = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(color)
    }

    private fun space(parent: LinearLayout, height: Int) {
        parent.addView(View(this), LinearLayout.LayoutParams(1, dp(height)))
    }

    private fun match() = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
    )

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
