# Shuttle Car Automation V8.0.0

A bilingual Arabic/English, offline-first Android and web application for recording, inspecting and maintaining industrial shuttle-car fleets. Built with React, TypeScript, Vite, Capacitor 8 and Three.js.

## Product scope

This application is dedicated to shuttle cars and their associated batteries. It is not a warehouse-management system, ERP, accounting system or machine safety controller.

### Included workspaces

- **Dashboard and fleet:** local fleet register, equipment identity, operating-state records, assignments and service history.
- **Engineering visualization:** interactive 3D shuttle and battery reference assemblies, selectable components, orthographic views and exploded views. Geometry is illustrative, not OEM-certified.
- **Battery lifecycle:** battery register, manual readings, assignment/removal, movement history, fault status, archive and restore. Unknown SOC, SOH, voltage, current, temperature and cycle counts remain null.
- **Fault management:** operator-reported observations, severity, investigation notes, corrective-action records and resolution controls. A fault cannot be resolved without a documented corrective action.
- **Maintenance:** scheduled and active work orders, technician assignment, completion notes and archive/restore rules. Unfinished work orders cannot be archived.
- **Shift operations:** local shift opening, handover notes and history.
- **Device connections:** native Android Bluetooth LE scanning and raw GATT read-only inspection, plus an optional HTTPS client for a separately deployed read-only industrial gateway.
- **Users, security and settings:** device-local accounts, role-based UI permissions, audit history, Arabic/English, dark/light themes and JSON backup/restore.

### Confirmed fleet data

The initial register contains five local fleet records based only on the fleet information supplied for this project:

- SC-01, SC-02, SC-03 — manufacturer Cassioli.
- SC-04 — manufacturer Craftsman.
- SC-05 — manufacturer ACME.

Exact model names, serial numbers, hardware/firmware revisions, operating states and live measurements are not populated unless verified. The local key `BAT-ACME-01` is an application record identifier, not an OEM battery serial number. The reported ACME HMI display of 0% after repair remains a manual historical note; it is not live SOC and SOC remains null.

## Industrial connectivity — commissioning boundary

The app includes:
- Generic Bluetooth LE discovery and GATT service/characteristic read inspection on a native mobile device.
- A read-only HTTPS gateway client using the documented `/v1/status` and `/v1/telemetry` contract.
- A separate industrial gateway project with generic protocol adapters and automated safety/contract tests.

A nearby Bluetooth peripheral is **not automatically identified as a shuttle**. Raw GATT values are not interpreted as shuttle telemetry until the OEM UUID/tag map and decoder are approved and commissioned. The mobile app does not scan/probe PLC networks and does not send motion, charging or PLC-write commands.

No installed Cassioli, Craftsman or ACME shuttle is confirmed connected. Actual fleet commissioning still requires model/serial-specific OEM manuals, approved protocol/register/tag maps, gateway network details, read-only credentials and validation against the physical HMI by authorized plant OT/maintenance personnel. Until those are available, the app must remain explicitly offline/uncommissioned and all machine telemetry remains unknown.

## Data integrity and safety

- Local seed data is clearly marked as local records, not live telemetry.
- No unverified model, serial number, firmware or battery measurement is invented.
- Only fresh, good-quality samples with vendor provenance and commissioned adapter identity can be labelled LIVE.
- Manual, simulated, imported, derived, stale or incomplete values cannot be labelled LIVE.
- The application is not a safety instrumented system and does not replace OEM procedures or qualified technical judgment.
- Local accounts and records are stored on the device. There is no publisher-operated cloud database or cross-device synchronization.
- 3D models are conceptual engineering references, not approved manufacturing or service drawings.

## Run and validate

Requirements: Node.js 22+ and npm.

```bash
npm ci
npm run dev
```

Validation commands:

```bash
npm run check
npm test
npm run check:release
npm run assets:render
npm run build
```

The test suite covers TypeScript, component behavior, battery assignment/lifecycle, fault and work-order lifecycle, data validation, read-only gateway contracts, telemetry provenance, security and storage migration.

## Android build and screen review

GitHub Actions on `main`:
- **Build Android Debug APK:** validates the web app, captures Arabic RTL screenshots for all application routes at mobile (390×844), tablet (768×1024) and desktop (1440×900) viewports, builds the Android debug APK, installs and launches it in an Android emulator, verifies the foreground process and crash log, and uploads APK plus evidence.
- **Package Android Debug APK:** creates a separately downloadable debug APK and SHA-256 checksum.
- **Package Complete Project Source:** creates a ZIP of the exact `main` commit with SHA-256 and commit metadata.

A debug APK is for controlled evaluation only. It is not a signed Google Play release. Play publishing requires publisher-controlled signing keys, signed AAB verification, physical-device acceptance and truthful Play Console declarations.

## Repository layout

- `src/` — React application, local data lifecycle, security and UI.
- `src/industrial/` — read-only gateway client, telemetry validation and connection catalog.
- `industrial-gateway/` — separately deployed gateway service and generic protocol adapters.
- `cad/` — editable reference CAD sources and rendered models.
- `docs/RELEASE_ACCEPTANCE.md` — final release and plant-commissioning acceptance gates.
- `docs/FINAL_HANDOVER.md` — evidence-based handover checklist.

## Release rule

The application version, APK, source ZIP, emulator evidence and screenshots must all refer to the same exact `main` commit SHA. A pending or skipped workflow is not a pass. Physical equipment connectivity is not considered complete until a vendor-specific adapter and approved read-only commissioning are verified on the actual installed shuttle.
