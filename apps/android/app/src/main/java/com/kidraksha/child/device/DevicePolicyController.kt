package com.kidraksha.child.device
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
object DevicePolicyController {
 data class ProtectionStatus(val deviceOwner:Boolean,val uninstallBlocked:Boolean){val protected get()=deviceOwner&&uninstallBlocked}
 fun adminComponent(context:Context)=ComponentName(context,KidSurakshaDeviceAdminReceiver::class.java)
 fun isDeviceOwner(context:Context)=context.getSystemService(DevicePolicyManager::class.java)?.isDeviceOwnerApp(context.packageName)==true
 fun enforceProtection(context:Context):Boolean{
  val manager=context.getSystemService(DevicePolicyManager::class.java)?:return false
  if(!manager.isDeviceOwnerApp(context.packageName))return false
  return runCatching{manager.setUninstallBlocked(adminComponent(context),context.packageName,true);manager.setOrganizationName(adminComponent(context),"KidSuraksha");true}.getOrDefault(false)
 }
 fun protectionStatus(context:Context):ProtectionStatus{
  val manager=context.getSystemService(DevicePolicyManager::class.java)?:return ProtectionStatus(false,false)
  if(!manager.isDeviceOwnerApp(context.packageName))return ProtectionStatus(false,false)
  return ProtectionStatus(true,runCatching{manager.isUninstallBlocked(adminComponent(context),context.packageName)}.getOrDefault(false))
 }
}