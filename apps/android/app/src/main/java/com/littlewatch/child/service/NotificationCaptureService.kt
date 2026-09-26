
package com.littlewatch.child.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.littlewatch.child.R
import com.littlewatch.child.data.PendingStore
import com.littlewatch.child.data.Prefs
import com.littlewatch.child.data.QueuedNotification
import com.littlewatch.child.sync.ScheduleSync
import com.littlewatch.child.sync.SyncManager
import java.security.MessageDigest
import java.util.concurrent.Executors

class NotificationCaptureService : NotificationListenerService() {
    private val executor = Executors.newSingleThreadExecutor()

    override fun onListenerConnected() {
        super.onListenerConnected()
        refreshStatusNotification()
        ScheduleSync.schedule(this)
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val prefs = Prefs(this)
        if (!prefs.paired || !prefs.sharingEnabled) return
        if (!StatusNotifier.canDisplay(this)) {
            prefs.sharingEnabled = false
            prefs.contentSharingEnabled = false
            StatusNotifier.refresh(this)
            return
        }
        if (sbn.packageName == packageName) return
        executor.execute { capture(sbn, prefs) }
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        val prefs = Prefs(this)
        // Fail closed: do not keep sharing queued/new notifications when Android
        // has disconnected the listener. Keep the visible LittleWatch status.
        prefs.sharingEnabled = false
        prefs.contentSharingEnabled = false
        StatusNotifier.refresh(this)
        SyncManager.run(this)
    }

    private fun capture(sbn: StatusBarNotification, prefs: Prefs) {
        val extras = sbn.notification.extras
        val title = extras?.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.take(500)
        val body = extras?.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.take(5000)
        val safeBody = if (prefs.contentSharingEnabled) body else null
        val safeTitle = if (prefs.contentSharingEnabled) title else null
        val appName = runCatching {
            val info = packageManager.getApplicationInfo(sbn.packageName, 0)
            packageManager.getApplicationLabel(info).toString()
        }.getOrDefault(sbn.packageName)

        val clientId = sha256("${sbn.key}|${sbn.postTime}")
        val store = PendingStore(this)
        store.insertIfAbsent(
            QueuedNotification(
                id = 0,
                clientNotificationId = clientId,
                packageName = sbn.packageName,
                appName = appName.take(120),
                title = safeTitle,
                body = safeBody,
                postedAt = sbn.postTime
            )
        )
        store.trimTo(5000)
        SyncManager.run(this)
    }

    private fun refreshStatusNotification() {
        StatusNotifier.refresh(this)
    }

    private fun sha256(input: String): String =
        MessageDigest.getInstance("SHA-256").digest(input.toByteArray()).joinToString("") { "%02x".format(it) }
}
