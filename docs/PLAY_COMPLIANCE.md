
# Google Play / monitoring compliance checklist

KidSuraksha is designed specifically for parental monitoring of a child's device.

The Android application must:
- use the `isMonitoringTool` manifest metadata with `child_monitoring`
- clearly explain notification sharing before enabling it
- require the device user to enable Notification Access
- show a persistent notification while monitoring is active
- clearly identify the app
- not provide a stealth/hidden mode
- clearly disclose monitoring in store listing materials
- never be positioned as a way to secretly monitor another adult
- avoid bypassing Android's notification privacy or redaction behavior

The product should also keep notification collection limited to the stated parental use case and provide settings to stop sharing and unpair the device.

Policy compliance and legal obligations must be rechecked before every production/Play submission because platform rules can change.


## Current policy-relevant design choices

- The child app does not collect or transmit notification data until sharing is enabled after an in-app disclosure.
- Message content is separately opt-in.
- Notification Access is granted only through Android system settings.
- A persistent KidSuraksha status notification is maintained while sharing is active when Android notification permission allows it.
- There is no stealth mode and no attempt to bypass Android notification redaction or permission controls.
- Parent accounts expose data export and permanent account deletion from the web console.
