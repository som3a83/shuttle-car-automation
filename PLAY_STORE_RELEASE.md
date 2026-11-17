# Play Store Release Procedure

**Release candidate:** Shuttle Car Automation 1.0.0  
**Application ID:** `com.shuttlecar.automation`

## 1. Google Play technical gate
As of 31 August 2026, new mobile apps and app updates submitted to Google Play must target Android 16 / API level 36 or higher. The release workflow explicitly sets and checks `compileSdkVersion` and `targetSdkVersion` to 36. This API 36 target is the current requirement for new mobile apps and updates from 31 August 2026. Recheck the official policy before every future release:  
https://support.google.com/googleplay/android-developer/answer/11926878

New Play apps must be uploaded as a signed Android App Bundle (AAB) and enrolled in Play App Signing. A debug APK is only for installation/testing; it is not the Play upload artifact. Official references:
- https://developer.android.com/guide/app-bundle/faq
- https://developer.android.com/studio/publish/app-signing

## 2. Create an upload keystore
Create and keep the upload keystore in a secure location outside this repository. Example:

```bash
keytool -genkeypair -v \
  -keystore shuttle-upload.jks \
  -alias shuttle-upload \
  -keyalg RSA -keysize 4096 \
  -validity 10000
```

Use a secure password and preserve the keystore plus passwords in a separate protected backup. Never commit them to GitHub or put them in app source code. When first uploading the AAB, enroll in Play App Signing and register this key as the upload key.

## 3. Configure GitHub Actions secrets
In the repository, open **Settings → Secrets and variables → Actions** and create:

- `ANDROID_KEYSTORE_BASE64`: base64 encoding of the `.jks` file.
- `ANDROID_KEYSTORE_PASSWORD`: keystore password.
- `ANDROID_KEY_ALIAS`: alias used above.
- `ANDROID_KEY_PASSWORD`: key password.

Example base64 conversion:
- macOS/Linux: `base64 -w 0 shuttle-upload.jks` (on macOS use `base64 shuttle-upload.jks | tr -d '\\n'`).
- Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes('shuttle-upload.jks'))`.

Only the encrypted GitHub Actions secrets should receive the output. Do not send private signing material in chat or commit it.

## 4. Build the signed AAB
After the secrets are configured, run **Actions → Android Play Store AAB → Run workflow** and supply:
- version_name: `1.0.0`
- version_code: `1000000`

Or push a version tag such as `v1.0.0`. Every later Play upload must use a strictly higher versionCode. The workflow runs TypeScript checks, tests and production build, generates/synchronizes the Capacitor Android project, enforces API 36, signs the release bundle and uploads the AAB plus SHA-256 checksum as a GitHub Actions artifact.

The workflow does not upload to Google Play automatically. Review the artifact and upload the signed `.aab` through Play Console.

## 5. Store listing and policy
Before submission:
1. Use this public privacy-policy URL in Play Console: https://github.com/som3a83/shuttle-car-automation/blob/main/PRIVACY_POLICY.md.
2. Review the privacy summary shown inside the application.
3. Prepare store listing text from `STORE_LISTING.md`.
4. Provide a 512 × 512 PNG app icon and a 1024 × 500 JPEG or 24-bit PNG feature graphic (no alpha channel).
5. Set the publisher's valid support email and contact details in Play Console; the publisher must supply these details.
6. Complete content rating, Data safety, target audience, app access, advertising and distribution declarations truthfully.
7. Capture genuine phone screenshots from the final signed release; add tablet screenshots if tablet support is advertised.
8. Test the signed release on physical Android devices and on supported screen sizes.
9. Review the generated AAB with Play Console's App Bundle Explorer before production rollout.

## 6. Current application scope
The current application is a local, single-device recordkeeping prototype. It has no shared cloud database, real user authentication, server-enforced roles, AI service, live PLC/telemetry connection or physical shuttle control. Do not advertise those capabilities. Industrial connectivity must remain read-only until vendor documentation, authorization and safety review are completed.
