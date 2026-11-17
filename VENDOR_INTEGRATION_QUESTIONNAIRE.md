# Vendor Integration Questionnaire — Shuttle Fleet

Purpose: obtain verified, vendor-approved facts before implementing a production protocol adapter. Complete one copy per exact machine model and firmware combination.

## A. Questions common to every vendor

1. What is the exact machine model, serial range, controller make/model and firmware?
2. Is an external monitoring connection supported without affecting machine safety, warranty or performance?
3. Which interface is officially supported: OPC UA, Modbus TCP, MQTT, REST API, WebSocket, proprietary SDK, industrial Wi-Fi gateway or another method?
4. Is the interface read-only? Can a separate read-only user/certificate be issued?
5. Provide the official protocol manual, API schema, register/tag map and example payloads.
6. For every tag, provide name, address/node ID, data type, byte/word order, scaling, unit, quality, update rate and meaning.
7. How are alarms and fault codes exposed? Provide the complete code list and severity mapping.
8. What are the maximum permitted clients, connections, polling frequency, timeout and retry policy?
9. Does the interface expose controller time, device time and communication quality?
10. Are there supported simulators or a test PLC / sandbox?
11. What network ports, VLANs, certificates, encryption and firewall rules are required?
12. Is there a supported gateway product? Who maintains it and how are firmware updates secured?
13. Does third-party read-only monitoring affect support or warranty?
14. Who is the authorized technical contact for commissioning and escalation?

## B. Cassioli — three vehicles

Public product information describes the IMASTER automated warehouse architecture and Cassioli warehouse-management/control software, but it does not identify the installed machines or establish their external API, protocol or tag map. Confirm whether these three assets are IMASTER, another Cassioli shuttle family, or a different configuration.

Request:
- exact shuttle family and installed controller/PLC;
- whether the installation uses Cassioli iCONTROL / iWARE / another WCS and its version;
- approved monitoring interface between the controller/WCS and a third-party dashboard;
- read-only status, location, cycle, alarm, battery and communication tags (only those actually available);
- supported gateway, authentication, licensing and network requirements;
- whether access is exposed per shuttle, per level, or only through the central WCS.

Official public product reference: https://www.cassioli.com/intralogistics-division/automated-warehouses/pallet-shuttle/imaster-shuttle/

## C. Craftsman — one vehicle

Public Craftsman material describes multiple different product families (Multi-Level Shuttle, Multi-deep Shuttle ASRS and Radio Shuttle); their hardware and communication architecture must not be treated as interchangeable. A public Multi-Level Shuttle page mentions industrial wireless communication; a public Multi-deep page identifies Ethernet and Wi-Fi module components. Neither establishes the installed unit's exact interface.

Confirm exact family: Radio Shuttle, Multi-Level Shuttle, Multi-deep Shuttle, 4-Way Shuttle or another model.

Request:
- exact installed family, model, serial and controller;
- carrier / shuttle / lift topology and which controller owns each;
- radio access point and wireless protocol/security;
- Ethernet/Wi-Fi interface specification and supported monitoring API;
- read-only tags for position, mode, battery, alarms, sensor states and communication quality;
- wooden-pallet detection sensor specifications and supported pallet envelope;
- approved cold-room wheel/traction and battery operating limits;
- fault code list, battery drain diagnostic procedure and approved service instructions.

Official public references:
- https://www.craftsmanstorage.com/multilevel-shuttle-system
- https://www.craftsmanstorage.com/multi-deep-shuttle-asrs

## D. ACME — one vehicle

The fleet owner reports an ACME unit with a tablet/HMI and a lithium battery; the battery reportedly displayed 0% after repair. These are operational reports, not verified model or BMS specifications.

Request:
- exact ACME shuttle model and controller;
- tablet/HMI model, software version and vendor service interface;
- whether HMI data is mirrored from PLC/BMS and whether a read-only API is supported;
- battery manufacturer/model/serial, chemistry, nominal voltage, capacity and BMS;
- BMS communication interface and SOC/SOH calibration method;
- approved charger model, charging limits and battery temperature limits;
- alarm/fault code for low battery and the documented post-repair SOC verification procedure;
- read-only data tags and vendor approval for third-party monitoring.

## E. Vendor response and approval

| Field | Response |
|---|---|
| Vendor legal entity | |
| Technical contact / role | |
| Exact model and firmware covered | |
| Official manual / API document reference | |
| Supported protocol and version | |
| Read-only access method | |
| Tag map revision / date | |
| Test environment available | |
| Maximum polling rate | |
| Security requirements | |
| Warranty / support conditions | |
| Written approval for read-only integration | |
| Authorized commissioning engineer | |

No protocol adapter is considered production-ready until the vendor's documentation and site OT approval are attached to this record.
