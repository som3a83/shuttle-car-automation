# Release Acceptance — Shuttle Car Automation V8

## 1. Release identity
- Repository: `som3a83/shuttle-car-automation`
- Source version: `8.0.0`
- Android application ID: `com.shuttlecar.automation`
- Release artifacts must be tied to one exact `main` commit SHA.

## 2. Required automated gates
A candidate is accepted only when the exact same SHA passes:
- TypeScript project check.
- Unit/component/security tests.
- Production web build.
- Android debug APK compilation.
- Android emulator installation, launch, foreground-process and crash-log checks.
- Responsive screenshots for all application routes at mobile, tablet and desktop dimensions.
- CodeQL and secret scanning.
- Industrial gateway contract/safety tests.
- Shuttle and battery CAD source rendering.

Pending, skipped, cancelled or missing checks are not passes.

## 3. Fleet data integrity
The initial fleet contains five local records:
- SC-01, SC-02 and SC-03 — manufacturer Cassioli.
- SC-04 — manufacturer Craftsman.
- SC-05 — manufacturer ACME.

The exact model for every unit is currently **Not recorded**. Serial numbers, hardware/firmware revisions, controller details, installed options, operating states and live readings remain unknown until verified from physical labels, OEM documentation or a commissioned telemetry source.

`BAT-ACME-01` is a local application key, not an OEM battery serial number. The reported ACME HMI 0% display after repair remains a manual historical note. The battery SOC remains null until a verified source provides a reading.

## 4. Operational acceptance
- Arabic RTL and English LTR navigation.
- Responsive layout and route reachability across phone, tablet and desktop.
- Gear-inspired graphite and copper interface; no shuttle model, warehouse 3D view or engineering drawing is displayed.
- Battery assignment, removal, movement history, archive and restore.
- Fault creation, investigation and resolution only with documented corrective action.
- Maintenance work-order creation, scheduling, progress, completion notes, archive and restore.
- JSON backup validation and restore without corrupting current state.
- Offline/local operation with no fabricated telemetry.
- Role permissions do not expose retired AI or reporting modules.

## 5. Connectivity acceptance — external commissioning dependency
The app includes generic BLE discovery/GATT inspection and an optional read-only HTTPS OT gateway client. These capabilities do not prove that an installed shuttle is discoverable or supported.

To commission a physical shuttle, obtain:
1. Exact model and serial number for each shuttle and battery/controller.
2. Manufacturer-approved communication manual and protocol details.
3. Approved BLE service/characteristic UUIDs or gateway endpoint and payload contract.
4. For Modbus, the OEM-approved register map, data types, scaling, units and read-only access.
5. Plant OT/IT-approved network path, certificates and read-only credentials.
6. A controlled verification procedure comparing telemetry with the physical HMI and authorized service technician findings.

Until all relevant items are supplied and verified, keep each device uncommissioned and its telemetry unknown. Do not probe PLC networks, invent addresses/registers, or send movement, charging or write commands.

## 6. Android release boundary
- Debug APK is for controlled evaluation only.
- Google Play release requires publisher-controlled signing keys, signed AAB/APK verification, unique increasing version code and SHA-256 checksums.
- Physical-device acceptance is required before production rollout.
- A successful emulator test is not a substitute for testing on the user's actual Android device.

## 7. Product boundaries
- Device-local records; no publisher-operated cloud database or cross-device sync.
- No AI assistant or Excel/CSV/PDF reporting workspace in V8.
- No physical shuttle is connected by default.
- 3D/CAD models are illustrative references, not OEM-certified drawings.
- The application is not a safety instrumented system.
