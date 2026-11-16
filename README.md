# Shuttle Car Automation V6

Shuttle Car Automation is a React + Vite + TypeScript application for monitoring and documenting shuttle-car fleets. The current release is a **local demo / engineering prototype**: records are illustrative or manually entered, and browser changes are stored locally on the current device.

## Quick start

1. Install dependencies: `npm install`
2. Start the web app: `npm run dev`
3. Run checks: `npm test` and `npm run build`

## Included workspaces

- Fleet dashboard and searchable shuttle register
- Shuttle engineering views (conceptual SVG illustrations, not vendor CAD)
- Battery register with manual state updates
- Fault register with investigation workflow and corrective-action gate before resolution
- Maintenance work orders with status transitions
- Device connectivity architecture placeholders
- CSV operational export, browser print / Save as PDF, and local JSON backup
- English / Arabic direction switching, dark / light theme, and responsive layouts
- Client-side role preview only

## Android build

The app is configured with Capacitor 8 (`com.shuttlecar.automation`).

A GitHub Actions workflow named **Build Android Debug APK** runs on updates to the development branch and can also be run manually. It builds the web app, generates the Android wrapper, builds a debug APK, and uploads the APK as a workflow artifact named `shuttle-car-automation-debug-apk`.

The debug APK is for installation and evaluation only. It is not a signed release bundle and is not ready for Google Play publication.

## Data, connectivity, and security limitations

- Seed records and battery values are demonstrative; they are not verified equipment telemetry, manufacturer specifications, or confirmed serial / firmware data.
- Connectivity states must not be interpreted as a live PLC, MQTT, Modbus, OPC UA, REST, or BLE connection. No verified vendor endpoint, address map, credentials, or protocol integration is configured.
- Battery SOC, SOH, voltage, current, and temperature are illustrative until a verified data source is connected.
- Local persistence uses browser storage on the current device. It is not a central database, cloud backup, multi-user synchronization, or disaster-recovery service.
- Role selection is a navigation preview, not authentication or server-enforced authorization. No real login, identity provider, or backend authorization service is configured.
- The AI workspace is an illustrative checklist. No AI provider is connected and it does not generate equipment diagnoses.
- No live movement, charging, PLC write, or other machine-control command is issued by this application.

## Engineering integration requirements

Before enabling real telemetry or control, obtain the manufacturer's approved interface documentation, supported protocol and register map, network topology, authentication method, safety constraints, and written authorization. Start with read-only telemetry and validate every field against the equipment HMI and vendor documentation.

Never commit device credentials, API keys, private certificates, or production secrets to this repository.
