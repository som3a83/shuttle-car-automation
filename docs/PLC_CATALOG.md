# PLC and smart cold-store controller reference catalog

This is a **document-backed identification catalog**, not a claim that every listed controller is installed at the user's site or already has a commissioned driver. It is intentionally expandable. Product families, firmware options, licenses and enabled communication services vary by exact CPU and configuration; verify the physical nameplate and the matching OEM manual before connecting.

## Controller families relevant to industrial automation and cold storage

| Manufacturer / family | Typical role | Documented communication / integration notes | Project status |
|---|---|---|---|
| Siemens SIMATIC S7-1200 / S7-1200 G2 | Machine, conveyor, handling and utility automation | Siemens documents S7 communication, Modbus TCP/RTU instructions and OPC UA server features. OPC UA availability and limits depend on CPU generation and firmware. | Catalogued; generic read-only Modbus adapter exists. No Siemens-specific S7 driver or commissioned tag map. |
| Siemens SIMATIC S7-1500 | Higher-performance line, conveyor, AS/RS and plant automation | Siemens documents PROFINET, S7 communication and OPC UA server/client capabilities; OPC UA read/write and methods are configurable on supported firmware. | Catalogued; no S7 protocol driver or commissioned tag map. |
| Schneider Electric Modicon M241 / M251 | Compact machine, refrigeration auxiliary, conveyor and facility automation | M241 programming guide lists Modbus TCP and OPC UA service ports; M251 documentation covers Modbus TCP and EtherNet/IP. Features are model/firmware/configuration dependent. | Catalogued; generic read-only Modbus adapter exists. |
| Schneider Electric Modicon M262 | Motion/machine control and connected automation | Schneider documents encrypted OPC UA availability for M262; confirm exact firmware and security configuration. | Catalogued; no commissioned adapter. |
| Beckhoff CX / TwinCAT PLC runtime | PC-based machine control, conveyors, material handling and warehouse automation | Beckhoff lists TwinCAT OPC UA, Modbus TCP server and Modbus RTU libraries as separate products/options. Do not assume every CX controller has every license enabled. | Catalogued; no Beckhoff ADS/OPC UA adapter commissioned. |
| Omron NJ / NX series (including NX102 / NX502) | Machine automation, coordinated motion, material handling and line control | Omron publishes NJ/NX OPC UA CPU catalogs and EtherNet/IP-related controller documentation; options depend on CPU and network units. | Catalogued; no Omron FINS/EtherNet-IP/OPC UA adapter commissioned. |
| Rockwell Automation CompactLogix / ControlLogix | Plant and material-handling automation | Rockwell manuals document EtherNet/IP and CIP data/control services. Exact controller generation, communication module and software version matter. | Catalogued; no EtherNet/IP/CIP driver or commissioned tag map. |
| Danfoss AK-SM 800A System Manager | Refrigeration system supervision, temperature logging, alarms, coordinated defrost and energy optimization | Danfoss describes it as the system manager for refrigeration/HVAC controllers; official material identifies Modbus, Modbus/TCP and other fieldbus connections. It is a refrigeration system manager, not a generic PLC. | Catalogued as refrigeration controller/supervisor; no Danfoss adapter commissioned. |
| Danfoss AK-PC / AK-CC controller families | Compressor pack and refrigeration case/room control | Exact controller model and its application manual are required. AK-SM documentation describes supported Danfoss controller networks; do not infer registers from the family name. | Family placeholder only; add exact models after nameplate/manual verification. |

## Protocol catalogue

