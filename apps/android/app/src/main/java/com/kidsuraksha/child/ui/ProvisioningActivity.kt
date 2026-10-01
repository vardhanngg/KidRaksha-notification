package com.kidsuraksha.child.ui
import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.Intent
import android.os.Bundle
import com.kidsuraksha.child.device.DevicePolicyController
class ProvisioningActivity:Activity(){
 override fun onCreate(state:Bundle?){super.onCreate(state);when(intent?.action){
  DevicePolicyManager.ACTION_GET_PROVISIONING_MODE->{val allowed=intent.getIntegerArrayListExtra(DevicePolicyManager.EXTRA_PROVISIONING_ALLOWED_PROVISIONING_MODES);val full=DevicePolicyManager.PROVISIONING_MODE_FULLY_MANAGED_DEVICE;if(allowed!=null&&!allowed.contains(full))setResult(RESULT_CANCELED)else setResult(RESULT_OK,Intent().putExtra(DevicePolicyManager.EXTRA_PROVISIONING_MODE,full));finish()}
  DevicePolicyManager.ACTION_ADMIN_POLICY_COMPLIANCE->{if(!DevicePolicyController.enforceProtection(this)){setResult(RESULT_CANCELED);finish();return};setResult(RESULT_OK);startActivity(Intent(this,MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP));finish()}
  else->finish()}}
}