package com.joerakesh.pocketsync.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class DetectedTransactionStore(context: Context) :
    SQLiteOpenHelper(context, "pocket_sync.db", null, 1) {

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
                detected_at INTEGER NOT NULL
            )
            """.trimIndent()
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        // Use explicit migrations when the local schema changes.
    }

    fun insertIfNew(
        amountPaise: Long,
        direction: String,
        merchant: String?,
        sourcePackage: String,
        reference: String?,
        detectedAt: Long
    ): Boolean {
        val fingerprint = reference?.let { "ref:$it" }
            ?: "$sourcePackage:$amountPaise:$direction:${merchant.orEmpty()}:${detectedAt / 120_000L}"

        val values = ContentValues().apply {
            put("fingerprint", fingerprint)
            put("amount_paise", amountPaise)
            put("direction", direction)
            put("merchant", merchant)
            put("source_package", sourcePackage)
            put("reference", reference)
            put("detected_at", detectedAt)
        }
        return writableDatabase.insertWithOnConflict(
            "detected_transactions",
            null,
            values,
            SQLiteDatabase.CONFLICT_IGNORE
        ) != -1L
    }

    fun latest(limit: Int): List<DetectedTransaction> {
        val items = mutableListOf<DetectedTransaction>()
        readableDatabase.query(
            "detected_transactions",
            arrayOf("id", "amount_paise", "direction", "merchant", "source_package", "reference", "detected_at"),
            null, null, null, null,
            "detected_at DESC",
            limit.toString()
        ).use { cursor ->
            while (cursor.moveToNext()) {
                items += DetectedTransaction(
                    id = cursor.getLong(0),
                    amountPaise = cursor.getLong(1),
                    direction = cursor.getString(2),
                    merchant = cursor.getString(3),
                    sourcePackage = cursor.getString(4),
                    reference = cursor.getString(5),
                    detectedAt = cursor.getLong(6)
                )
            }
        }
        return items
    }
}
