package com.kidsuraksha.child.notification

import android.app.Notification
import java.util.Locale

object NotificationType {
    const val MESSAGE = "message"
    const val EMAIL = "email"
    const val CALL = "call"
    const val MEDIA = "media"
    const val ALARM = "alarm"
    const val REMINDER = "reminder"
    const val EVENT = "event"
    const val SYSTEM = "system"
    const val PROGRESS = "progress"
    const val SERVICE = "service"
    const val OTHER = "other"

    fun fromCategory(category: String?): String {
        return when (category?.trim()?.lowercase(Locale.ROOT)) {
            Notification.CATEGORY_MESSAGE,
            Notification.CATEGORY_SOCIAL -> MESSAGE

            Notification.CATEGORY_EMAIL -> EMAIL

            Notification.CATEGORY_CALL,
            Notification.CATEGORY_MISSED_CALL -> CALL

            Notification.CATEGORY_TRANSPORT -> MEDIA

            Notification.CATEGORY_ALARM -> ALARM

            Notification.CATEGORY_REMINDER -> REMINDER

            Notification.CATEGORY_EVENT -> EVENT

            Notification.CATEGORY_PROGRESS -> PROGRESS

            Notification.CATEGORY_SERVICE -> SERVICE

            Notification.CATEGORY_SYSTEM,
            Notification.CATEGORY_STATUS -> SYSTEM

            else -> OTHER
        }
    }
}
