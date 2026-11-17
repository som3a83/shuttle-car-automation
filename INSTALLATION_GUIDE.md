# Installation and Release Guide — Shuttle Car Automation 1.0.0

This guide applies to the current React/TypeScript/Capacitor implementation on the feature branch and the pull request targeting `main`. It replaces the historical V4 ZIP-only installation instructions below.

## 1. Requirements

- Node.js 22 or newer.
- npm.
- Git.
- Android Studio/Android SDK only when building locally for Android.

## 2. Run the web app

```bash
git clone https://github.com/som3a83/shuttle-car-automation.git
cd shuttle-car-automation
git switch copilot/complete-shuttle-automation-v6
npm install
npm run dev
```

Use the local URL printed by Vite.

## 3. Run checks and build

```bash
npm run check
npm test
npm run build
npm run assets:render
```

The CI pipeline runs TypeScript, Vitest, the production bundle and store-artwork rendering. Check the workflow run corresponding to the exact commit you intend to release.

## 4. Build a local Android debug APK

```bash
npm install
npm run build
npx cap add android
npx capacitor-assets generate --android --iconBackgroundColor '#111820' --iconBackgroundColorDark '#111820' --splashBackgroundColor '#111820' --splashBackgroundColorDark '#111820'
npx cap sync android
cd android
./gradlew assembleDebug
```

The debug APK is created at:

`android/app/build/outputs/apk/debug/app-debug.apk`

This is an evaluation build, not a Play Store upload bundle.

## 5. Get the APK from GitHub Actions

Open **Actions → Build Android Debug APK** and select the successful run for the exact release commit. Download the `shuttle-car-automation-debug-apk` artifact. Review the separate emulator evidence artifact. Do not use an APK from an earlier commit after the source has changed.

The **Package Android Debug APK** workflow creates an APK plus SHA256 checksum. Compare the downloaded file against the checksum before installation.

## 6. Produce the signed Google Play AAB

1. Create an Android upload keystore and securely store at least two independent backups of the keystore and passwords. Do not upload the keystore file into Git or attach it to a public issue.
2. Open repository **Settings → Secrets and variables → Actions** and add:
   - `ANDROID_KEYSTORE_BASE64`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`
3. Open **Actions → Android Play Store AAB → Run workflow**.
4. Enter the semantic version and an unused, strictly increasing Android `versionCode`.
5. Download the `shuttle-car-automation-play-aab` artifact only after the workflow succeeds. Verify the attached SHA256 checksum and confirm the AAB signature.
6. Upload the signed AAB in Google Play Console. Play App Signing enrollment and all publisher declarations are completed in Play Console, not in this repository.

The workflow targets compile/target API 36. Verify the current Google Play target API requirement again when releasing a later version.

Detailed signing and release instructions are in [PLAY_STORE_RELEASE.md](PLAY_STORE_RELEASE.md).

## 7. Store graphics

The repository contains vector sources in `assets/`. Run:

```bash
npm run assets:render
```

This produces:

- `artifacts/store-listing/icon-512.png`
- `artifacts/store-listing/feature-graphic-1024x500.png`
- PWA icons in `public/`

CI uploads the two Google Play graphics as `shuttle-car-automation-store-artwork`. Obtain genuine screenshots from the app running on the intended release build. A feature graphic or store icon is not a substitute for app screenshots.

## 8. Store declarations and policy

Before submission, the publisher must:

- Publish [PRIVACY_POLICY.md](PRIVACY_POLICY.md) at a stable public HTTPS page and enter that URL in Play Console.
- Add support contact details.
- Complete content rating, target audience, data safety, app access, ads and country distribution forms accurately.
- Verify all store screenshots, icon, feature graphic, app name and descriptions.
- Test the signed release on physical Android devices.

Listing text is in [STORE_LISTING.md](STORE_LISTING.md).

## 9. Current scope and limitations

This release is a local single-device recordkeeping app. It has no app-operated backend, cloud database, account login, secure server-enforced roles, connected AI diagnosis, real PLC/manufacturer telemetry or machine-control interface. Its 3D engineering models are conceptual, not vendor-certified CAD. These limitations are stated in the app, privacy policy, terms and Play listing. Do not submit marketing material that implies otherwise.
