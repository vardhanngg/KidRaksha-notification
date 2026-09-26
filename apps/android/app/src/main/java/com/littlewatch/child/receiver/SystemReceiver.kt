
package com.littlewatch.child.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.littlewatch.child.data.Prefs
import com.littlewatch.child.sync.ScheduleSync
import com.littlewatch.child.sync.SyncManager

class SystemReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val app = context.applicationContext
        if (Prefs(app).paired) {
            ScheduleSync.schedule(app)
            SyncManager.run(app)
        }
    }
}
