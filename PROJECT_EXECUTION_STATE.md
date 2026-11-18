# Project Execution State — Verified Main Integration
Updated: 18 November 2026
Repository: `som3a83/shuttle-car-automation`
Default branch: `main`
Verified main commit: `a10d0efb8c986cc84d6e5c6ae7325819578a2623`

## Current authoritative status

- Pull Request **#47** was squash-merged into `main`. Merge commit: `a10d0efb8c986cc84d6e5c6ae7325819578a2623`.
- The older draft PR **#46** was closed without merging because its migration orchestration changes were carried into PR #47; no duplicate merge remains open.
- The integration branch was based on the then-current `main`, was not behind `main`, and no force-push or history rewrite was used.
- The Anila archive baseline `faff09f63779e70074209dd1d8f808768a2c6021` was 36 commits behind the current `main` when reviewed. The archive was not overlaid wholesale; relevant changes were selectively reviewed and integrated.

## Integrated work

1. Added the seven Phase 2B-4a-2 IndexedDB generation/migration orchestration source and test files.
2. Replaced permissive storage placeholders with canonical application types for local accounts, audit entries, audit-archive entries and customization.
3. Corrected asynchronous UI tests for notification dismissal, shuttle archiving and fleet registration so assertions wait for the committed React state.
4. Added keyboard rotation/reset controls and accessibility hints to the conceptual shuttle and battery 3D viewers.
5. Disabled unsolicited shuttle motion. Visual wheel simulation now requires both explicit user activation and the recorded shuttle state `Running`; UI labels clearly say the motion is simulated and not live.
6. Added responsive 3D interaction guidance and kept the fallback view subject to the same motion gate.
7. Updated the engineering integration report and GitHub protection instructions to reflect the actual repository state.

## Verified CI on merged main

All the following runs completed successfully on commit `a10d0efb8c986cc84d6e5c6ae7325819578a2623`:

| Check | Run ID | Result |
|---|---:|---|
| TypeScript, automated tests, release-config validation, store asset generation and production build | 44309184782 | PASS |
| CodeQL JavaScript/TypeScript | 44309184966 | PASS |
| Secret Leak Scan | 44309185052 | PASS |
| Industrial read-only gateway validation | 44309184706 | PASS |
| Parametric CAD: shuttle and lithium battery rendering | 44309184851 | PASS |
| Android Debug APK build and emulator install/launch/smoke test | 44309185073 | PASS |
| Android Debug APK packaging and SHA-256 generation | 44309184828 | PASS |

The PR #47 run also passed Dependency Review and Phase 2B-1 storage tests before the merge. The current main build produced a debug APK and the Android emulator evidence. The CAD workflow produced editable OpenSCAD sources and rendered STL meshes.

## Verified delivery artifacts

- APK artifact: `shuttle-car-automation-1.0.0-debug-apk`, GitHub artifact ID `14428554218`.
- APK file: `shuttle-car-automation-1.0.0-debug.apk`, 5,332,016 bytes.
- APK SHA-256: `5fae4943de7744776ea2744daa648bcc46a494ea6e98bcfa62e1a416553075b5`.
- Android emulator evidence artifact: `shuttle-android-emulator-evidence`, ID `14429632301`.
- CAD source and STL artifact: `shuttle-parametric-cad-reference`, ID `14430015938`.

The debug APK is for installation and testing. It is not the signed Android App Bundle required for a Google Play production submission.

## Release readiness: remaining gates

1. A signed AAB has not yet been built or uploaded. The repository contains `.github/workflows/android-release.yml`; it requires the four upload-signing secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`. This session did not inspect the secret values or run a signed release workflow.
2. The Play Console listing still needs its publisher account details, data-safety declarations, content rating, target-audience and app-access declarations, final store screenshots/feature graphic, and review.
3. A physical Android device test and site-specific commissioning have not been completed.
4. No Cassioli, Craftsman or ACME manufacturer driver, confirmed PLC tag/register map or commissioned physical shuttle connection is included. The app remains a local recordkeeping/visualization system with read-only gateway architecture; no movement, charging, reset or PLC-write control is enabled.
5. The active `main` repository ruleset (ID `27423825`) requires pull requests and rejects non-fast-forward updates, but it does not yet require CI status checks, approvals, CODEOWNERS review or resolved review threads. The GitHub integration used here had no ruleset-write operation; a repository administrator must enable those gates in GitHub Settings.
6. Dependency Review remains non-blocking while Dependency Graph is unavailable. The known picomatch advisory should be rechecked when an upstream patched release is available; do not suppress or misreport the audit warning.

## Product and data boundary

- Current version candidate: `1.0.0`; Android application ID: `com.shuttlecar.automation`.
- The app stores records locally on the current device and has no publisher-hosted cloud database or cross-device synchronization.
- Local accounts and client-side role checks are not server-enforced enterprise identity.
- The optional OT gateway is separately operated and intended for authorized read-only telemetry. No live vendor telemetry is claimed until the appropriate manufacturer documentation, adapter and site commissioning exist.
- Shuttle and battery 3D/CAD representations are reference models, not manufacturer-certified drawings or fabrication instructions.
- The bilingual privacy policy is maintained at `PRIVACY_POLICY.md`; public URL: https://github.com/som3a83/shuttle-car-automation/blob/main/PRIVACY_POLICY.md.

## Historical note

The previous 17 November assessment described a locally modified source archive that had not yet been pushed and had not been tested with the full application toolchain. That assessment is superseded by the merged main commit and the successful CI, Android emulator and CAD workflows listed above. Its architectural observations about device-local storage and the industrial safety boundary remain applicable.
