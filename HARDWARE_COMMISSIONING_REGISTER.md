# Hardware Commissioning Register — Five Shuttle Cars

Use this register during a supervised site survey. Do not guess missing values. Photograph nameplates and controller labels only with site authorization; redact credentials, QR access tokens and personal data before sharing.

## Fleet inventory

| Local ID | Manufacturer | Physical serial | Exact model | Controller / PLC | Firmware | Radio / gateway | Status |
|---|---|---|---|---|---|---|---|
| SC-01 | Cassioli | Pending | Pending | Pending | Pending | Pending | Not commissioned |
| SC-02 | Cassioli | Pending | Pending | Pending | Pending | Pending | Not commissioned |
| SC-03 | Cassioli | Pending | Pending | Pending | Pending | Pending | Not commissioned |
| CRAFT-01 | Craftsman | Pending | Pending | Pending | Pending | Pending | Not commissioned |
| ACME-01 | ACME | Pending | Pending | Pending | Pending | Pending | Not commissioned |

The application and edge-gateway local asset IDs are SC-01 through SC-05. These are internal IDs only; they are not manufacturer serial numbers.

## Per-asset inspection checklist

- [ ] Nameplate manufacturer, exact model and serial captured.
- [ ] Controller make/model and CPU part number captured.
- [ ] PLC firmware and application/software version captured.
- [ ] HMI make/model and software version captured.
- [ ] Wireless module make/model, frequency band and firmware captured.
- [ ] Gateway / access point make/model and firmware captured.
- [ ] Network topology, VLAN, IP, subnet, gateway and port list obtained from OT owner.
- [ ] Vendor communication manual and signed tag/register map obtained.
- [ ] Read-only account / certificate provisioned by authorized vendor.
- [ ] Approved polling rate, timeout and connection limits documented.
- [ ] Physical emergency stop and safety circuits confirmed independent of this app.
- [ ] Cold-room temperature range and equipment ratings documented.
- [ ] Baseline HMI readings captured with timestamp for comparison.
- [ ] Fault history and current known defects reviewed with maintenance.
- [ ] Site automation engineer approves the read-only commissioning test.
- [ ] Edge-gateway asset entry matches the app ID, exact manufacturer/model/firmware and unique adapter ID.
- [ ] Approved telemetry tags, polling interval, stale timeout and allowed data quality are signed off.
- [ ] A read-only ingest adapter and separate viewer credential are provisioned; neither credential is stored in this repository.

## Battery and charger register

| Asset / battery ID | Battery serial | Manufacturer / model | Chemistry | Nominal V | Capacity Ah | BMS model / firmware | Charger model |
|---|---|---|---|---|---|---|---|
| ACME battery A | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Craftsman battery A | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Cassioli batteries | Pending | Pending | Pending | Pending | Pending | Pending | Pending |

Add one row per physical battery. Do not infer the number of spare batteries or chemistry from a previous estimate. Confirm battery count physically and reconcile installed/spare/charging status.

## Vendor document request checklist

- [ ] Electrical drawings and controller architecture.
- [ ] PLC make/model, firmware compatibility and backup procedure.
- [ ] Communication interface specification (OPC UA / Modbus TCP / MQTT / REST / vendor SDK / other).
- [ ] Network port and firewall requirements.
- [ ] Read-only tag list or register map, including address, type, scaling, unit and quality.
- [ ] Error/alarm code list and reset policy (read only; no reset command in this project).
- [ ] Battery BMS communication specification and supported telemetry.
- [ ] Gateway commissioning guide and cybersecurity hardening guide.
- [ ] Vendor support and warranty conditions for third-party monitoring.
- [ ] Simulator / test environment and approved commissioning procedure.

## Survey record

| Field | Entry |
|---|---|
| Site / cold-store area | |
| Survey date and time | |
| Site automation engineer | |
| Maintenance representative | |
| IT/OT network approver | |
| Vendor representative | |
| Ambient temperature range | |
| Approved test window | |
| Work permit / risk assessment reference | |
| Evidence folder reference | |

## Mandatory safety note

Do not scan, probe, port-scan, connect to, change configuration on, or write to a production PLC / radio network without written OT authorization and an approved method statement. The first test must be isolated or explicitly approved read-only access. Never test movement commands from this application.
