# Changelog

All notable application changes are documented here.

## 1.0.0 — Release candidate

### Application
- Bilingual Arabic RTL / English LTR interface with dark and light appearance.
- Local fleet, battery, shift, fault, maintenance, connection-register and reporting workspaces.
- Viewer role can inspect operational pages without mutation permissions; administrator destinations remain protected.
- Precision Industrial graphite, gunmetal and copper visual identity.
- Interactive reference visualization for shuttle and battery assemblies.
- Interactive rule-based diagnostic workbench with six symptom pathways, field findings and authorized creation of fault records.
- JSON backup/restore and CSV/XLSX reporting.

### Industrial integration boundary
- Optional HTTPS client for an independently deployed, authorized read-only OT gateway.
- No direct PLC connection or machine-control commands from the mobile application.
- No OEM telemetry or serial-specific specifications are assumed without approved evidence.
- 3D/CAD geometry remains illustrative reference material, not OEM-certified engineering data.

### Platform and release
- Capacitor Android application and debug APK workflow.
- Android emulator smoke-test workflow.
- OpenSCAD reference model validation.
- CodeQL, dependency review, secret scanning and gateway validation workflows.
- Signed Play AAB workflow requires publisher-controlled upload-key secrets and does not upload to Google Play automatically.

### Known limitations
- Operational records and local accounts remain on the current device; no publisher-operated cloud database or cross-device synchronization.
- No AI provider is connected; the diagnostic workbench is rule-based local guidance.
- Live telemetry requires plant-side gateway deployment, approved OEM tag mapping, authorization and commissioning.
- Local role checks are not server-enforced security and the application is not a safety instrumented system.
