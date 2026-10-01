
package com.kidsuraksha.child.data

import android.content.Context

class Prefs(context: Context) {
    private val sp = context.getSharedPreferences("kidraksha_prefs", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = sp.getString("server_url", com.kidsuraksha.child.BuildConfig.API_BASE_URL).orEmpty().trimEnd('/')
        set(value) = sp.edit().putString("server_url", value.trimEnd('/')).apply()

    var deviceId: String?
        get() = sp.getString("device_id", null)
        set(value) = sp.edit().putString("device_id", value).apply()

    var deviceName: String
        get() = sp.getString("device_name", android.os.Build.MODEL ?: "Child device").orEmpty()
        set(value) = sp.edit().putString("device_name", value).apply()

    var paired: Boolean
        get() = sp.getBoolean("paired", false)
        set(value) = sp.edit().putBoolean("paired", value).apply()

    var sharingEnabled: Boolean
        get() = sp.getBoolean("sharing_enabled", false)
        set(value) = sp.edit().putBoolean("sharing_enabled", value).apply()

    var contentSharingEnabled: Boolean
        get() = sp.getBoolean("content_sharing_enabled", false)
        set(value) = sp.edit().putBoolean("content_sharing_enabled", value).apply()

    var pendingEnableAfterAccess: Boolean
        get() = sp.getBoolean("pending_enable_after_access", false)
        set(value) = sp.edit().putBoolean("pending_enable_after_access", value).apply()

    var syncLastAttemptAt: Long
        get() = sp.getLong("sync_last_attempt_at", 0L)
        set(value) = sp.edit().putLong("sync_last_attempt_at", value).apply()

    var syncLastSuccessAt: Long
        get() = sp.getLong("sync_last_success_at", 0L)
        set(value) = sp.edit().putLong("sync_last_success_at", value).apply()

    var syncFailureCount: Int
        get() = sp.getInt("sync_failure_count", 0)
        set(value) = sp.edit().putInt("sync_failure_count", value.coerceIn(0, 20)).apply()

    var syncLastError: String?
        get() = sp.getString("sync_last_error", null)
        set(value) = sp.edit().putString("sync_last_error", value?.take(240)).apply()

    var syncDroppedCount: Long
        get() = sp.getLong("sync_dropped_count", 0L)
        set(value) = sp.edit().putLong("sync_dropped_count", value.coerceIn(0L, 1_000_000_000L)).apply()

    fun recordDroppedRows(count: Int) {
        if (count <= 0) return
        val current = syncDroppedCount
        val next = minOf(1_000_000_000L, current + count.toLong())
        syncDroppedCount = next
    }

    fun markSyncAttempt(now: Long = System.currentTimeMillis()) {
        syncLastAttemptAt = now
    }

    fun markSyncSuccess(now: Long = System.currentTimeMillis()) {
        sp.edit()
            .putLong("sync_last_success_at", now)
            .putInt("sync_failure_count", 0)
            .remove("sync_last_error")
            .apply()
    }

    fun markSyncFailure(message: String, now: Long = System.currentTimeMillis()) {
        sp.edit()
            .putLong("sync_last_attempt_at", now)
            .putInt("sync_failure_count", (syncFailureCount + 1).coerceAtMost(20))
            .putString("sync_last_error", message.take(240))
            .apply()
    }
}
