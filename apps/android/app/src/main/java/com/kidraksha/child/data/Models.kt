package com.kidraksha.child.data

data class QueuedNotification(
    val id: Long,
    val clientNotificationId: String,
    val notificationKeyHash: String,
    val packageName: String,
    val appName: String,
    val title: String?,
    val body: String?,
    val contentState: String,
    val notificationType: String,
    val category: String?,
    val channelId: String?,
    val groupKey: String?,
    val isOngoing: Boolean,
    val isClearable: Boolean,
    val isGroupSummary: Boolean,
    val postedAt: Long
)
