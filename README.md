# Shuttle Car Automation V10

Shuttle Car Automation is a React, Vite, TypeScript and Capacitor application for documenting and inspecting a shuttle-car fleet. It is currently an **offline-first local engineering prototype**. Local records and simulation controls do not communicate with, or control, physical shuttle cars.

## Start and validate

```bash
npm install
npm run dev
npm test
npm run build
```

## Application workspaces

- **Dashboard:** fleet overview and local record indicators.
- **Fleet:** searchable active register, edit manufacturer/model/serial/hardware/firmware/zone/operator/status, add units, and archive/restore records while retaining service history.
- **Engineering:** interactive Three.js conceptual shuttle assembly, camera presets, pointer rotation, zoom, exploded view and selectable component inspection; a 2D schematic fallback is provided when WebGL is unavailable.
- **Batteries:** Three.js conceptual lithium battery assembly; add/edit/archive/restore batteries, assign them to shuttle units, record manual SOC/SOH/temperature/voltage/current/cycles, and track local status. Every registration, assignment, removal, reassignment, archive and restore creates a local movement-journal entry. Assignment reconciliation prevents one battery from appearing installed in two shuttles and blocks batteries marked Fault, Maintenance, Charging or Discharging from being installed.
- **Faults:** manually reported observations, investigation status and corrective-action requirement before closure.
- **Maintenance:** work-order creation and local status transitions.
- **Connections:** protocol architecture reference for Modbus TCP, OPC UA, MQTT, REST API, WebSocket and BLE; no endpoint is configured.
- **Technical assistant:** static field-inspection guidance, not an AI-generated diagnosis.
- **Shift operations:** open one active day/night shift at a time, require supervisor and operator names, snapshot the opening fleet/fault/work-order state, require handover notes to close the shift, and retain a searchable local shift history.
- **Reports:** generate immutable daily device-status snapshots with active-shift context and battery movement details, review daily report history, export a daily report workbook or the complete multi-sheet operational register to real XLSX, export CSV, and print / Save as PDF.
- **Notifications:** local events from fault, battery and maintenance record changes, with dismiss / clear actions and configurable alert preferences.
- **Users and settings:** role preview, language, theme, local alert preferences, JSON backup import/export, visible local-data inventory and seed-data reset.

## Navigation and interface

Application workspaces use URL hash routes, for example `#/fleet`, `#/shifts`, `#/engineering` and `#/notifications`. Browser back / forward navigation is supported. The interface supports Arabic RTL, English LTR, dark and light themes, desktop navigation, mobile quick-navigation, a modules drawer, and in-app back/home/settings controls.

## Automated validation

The current feature branch adds regression coverage for equipment editing and archival, safe battery assignment and movement journaling, shift start/close and handover records, XLSX workbook generation, manually recorded readings, daily report snapshots, settings access and in-app back navigation. GitHub Actions validates TypeScript, tests and the production web bundle, then builds a Capacitor debug APK. A separate Android emulator smoke test attempts to install and launch the APK and capture screen/log evidence. Emulator success and a physical-device test must be checked from the matching workflow run; a build alone is not proof of Android usability.

A debug APK is for evaluation and is **not** a signed Play Store release.

## Data, connectivity and safety limits

- Fleet composition is based on the operator-reported count. Manufacturer model numbers, serial numbers, firmware, hardware revisions and unverified operating telemetry remain unknown.
- The Three.js shuttle and battery models are conceptual geometry, **not manufacturer CAD, approved service drawings, or dimensionally verified models**.
- No live PLC, manufacturer API, MQTT, Modbus, OPC UA, REST, WebSocket or BLE connection is configured.
- Battery SOC, SOH, voltage, current and temperature are treated as unknown or manually reported unless a verified source is provided. A reported HMI value is not automatically a live telemetry reading.
- Local state changes, work orders, faults and notifications are persisted in browser storage on the current device. They are not a central database, cloud synchronization, multi-user service or disaster-recovery system.
- Role selection is a user-interface preview only. There is no real authentication or server-enforced RBAC.
- The technical assistant is a static checklist. No AI provider is connected, and diagnostic possibilities must be verified by a qualified technician.
- The application does not issue shuttle movement, charging, PLC-write or other machine-control commands.


## V10 operations and data lifecycle

- Equipment and battery removal is implemented as **soft archival**. Archived records are hidden from active operations but can be restored; fault and maintenance history is not automatically deleted.
- Daily reports are immutable local snapshots generated on demand. They include the active shift at generation time and the battery movement journal captured in that snapshot. Later status changes do not rewrite previously generated reports.
- Shift start/close records and battery lifecycle movements are manually recorded. Supervisor/operator names are not authenticated signatures; no identity verification or tamper-proof audit guarantee is provided.
- JSON import checks the required record collections before replacing local records. Export a backup before resetting or replacing local data.
- Manually entered battery readings retain their connection mode and are not promoted to live telemetry.
- CAD-like Three.js assemblies now include additional frame reinforcements, drivetrain details, tread blocks, service points, battery cell/BMS details and engineering callouts. They remain conceptual models, not vendor-certified drawings or dimensionally validated CAD.

## Before real equipment integration

Obtain written authorization, manufacturer-approved interface documentation, the supported protocol and register map, network topology, authentication requirements and machine safety constraints. Begin with read-only telemetry. Validate every field against the physical HMI and vendor documentation before using it operationally.

Never commit device credentials, API keys, private certificates or production secrets to this repository.
