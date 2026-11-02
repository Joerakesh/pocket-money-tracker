package com.joerakesh.pocketsync.notification

import java.math.BigDecimal

data class ParsedPayment(
    val amountPaise: Long,
    val direction: String,
    val merchant: String?,
    val reference: String?,
    val accountSuffix: String?,
    val counterparty: String?
)

object TransactionParser {
    private val amountRegex = Regex(
        """(?:₹|Rs\.?|INR)\s*([0-9][0-9,]*(?:\.\d{1,2})?)""",
        RegexOption.IGNORE_CASE
    )
    private val referenceRegex = Regex(
        """(?:UPI\s*(?:Ref(?:erence)?(?:\s*No\.?)?|ID)|Txn\s*(?:ID|Ref)|Transaction\s*ID|RRN)\s*[:#.-]?\s*([A-Za-z0-9-]{8,})""",
        RegexOption.IGNORE_CASE
    )
    private val accountRegex = Regex(
        """(?:A/c|account|from)\s*[*Xx-]*([0-9]{4})\b""",
        RegexOption.IGNORE_CASE
    )
    private val sentToRegex = Regex(
        """\b(?:sent|paid|transferred)\s+(?:Rs\.?\s*[0-9,.]+\s+)?to\s+(.+?)(?=\s+(?:on\s+\d|UPI\s+ref|ref(?:erence)?\s+no)|[,.]|$)""",
        RegexOption.IGNORE_CASE
    )
    private val receivedFromRegex = Regex(
        """\b(?:received\s+from|credited\s+(?:by|from))\s+(.+?)(?=\s+(?:on\s+\d|RRN|UPI\s+ref|available\s+balance)|[,.]|$)""",
        RegexOption.IGNORE_CASE
    )

    fun parse(title: String?, body: String?): ParsedPayment? {
        // Parse all notification text fields together; Android may split long SMS across title/text/bigText.
        val content = listOfNotNull(title, body)
            .joinToString(" ")
            .replace(Regex("""\s+"""), " ")
            .trim()
        if (content.isBlank()) return null

        val lower = content.lowercase()
        if (listOf("failed", "failure", "declined", "pending", "reversed", "refunded").any(lower::contains)) {
            return null
        }

        val direction = when {
            Regex("""\b(credited|received|money added)\b""", RegexOption.IGNORE_CASE).containsMatchIn(content) -> "INCOME"
            Regex("""\b(sent|debited|paid|payment successful|transferred)\b""", RegexOption.IGNORE_CASE).containsMatchIn(content) -> "EXPENSE"
            else -> return null
        }

        val amountText = amountRegex.find(content)?.groupValues?.getOrNull(1) ?: return null
        val rupees = amountText.replace(",", "").toBigDecimalOrNull() ?: return null
        val paise = runCatching { rupees.movePointRight(2).longValueExact() }.getOrNull() ?: return null
        if (paise <= 0L) return null

        val reference = referenceRegex.find(content)?.groupValues?.getOrNull(1)
        val accountSuffix = accountRegex.find(content)?.groupValues?.getOrNull(1)
        val counterparty = (if (direction == "EXPENSE") sentToRegex else receivedFromRegex)
            .find(content)?.groupValues?.getOrNull(1)
            ?.replace(Regex("""\s+(?:UPI|RRN|Ref(?:erence)?|on\s+\d).*?$""", RegexOption.IGNORE_CASE), "")
            ?.trim(' ', '.', ',', ':', '-')
            ?.take(100)
            ?.takeIf { it.isNotBlank() }

        return ParsedPayment(
            amountPaise = paise,
            direction = direction,
            merchant = counterparty,
            reference = reference,
            accountSuffix = accountSuffix,
            counterparty = counterparty
        )
    }
}
