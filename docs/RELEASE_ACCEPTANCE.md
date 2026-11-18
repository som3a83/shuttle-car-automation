# Release Acceptance — Shuttle Car Automation

## 1. Release identity

- Repository: `som3a83/shuttle-car-automation`
- Application ID: `com.shuttlecar.automation`
- Current source release label: verify against the application footer and Android package before tagging.
- Release artifacts must be tied to one exact Git commit SHA.

## 2. Automated merge gates

A release candidate is not accepted until all checks on the exact candidate SHA complete successfully:

| Gate | Required evidence |
|---|---|
| TypeScript | `npm run check` passes |
| Unit and component tests | `npm test` passes, including security tests |
| Production build | `npm run build` passes |
| Dependency security | Dependency Review and `npm audit --audit-level=high` pass |
| Static analysis | CodeQL succeeds |
| Secret scanning | Secret Leak Scan succeeds |
| Gateway safety tests | Read-only gateway validation succeeds |
| Android | Debug APK builds and the emulator smoke test installs and launches it |
| CAD | OpenSCAD renders shuttle and battery reference models and publishes the editable source/STL artifact |
| Store assets | Listing/PWA asset validation and generation succeed |

A skipped, cancelled, pending or missing check is not a successful check. A successful APK compilation alone is not proof that the emulator launch succeeded.

## 3. Fleet data integrity

The installed fleet register must retain the confirmed five units:

- SC-01, SC-02 and SC-03 — Cassioli ISAT Semi-Automatic.
- SC-04 — Craftsman Standard Pallet Shuttle.
- SC-05 — ACME Namla Polar Edition.

Unknown serial numbers, hardware revisions, firmware versions, OEM options and live device readings must remain unknown until verified from physical labels, approved OEM documentation or a commissioned telemetry source. The reported ACME 0% battery display is a manual report, not verified state-of-charge telemetry; the unverified SOC remains `null`.

## 4. Operational and security acceptance

- Arabic RTL and English LTR navigation work on phone, tablet and desktop layouts.
- The unauthenticated Viewer can inspect permitted operational screens but cannot perform mutations.
- Users & Security remains available for first-run account setup/sign-in; administrator actions require authentication and permissions.
- Settings and other administrative destinations remain protected.
- Faults cannot be resolved without a documented corrective action.
- Diagnostic hypotheses are labeled as hypotheses requiring technical verification.
- The diagnostic workbench cannot send commands to equipment and never bypasses safety interlocks.
- Backup/restore validation rejects malformed or incompatible data before changing application state.
- Offline/local operation is tested with network access unavailable.

## 5. Android release boundary

- Debug APK is for controlled evaluation only; it is not a signed Play Store release.
- A Play release requires publisher-controlled upload keystore secrets, a unique increasing version code, signed AAB/APK verification and SHA-256 checksums.
- A successful signed artifact build does not mean the app has been uploaded to or approved by Google Play.
- Capture genuine screenshots from the tested app. Do not present mockups or generated images as runtime evidence.

## 6. Required plant commissioning before live use

The current project does not contain confirmed OEM PLC register maps, serial-specific hardware/firmware details, or a commissioned manufacturer API for the installed fleet. Therefore:

1. Obtain model/serial-specific manuals and interface documents from each manufacturer.
2. Confirm gateway network architecture, certificates, access controls and read-only service account with plant OT/IT.
3. Map and validate each telemetry tag against the actual HMI and an approved test procedure.
4. Start read-only; independently verify units, scaling, timestamps, stale-data behavior and quality flags.
5. Conduct controlled physical-device acceptance with the manufacturer/authorized service technician.
6. Do not enable motion, charging or safety-related control from this application without a separate, formally engineered and certified control-system project.

## 7. Known product boundaries

- Operational records and local accounts are device-local; there is no publisher-operated cloud database or cross-device synchronization.
- The technical diagnostic workbench is rule-based local guidance; no AI provider is connected.
- No physical shuttle is connected by default; live telemetry requires an independently deployed and commissioned OT gateway.
- 3D/CAD models are reference assemblies, not OEM-certified manufacturing or service drawings.
- The application is not a safety instrumented system or a substitute for OEM procedures and qualified technical judgment.

## 8. Final sign-off checklist

- [ ] All intended PRs are merged into `main`.
- [ ] No required PR remains open or draft.
- [ ] No feature branch contains unmerged release code.
- [ ] No required workflow is pending, cancelled, skipped or failing on the final SHA.
- [ ] Android emulator evidence and the matching debug APK artifact are available.
- [ ] CAD source and rendered artifacts are available.
- [ ] Privacy policy, terms, README and store listing match actual shipped behavior.
- [ ] Publisher signing secrets are configured before requesting a signed Play artifact.
- [ ] Plant commissioning is either completed and documented or the product remains explicitly in offline/local mode.
