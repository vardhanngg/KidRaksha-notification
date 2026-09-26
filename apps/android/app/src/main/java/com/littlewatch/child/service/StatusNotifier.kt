package com.littlewatch.child.service

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import com.littlewatch.child.R
import com.littlewatch.child.data.Prefs
import com.littlewatch.child.ui.MainActivity

object StatusNotifier {
    private const val CHANNEL_ID = "littlewatch_status"
    private const val NOTIFICATION_ID = 9051

    fun canDisplay(context: Context): Boolean {
        val app = context.applicationContext
        val manager = app.getSystemService(NotificationManager::class.java) ?: return false
        if (Build.VERSION.SDK_INT >= 33 && app.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false
        ensureChannel(app, manager)
        return Build.VERSION.SDK_INT < 26 || manager.getNotificationChannel(CHANNEL_ID)?.importance != NotificationManager.IMPORTANCE_NONE
    }

    fun refresh(context: Context) {
        val app = context.applicationContext
        val prefs = Prefs(app)
        val manager = app.getSystemService(NotificationManager::class.java) ?: return
        if (!prefs.paired) {
            manager.cancel(NOTIFICATION_ID)
            return
        }
        ensureChannel(app, manager)
        if (!canDisplay(app)) return

        val hasAccess = hasNotificationAccess(app)
        val active = prefs.sharingEnabled && hasAccess
        val (title, body) = when {
            active -> "Notification sharing is on" to "LittleWatch is sharing notifications from this device."
            prefs.sharingEnabled && !hasAccess -> "Notification Access is off" to "Open LittleWatch to reconnect notification sharing."
            else -> "LittleWatch is connected" to "Notification sharing is currently off."
        }
        val openApp = PendingIntent.getActivity(
            app, 9052, Intent(app, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        manager.notify(
            NOTIFICATION_ID,
            Notification.Builder(app, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setOngoing(true)
                .setCategory(Notification.CATEGORY_STATUS)
                .setShowWhen(false)
                .setContentIntent(openApp)
                .build()
        )
    }

    fun stop(context: Context) {
        context.getSystemService(NotificationManager::class.java)?.cancel(NOTIFICATION_ID)
    }

    private fun ensureChannel(context: Context, manager: NotificationManager) {
        if (Build.VERSION.SDK_INT < 26) return
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID, context.getString(R.string.channel_status), NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows LittleWatch notification-access and sharing status."
                setShowBadge(false)
            }
        )
    }

    private fun hasNotificationAccess(context: Context): Boolean {
        val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners").orEmpty()
        val cn = ComponentName(context, NotificationCaptureService::class.java)
        return flat.split(":").any { it.equals(cn.flattenToString(), true) }
    }
}
