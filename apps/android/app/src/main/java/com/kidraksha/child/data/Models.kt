
package com.kidraksha.child.data

data class QueuedNotification(
    val id: Long,
    val clientNotificationId: String,
    val packageName: String,
    val appName: String,
    val title: String?,
    val body: String?,
    val postedAt: Long
)
