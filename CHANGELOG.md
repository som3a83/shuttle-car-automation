# Changelog

## 8.0.0 — Precision Industrial V8

### Application scope
- Dedicated shuttle-car and battery operational application; no warehouse-management or ERP functions.
- Arabic RTL / English LTR interface, dark/light themes and responsive phone, tablet and desktop layouts.
- Fleet register seeded only with the five confirmed manufacturer identities; model, serial, firmware, state and live telemetry remain unknown unless verified.
- Interactive shuttle and battery engineering reference visualizations.
- Battery lifecycle, assignment journal, fault management and maintenance work orders.
- Local shift operations, notifications, device-local security and JSON backup/restore.
- Removed the AI assistant and reporting/export workspaces and retired their navigation and permission grants.

### Industrial connectivity
- Native Bluetooth LE discovery and raw GATT read-only inspection.
- Optional HTTPS client for an independently deployed read-only OT gateway.
- Explicit telemetry provenance and quality validation; manual, simulated, imported, derived, stale or uncommissioned values are never presented as LIVE.
- No motion, charging or PLC-write commands.
- Physical shuttle connectivity remains subject to model-specific OEM documentation, approved tag maps, gateway access and plant commissioning.

### Verification
- TypeScript, automated component/data/security tests and production build.
- Android debug build and emulator install/launch smoke test.
- Responsive screen capture across all app routes at mobile, tablet and desktop viewports.
- CAD validation and secret scanning.

### Known boundaries
- Local-only data; no cloud synchronization.
- No confirmed physical shuttle connection or manufacturer-specific shuttle driver until commissioning.
- 3D geometry is illustrative, not OEM-certified.
- Debug APK is not a signed Google Play release.
