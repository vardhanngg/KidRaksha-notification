package com.kidraksha.child.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.kidraksha.child.data.PendingStore
import com.kidraksha.child.data.Prefs
import com.kidraksha.child.data.SecureStore
import com.kidraksha.child.network.ApiClient
import com.kidraksha.child.service.StatusNotifier
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import java.io.IOException
import kotlin.coroutines.coroutineContext

class NotificationSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {
    companion object {
        private const val BATCH_SIZE = 50
        private const val MAX_BATCHES_PER_RUN = 20
    }

    override suspend fun doWork(): Result = SyncGate.withLock {
        val app = applicationContext
        val prefs = Prefs(app)
        val secure = SecureStore(app)
        val queue = PendingStore(app)

        if (!prefs.paired || secure.getToken().isNullOrBlank()) return@withLock Result.success()

        prefs.markSyncAttempt()
        val api = ApiClient(prefs, secure)

        // Sharing-off is a legitimate steady state. Reconcile the state, clear any pending
        // notification data, and let the periodic reconciliation remain dormant.
        if (!prefs.sharingEnabled) {
            queue.clear()
            StatusNotifier.refresh(app)
            bestEffortHeartbeat(api, prefs, 0)
            return@withLock Result.success()
        }

        // A missing required status notification or Notification Access invalidates sharing.
        if (!StatusNotifier.hasNotificationAccess(app) || !StatusNotifier.canDisplay(app)) {
            prefs.sharingEnabled = false
            prefs.contentSharingEnabled = false
            prefs.pendingEnableAfterAccess = false
            queue.clear()
            StatusNotifier.refresh(app)
            // Leave the periodic reconciliation registered. It will observe the disabled
            // sharing state and exit without uploading until the user explicitly re-enables it.
            bestEffortHeartbeat(api, prefs, 0)
            return@withLock Result.success()
        }

        // A paired device with sharing enabled always has periodic reconciliation.
        SyncScheduler.ensurePeriodic(app)

        try {
            var batches = 0
            while (batches < MAX_BATCHES_PER_RUN) {
                coroutineContext.ensureActive()
                val batch = withContext(Dispatchers.IO) { queue.take(BATCH_SIZE) }
                if (batch.isEmpty()) break

                try {
                    withContext(Dispatchers.IO) { api.upload(batch) }
                } catch (e: ApiClient.ApiException) {
                    return@withLock handleApiFailure(e, prefs, queue, api)
                } catch (e: IOException) {
                    prefs.markSyncFailure(networkMessage(e))
                    return@withLock Result.retry()
                }

                // Remove only after an HTTP success. Server-side idempotency makes a crash between
                // upload and removal safe: the next run can resend without creating duplicates.
                withContext(Dispatchers.IO) { queue.remove(batch.map { it.id }) }
                batches++
            }

            prefs.markSyncSuccess()
            bestEffortHeartbeat(api, prefs, queue.count())

            if (queue.count() > 0 && batches >= MAX_BATCHES_PER_RUN) {
                Result.retry()
            } else {
                Result.success()
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            prefs.markSyncFailure(e.message ?: e.javaClass.simpleName)
            Result.retry()
        }
    }

    private suspend fun handleApiFailure(
        error: ApiClient.ApiException,
        prefs: Prefs,
        queue: PendingStore,
        api: ApiClient
    ): Result {
        return when (SyncPolicy.forHttpStatus(error.code)) {
            SyncPolicy.Action.AUTH_REVOKED -> {
                secureCleanup(prefs, queue)
                StatusNotifier.stop(applicationContext)
                // Do not cancel WorkManager from inside the currently executing Worker.
                // The periodic job remains harmless because the unpaired guard exits early.
                Result.success()
            }
            SyncPolicy.Action.SHARING_DISABLED -> {
                prefs.sharingEnabled = false
                prefs.contentSharingEnabled = false
                prefs.pendingEnableAfterAccess = false
                queue.clear()
                StatusNotifier.refresh(applicationContext)
                bestEffortHeartbeat(api, prefs, 0)
                Result.success()
            }
            SyncPolicy.Action.RETRY -> {
                prefs.markSyncFailure("Server ${error.code}: ${error.message}")
                Result.retry()
            }
            SyncPolicy.Action.TERMINAL -> {
                // Preserve the queue. Periodic work will retry after the app/backend version
                // is corrected rather than silently deleting user notification data.
                prefs.markSyncFailure("Server ${error.code}: ${error.message}")
                bestEffortHeartbeat(api, prefs, queue.count())
                Result.success()
            }
            SyncPolicy.Action.SUCCESS -> Result.success()
        }
    }

    private suspend fun bestEffortHeartbeat(api: ApiClient, prefs: Prefs, pendingCount: Int) {
        try {
            withContext(Dispatchers.IO) {
                api.heartbeat(
                    pendingCount = pendingCount,
                    syncFailures = prefs.syncFailureCount,
                    syncError = prefs.syncLastError,
                    syncDroppedCount = prefs.syncDroppedCount
                )
            }
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            // Upload success must not be replayed only because the observability heartbeat failed.
        }
    }

    private fun secureCleanup(prefs: Prefs, queue: PendingStore) {
        SecureStore(applicationContext).clear()
        queue.clear()
        prefs.paired = false
        prefs.sharingEnabled = false
        prefs.contentSharingEnabled = false
        prefs.pendingEnableAfterAccess = false
        prefs.deviceId = null
    }

    private fun networkMessage(error: IOException): String =
        when (error) {
            is java.net.SocketTimeoutException -> "Network request timed out."
            is java.net.UnknownHostException -> "Server could not be reached."
            else -> "Network request failed."
        }
}
