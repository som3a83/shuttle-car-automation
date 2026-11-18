# Shuttle Car Automation — Final Integration and Build Report
Updated: 18 November 2026

## Repository result

- Repository: https://github.com/som3a83/shuttle-car-automation
- Default branch: `main`
- Merge commit: `a10d0efb8c986cc84d6e5c6ae7325819578a2623`
- Merged PR: #47 — storage migration orchestration and industrial viewer safeguards.
- Superseded draft PR: #46 — closed without merge to prevent duplicate integration.
- PR #47 was squash-merged only after its full CI, Android emulator, CAD and security checks passed.

## What was integrated

1. Seven Phase 2B-4a-2 IndexedDB migration-generation/orchestration modules and their tests.
2. Canonical local-account, audit, audit-archive and customization types in storage schema definitions.
3. Asynchronous UI test corrections for notification dismissal, fleet registration and shuttle archive/restore.
4. Keyboard rotation/reset and interaction guidance for shuttle and battery 3D viewers.
5. A safety gate for wheel motion: simulation starts disabled and can be enabled only when the recorded state is `Running`. The interface labels it simulated, not live.
6. Updated project execution and GitHub security documentation.

The uploaded Anila archive was not copied over the newer application tree: its source baseline was 36 commits behind the then-current `main`. Only reviewed changes were carried across.

## Verified main-branch workflow results

All checks below completed successfully for merge commit `a10d0efb8c986cc84d6e5c6ae7325819578a2623`:

| Workflow | Run ID | Result |
|---|---:|---|
| Shuttle Car Automation CI: TypeScript, full test suite, release config, store assets and production build | 44309184782 | PASS |
| CodeQL JavaScript/TypeScript | 44309184966 | PASS |
| Secret Leak Scan | 44309185052 | PASS |
| Industrial read-only gateway validation | 44309184706 | PASS |
| Parametric CAD validation: shuttle + battery | 44309184851 | PASS |
| Android Debug APK + install/launch/emulator smoke test | 44309185073 | PASS |
| Android Debug APK packaging + checksum | 44309184828 | PASS |

Dependency Review and Phase 2B-1 storage tests also passed on the PR #47 head before merge.

## Build deliverables

### Android debug APK

- GitHub artifact: `shuttle-car-automation-1.0.0-debug-apk`
- Artifact ID: `14428554218`
- File: `shuttle-car-automation-1.0.0-debug.apk`
- Size: 5,332,016 bytes
- SHA-256: `5fae4943de7744776ea2744daa648bcc46a494ea6e98bcfa62e1a416553075b5`

### Android emulator evidence

- Artifact: `shuttle-android-emulator-evidence`
- Artifact ID: `14429632301`
- Contains dashboard screenshot, engineering-view screenshot, activity information, display metrics, launch result and device logcat.
- Emulator workflow installed and launched the app and completed its smoke checks successfully.

### Parametric CAD

- Artifact: `shuttle-parametric-cad-reference`
- Artifact ID: `14430015938`
- Contains editable OpenSCAD source for the shuttle reference assembly and lithium battery pack, plus rendered STL outputs.
- These are conceptual reference models, not manufacturer-certified CAD.

## Security, privacy and industrial boundary

- The active `main` ruleset (ID `27423825`) requires pull requests and rejects non-fast-forward changes.
- It still does not require status checks, an independent approval, CODEOWNERS approval or review-thread resolution. The repository protection guide records the missing gates. A repository administrator must complete these settings because the available GitHub integration had no ruleset-write operation.
- Dependency Review remains temporarily non-blocking while GitHub Dependency Graph is unavailable. The previously observed picomatch advisory remains a dependency follow-up; a green workflow does not mean that advisory has been patched.
- `PRIVACY_POLICY.md` contains Arabic and English disclosures. It accurately describes device-local records, absence of publisher cloud synchronization, the optional separate read-only OT gateway, and the lack of in-app advertising/analytics.
- No physical shuttle is connected by this build. The app does not issue PLC writes, movement, charge or reset commands.

## Not yet a Google Play release

The successful APK is a **debug/testing build**, not a signed Play Store AAB. The release workflow exists at `.github/workflows/android-release.yml` and builds a signed AAB/APK only after these GitHub Actions secrets are configured:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

No signed AAB workflow was run and no Play Console upload is claimed. Before publishing, complete the signing setup, verify the final privacy-policy URL, store listing, screenshots/feature graphic, Data safety, content rating, target audience and app-access declarations, then test the signed release on physical Android devices.
