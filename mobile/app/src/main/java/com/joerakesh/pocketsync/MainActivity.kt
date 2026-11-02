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
import android.util.Log
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
        private const val API_BASE = BuildConfig.API_BASE
        private const val TAG = "PocketSyncAuth"
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
    private var authStatus = ""
    private var serverNotifications: org.json.JSONArray? = null
    private var serverNotificationsLoading = false
    private var serverNotificationsError: String? = null

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
        panel.addView(label("Pocket Sync reads notifications from supported UPI and messaging apps. Eligible payment notification text (including visible bank-message notifications from Google Messages) is sent to the Pocket server for parsing when you are signed in. You review each detected item in Pocket Web before it enters your ledger. Pocket Sync cannot make payments or access your UPI PIN, OTP or banking password.", 13f, ink, false))
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
        val signInButton = button("Continue with Google", true) { googleSignIn() }
        signInButton.isEnabled = authStatus != "Opening Google sign-in…" && authStatus != "Connecting your Google account…"
        content.addView(signInButton, match())
        space(content, 12)
        if (authStatus.isNotBlank()) {
            content.addView(label(authStatus, 12f, if (authStatus.contains("failed", true) || authStatus.contains("cancel", true)) Color.rgb(255, 130, 130) else lime, false))
            space(content, 8)
        }
        content.addView(label("Notification access enabled ✓", 12f, lime, true))
    }

    private fun googleSignIn() {
        Log.i(TAG, "Google sign-in button tapped")
        authStatus = "Opening Google sign-in…"
        render()
        try {
            val webClientId = getString(R.string.default_web_client_id)
            Log.i(TAG, "Web OAuth client ID resource loaded")
            val options = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(webClientId).requestEmail().build()
            val client = GoogleSignIn.getClient(this, options)
            Log.i(TAG, "Launching Google account chooser")
            startActivityForResult(client.signInIntent, GOOGLE_SIGN_IN)
        } catch (e: Exception) {
            Log.e(TAG, "Unable to launch Google sign-in", e)
            authStatus = "Sign-in setup failed: " + (e.localizedMessage ?: e.javaClass.simpleName)
            render()
            toast(authStatus)
        }
    }

    @Deprecated("Google Sign-In activity result")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != GOOGLE_SIGN_IN) {
            Log.d(TAG, "Ignoring unrelated activity result: " + requestCode)
            return
        }
        Log.i(TAG, "Google chooser returned resultCode=" + resultCode + ", dataPresent=" + (data != null))
        if (resultCode != RESULT_OK || data == null) {
            authStatus = if (resultCode == RESULT_CANCELED) "Google sign-in was cancelled. Tap Continue with Google to try again." else "Google sign-in did not return an account (result " + resultCode + ")."
            Log.w(TAG, authStatus)
            render()
            return
        }
        authStatus = "Connecting your Google account…"
        render()
        try {
            val account = GoogleSignIn.getSignedInAccountFromIntent(data).getResult(ApiException::class.java)
            Log.i(TAG, "Google account selected; emailPresent=" + (!account.email.isNullOrBlank()) + ", idTokenPresent=" + (!account.idToken.isNullOrBlank()))
            val idToken = account.idToken
            if (idToken.isNullOrBlank()) {
                authStatus = "Google did not return an ID token. Check Firebase OAuth configuration."
                Log.e(TAG, authStatus)
                render()
                return
            }
            val credential = GoogleAuthProvider.getCredential(idToken, null)
            auth.signInWithCredential(credential).addOnCompleteListener(this) { task ->
                if (task.isSuccessful) {
                    Log.i(TAG, "Firebase sign-in succeeded; userPresent=" + (auth.currentUser != null))
                    authStatus = ""
                    tab = "home"
                    render()
                    loadSummary()
                } else {
                    val error = task.exception
                    Log.e(TAG, "Firebase sign-in failed", error)
                    authStatus = "Firebase sign-in failed: " + (error?.localizedMessage ?: "Unknown error")
                    render()
                    toast(authStatus)
                }
            }
        } catch (e: ApiException) {
            Log.e(TAG, "Google account result failed; statusCode=" + e.statusCode, e)
            authStatus = "Google sign-in failed (code " + e.statusCode + "): " + (e.localizedMessage ?: "Check account and OAuth setup.")
            render()
            toast(authStatus)
        } catch (e: Exception) {
            Log.e(TAG, "Unexpected error handling Google sign-in result", e)
            authStatus = "Sign-in failed: " + (e.localizedMessage ?: e.javaClass.simpleName)
            render()
            toast(authStatus)
        }
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
        content.addView(label("Bank SMS and UPI app notifications parsed by your Pocket backend. These remain separate from your ledger until you review them.", 12f, muted, false))
        space(content, 12)
        val panel = card()
        val rows = serverNotifications
        if (rows == null) {
            panel.addView(label(if (serverNotificationsLoading) "Loading server-parsed notifications…" else "Server activity has not been loaded.", 13f, ink, false))
            serverNotificationsError?.let { panel.addView(label(it, 11f, Color.rgb(255, 130, 130), false)) }
            if (!serverNotificationsLoading) loadServerNotifications()
        } else if (rows.length() == 0) {
            panel.addView(label("No matching bank or UPI notifications received yet.", 13f, muted, false))
        } else {
            for (i in 0 until rows.length()) {
                val item = rows.getJSONObject(i)
                val direction = item.optString("direction").uppercase()
                val amount = money(item.optDouble("amount"))
                val displayAmount = when (direction) {
                    "INCOME" -> "+ $amount"
                    "EXPENSE" -> "− $amount"
                    "TRANSFER" -> "↔ $amount"
                    else -> "Review · $amount"
                }
                val name = item.optString("counterparty").takeIf { it.isNotBlank() }
                    ?: item.optString("sourcePackage").substringAfterLast('.')
                panel.addView(row(name, displayAmount))
                val account = item.optString("accountSuffix").takeIf { it.isNotBlank() }?.let { " · ••$it" } ?: ""
                val status = item.optString("status", "PENDING")
                panel.addView(label("$direction · $status$account", 10f, muted, false))
                if (i < rows.length() - 1) space(panel, 5)
            }
        }
        content.addView(panel)
        space(content, 10)
        content.addView(button("Refresh detected activity", false) {
            serverNotifications = null
            serverNotificationsError = null
            loadServerNotifications()
        }, match())
    }

    private fun loadServerNotifications() {
        if (serverNotificationsLoading || auth.currentUser == null) return
        serverNotificationsLoading = true
        Thread {
            var result: org.json.JSONArray? = null
            var problem: String? = null
            var connection: HttpURLConnection? = null
            try {
                val token = com.google.android.gms.tasks.Tasks.await(auth.currentUser!!.getIdToken(false)).token
                    ?: throw IllegalStateException("Firebase token unavailable.")
                connection = URL(API_BASE + "/sync/notifications").openConnection() as HttpURLConnection
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
                result = org.json.JSONArray(body)
            } catch (error: Exception) {
                problem = error.localizedMessage ?: "Could not load detected activity."
            } finally {
                connection?.disconnect()
            }
            runOnUiThread {
                serverNotificationsLoading = false
                serverNotifications = result
                serverNotificationsError = problem
                if (tab == "activity") render()
                if (problem != null) toast(problem!!)
            }
        }.apply { name = "PocketNotificationFetch" }.start()
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
