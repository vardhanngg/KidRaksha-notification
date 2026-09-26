package com.kidraksha.child.ui

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.app.NotificationManager
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import android.widget.*
import com.kidraksha.child.BuildConfig
import com.kidraksha.child.data.Prefs
import com.kidraksha.child.R
import com.kidraksha.child.data.PendingStore
import com.kidraksha.child.data.SecureStore
import com.kidraksha.child.network.ApiClient
import com.kidraksha.child.service.NotificationCaptureService
import com.kidraksha.child.service.StatusNotifier
import com.kidraksha.child.sync.SyncScheduler
import com.kidraksha.child.sync.SyncManager

class MainActivity : Activity() {
    private lateinit var prefs: Prefs
    private lateinit var secure: SecureStore
    private lateinit var root: LinearLayout
    private lateinit var primary: Button
    private var rendering = false

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        window.setFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE, android.view.WindowManager.LayoutParams.FLAG_SECURE)
        prefs = Prefs(this)
        secure = SecureStore(this)
        window.statusBarColor = getColor(R.color.kd_bg)
        window.navigationBarColor = getColor(R.color.kd_bg)
        window.decorView.systemUiVisibility = 0
        render()
    }

    override fun onResume() {
        super.onResume()
        val access = hasNotificationAccess()
        val visibleStatus = !prefs.paired || StatusNotifier.canDisplay(this)
        if (prefs.paired && prefs.sharingEnabled && (!access || !visibleStatus)) {
            prefs.sharingEnabled = false
            prefs.contentSharingEnabled = false
            SyncManager.run(this)
        }
        if (prefs.paired && prefs.pendingEnableAfterAccess && access) {
            if (needsPostNotificationsPermission()) {
                requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_NOTIFICATIONS)
            } else {
                finishEnableAfterAccess()
            }
        }
        StatusNotifier.refresh(this)
        if (!rendering) render()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQUEST_NOTIFICATIONS) return
        if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED && hasNotificationAccess()) {
            finishEnableAfterAccess()
        } else {
            prefs.pendingEnableAfterAccess = false
            prefs.sharingEnabled = false
            prefs.contentSharingEnabled = false
            StatusNotifier.refresh(this)
            render()
            Toast.makeText(this, "Sharing stays off until KidRaksha can show its required status notification.", Toast.LENGTH_LONG).show()
        }
    }

    private fun render() {
        rendering = true
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(22), dp(24), dp(30))
            setBackgroundColor(getColor(R.color.kd_bg))
            setOnApplyWindowInsetsListener { view, insets ->
                val bars = if (Build.VERSION.SDK_INT >= 30) insets.getInsets(android.view.WindowInsets.Type.systemBars()) else null
                val top = bars?.top ?: insets.systemWindowInsetTop
                val bottom = bars?.bottom ?: insets.systemWindowInsetBottom
                view.setPadding(dp(24), dp(22) + top, dp(24), dp(30) + bottom)
                insets
            }
        }
        val scroll = ScrollView(this).apply { setBackgroundColor(getColor(R.color.kd_bg)); addView(root, ScrollView.LayoutParams(-1, -2)) }
        setContentView(scroll)

        root.addView(TextView(this).apply {
            text = "KR  KidRaksha"
            textSize = 21f
            setTextColor(getColor(R.color.kd_text))
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        })

        if (!prefs.paired) renderPairingState() else renderConnectedState()
        rendering = false
    }

    private fun renderPairingState() {
        root.addView(stepHeader(1, "Connect this device"))
        root.addView(title("Connect this device"))
        root.addView(body("Your parent will give you an 8-character KidRaksha pairing code. This code connects this phone to the correct family account."))
        root.addView(space(22))
        primary = primaryButton("Enter pairing code") { showPairDialog() }
        root.addView(primary)
        root.addView(space(12))
        root.addView(infoCard("Before you continue", "KidRaksha only receives notifications after you explicitly enable Notification Access. Message content is a separate choice."))
        root.addView(space(12))
        root.addView(secondaryButton("How this works") { showDisclosure(readOnly = true) })
        root.addView(space(8))
        root.addView(secondaryButton("Privacy and data") { showPrivacy() })
    }

    private fun renderConnectedState() {
        val access = hasNotificationAccess()
        val statusReady = StatusNotifier.canDisplay(this)
        val sharing = prefs.sharingEnabled && access && statusReady
        val content = prefs.contentSharingEnabled && sharing
        val step = when {
            !access -> 2
            !statusReady -> 3
            !prefs.sharingEnabled -> 3
            else -> 4
        }
        root.addView(stepHeader(step, if (sharing) "Protected and connected" else "Finish setup"))
        root.addView(title(if (sharing) "KidRaksha is protecting this connection." else "Finish connecting this phone."))
        root.addView(body("Device: ${prefs.deviceName}\nYour parent account can see the status of this device and, when sharing is on, the notifications you have chosen to share."))
        root.addView(space(18))
        root.addView(statusCard("Parent connection", "Connected", true))
        root.addView(space(8))
        root.addView(statusCard("Notification Access", if (access) "Connected" else "Needs access", access))
        root.addView(space(8))
        root.addView(statusCard("Visible status", if (statusReady) "Ready" else "Needs notification permission", statusReady))

        if (!access) {
            root.addView(space(18))
            primary = primaryButton("Enable Notification Access") { openNotificationAccess() }
            root.addView(primary)
            root.addView(space(10))
            root.addView(body("Android opens its system settings. Find KidRaksha and allow notification access, then return here."))
        } else if (!statusReady) {
            root.addView(space(18))
            primary = primaryButton(if (needsPostNotificationsPermission()) "Allow status notification" else "Open notification settings") {
                if (needsPostNotificationsPermission()) requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_NOTIFICATIONS)
                else openAppNotificationSettings()
            }
            root.addView(primary)
            root.addView(space(10))
            root.addView(body("KidRaksha keeps a visible status notification while sharing is active."))
        } else if (!prefs.sharingEnabled) {
            root.addView(space(18))
            primary = primaryButton("Turn on notification sharing") { enableSharing() }
            root.addView(primary)
            root.addView(space(10))
            root.addView(body("You can turn sharing off at any time from this phone."))
        } else {
            root.addView(space(18))
            val contentBox = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(16), dp(14), dp(8), dp(14))
                setBackgroundColor(getColor(R.color.kd_panel_alt))
            }
            val row = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
            val textBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; layoutParams = LinearLayout.LayoutParams(0, -2, 1f) }
            textBox.addView(TextView(this).apply { text="Include message content"; textSize=16f; setTextColor(getColor(R.color.kd_text)); setTypeface(typeface, android.graphics.Typeface.BOLD) })
            textBox.addView(TextView(this).apply { text="May include private notification titles and message text."; textSize=12f; setTextColor(getColor(R.color.kd_muted)); setPadding(0,dp(4),0,0) })
            val sw = Switch(this).apply { isChecked = content }
            sw.setOnCheckedChangeListener { _, enabled ->
                if (enabled && !prefs.contentSharingEnabled) showContentConfirmation {
                    prefs.contentSharingEnabled = true
                    SyncManager.run(this)
                    render()
                } else if (!enabled && prefs.contentSharingEnabled) {
                    prefs.contentSharingEnabled = false
                    PendingStore(this).clear()
                    SyncManager.run(this)
                    render()
                }
            }
            row.addView(textBox); row.addView(sw); contentBox.addView(row); root.addView(contentBox)

            root.addView(space(12))
            root.addView(statusCard("Notification sharing", "Active", true))
            root.addView(space(8))
            root.addView(secondaryButton("Pause sharing") { disableSharing() })
            root.addView(space(8))
            root.addView(secondaryButton("Notification Access settings") { openNotificationAccess() })
            root.addView(space(8))
            val pending = PendingStore(this).count()
            val sync = if (prefs.syncLastSuccessAt > 0L) "Last successful sync: ${java.text.DateFormat.getDateTimeInstance().format(java.util.Date(prefs.syncLastSuccessAt))}" else "No successful sync yet"
            root.addView(statusCard("Sync", if (pending > 0) "$pending notification${if (pending == 1) "" else "s"} waiting · $sync" else sync, prefs.syncFailureCount == 0))
            root.addView(secondaryButton("Sync now") { SyncManager.run(this); Toast.makeText(this,"Sync requested",Toast.LENGTH_SHORT).show() })
            root.addView(space(8))
            root.addView(secondaryButton("Privacy and data") { showPrivacy() })
            root.addView(space(8))
            root.addView(secondaryButton("Unpair this device") { confirmUnpair() })
        }
        root.addView(space(18))
        root.addView(infoCard("Your control", "KidRaksha cannot turn Notification Access on for you. If you revoke access, sharing stops. Message content remains off unless you explicitly enable it."))
    }

    private fun showPairDialog() {
        val box = LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(dp(6),0,dp(6),0) }
        val code = EditText(this).apply { hint="8-character code"; inputType=android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS; setSingleLine(true); filters=arrayOf(android.text.InputFilter.LengthFilter(8)) }
        val name = EditText(this).apply { hint="Device name, e.g. Aarav's phone"; setSingleLine(true); setText(android.os.Build.MODEL ?: "Android device") }
        box.addView(code); box.addView(space(10)); box.addView(name)
        val dialog = AlertDialog.Builder(this)
            .setTitle("Connect to your parent")
            .setMessage("Enter the one-time code from the parent dashboard.")
            .setView(box)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Connect", null)
            .create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val c=code.text.toString().trim().uppercase()
                val n=name.text.toString().trim()
                if(!c.matches(Regex("[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}"))){code.error="Enter the 8-character code";return@setOnClickListener}
                if(n.isBlank()){name.error="Enter a device name";return@setOnClickListener}
                dialog.getButton(AlertDialog.BUTTON_POSITIVE).isEnabled=false
                Thread {
                    runCatching {
                        val result=ApiClient(prefs,secure).pair(c,n,BuildConfig.VERSION_NAME)
                        secure.setToken(result.token)
                        prefs.deviceId=result.deviceId
                        prefs.deviceName=n
                        prefs.paired=true
                        prefs.sharingEnabled=false
                        prefs.contentSharingEnabled=false
                    }.onSuccess {
                        SyncManager.run(this)

                        runOnUiThread { dialog.dismiss(); render(); showDisclosure(readOnly=false) }
                    }.onFailure { e ->
                        runOnUiThread { dialog.getButton(AlertDialog.BUTTON_POSITIVE).isEnabled=true; Toast.makeText(this,e.message ?: "Pairing failed",Toast.LENGTH_LONG).show() }
                    }
                }.start()
            }
        }
        dialog.show()
    }

    private fun showDisclosure(readOnly: Boolean) {
        val message = "KidRaksha is a parental monitoring app. When sharing is enabled, Android's Notification Access service can receive notifications from other apps and send selected notification data to the paired parent account. Message content is optional. A persistent KidRaksha notification identifies when sharing is active."
        AlertDialog.Builder(this)
            .setTitle(if(readOnly) "How notification sharing works" else "Before you enable sharing")
            .setMessage(message)
            .setNegativeButton(if(readOnly) "Close" else "Not now",null)
            .setPositiveButton(if(readOnly) "Got it" else "Continue") { _,_ -> if(!readOnly) enableSharing() }
            .show()
    }

    private fun showContentConfirmation(onYes:()->Unit) {
        AlertDialog.Builder(this)
            .setTitle("Share message content?")
            .setMessage("This can include private message text, previews, codes, or other sensitive notification content from apps on this phone. Only enable it when the device user understands what will be shared with the parent account.")
            .setNegativeButton("Keep off",null)
            .setPositiveButton("Enable") { _,_ -> onYes() }
            .show()
    }

    private fun enableSharing() {
        if (!hasNotificationAccess()) { openNotificationAccess(); return }
        if (needsPostNotificationsPermission()) {
            prefs.pendingEnableAfterAccess=true
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_NOTIFICATIONS)
            return
        }
        if (!StatusNotifier.canDisplay(this)) {
            openAppNotificationSettings()
            return
        }
        finishEnableAfterAccess()
    }

    private fun finishEnableAfterAccess() {
        prefs.pendingEnableAfterAccess=false
        prefs.sharingEnabled=true
        SyncManager.run(this)
        StatusNotifier.refresh(this)
        render()
    }

    private fun disableSharing() {
        prefs.sharingEnabled=false
        prefs.pendingEnableAfterAccess=false
        prefs.contentSharingEnabled=false
        PendingStore(this).clear()
        StatusNotifier.refresh(this)
        SyncScheduler.cancelAll(this)
        SyncManager.run(this)
        render()
    }

    private fun hasNotificationAccess(): Boolean {
        val manager=getSystemService(NotificationManager::class.java) ?: return false
        val component=ComponentName(this,NotificationCaptureService::class.java)
        return manager.isNotificationListenerAccessGranted(component)
    }

    private fun needsPostNotificationsPermission():Boolean = Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED

    private fun openNotificationAccess() {
        val component=ComponentName(this,NotificationCaptureService::class.java)
        val detailIntent=Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS).apply { putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME,component) }
        try { startActivity(detailIntent) }
        catch (_:Exception) { startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) }
        Toast.makeText(this,"Enable KidRaksha, then return here.",Toast.LENGTH_LONG).show()
    }

    private fun openAppNotificationSettings() {
        startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
            putExtra(Settings.EXTRA_APP_PACKAGE,packageName)
        })
    }

    private fun confirmUnpair() {
        AlertDialog.Builder(this).setTitle("Unpair this device?")
            .setMessage("KidRaksha will stop sharing and remove this phone from the parent account. Pending unsent notifications will be deleted from this phone.")
            .setNegativeButton("Cancel",null)
            .setPositiveButton("Unpair") { _,_ ->
                Thread {
                    val result=runCatching { ApiClient(prefs,secure).unpair() }
                    runOnUiThread {
                        if (result.isFailure) {
                            Toast.makeText(this,"Could not reach the parent service. Try again when online.",Toast.LENGTH_LONG).show()
                        } else {
                            secure.clear(); PendingStore(this).clear(); prefs.paired=false; prefs.sharingEnabled=false; prefs.contentSharingEnabled=false; prefs.pendingEnableAfterAccess=false; prefs.deviceId=null
                            SyncScheduler.cancelAll(this); StatusNotifier.stop(this); render()
                        }
                    }
                }.start()
            }.show()
    }

    private fun stepHeader(step:Int,label:String)=TextView(this).apply {
        text="SETUP  $step OF 4  ·  $label"
        textSize=11f; setTextColor(getColor(R.color.kd_accent)); setTypeface(typeface,android.graphics.Typeface.BOLD)
        setPadding(0,dp(30),0,dp(8))
    }

    private fun title(text:String)=TextView(this).apply { this.text=text; textSize=31f; setTextColor(getColor(R.color.kd_text)); setTypeface(typeface,android.graphics.Typeface.BOLD); setPadding(0,dp(6),0,dp(8)) }
    private fun body(text:String)=TextView(this).apply { this.text=text; textSize=15f; setTextColor(getColor(R.color.kd_muted)); setLineSpacing(0f,1.35f) }
    private fun infoCard(title:String,text:String)=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(dp(16),dp(14),dp(16),dp(14)); setBackgroundColor(getColor(R.color.kd_panel_alt)); addView(TextView(this@MainActivity).apply{text=title;textSize=14f;setTextColor(getColor(R.color.kd_text));setTypeface(typeface,android.graphics.Typeface.BOLD)}); addView(TextView(this@MainActivity).apply{text=textSizeNullSafe(text);textSize=12f;setTextColor(getColor(R.color.kd_muted));setPadding(0,dp(5),0,0)}) }
    private fun textSizeNullSafe(text:String)=text
    private fun statusCard(label:String,value:String,ok:Boolean)=LinearLayout(this).apply { orientation=LinearLayout.HORIZONTAL; gravity=Gravity.CENTER_VERTICAL; setPadding(dp(16),dp(13),dp(16),dp(13)); setBackgroundColor(getColor(if(ok) R.color.kd_panel else R.color.kd_panel_alt)); val left=LinearLayout(this@MainActivity).apply{orientation=LinearLayout.VERTICAL;layoutParams=LinearLayout.LayoutParams(0,-2,1f)}; left.addView(TextView(this@MainActivity).apply{text=label;textSize=13f;setTextColor(getColor(R.color.kd_text));setTypeface(typeface,android.graphics.Typeface.BOLD)}); left.addView(TextView(this@MainActivity).apply{text=value;textSize=12f;setTextColor(getColor(if(ok) R.color.kd_green else R.color.kd_muted));setPadding(0,dp(4),0,0)}); addView(left); addView(TextView(this@MainActivity).apply{text=if(ok) "✓" else "•";textSize=20f;setTextColor(getColor(if(ok) R.color.kd_green else R.color.kd_muted))}) }
    private fun primaryButton(text:String,onClick:()->Unit)=Button(this).apply{setText(text);setTextColor(getColor(android.R.color.white));setBackgroundColor(getColor(R.color.kd_accent));setOnClickListener{onClick()}}
    private fun secondaryButton(text:String,onClick:()->Unit)=Button(this).apply{setText(text);setTextColor(getColor(R.color.kd_text));setBackgroundColor(getColor(R.color.kd_panel_alt));setOnClickListener{onClick()}}
    private fun space(h:Int)=Space(this).apply{layoutParams=LinearLayout.LayoutParams(1,dp(h))}
    private fun dp(v:Int)= (v*resources.displayMetrics.density).toInt()

    companion object { private const val REQUEST_NOTIFICATIONS=7001 }
}
