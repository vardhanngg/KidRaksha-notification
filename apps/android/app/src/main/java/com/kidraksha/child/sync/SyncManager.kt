package com.kidraksha.child.sync

import android.content.Context
import com.kidraksha.child.data.PendingStore
import com.kidraksha.child.data.Prefs
import com.kidraksha.child.data.SecureStore
import com.kidraksha.child.network.ApiClient
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

object SyncManager {
    private val executor = Executors.newSingleThreadExecutor()
    private val running = AtomicBoolean(false)

    fun run(context: Context) {
        if (!running.compareAndSet(false, true)) return
        val app = context.applicationContext
        executor.execute {
            try {
                val prefs = Prefs(app)
                val secure = SecureStore(app)
                if (!prefs.paired || secure.getToken().isNullOrBlank()) return@execute
                val api = ApiClient(prefs, secure)
                val queue = PendingStore(app)
                if (prefs.sharingEnabled && (!com.kidraksha.child.service.StatusNotifier.canDisplay(app) || !com.kidraksha.child.service.StatusNotifier.hasNotificationAccess(app))) {
                    prefs.sharingEnabled = false
                    prefs.contentSharingEnabled = false
                    queue.clear()
                    com.kidraksha.child.service.StatusNotifier.refresh(app)
                }
                if (prefs.sharingEnabled) {
                    for (attempt in 0 until 3) {
                        val batch = queue.take(50)
                        if (batch.isEmpty()) break
                        api.upload(batch)
                        queue.remove(batch.map { it.id })
                        if (batch.size < 50) break
                    }
                }
                api.heartbeat()
                ScheduleSync.schedule(app)
            } catch (e: ApiClient.ApiException) {
                if (e.code == 401) {
                    secureFor(app).clear()
                    PendingStore(app).clear()
                    Prefs(app).apply {
                        paired = false
                        sharingEnabled = false
                        contentSharingEnabled = false
                        pendingEnableAfterAccess = false
                    }
                    com.kidraksha.child.service.StatusNotifier.stop(app)
                    ScheduleSync.cancel(app)
                }
            } catch (_: Throwable) {
                // Keep queued data on transient network/server errors.
            } finally {
                running.set(false)
                // Keep transient failures queued. The periodic sync alarm provides
                // the next retry and avoids a hot retry loop when the API is down.
                if (Prefs(app).paired && Prefs(app).sharingEnabled && PendingStore(app).count() > 0) {
                    ScheduleSync.schedule(app)
                }
            }
        }
    }

    private fun secureFor(context: Context) = SecureStore(context)
}
