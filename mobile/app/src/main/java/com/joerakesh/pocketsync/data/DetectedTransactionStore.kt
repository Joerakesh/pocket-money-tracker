package com.joerakesh.pocketsync.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class DetectedTransactionStore(context: Context) :
    SQLiteOpenHelper(context, "pocket_sync.db", null, 2) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE detected_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fingerprint TEXT NOT NULL UNIQUE,
                amount_paise INTEGER NOT NULL,
                direction TEXT NOT NULL,
                merchant TEXT,
                source_package TEXT NOT NULL,
                reference TEXT,
                detected_at INTEGER NOT NULL,
                account_suffix TEXT,
                counterparty TEXT
            )
            """.trimIndent()
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) {
            db.execSQL("ALTER TABLE detected_transactions ADD COLUMN account_suffix TEXT")
            db.execSQL("ALTER TABLE detected_transactions ADD COLUMN counterparty TEXT")
        }
    }

    fun insertIfNew(
        amountPaise: Long,
        direction: String,
        merchant: String?,
        sourcePackage: String,
        reference: String?,
        detectedAt: Long,
        accountSuffix: String? = null,
        counterparty: String? = null
    ): Boolean {
        // Same reference from the same source/direction is a duplicate alert.
        // Different banks/sources can still create the opposite side of a transfer.
        val fingerprint = reference?.let { "ref:$it:$sourcePackage:$direction" }
            ?: "$sourcePackage:$amountPaise:$direction:${merchant.orEmpty()}:${detectedAt / 120_000L}"

        val db = writableDatabase
        val values = ContentValues().apply {
            put("fingerprint", fingerprint)
            put("amount_paise", amountPaise)
            put("direction", direction)
            put("merchant", merchant)
            put("source_package", sourcePackage)
            put("reference", reference)
            put("detected_at", detectedAt)
            put("account_suffix", accountSuffix)
            put("counterparty", counterparty)
        }
        val insertedId = db.insertWithOnConflict(
            "detected_transactions", null, values, SQLiteDatabase.CONFLICT_IGNORE
        )
        if (insertedId == -1L) return false

        if (!reference.isNullOrBlank()) {
            val opposite = if (direction == "INCOME") "EXPENSE" else "INCOME"
            val match = db.query(
                "detected_transactions",
                arrayOf("id"),
                "reference = ? AND amount_paise = ? AND direction = ? AND id != ?",
                arrayOf(reference, amountPaise.toString(), opposite, insertedId.toString()),
                null, null, null, "1"
            ).use { it.moveToFirst() }

            if (match) {
                val transfer = ContentValues().apply { put("direction", "TRANSFER") }
                db.update("detected_transactions", transfer, "id = ?", arrayOf(insertedId.toString()))
                db.update(
                    "detected_transactions", transfer,
                    "reference = ? AND amount_paise = ? AND direction = ? AND id != ?",
                    arrayOf(reference, amountPaise.toString(), opposite, insertedId.toString())
                )
            }
        }
        return true
    }

    fun latest(limit: Int): List<DetectedTransaction> {
        val items = mutableListOf<DetectedTransaction>()
        readableDatabase.query(
            "detected_transactions",
            arrayOf(
                "id", "amount_paise", "direction", "merchant", "source_package",
                "reference", "detected_at", "account_suffix", "counterparty"
            ),
            null, null, null, null, "detected_at DESC", limit.toString()
        ).use { cursor ->
            while (cursor.moveToNext()) {
                items += DetectedTransaction(
                    id = cursor.getLong(0),
                    amountPaise = cursor.getLong(1),
                    direction = cursor.getString(2),
                    merchant = cursor.getString(3),
                    sourcePackage = cursor.getString(4),
                    reference = cursor.getString(5),
                    detectedAt = cursor.getLong(6),
                    accountSuffix = cursor.getString(7),
                    counterparty = cursor.getString(8)
                )
            }
        }
        return items
    }
}
