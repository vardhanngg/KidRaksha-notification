package com.kidraksha.child.notification

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

    fun fromCategory(category: String?): String = when (category) {
        "msg", "social" -> MESSAGE
        "email" -> EMAIL
        "call", "missed_call" -> CALL
        "transport" -> MEDIA
        "alarm" -> ALARM
        "reminder" -> REMINDER
        "event" -> EVENT
        "progress" -> PROGRESS
        "service" -> SERVICE
        "system" -> SYSTEM
        else -> OTHER
    }
}
