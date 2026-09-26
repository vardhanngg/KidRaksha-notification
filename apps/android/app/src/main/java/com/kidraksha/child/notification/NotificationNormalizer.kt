package com.kidraksha.child.notification

import android.app.Notification
import android.content.Context
import android.service.notification.StatusBarNotification
import com.kidraksha.child.data.Prefs
import java.security.MessageDigest

class NotificationNormalizer(private val context: Context) {
    data class NormalizedNotification(
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

    private val appLabelCache = HashMap<String, String>()

    fun normalize(sbn: StatusBarNotification, prefs: Prefs): NormalizedNotification {
        val notification = sbn.notification
        val extras = notification.extras

        val titleRaw = NotificationText.firstNonBlank(
            extras?.getCharSequence(Notification.EXTRA_TITLE),
            extras?.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE)
        )
        val bodyRaw = NotificationText.firstNonBlank(
            extras?.getCharSequence(Notification.EXTRA_BIG_TEXT),
            extras?.getCharSequence(Notification.EXTRA_TEXT),
            extras?.getCharSequence(Notification.EXTRA_SUMMARY_TEXT)
        ) ?: NotificationText.joinLines(extras?.getCharSequenceArray(Notification.EXTRA_TEXT_LINES))

        val contentState = when {
            !prefs.contentSharingEnabled -> "withheld"
            titleRaw == null && bodyRaw == null -> "unavailable"
            else -> "available"
        }
        val title = if (prefs.contentSharingEnabled) titleRaw?.take(500) else null
        val body = if (prefs.contentSharingEnabled) bodyRaw?.take(5000) else null
        val category = notification.category?.take(40)
        val type = NotificationType.fromCategory(category)
        val keyHash = sha256(sbn.key)
        // Keep the id independent of notification text. A hash of sensitive text can
        // still leak information by brute force, so content never participates in the
        // identifier sent to the server.
        val clientId = sha256("$keyHash|${sbn.postTime}")

        return NormalizedNotification(
            clientNotificationId = clientId,
            notificationKeyHash = keyHash,
            packageName = sbn.packageName.take(200),
            appName = appLabel(sbn.packageName).take(120),
            title = title,
            body = body,
            contentState = contentState,
            notificationType = type,
            category = category,
            channelId = notification.channelId?.take(200),
            groupKey = sbn.groupKey?.take(300),
            isOngoing = notification.flags and Notification.FLAG_ONGOING_EVENT != 0,
            isClearable = sbn.isClearable,
            isGroupSummary = notification.flags and Notification.FLAG_GROUP_SUMMARY != 0,
            postedAt = sbn.postTime
        )
    }

    private fun appLabel(packageName: String): String {
        synchronized(appLabelCache) {
            appLabelCache[packageName]?.let { return it }
            val label = runCatching {
                val info = context.packageManager.getApplicationInfo(packageName, 0)
                context.packageManager.getApplicationLabel(info).toString()
            }.getOrDefault(packageName)
            appLabelCache[packageName] = label
            if (appLabelCache.size > 256) appLabelCache.remove(appLabelCache.keys.first())
            return label
        }
    }

    private fun sha256(value: String): String =
        MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
}
