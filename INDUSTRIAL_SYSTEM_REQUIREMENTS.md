# Industrial Shuttle Automation — Engineering Requirements & Acceptance Gates

Status: **Engineering baseline / not yet production commissioned**  
Scope: Dedicated shuttle-car fleet monitoring, maintenance, battery lifecycle, technical reporting and read-only equipment telemetry. This project is separate from WMS, inventory, ERP, accounting and customer management.

## 1. Verified fleet baseline

The current operating fleet reported by the owner is five shuttle cars used in cold storage:

| Asset placeholder | Manufacturer | Count | Model / serial | Interface evidence |
|---|---:|---:|---|---|
| CAS-01..CAS-03 | Cassioli | 3 | Not yet supplied | Not verified |
| CRAFT-01 | Craftsman | 1 | Not yet supplied | Not verified |
| ACME-01 | ACME | 1 | Not yet supplied | Not verified |

Do not infer exact product family, PLC, radio, IP address, firmware, BMS, register map or supported protocol from the manufacturer name. Asset IDs above are placeholders until confirmed against physical nameplates.

Known reported operational issues to retain as user-entered service history (not machine telemetry): ACME battery displayed 0% after repair and automatic mode was reportedly blocked at low battery; Craftsman reported issues include wooden-pallet detection, battery drain, rough pallet handling, false alarms, wheel slip on ice, sensor cutoff and sudden stop. These require technician verification and must not be converted into confirmed diagnostic facts.

## 2. Product boundary

The application is a supervisory monitoring and maintenance layer. It is not a safety PLC, motion controller, WCS replacement, or emergency-stop system.

Initial production integration is **read-only**:
- Read telemetry and diagnostic states through a vendor-approved interface.
- No movement, lift, fork, charge, reset, acknowledge, enable, disable or safety-bypass commands.
- Never write to PLC coils/registers or invoke vendor command APIs in the monitoring release.
- A later command-capable product would require a separate safety engineering project, hazard analysis, vendor authorization, independent interlocks, role approval, site acceptance testing and legal review.

## 3. Required system architecture

1. **Android / Web operator client** — RTL Arabic and LTR English, fleet views, work orders, battery lifecycle, shift handover, reports and local offline queue.
2. **Authenticated application API** — validated schemas, server-side RBAC, tenant/site scoping, rate limits and audit events.
3. **Device gateway** — deployed on the plant OT network or approved DMZ; outbound-only secure connection to the application API where feasible. The gateway owns vendor protocol drivers and credential storage.
4. **Protocol adapters** — separate adapter per verified vendor/model/firmware/interface. Each adapter declares supported read-only tags, units, data quality, polling rate, timeout and source timestamp.
5. **Persistence** — relational database for users/assets/work orders/audit; time-series storage for telemetry; encrypted backups and tested restore.
6. **Observability** — structured logs, gateway health, per-device last-seen, communication quality, queue depth and alert delivery status.

The mobile client must never connect directly to a PLC or store OT credentials.

## 4. Data provenance contract

Every value shown as machine data must carry:
- asset ID and tag identifier;
- source device / gateway;
- source timestamp and receive timestamp;
- unit and scaling;
- quality: GOOD, UNCERTAIN, BAD, STALE or NOT_CONFIGURED;
- provenance: LIVE_VENDOR, MANUAL, SIMULATED, IMPORTED or DERIVED;
- adapter name and adapter version.

UI must visibly distinguish:
- REAL / LIVE_VENDOR — only when a verified adapter is receiving fresh, good-quality data;
- MANUAL — operator-entered, never described as a live reading;
- SIMULATION — generated test data, permanently watermarked;
- OFFLINE / STALE — last value shown with age and stale warning;
- UNKNOWN / NOT_CONFIGURED — no confirmed source.

Null / unmeasured is not zero. A battery SOC of 0% must only be displayed when a verified BMS reports zero with GOOD quality. A missing SOC must display “Not measured”.

## 5. Asset and battery model requirements

