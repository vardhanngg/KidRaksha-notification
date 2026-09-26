# KidRaksha Android Device Management

KidRaksha supports Android Device Owner / Device Policy Controller provisioning.

A normal Android app cannot reliably prevent a user from uninstalling it. When KidRaksha is successfully provisioned as Device Owner, it uses DevicePolicyManager.setUninstallBlocked() and Android enforces the uninstall restriction.

## Enrollment
Device Owner is established during Android managed provisioning, not through an ordinary runtime permission. Prepare the child phone for managed setup, provision the signed KidRaksha package through Android's supported managed enrollment flow, let Android invoke the provisioning handlers, then complete normal KidRaksha pairing and Notification Access setup.

## Developer test
On a dedicated test device, after installing KidRaksha:
```bash
adb shell dpm set-device-owner "com.kidraksha.child/.device.KidRakshaDeviceAdminReceiver"
adb shell dumpsys device_policy
```
Then test Settings > Apps > KidRaksha > Uninstall. The uninstall action should be blocked while Device Owner management is active.

Use the supported device-policy testing/deprovisioning flow or factory reset for cleanup. Do not expose a consumer-facing clear-device-owner control.

## Limits
This protects successfully managed devices at the Android policy layer. Factory reset, root access, bootloader/OEM servicing, and other device-level control are outside the normal app-level guarantee.
