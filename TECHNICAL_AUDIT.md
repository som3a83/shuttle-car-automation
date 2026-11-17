# Technical Audit — current main baseline

**Audit date:** 17 November 2026  
**Repository:** `som3a83/shuttle-car-automation`  
**Official branch:** `main`  
**Audited commit:** `28eeca047863d39b1126a1e3116640ac791f65f2`  
**Status:** Engineering baseline is integrated; production release and physical commissioning are not complete.

## 1. Scope and evidence

This audit snapshot supersedes the repository-access-stage report dated 15 November 2026. It is based on the current GitHub main tree, current pull-request and branch metadata, the main-branch CI/security workflow results, and targeted source review of the application entry point, local authentication, permission checks, operational storage, audit ledger, Security Center, Android workflow, and industrial gateway.

The recursive main tree returned 118 entries including directories (106 files and 12 directories), with `truncated=false`. The default branch is `main`. The repository is currently public. This is a targeted engineering audit of the current source and workflows, not a claim that every visible UI control has been manually exercised on physical devices.

## 2. Repository integration state

- PR #23 — local identity, permission gates, audit integrity and recoverable storage — **merged** into `main` at `f7574cf5db3cfa636d0dae957e1b254cea68b369`.
- PR #24 — Android emulator KVM access and smoke-test script correction — **merged** into `main` at `28eeca047863d39b1126a1e3116640ac791f65f2`.
- PR #22 — read-only industrial telemetry gateway and app client — merged.
- PR #21 — industrial UI customization — merged.
- PR #20 — commissioning baseline and five-asset register — merged.
- Earlier application foundation PRs #1 and #2 are also merged.
- `main` is the official source of truth. No old development branch should be merged wholesale: several branches are divergent or duplicate already-integrated content.
- The repository ruleset named `main` exists but its enforcement is **disabled**. No branch in the current branch listing reports protected status.
- Eight Dependabot PRs remain open (#10, #13–#19 excluding #11/#12). They are not approved for blanket merging. In particular, the React and React DOM upgrades are split across separate PRs, and TypeScript 7 is a major-version change; compatibility must be validated as a coordinated dependency update.

## 3. Validation evidence

On the audited main commit:

| Check | Observed result |
|---|---|
| TypeScript, automated tests, dependency audit and production web build (run 44070837675) | Passed |
| Industrial gateway security/validation workflow (run 44070837474) | Passed |
| Secret leak scan (run 44070837435) | Passed |
| CodeQL security scan (run 44070837417) | Passed |
| Android debug APK build and emulator smoke (PR #24 run 44073395778) | Passed: APK assembled, accelerated emulator booted, APK installed/launched, process verified, screenshot/log evidence uploaded |
| Main post-merge CI (run 44074458927) | Passed |
| Main post-merge CodeQL (run 44074458926) | Passed |
| Main post-merge secret scan (run 44074458837) | Passed |
| Fresh Android run on merged main (run 44074458921) | Passed: all Android setup/build/KVM/emulator install/launch/evidence-upload steps completed successfully |

The PR #24 Android run completed the emulator smoke test successfully: the accelerated emulator booted, installed the APK, launched the main activity, verified the app process, captured a screenshot and uploaded emulator logs. The post-merge main Android run is still being checked independently. A debug build is not a signed Google Play release.

## 4. Application capabilities present in source

The current application includes fleet records, shuttle engineering views, battery register and assignment lifecycle, fault reports and corrective actions, maintenance work orders, shift handover, connection register, read-only gateway client, reports/exports, notifications, user/security center, local customization and recovery UI.

The app has Arabic/English UI, responsive navigation, conceptual SVG engineering views for shuttle and battery assemblies, and local operational persistence. The main source contains explicit demo/local/unverified disclosures.

## 5. Security and data boundaries

Implemented:
- Device-local first-admin bootstrap and local account sign-in.
- PBKDF2-SHA-256 password derivation with per-account salt.
- Eight-hour local sessions, failed-login lockout and session identity/role re-resolution from the local account registry.
- Central role/permission matrix and application-level mutation authorization.
- SHA-256 chained audit records, archive verification and JSON/CSV export.
- Versioned/checksummed operational snapshots, previous-snapshot recovery, startup inspection and explicit recovery choices.

Limitations that must remain visible:
- Authentication and authorization are device-local/client-side. They are not server-enforced RBAC, enterprise identity, multi-device account revocation or tenant isolation.
- Operational records and audit archives reside in browser/WebView local storage. Checksums and hash chains detect some accidental/tampered changes but are not encryption-at-rest or a remotely anchored immutable audit service. A person controlling the device or app can alter local storage or client code.
- The active audit ledger has a 5,000-record cap. The UI provides manual archiving; appends stop at the cap until the active ledger is archived. This is a continuity/operations risk if an administrator does not monitor and archive it.
- Browser/WebView storage is quota-limited. Snapshot recovery improves recoverability but does not replace a transactional server database or independent backups.

## 6. Industrial connectivity and model accuracy

- The gateway is read-only by design. No movement, charging, reset or PLC-write command is implemented.
- No exact controller model, vendor adapter, approved register/tag map, IP address or physical telemetry path has been verified for the five listed shuttle assets.
- Cassioli, Craftsman and ACME identities in the commissioning register are application placeholders pending physical nameplate/vendor confirmation.
- Battery SOC/SOH, voltage, current, temperature and cycle values must remain unknown/manual unless sourced from fresh, good-quality data from a commissioned adapter.
- Shuttle and battery 3D views are illustrative assemblies, not OEM CAD, dimensionally validated models or service drawings.
- The AI technical-assistant screen is not a connected AI inference service. Do not present it as an automated diagnostic engine.

## 7. Android and store readiness

- A reproducible Android debug APK build path exists. The APK built and passed install/launch/process/screenshot/log checks in PR #24 run `44073395778`; a fresh post-merge run on `main` is underway.
- Emulator launch verification passed on PR #24 head `b7ecfd6`; that exact code was merged to `main`. The fresh post-merge Android run `44074458921` also passed on the current `main` SHA.
- Production signing credentials, a signed AAB, Play Console validation, store review, privacy disclosures in the published listing and physical-device acceptance have not been established by this audit.
- Therefore the project is **not yet certified as Google Play production-ready**.

## 8. Required next actions

1. Confirm the fresh post-merge Android workflow on `main`; emulator install/launch and screenshot/log artifact generation already passed on the exact PR #24 code that was merged.
2. Activate a reviewed, enforced branch-protection/ruleset policy for `main`; do not rely on the currently disabled ruleset.
3. Review the eight open Dependabot PRs individually. Upgrade React/React DOM/types as one coordinated set only after CI passes; do not merge TypeScript 7 without a compatibility plan.
4. Improve audit-ledger capacity handling and provide an operational warning before the 5,000 active-record threshold. Preserve the current fail-closed behavior until a tested retention/backup design exists.
5. Complete manual UI acceptance testing across Arabic RTL, English LTR, mobile and tablet layouts, including every form, destructive action, navigation/back behavior and recovery path.
6. Obtain vendor documents and physical nameplate details before commissioning any live telemetry adapter.
7. Complete production signing and Play Store checks separately from the debug build.

## 9. Audit conclusion

The project has a substantial, tested local industrial recordkeeping application and its security foundation has been merged into `main`. The current evidence supports successful web build/tests and several security checks. It does **not** support claims of commissioned live shuttle telemetry, manufacturer-accurate CAD, server-backed multi-user operation, successful emulator acceptance, or signed Google Play release readiness.
