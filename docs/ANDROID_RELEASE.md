# KidSuraksha Android release

## Current build identity
- applicationId: `com.kidraksha.child`
- targetSdk: 36
- compileSdk: 36
- minSdk: 28
- current versionCode: 5
- current versionName: 1.4.0
- artifact: Android App Bundle (`.aab`)

## Required GitHub production secrets
- `ANDROID_KEYSTORE_B64` — base64-encoded release keystore
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

## Required GitHub production variables
- `ANDROID_API_URL` — HTTPS API origin
- `ANDROID_VERSION_CODE` — monotonically increasing integer
- `ANDROID_VERSION_NAME` — human-readable release version (for example `1.4.0`)

Never commit the keystore or password values. The release workflow reconstructs the keystore only inside the ephemeral CI runner and deletes it when the job ends.

## Release flow
1. Verify the release checklist.
2. Update versionCode/versionName variables.
3. Run the Android release workflow.
4. Verify the AAB SHA-256 artifact.
5. Upload the AAB to the intended Play Console track.
6. Complete the Play declarations and review materials.
7. Run the physical-device acceptance matrix.

The current Google Play submission requirement for new apps and app updates is target API 36 or higher from August 31, 2026. KidSuraksha targets API 36.
