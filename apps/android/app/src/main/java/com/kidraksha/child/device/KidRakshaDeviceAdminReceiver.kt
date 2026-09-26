package com.kidraksha.child.device
import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import com.kidraksha.child.ui.MainActivity
class KidRakshaDeviceAdminReceiver:DeviceAdminReceiver(){
 override fun onEnabled(context:Context,intent:Intent){super.onEnabled(context,intent);DevicePolicyController.enforceProtection(context)}
 override fun onProfileProvisioningComplete(context:Context,intent:Intent){super.onProfileProvisioningComplete(context,intent);DevicePolicyController.enforceProtection(context);runCatching{context.startActivity(Intent(context,MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP))}}
}