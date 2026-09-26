
package com.littlewatch.child.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.littlewatch.child.sync.SyncManager

class SyncReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        SyncManager.run(context)
    }
}
