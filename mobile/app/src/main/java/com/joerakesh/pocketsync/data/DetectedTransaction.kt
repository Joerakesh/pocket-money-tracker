package com.joerakesh.pocketsync.data

data class DetectedTransaction(
    val id: Long,
    val amountPaise: Long,
    val direction: String,
    val merchant: String?,
    val sourcePackage: String,
    val reference: String?,
    val detectedAt: Long,
    val accountSuffix: String? = null,
    val counterparty: String? = null
)
