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
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.joerakesh.pocketsync.data.DetectedTransactionStore
import com.joerakesh.pocketsync.notification.PocketNotificationListener
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.NumberFormat
import java.util.Locale

class MainActivity : Activity() {
    companion object {
        private const val GOOGLE_SIGN_IN = 7101
        private const val API_BASE = "https://money.joerakesh.tech/api"
    }
    private val bg = Color.rgb(15, 20, 30)
    private val surface = Color.rgb(24, 30, 43)
    private val surfaceAlt = Color.rgb(34, 42, 56)
    private val ink = Color.rgb(245, 247, 251)
    private val muted = Color.rgb(146, 155, 173)
    private val lime = Color.rgb(184, 243, 107)
    private val auth by lazy { FirebaseAuth.getInstance() }
    private lateinit var root: LinearLayout
    private lateinit var content: LinearLayout
    private var tab = "home"
    private var summary: JSONObject? = null
    private var loading = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = bg
        window.navigationBarColor = bg
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        hideStatusBar()
        root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(bg) }
        content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(20), dp(24), dp(20), dp(18)) }
        val scroll = ScrollView(this).apply { isFillViewport = true; addView(content) }
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        setContentView(root)
        render()
    }

    @Suppress("DEPRECATION")
    private fun hideStatusBar() {
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_FULLSCREEN or
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
    }

    override fun onResume() {
        super.onResume()
        hideStatusBar()
        if (::content.isInitialized) render()
    }

    private fun notificationAccess(): Boolean {
        val component = ComponentName(this, PocketNotificationListener::class.java)
        return Settings.Secure.getString(contentResolver, "enabled_notification_listeners")
            .orEmpty().split(':').any { it == component.flattenToString() }
    }

    private fun render() {
        content.removeAllViews()
        if (root.childCount > 1) root.removeViewAt(root.childCount - 1)
        if (!notificationAccess()) { permissionScreen(); return }
        if (auth.currentUser == null) { loginScreen(); return }
        content.addView(header())
        space(content, 18)
        when (tab) {
            "home" -> homeScreen()
            "activity" -> activityScreen()
            "sync" -> syncScreen()
            else -> settingsScreen()
        }
        bottomBar()
    }

    private fun permissionScreen() {
        content.addView(label("POCKET  /  COMPANION", 10f, lime, true))
        space(content, 48)
        content.addView(label("One quick setup", 30f, ink, true))
        space(content, 10)
        content.addView(label("Allow notification access so Pocket Sync can recognise payment alerts from supported banking and UPI apps.", 15f, muted, false))
        space(content, 22)
        val panel = card()
        panel.addView(label("WHY THIS PERMISSION?", 10f, lime, true))
        space(panel, 10)
        panel.addView(label("Pocket Sync reads payment notifications to prepare activity for your review. It cannot make payments or access your banking password or PIN. Detected entries stay on this device.", 13f, ink, false))
        content.addView(panel)
        space(content, 22)
        content.addView(button("Enable notification access", true) {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }, match())
        space(content, 10)
        content.addView(label("Google sign-in comes after this permission is enabled.", 11f, muted, false))
    }

    private fun loginScreen() {
        content.addView(label("POCKET  /  COMPANION", 10f, lime, true))
        space(content, 48)
        content.addView(label("Your money,\nmade clear.", 32f, ink, true))
        space(content, 12)
        content.addView(label("Sign in with the same Google account you use on Pocket. Your existing financial summary will appear here in read-only mode.", 15f, muted, false))
        space(content, 24)
        val panel = card()
        panel.addView(label("SECURE ACCOUNT CONNECTION", 10f, lime, true))
        space(panel, 10)
        panel.addView(label("Firebase verifies your Google account. Pocket Sync uses a Firebase ID token to request your summary over HTTPS.", 13f, ink, false))
        content.addView(panel)
        space(content, 22)
        content.addView(button("Continue with Google", true) { googleSignIn() }, match())
        space(content, 12)
        content.addView(label("Notification access enabled ✓", 12f, lime, true))
    }

    private fun googleSignIn() {
        try {
            val options = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(getString(R.string.default_web_client_id)).requestEmail().build()
            startActivityForResult(GoogleSignIn.getClient(this, options).signInIntent, GOOGLE_SIGN_IN)
        } catch (e: Exception) { toast("Google sign-in setup error: " + (e.localizedMessage ?: "unknown")) }
    }

    @Deprecated("Google Sign-In activity result")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != GOOGLE_SIGN_IN || resultCode != RESULT_OK || data == null) return
        try {
            val account = GoogleSignIn.getSignedInAccountFromIntent(data).getResult(ApiException::class.java)
            val credential = GoogleAuthProvider.getCredential(account.idToken, null)
            auth.signInWithCredential(credential).addOnCompleteListener(this) { task ->
                if (task.isSuccessful) { tab = "home"; render(); loadSummary() }
                else toast(task.exception?.localizedMessage ?: "Google sign-in failed.")
            }
        } catch (e: ApiException) { toast("Google sign-in failed (" + e.statusCode + ").") }
    }

    private fun header(): View {
        val row = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
        val brand = column()
        brand.addView(label("POCKET  /  COMPANION", 10f, lime, true))
        brand.addView(label("Pocket Sync", 25f, ink, true))
        row.addView(brand, LinearLayout.LayoutParams(0, -2, 1f))
        row.addView(button(auth.currentUser?.displayName?.substringBefore(" ") ?: "Account", false) {
            tab = "settings"; render()
        })
        return row
    }

    private fun homeScreen() {
        val hero = card()
        hero.addView(label("WELCOME BACK", 10f, muted, true))
        hero.addView(label(auth.currentUser?.displayName ?: "Pocket account", 21f, ink, true))
        hero.addView(label(auth.currentUser?.email ?: "", 11f, muted, false))
        content.addView(hero)
        space(content, 12)
        val data = summary
        if (data == null) {
            val panel = card()
            panel.addView(label(if (loading) "Loading your Pocket summary…" else "Your summary is not available.", 14f, ink, true))
            space(panel, 8)
            panel.addView(button("Refresh summary", true) { loadSummary() })
            content.addView(panel)
            if (!loading) loadSummary()
            return
        }
        content.addView(metric("TOTAL BALANCE", money(data.optDouble("totalBalance")), "Across your Pocket accounts"))
        space(content, 10)
        val first = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        first.addView(metric("SPENDABLE", money(data.optDouble("spendable")), "Available to spend"), weighted())
        first.addView(metric("TODAY", money(data.optDouble("todaySpent")), "Spent today"), weighted().apply { marginStart = dp(9) })
        content.addView(first)
        space(content, 10)
        val second = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        second.addView(metric("MONTH INCOME", money(data.optDouble("monthIncome")), "Income"), weighted())
        second.addView(metric("MONTH SPENDING", money(data.optDouble("monthSpent")), "Net spending"), weighted().apply { marginStart = dp(9) })
        content.addView(second)
        space(content, 10)
        val friends = card()
        friends.addView(label("FRIENDS & PAYBACKS", 10f, lime, true))
        friends.addView(row("You owe", money(data.optDouble("owedToFriends"))))
        friends.addView(row("Owed to you", money(data.optDouble("owedByFriends"))))
        content.addView(friends)
        space(content, 14)
        val recent = card()
        recent.addView(label("RECENT POCKET ACTIVITY", 10f, lime, true))
        val rows = data.optJSONArray("recentTransactions")
        if (rows == null || rows.length() == 0) recent.addView(label("No transactions yet.", 12f, muted, false))
        else for (i in 0 until minOf(rows.length(), 5)) {
            val item = rows.getJSONObject(i)
            val name = item.optString("person").takeIf { it.isNotBlank() }
                ?: item.optString("note").takeIf { it.isNotBlank() }
                ?: item.optString("category", item.optString("type"))
            val type = item.optString("type")
            val sign = if (type == "income" || type == "collection" || type == "refund") "+" else "−"
            recent.addView(row(name, sign + money(item.optDouble("amount"))))
        }
        content.addView(recent)
        space(content, 10)
        content.addView(button("Refresh summary", false) { loadSummary() }, match())
    }

    private fun activityScreen() {
        content.addView(label("Detected activity", 24f, ink, true))
        content.addView(label("Payment notifications on this device. These are not automatically added to your Pocket ledger.", 12f, muted, false))
        space(content, 12)
        val items = DetectedTransactionStore(this).use { it.latest(50) }
        val panel = card()
        if (items.isEmpty()) panel.addView(label("No detected notifications yet.", 13f, muted, false))
        items.forEach { item ->
            val sign = if (item.direction.equals("INCOME", true)) "+" else "−"
            panel.addView(row(item.counterparty ?: item.merchant ?: "UPI transaction", sign + money(item.amountPaise / 100.0)))
            val meta = item.sourcePackage.substringAfterLast('.') + (item.accountSuffix?.let { " · ••" + it } ?: "")
            panel.addView(label(meta, 10f, muted, false))
        }
        content.addView(panel)
    }

    private fun syncScreen() {
        content.addView(label("Sync & privacy", 24f, ink, true))
        space(content, 12)
        val panel = card()
        panel.addView(row("Google account", auth.currentUser?.email ?: "Signed out"))
        panel.addView(row("Summary API", "HTTPS · Read only"))
        panel.addView(row("Notification access", if (notificationAccess()) "Enabled" else "Off"))
        panel.addView(row("Detected entries", DetectedTransactionStore(this).use { it.latest(1000).size }.toString()))
        content.addView(panel)
        space(content, 12)
        content.addView(button("Refresh Pocket summary", true) { loadSummary() }, match())
    }

    private fun settingsScreen() {
        content.addView(label("Settings", 24f, ink, true))
        space(content, 12)
        val account = card()
        account.addView(label("SIGNED-IN GOOGLE ACCOUNT", 10f, lime, true))
        space(account, 8)
        account.addView(label(auth.currentUser?.displayName ?: "Google account", 17f, ink, true))
        account.addView(label(auth.currentUser?.email ?: "", 12f, muted, false))
        space(account, 14)
        account.addView(button("Sign out", false) {
            auth.signOut()
            GoogleSignIn.getClient(this, GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN).build())
                .signOut().addOnCompleteListener { summary = null; tab = "home"; render() }
        }, match())
        content.addView(account)
        space(content, 12)
        val permissions = card()
        permissions.addView(label("APP PERMISSIONS", 10f, lime, true))
        permissions.addView(row("Notification access", if (notificationAccess()) "Enabled" else "Off"))
        permissions.addView(button("Manage notification access", false) {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }, match())
        content.addView(permissions)
        space(content, 12)
        content.addView(label("Pocket Sync · Android 0.2.0", 11f, muted, false))
    }

    private fun bottomBar() {
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER
            setPadding(dp(8), dp(8), dp(8), dp(8)); setBackgroundColor(surface)
        }
        listOf("home" to "Home", "activity" to "Activity", "sync" to "Sync", "settings" to "Settings").forEach { item ->
            val selected = tab == item.first
            val view = TextView(this).apply {
                text = item.second; textSize = 11f; gravity = Gravity.CENTER
                typeface = if (selected) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
                setTextColor(if (selected) lime else muted)
                background = if (selected) rounded(surfaceAlt, 12) else null
                setOnClickListener { tab = item.first; render() }
            }
            bar.addView(view, LinearLayout.LayoutParams(0, dp(44), 1f))
        }
        root.addView(bar, LinearLayout.LayoutParams(-1, -2))
    }

    private fun loadSummary() {
        if (loading || auth.currentUser == null) return
        loading = true
        Thread {
            var data: JSONObject? = null
            var problem: String? = null
            var connection: HttpURLConnection? = null
            try {
                val tokenResult = com.google.android.gms.tasks.Tasks.await(auth.currentUser!!.getIdToken(false))
                val token = tokenResult.token ?: throw IllegalStateException("Firebase token unavailable.")
                connection = URL(API_BASE + "/summary").openConnection() as HttpURLConnection
                connection.requestMethod = "GET"
                connection.connectTimeout = 15000
                connection.readTimeout = 15000
                connection.setRequestProperty("Authorization", "Bearer " + token)
                connection.setRequestProperty("Accept", "application/json")
                connection.setRequestProperty("Cache-Control", "no-store")
                val code = connection.responseCode
                val stream = if (code in 200..299) connection.inputStream else connection.errorStream
                val body = stream.bufferedReader().use { it.readText() }
                if (code !in 200..299) throw IllegalStateException(JSONObject(body).optString("error", "Request failed: " + code))
                data = JSONObject(body)
            } catch (e: Exception) { problem = e.localizedMessage ?: "Could not load summary." }
            finally { connection?.disconnect() }
            runOnUiThread {
                loading = false
                if (data != null) summary = data
                render()
                if (problem != null) toast(problem!!)
            }
        }.start()
    }

    private fun metric(title: String, value: String, note: String) = card().apply {
        addView(label(title, 10f, muted, true))
        addView(label(value, 21f, ink, true).apply { setPadding(0, dp(7), 0, dp(3)) })
        addView(label(note, 10f, muted, false))
    }
    private fun row(left: String, right: String) = LinearLayout(this).apply {
        gravity = Gravity.CENTER_VERTICAL; setPadding(0, dp(8), 0, dp(8))
        addView(label(left, 12f, muted, false), LinearLayout.LayoutParams(0, -2, 1f))
        addView(label(right, 13f, ink, true))
    }
    private fun card() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL; setPadding(dp(16), dp(16), dp(16), dp(16))
        background = rounded(surface, 18)
    }
    private fun column() = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
    private fun label(value: String, size: Float, color: Int, bold: Boolean) = TextView(this).apply {
        text = value; textSize = size; setTextColor(color)
        if (bold) typeface = Typeface.create("sans-serif", Typeface.BOLD)
        setLineSpacing(dp(3).toFloat(), 1f)
    }
    private fun button(value: String, primary: Boolean, action: () -> Unit) = Button(this).apply {
        text = value; textSize = 12f; isAllCaps = false; typeface = Typeface.DEFAULT_BOLD
        setTextColor(if (primary) Color.rgb(16, 22, 8) else ink)
        background = rounded(if (primary) lime else surfaceAlt, 13)
        minHeight = dp(46); setPadding(dp(14), 0, dp(14), 0)
        setOnClickListener { action() }
    }
    private fun rounded(color: Int, radius: Int) = GradientDrawable().apply {
        setColor(color); cornerRadius = dp(radius).toFloat()
    }
    private fun space(parent: LinearLayout, height: Int) {
        parent.addView(View(this), LinearLayout.LayoutParams(1, dp(height)))
    }
    private fun weighted() = LinearLayout.LayoutParams(0, -2, 1f)
    private fun match() = LinearLayout.LayoutParams(-1, -2)
    private fun money(amount: Double) = NumberFormat.getCurrencyInstance(Locale("en", "IN"))
        .format(amount).replace("INR", "₹")
    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
