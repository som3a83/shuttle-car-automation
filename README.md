# Shuttle Car Automation V9

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
- **Fleet:** searchable shuttle register for the reported 3 Cassioli, 1 Craftsman and 1 ACME units.
- **Engineering:** interactive Three.js conceptual shuttle assembly, camera presets, pointer rotation, zoom, exploded view and selectable component inspection; a 2D schematic fallback is provided when WebGL is unavailable.
- **Batteries:** Three.js conceptual lithium battery assembly and local battery register.
- **Faults:** manually reported observations, investigation status and corrective-action requirement before closure.
- **Maintenance:** work-order creation and local status transitions.
- **Connections:** protocol architecture reference for Modbus TCP, OPC UA, MQTT, REST API, WebSocket and BLE; no endpoint is configured.
- **Technical assistant:** static field-inspection guidance, not an AI-generated diagnosis.
- **Reports:** CSV export, local JSON backup and print / Save as PDF.
- **Notifications:** local events from fault, battery and maintenance record changes, with dismiss / clear actions and configurable alert preferences.
- **Users and settings:** role preview, language, theme and local alert preferences.

## Navigation and interface

Application workspaces use URL hash routes, for example `#/fleet`, `#/engineering` and `#/notifications`. Browser back / forward navigation is supported. The interface supports Arabic RTL, English LTR, dark and light themes, desktop navigation, and a mobile quick-navigation bar with an all-modules drawer.

## Automated validation

The latest verified CI run on the development feature branch passed:
- TypeScript project check.
- **25 automated tests across 3 test files** (navigation, local workflows, WebGL fallback behavior and persistence).
- Production Vite build.

The Android debug workflow builds the Capacitor wrapper and publishes a debug APK artifact. A debug APK is for evaluation and is **not** a signed Play Store release.

## Data, connectivity and safety limits

- Fleet composition is based on the operator-reported count. Manufacturer model numbers, serial numbers, firmware, hardware revisions and unverified operating telemetry remain unknown.
- The Three.js shuttle and battery models are conceptual geometry, **not manufacturer CAD, approved service drawings, or dimensionally verified models**.
- No live PLC, manufacturer API, MQTT, Modbus, OPC UA, REST, WebSocket or BLE connection is configured.
- Battery SOC, SOH, voltage, current and temperature are treated as unknown or manually reported unless a verified source is provided. A reported HMI value is not automatically a live telemetry reading.
- Local state changes, work orders, faults and notifications are persisted in browser storage on the current device. They are not a central database, cloud synchronization, multi-user service or disaster-recovery system.
- Role selection is a user-interface preview only. There is no real authentication or server-enforced RBAC.
- The technical assistant is a static checklist. No AI provider is connected, and diagnostic possibilities must be verified by a qualified technician.
- The application does not issue shuttle movement, charging, PLC-write or other machine-control commands.

## Before real equipment integration

Obtain written authorization, manufacturer-approved interface documentation, the supported protocol and register map, network topology, authentication requirements and machine safety constraints. Begin with read-only telemetry. Validate every field against the physical HMI and vendor documentation before using it operationally.

Never commit device credentials, API keys, private certificates or production secrets to this repository.
