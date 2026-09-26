
package com.littlewatch.child.ui

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.widget.*
import com.littlewatch.child.data.Prefs
import com.littlewatch.child.data.PendingStore
import com.littlewatch.child.data.SecureStore
import com.littlewatch.child.network.ApiClient
import com.littlewatch.child.service.NotificationCaptureService
import com.littlewatch.child.service.StatusNotifier
import com.littlewatch.child.sync.ScheduleSync
import com.littlewatch.child.sync.SyncManager

class MainActivity : Activity() {
    private lateinit var prefs: Prefs
    private lateinit var secure: SecureStore
    private lateinit var root: LinearLayout
    private lateinit var status: TextView
    private lateinit var sharing: Switch
    private lateinit var contentSharing: Switch

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = Prefs(this)
        secure = SecureStore(this)
        window.statusBarColor = getColor(com.littlewatch.child.R.color.lw_bg)
        window.navigationBarColor = getColor(com.littlewatch.child.R.color.lw_bg)
        window.decorView.systemUiVisibility = 0
        render()
    }

    override fun onResume() {
        super.onResume()
        if (prefs.paired && prefs.sharingEnabled && !hasNotificationAccess()) {
            prefs.sharingEnabled = false
            prefs.contentSharingEnabled = false
        }
        if (prefs.paired && prefs.pendingEnableAfterAccess && hasNotificationAccess()) {
            if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 7001)
            } else {
                prefs.pendingEnableAfterAccess = false
                prefs.sharingEnabled = true
                SyncManager.run(this)
                StatusNotifier.refresh(this)
            }
        }
        StatusNotifier.refresh(this)
        if (::sharing.isInitialized) {
            sharing.isChecked = prefs.sharingEnabled && hasNotificationAccess()
            updateControls()
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 7001 && grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
            if (hasNotificationAccess()) {
                prefs.sharingEnabled = true
                prefs.pendingEnableAfterAccess = false
                SyncManager.run(this)
                StatusNotifier.refresh(this)
                updateControls()
            } else {
                prefs.pendingEnableAfterAccess = true
                openNotificationAccess()
            }
        } else if (requestCode == 7001) {
            prefs.pendingEnableAfterAccess = false
            if (::sharing.isInitialized) sharing.isChecked = false
            StatusNotifier.refresh(this)
        }
    }

    private fun render() {
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(22), dp(24), dp(30))
            setBackgroundColor(getColor(com.littlewatch.child.R.color.lw_bg))
            setOnApplyWindowInsetsListener { view, insets ->
                val top: Int
                val bottom: Int
                if (Build.VERSION.SDK_INT >= 30) {
                    val bars = insets.getInsets(android.view.WindowInsets.Type.systemBars())
                    top = bars.top
                    bottom = bars.bottom
                } else {
                    @Suppress("DEPRECATION")
                    top = insets.systemWindowInsetTop
                    @Suppress("DEPRECATION")
                    bottom = insets.systemWindowInsetBottom
                }
                view.setPadding(dp(24), dp(22) + top, dp(24), dp(30) + bottom)
                insets
            }
        }
        val scroll = ScrollView(this).apply {
            setBackgroundColor(getColor(com.littlewatch.child.R.color.lw_bg))
            addView(root, ScrollView.LayoutParams(-1, -2))
        }
        setContentView(scroll)

        val brand = TextView(this).apply {
            text = "LW  LittleWatch"
            textSize = 21f
            setTextColor(getColor(com.littlewatch.child.R.color.lw_text))
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }
        root.addView(brand)

        val title = TextView(this).apply {
            textSize = 31f
            setTextColor(getColor(com.littlewatch.child.R.color.lw_text))
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(0, dp(36), 0, dp(8))
        }
        root.addView(title)

        status = TextView(this).apply {
            textSize = 15f
            setTextColor(getColor(com.littlewatch.child.R.color.lw_muted))
            setLineSpacing(0f,1.35f)
        }
        root.addView(status)

        if (!prefs.paired) {
            title.text = "Connect this device."
            status.text = "LittleWatch works with a parent account. Pair this Android phone using the one-time code shown in the parent's dashboard."
            root.addView(space(22))
            root.addView(primaryButton("Pair this device") { showPairDialog() })
            root.addView(space(12))
            root.addView(secondaryButton("How notification sharing works") { showDisclosure(readOnly = true) })
            root.addView(space(8))
            root.addView(secondaryButton("Privacy and data") { showPrivacy() })
        } else {
            title.text = "This device is connected."
            status.text = "Device: ${prefs.deviceName}\nOnly the notification sharing features below are active."
            root.addView(space(20))
            addSwitchRow("Share notifications", "Send notifications to the paired parent account.", prefs.sharingEnabled) { requested ->
                if (requested) enableSharing() else disableSharing()
            }
            addSwitchRow("Include message content", "When enabled, shared notifications may include title and message text.", prefs.contentSharingEnabled) { enabled ->
                if (enabled) {
                    showContentConfirmation {
                        prefs.contentSharingEnabled = true
                        contentSharing.isChecked = true
                        SyncManager.run(this)
                    }
                } else {
                    prefs.contentSharingEnabled = false
                    PendingStore(this).clear()
                    SyncManager.run(this)
                }
            }
            root.addView(space(12))
            root.addView(secondaryButton("Privacy and data") { showPrivacy() })
            root.addView(space(8))
            root.addView(secondaryButton("Open Notification Access settings") { openNotificationAccess() })
            root.addView(space(8))
            root.addView(secondaryButton("Sync now") { SyncManager.run(this); Toast.makeText(this,"Sync requested",Toast.LENGTH_SHORT).show() })
            root.addView(space(8))
            root.addView(secondaryButton("Unpair this device") { confirmUnpair() })
        }
    }

    private fun addSwitchRow(label:String, detail:String, checked:Boolean, onChange:(Boolean)->Unit) {
        val box=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(dp(16),dp(14),dp(8),dp(14));setBackgroundColor(getColor(com.littlewatch.child.R.color.lw_panel_alt))}
        val row=LinearLayout(this).apply{gravity=Gravity.CENTER_VERTICAL}
        val textBox=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;layoutParams=LinearLayout.LayoutParams(0,-2,1f)}
        val title=TextView(this).apply{text=label;textSize=16f;setTextColor(getColor(com.littlewatch.child.R.color.lw_text));setTypeface(typeface,android.graphics.Typeface.BOLD)}
        val desc=TextView(this).apply{text=detail;textSize=12f;setTextColor(getColor(com.littlewatch.child.R.color.lw_muted));setPadding(0,dp(4),0,0)}
        textBox.addView(title);textBox.addView(desc)
        val sw=Switch(this);sw.isChecked=checked
        if(label=="Share notifications") sharing=sw else contentSharing=sw
        sw.setOnCheckedChangeListener{_,v->onChange(v)}
        row.addView(textBox);row.addView(sw);box.addView(row)
        root.addView(box);root.addView(space(8))
    }

    private fun enableSharing() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            prefs.pendingEnableAfterAccess = true
            showNotificationPermissionDisclosure()
            return
        }
        if (!hasNotificationAccess()) {
            prefs.pendingEnableAfterAccess = true
            showDisclosure(readOnly = false)
            return
        }
        prefs.sharingEnabled=true
        sharing.isChecked=true
        SyncManager.run(this)
        StatusNotifier.refresh(this)
        updateControls()
    }

    private fun disableSharing() {
        prefs.sharingEnabled=false
        prefs.pendingEnableAfterAccess=false
        prefs.contentSharingEnabled=false
        PendingStore(this).clear()
        contentSharing.isChecked=false
        ScheduleSync.schedule(this)
        StatusNotifier.refresh(this)
        SyncManager.run(this)
        updateControls()
    }

    private fun updateControls() {
        if (::contentSharing.isInitialized) contentSharing.isEnabled=prefs.sharingEnabled
        if (::sharing.isInitialized) sharing.isChecked=prefs.sharingEnabled && hasNotificationAccess()
    }

    private fun showNotificationPermissionDisclosure() {
        AlertDialog.Builder(this)
            .setTitle("Keep sharing visible")
            .setMessage("LittleWatch uses a visible status notification while notification sharing is active. Android may ask for notification permission so this status can be shown. LittleWatch will not start sharing until you choose to allow it.")
            .setNegativeButton("Not now") { _, _ ->
                prefs.pendingEnableAfterAccess = false
                if (::sharing.isInitialized) sharing.isChecked = false
            }
            .setPositiveButton("Continue") { _, _ ->
                requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 7001)
            }.show()
    }

    private fun showPrivacy() {
        AlertDialog.Builder(this)
            .setTitle("Privacy and data")
            .setMessage("LittleWatch only shares notification data after Notification Access is enabled and sharing is turned on. Message content is optional. Shared data is sent to the paired parent account over HTTPS and notification content is encrypted when stored by LittleWatch. The device user can turn sharing off or remove Notification Access at any time.")
            .setPositiveButton("Close", null)
            .show()
    }

    private fun showPairDialog() {
        val form=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(dp(8),0,dp(8),0)}
        val code=EditText(this).apply{hint="8-character pairing code";inputType=InputType.TYPE_CLASS_TEXT;isSingleLine=true}
        val name=EditText(this).apply{hint="Device name";inputType=InputType.TYPE_CLASS_TEXT;isSingleLine=true;setText("${Build.MANUFACTURER} ${Build.MODEL}")}
        form.addView(code);form.addView(name)
        AlertDialog.Builder(this).setTitle("Pair with parent").setView(form)
            .setNegativeButton("Cancel",null)
            .setPositiveButton("Pair",null)
            .create().also { dialog->
                dialog.setOnShowListener {
                    dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                        val c=code.text.toString().trim().uppercase()
                        val n=name.text.toString().trim()
                        if(!c.matches(Regex("[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}"))||n.isBlank()){code.error="Enter a valid code";return@setOnClickListener}
                        Thread {
                            runCatching {
                                PendingStore(this).clear()
                                secure.clear()
                                val result=ApiClient(prefs,secure).pair(c,n, "1.0.0")
                                secure.setToken(result.token)
                                prefs.deviceId=result.deviceId
                                prefs.deviceName=n
                                prefs.paired=true
                            }.onSuccess {
                                runOnUiThread { dialog.dismiss(); render(); showDisclosure(readOnly=false) }
                            }.onFailure { e ->
                                runOnUiThread { Toast.makeText(this,e.message ?: "Pairing failed",Toast.LENGTH_LONG).show() }
                            }
                        }.start()
                    }
                }
                dialog.show()
            }
    }

    private fun showDisclosure(readOnly:Boolean) {
        val message = "LittleWatch is a parental monitoring app. When sharing is enabled, the Android Notification Access service can receive notifications from other apps and send selected notification data to your paired parent account. Message content is optional. The child device shows a persistent LittleWatch status notification while sharing is active."
        AlertDialog.Builder(this)
            .setTitle("Before you enable sharing")
            .setMessage(message)
            .setNegativeButton("Close",null)
            .setPositiveButton(if(readOnly)"Got it" else "Continue") { _,_ ->
                if(!readOnly){
                    enableSharing()
                }
            }.show()
    }

    private fun showContentConfirmation(onYes:()->Unit) {
        AlertDialog.Builder(this)
            .setTitle("Share message content?")
            .setMessage("This can include private message text from other apps. Turn it on only if the device user understands what will be shared with the parent account.")
            .setNegativeButton("Keep off",null)
            .setPositiveButton("Enable") { _,_ -> onYes() }
            .show()
    }

    private fun openNotificationAccess() {
        startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        Toast.makeText(this,"Enable LittleWatch, then return here.",Toast.LENGTH_LONG).show()
    }

    private fun hasNotificationAccess():Boolean {
        val flat = Settings.Secure.getString(contentResolver, "enabled_notification_listeners").orEmpty()
        val cn=ComponentName(this,NotificationCaptureService::class.java)
        return flat.split(":").any { it.equals(cn.flattenToString(),true) }
    }

    private fun confirmUnpair() {
        AlertDialog.Builder(this).setTitle("Unpair device?")
            .setMessage("Notification sharing will stop and this device will be removed from the parent account.")
            .setNegativeButton("Cancel",null)
            .setPositiveButton("Unpair"){_,_-> Thread{
                runCatching{ApiClient(prefs,secure).unpair()}
                secure.clear(); PendingStore(this).clear(); prefs.paired=false;prefs.sharingEnabled=false;prefs.contentSharingEnabled=false;prefs.deviceId=null
                ScheduleSync.cancel(this)
                StatusNotifier.stop(this)
                runOnUiThread{render()}
            }.start()}.show()
    }

    private fun primaryButton(text:String,onClick:()->Unit)=Button(this).apply{setText(text);setTextColor(getColor(android.R.color.white));setBackgroundColor(getColor(com.littlewatch.child.R.color.lw_accent));setOnClickListener{onClick()}}
    private fun secondaryButton(text:String,onClick:()->Unit)=Button(this).apply{setText(text);setTextColor(getColor(com.littlewatch.child.R.color.lw_text));setBackgroundColor(getColor(com.littlewatch.child.R.color.lw_panel_alt));setOnClickListener{onClick()}}
    private fun space(h:Int)=Space(this).apply{layoutParams=LinearLayout.LayoutParams(1,dp(h))}
    private fun dp(v:Int)= (v*resources.displayMetrics.density).toInt()
}