### Shuttle
Manufacturer, model, manufacturer serial, local asset ID, controller/PLC model, PLC firmware, radio/Wi-Fi module, gateway, network segment, operating zone, rated ambient temperature, hardware revision, software revision, commissioned date, service contact, last communication, hours/cycles (with source), state and full fault/maintenance history.

### Battery
Manufacturer, model, chemistry, serial, nominal voltage, capacity, BMS model/firmware, approved charger model, charge connector, temperature limits, SOC/SOH/voltage/current/temperature/cycles (only when source-verified), installation/removal history, inspection and service records.

Do not assume all five vehicles use the same battery chemistry or telemetry method.

## 6. Security requirements

- Individual named accounts; MFA for administrators.
- Server-enforced RBAC and tenant/site authorization on every API endpoint.
- No shared default passwords; secure account recovery and session revocation.
- TLS 1.2+ for all remote connections; mutual TLS or vendor-approved secure tunnel for gateway links.
- Secrets in a managed secret store, never in mobile app, repository, logs or screenshots.
- OT/IT network segmentation; firewall allowlists; no inbound internet exposure of PLCs.
- Read-only PLC/OPC UA accounts and least-privilege tag allowlists.
- Signed application releases, dependency scanning, SAST, secret scanning and SBOM.
- Append-only audit trail for user, asset, battery, fault, maintenance, configuration and access changes.
- Encrypted server-side backups; recovery point/recovery time objectives agreed before production.
- Retention and deletion policy for personal data and operational telemetry.

## 7. Reliability and cold-store requirements

- Define tested operating range for phone/tablet, gateway and radio equipment; do not assume the phone is rated for the cold room.
- Show telemetry age and stale state; never preserve a stale green/healthy indicator.
- Store-and-forward at gateway during WAN loss, with bounded queue, timestamps and duplicate handling.
- Client offline mode must clearly mark local unsynchronized changes.
- Clock synchronization (NTP) and timezone handling.
- Alert on gateway offline, device stale, invalid quality, battery limits and repeated communication faults.
- Polling rates must be agreed with each vendor and must not overload controller networks.

## 8. Verification gates before industrial acceptance

| Gate | Required evidence | Release condition |
|---|---|---|
| G0 Asset identity | Nameplate photos, model, serial, firmware | All five assets identified |
| G1 Interface authorization | Vendor letter/manual/API specification | Approved read-only interface |
| G2 Network design | OT diagram, VLAN, IPs, ports, firewall approval | Security review signed |
| G3 Tag mapping | Signed tag/register map, units, scaling, quality | Every displayed live metric traceable |
| G4 Bench adapter test | Vendor simulator or isolated test PLC | Automated protocol tests pass |
| G5 Site read-only test | Timestamped traces compared with HMI | Accuracy and stale handling accepted |
| G6 Security test | Threat model, access tests, scan results | No critical/high unresolved issues |
| G7 Operations acceptance | Shift trial, alarm workflow, restore drill | Site owner signs acceptance |
| G8 Release | Signed AAB, SBOM, test report, rollback plan | Release manager approval |

## 9. Acceptance metrics to agree with site owner

Set per vendor/model before deployment:
- telemetry freshness target and maximum stale threshold;
- gateway availability and reconnection time;
- read error rate and data-quality thresholds;
- timestamp skew tolerance;
- alarm delivery latency;
- backup RPO/RTO;
- supported concurrent users and assets;
- retention period and report export integrity.

No universal numeric target is invented here; it must be agreed with the site and vendors.

## 10. Current blockers

1. Physical model/serial/controller/firmware details for each of the five vehicles.
2. Approved vendor communication manuals, gateway/API access and tag/register map.
3. OT network diagram, approved IP/ports/VLAN and IT/OT authorization.
4. Battery/BMS/charger nameplates and approved telemetry source.
5. Named vendor/service contacts and written authorization for read-only integration.
6. A real site test window with a qualified automation engineer.

Until these are provided and gates G0–G7 pass, the product remains an operations-recording application with simulated/manual data, not a live industrial monitoring system.
