package com.kidraksha.child.sync

import android.content.Context

/** Public sync entry point used by the notification listener and child UI. */
object SyncManager {
    fun run(context: Context) = SyncScheduler.enqueueNow(context)
}
