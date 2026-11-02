package com.joerakesh.pocketsync.notification

data class ParsedPayment(
    val amountPaise: Long,
    val direction: String,
    val merchant: String?,
    val reference: String?
)

object TransactionParser {
    private val amountRegex = Regex("""(?:₹|Rs\.?|INR)\s*([0-9][0-9,]*(?:\.\d{1,2})?)""", RegexOption.IGNORE_CASE)
    private val referenceRegex = Regex(
        """(?:UPI\s*(?:Ref(?:erence)?|ID)|Txn\s*ID|Transaction\s*ID)\s*[:#-]?\s*([A-Za-z0-9-]{8,})""",
        RegexOption.IGNORE_CASE
    )
    private val merchantRegex = Regex(
        """(?:paid to|sent to|received from|credited by)\s+([^,.;\n]+)""",
        RegexOption.IGNORE_CASE
    )

    fun parse(title: String?, body: String?): ParsedPayment? {
        val content = listOfNotNull(title, body).joinToString(" ").trim()
        if (content.isBlank()) return null

        val lower = content.lowercase()
        val rejected = listOf("failed", "failure", "declined", "pending", "reversed", "refunded")
        if (rejected.any(lower::contains)) return null

        val direction = when {
            listOf("received", "credited", "money added").any(lower::contains) -> "INCOME"
            listOf("paid", "sent", "debited", "payment successful").any(lower::contains) -> "EXPENSE"
            else -> return null
        }

        val amountText = amountRegex.find(content)?.groupValues?.getOrNull(1) ?: return null
        val rupees = amountText.replace(",", "").toBigDecimalOrNull() ?: return null
        val paise = runCatching { rupees.movePointRight(2).longValueExact() }.getOrNull()
            ?: return null
        if (paise <= 0L) return null

        val merchant = merchantRegex.find(content)?.groupValues?.getOrNull(1)
            ?.trim()
            ?.take(100)
            ?.takeIf { it.isNotBlank() }
        val reference = referenceRegex.find(content)?.groupValues?.getOrNull(1)

        return ParsedPayment(paise, direction, merchant, reference)
    }
}
