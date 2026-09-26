
package com.kidraksha.child.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.kidraksha.child.data.Prefs
import com.kidraksha.child.sync.ScheduleSync
import com.kidraksha.child.sync.SyncManager

class SystemReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val app = context.applicationContext
        if (Prefs(app).paired) {
            ScheduleSync.schedule(app)
            SyncManager.run(app)
        }
    }
}
