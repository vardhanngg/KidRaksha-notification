
package com.kidraksha.child.data

import android.content.Context

class Prefs(context: Context) {
    private val sp = context.getSharedPreferences("kidraksha_prefs", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = sp.getString("server_url", com.kidraksha.child.BuildConfig.API_BASE_URL).orEmpty().trimEnd('/')
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
}