- **Modbus TCP / Modbus RTU:** Generic read-only adapters are present in `industrial-gateway/adapters/`. They use function codes 3 and 4 only and require a manufacturer-approved register map, data type, byte order, scaling, units and unit/slave ID.
- **OPC UA:** Standardized client/server interface. Browse and read only after endpoint, namespace, NodeIds, certificates, security policy and authorized read-only identity are configured. Some PLCs expose writable nodes; this application must not write them.
- **PROFINET:** Industrial Ethernet fieldbus used in Siemens and other automation ecosystems. A network presence does not provide a safe or generic telemetry map.
- **EtherNet/IP / CIP:** Used in Rockwell and supported by selected other controllers. Requires a compatible, reviewed driver and exact controller/assembly/tag definitions.
- **Beckhoff ADS, Omron FINS, Mitsubishi MC/SLMP, Siemens S7:** Vendor/protocol-specific integrations. They are not interchangeable with Modbus and are not implemented merely because the vendor appears in this catalog.
- **MQTT / HTTPS / REST / WebSocket:** Application/edge integration transports, not proof that a PLC natively supports them. Usually an approved gateway or controller option is required.

## Cold-store data model candidates

These are **semantic tag categories**, not register addresses. Map each category to actual OEM tags only after documentation and on-site validation:

- Room: air temperature, setpoint, high/low alarm, door state, evaporator status.
- Refrigeration: suction/discharge pressure, compressor state, defrost state, fan state, refrigerant leak alarm (where instrumented).
- Energy: kW, kWh, demand and meter quality.
- Warehouse automation: conveyor zones, lift/shuttle permissives, position/occupancy, transfer request/acknowledgement, fault code and heartbeat.
- Safety/status: emergency-stop circuit state, guard/interlock state and safety-controller diagnostic status. These are monitoring points only; the app is not a safety controller.

## Mandatory commissioning gates

1. Record manufacturer, exact model, order number, serial number, hardware revision, firmware and installed communication modules.
2. Obtain the matching OEM communication manual and written plant OT authorization.
3. Build an explicit approved tag map: tag/NodeId/register, data type, byte/word order, scaling, engineering unit, quality and read permission.
4. Start with a read-only identity and read-only network policy. Keep PLC credentials and certificates on the OT gateway, never in the Android app.
5. Compare values with the local HMI and an authorized technician's measurement; verify timestamps, quality, stale-data behavior and disconnect handling.
6. Keep machine commands disabled in this app. Any future command interface requires a separately engineered, risk-assessed and commissioned control system with hardwired safety circuits and OEM/plant approval. A mobile app must never replace safety PLC logic or emergency stops.

## Official manufacturer references

- Siemens S7-1200 G2 System Manual: https://cache.industry.siemens.com/dl/files/791/109997791/att_1350879/v2/S71200_G2_system_manual_en-US_en-US.pdf
- Siemens OPC UA S7-1200/S7-1500: https://sieportal.siemens.com/en-ww/products-services/10317040
- Siemens S7-1500 communication function manual: https://support.industry.siemens.com/cs/attachments/59192925/s71500_communication_function_manual_en-US_en-US.pdf
- Schneider Modicon M241 Programming Guide: https://download.se.com/files?p_Doc_Ref=EIO0000003059&p_File_Name=M241-Programming-Guide-EN-EIO0000003059-11.pdf
- Schneider Modicon M251 User Guide: https://www.se.com/be/en/download/document/EIO0000004273/
- Beckhoff TwinCAT communication products: https://infosys.beckhoff.com/content/1033/tcinfosys/12666675339.html
- Omron NX102 manuals and catalogs: https://www.ia.omron.com/products/family/3705/download/manual.html
- Omron NX502 catalog: https://www.ia.omron.com/products/family/3900/download/catalog.html
- Rockwell CompactLogix EtherNet/IP manual (1768 family; legacy reference, not a universal CompactLogix manual): https://literature.rockwellautomation.com/idc/groups/literature/documents/um/1768-um001_-en-p.pdf
- Danfoss AK-SM 800A system manager: https://www.danfoss.com/en/products/dcs/electronic-controls/products/system-managers/
- Danfoss AK-SM 800A / cold-room network units guide: https://assets.danfoss.com/documents/latest/607075/AF465337228619en-000402.pdf
