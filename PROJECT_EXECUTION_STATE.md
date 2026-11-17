# Project Execution State — current main baseline

**Updated:** 17 November 2026  
**Repository:** `som3a83/shuttle-car-automation`  
**Official branch:** `main`  
**Current audited commit:** `28eeca047863d39b1126a1e3116640ac791f65f2`

## Current position

The security and local-recovery work is no longer an unpushed local ZIP or an open draft. Pull request #23 and the Android emulator CI repair PR #24 were merged into `main` on 17 November 2026. The read-only gateway, commissioning baseline, and application customization work from PRs #20–#22 are also merged.

The repository is now a functioning web/Capacitor application source tree with automated tests and CI. It is not yet a production-commissioned shuttle-control system or a verified Google Play production release.

## Integrated capabilities

- Shuttle fleet register and lifecycle operations.
- Battery register, assignment, installation/removal history and battery lifecycle.
- Fault recording, investigation, corrective action and resolution controls.
- Maintenance work orders and shift handover records.
- Reports and exports, notifications, application settings and local customization.
- Arabic/English interface and responsive web/Android shell.
- Conceptual shuttle and lithium-battery engineering visualizations.
- Device-local accounts, PBKDF2-SHA-256 password derivation, local sessions and role/permission gates.
- Tamper-evident local audit chain with archive verification and export.
- Versioned/checksummed local operational snapshots and explicit recovery workflow.
- Read-only industrial gateway architecture and client.

## Verified CI evidence on current main

- Main post-merge CI run `44074458927`: TypeScript, automated tests, dependency audit, release configuration validation, store asset rendering and production web bundle passed.
- Main post-merge CodeQL run `44074458926`: passed.
- Main post-merge secret scan run `44074458837`: passed.
- PR #24 validation at `b7ecfd6bf2ab08285c7b8e1b4823e804f92bbd01`: CI, CodeQL, Secret Scan and Dependency Review all passed.
- Android debug build and emulator smoke run `44073395778`: passed end-to-end, including SDK setup, Capacitor sync, APK assembly, KVM-enabled emulator boot, install, app launch, process check, screenshot and log capture. Evidence and APK artifacts were uploaded.
- Post-merge Android run on the official `main` SHA `28eeca047863d39b1126a1e3116640ac791f65f2` (`44074458921`): passed every step, including APK build, KVM-enabled emulator boot, install, launch, process check and evidence upload.

## Explicit constraints

- Accounts and permissions are local to one device. This is not server-side identity, enterprise RBAC or multi-device synchronization.
- Operational data and audit archives are stored in local browser/WebView storage. The snapshot checksum and audit hash chain are integrity mechanisms, not encryption-at-rest or a server-anchored immutable record.
- The active audit log stops accepting appends at 5,000 records until a Super Admin archives it. Manual archive exists; operational monitoring is required.
- No exact vendor-specific shuttle driver, controller map, register map or commissioned physical telemetry source is present. The gateway is read-only.
- The five fleet entries remain uncommissioned placeholders until verified against physical nameplates and vendor documentation.
- 3D mechanical assemblies are conceptual illustrations, not OEM CAD.
- The AI technical-assistant view is not a connected AI service.
- Debug APK build success is not production signing, signed AAB generation, Play Console approval or store publication.

## Repository hygiene

- Keep `main` as the official source of truth.
- PR #23 is merged. Do not re-merge its old branch.
- Review old branches by their unique diff against current `main`; do not merge divergent V4/V6 branches wholesale.
- Eight Dependabot PRs remain open (#10, #13–#19 excluding #11/#12). The React/React DOM/types updates are split and must be reviewed as a coordinated upgrade; TypeScript 7 is a major upgrade and must not be merged blindly.
- The `main` ruleset currently exists with enforcement disabled. Enable branch protections only after confirming the required checks and repository settings.

## Next execution sequence

1. Confirm the post-merge Android workflow on `main` completes successfully; the same source revision already passed emulator install/launch on PR #24.
2. Activate the existing `main` ruleset (currently Disabled) and require the verified CI/security checks.
3. Resolve the audit-log 5,000-record operational threshold with warning/backup behavior and tests.
4. Complete physical-device/manual acceptance across all screens, forms, destructive actions, Arabic RTL, English LTR, mobile/tablet layouts and recovery flows.
5. Review open dependency PRs individually; group React ecosystem changes and run the full test/build matrix.
6. Commission physical telemetry only after vendor/controller documents and approved read-only tag maps are supplied.
7. Configure the four Android signing secrets, produce a signed production AAB and complete Play Store checks only after the above gates pass.

**Current result:** `main` is the valid working baseline at `28eeca047863d39b1126a1e3116640ac791f65f2`. Web CI, CodeQL and secret scan are green. The Android APK successfully installed and launched in the emulator on the exact PR head subsequently merged into `main`; the fresh post-merge Android run `44074458921` has also passed. Production signing/store release, main ruleset activation, physical-device acceptance and vendor shuttle commissioning remain open.
