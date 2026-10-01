package com.kidsuraksha.child.service

import android.content.ComponentName
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.kidsuraksha.child.data.PendingStore
import com.kidsuraksha.child.data.Prefs
import com.kidsuraksha.child.data.QueuedNotification
import com.kidsuraksha.child.notification.NotificationNormalizer
import com.kidsuraksha.child.sync.SyncScheduler
import com.kidsuraksha.child.sync.SyncManager
import java.util.concurrent.Executors

class NotificationCaptureService : NotificationListenerService() {
    private val executor = Executors.newSingleThreadExecutor()
    private lateinit var normalizer: NotificationNormalizer

    override fun onCreate() {
        super.onCreate()
        normalizer = NotificationNormalizer(applicationContext)
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        refreshStatusNotification()
        if (Prefs(this).paired && Prefs(this).sharingEnabled) SyncScheduler.ensurePeriodic(this)
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        // Android invokes NotificationListenerService callbacks on the main thread.
        // Never parse extras or touch disk/network there.
        if (sbn.packageName == packageName) return
        executor.execute { captureIfEnabled(sbn) }
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        refreshStatusNotification()
        // Android can disconnect/rebind listeners transiently. Ask the framework to
        // restore the listener instead of turning off sharing on every disconnect.
        runCatching { requestRebind(ComponentName(this, NotificationCaptureService::class.java)) }
        if (Prefs(this).paired) {
            SyncManager.run(this)
            if (Prefs(this).sharingEnabled) SyncScheduler.ensurePeriodic(this)
        }
    }

    override fun onDestroy() {
        executor.shutdownNow()
        super.onDestroy()
    }

    private fun captureIfEnabled(sbn: StatusBarNotification) {
        val prefs = Prefs(this)
        if (!prefs.paired || !prefs.sharingEnabled) return
        if (!StatusNotifier.canDisplay(this)) {
            prefs.sharingEnabled = false
            prefs.contentSharingEnabled = false
            PendingStore(this).clear()
            StatusNotifier.refresh(this)
            SyncManager.run(this)
            return
        }

        val normalized = runCatching { normalizer.normalize(sbn, prefs) }.getOrNull() ?: return
        val queue = PendingStore(this)
        val inserted = queue.insertIfAbsent(
            QueuedNotification(
                id = 0,
                clientNotificationId = normalized.clientNotificationId,
                notificationKeyHash = normalized.notificationKeyHash,
                packageName = normalized.packageName,
                appName = normalized.appName,
                title = normalized.title,
                body = normalized.body,
                contentState = normalized.contentState,
                notificationType = normalized.notificationType,
                category = normalized.category,
                channelId = normalized.channelId,
                groupKey = normalized.groupKey,
                isOngoing = normalized.isOngoing,
                isClearable = normalized.isClearable,
                isGroupSummary = normalized.isGroupSummary,
                postedAt = normalized.postedAt
            )
        )
        if (inserted) {
            Prefs(this).recordDroppedRows(queue.trimTo(5000))
        }
        SyncManager.run(this)
    }

    private fun refreshStatusNotification() = StatusNotifier.refresh(this)
}
