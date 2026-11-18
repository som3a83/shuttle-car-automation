# Universal Shuttle Connectivity

> **Hardware commissioning status — reference adapters, NOT commissioned on real hardware.** The adapters and explorers below are reference implementations validated with software tests/simulators only. No Cassioli, Craftsman, ACME or other physical shuttle has been connected or commissioned by this repository. Do not interpret successful CI, a discovered BLE peripheral, or accepted mock telemetry as proof of compatibility with installed equipment.

## Purpose and compatibility model

The application is not limited to Cassioli, Craftsman or ACME. The gateway accepts any non-empty manufacturer name and exact model/firmware identity. A new manufacturer can be registered without changing the application source.

Compatibility is determined by the physical machine's actual interfaces, not by its brand name. Each asset must declare approved transport identifiers, protocol identifiers, a unique adapter ID and an exact read-only tag map. Vendor-specific identifiers are accepted using lowercase IDs such as `vendor.example.radio-v2`.

## Connection families in the application catalog

### Transport / physical link
- Wi-Fi and Ethernet
- Bluetooth LE and Bluetooth Classic / RFCOMM
- USB serial
- RS-232 and RS-485
- Industrial radio through a vendor radio receiver / gateway
- Cellular 4G / 5G and approved VPN tunnel

### Protocol / application layer
- Modbus TCP and Modbus RTU
- OPC UA
- MQTT
- REST API and WebSocket
- Vendor TCP / UDP protocols
- Siemens S7, EtherNet/IP, PROFINET and CANopen
- Bluetooth GATT
- Proprietary radio and manufacturer SDK/API
- Custom vendor protocol identifiers

The catalog describes integration families and extension points. It does not claim that a particular shuttle exposes every listed option.

## Hardware commissioning status

Every implemented driver in this section is a **reference adapter, NOT commissioned on real hardware**:
1. **Modbus TCP:** reference adapter, NOT commissioned on real hardware. Local protocol simulator tests only; exact OEM register map and supervised site acceptance required.
2. **Modbus RTU / RS-485 / serial:** reference adapter, NOT commissioned on real hardware. Local PTY simulator tests only; exact OEM register map, isolated serial interface and supervised site acceptance required.
3. **Bluetooth LE GATT explorer:** reference adapter, NOT commissioned on real hardware. Native scan/connect/GATT tests use mocks; no installed shuttle has been identified or paired.
4. **MQTT:** reference adapter, NOT commissioned on real hardware. Broker/topic tests use a fake client; real broker, TLS trust, topic contract and vendor approval required.
5. **OPC UA:** reference adapter, NOT commissioned on real hardware. Client tests use a mocked server; real certificates, server trust, node map and vendor approval required.
6. **REST API:** reference adapter, NOT commissioned on real hardware. Tests use a local test HTTP server; real HTTPS endpoint, credentials and vendor schema required.
7. **WebSocket:** reference adapter, NOT commissioned on real hardware. Tests use a mocked push stream; real WSS endpoint and vendor payload contract required.

These reference implementations are not a statement that the named protocols exist on the company's five shuttles. Each connection is disabled/uncommissioned until the actual machine interface is documented, approved, configured, bench-tested and accepted on site.

## Implemented reference adapters — read only

### Modbus TCP reference adapter

`industrial-gateway/adapters/modbus_tcp.py` contains a generic Modbus TCP reader for a shuttle/controller that explicitly supports Modbus TCP. It uses function code 3 (Read Holding Registers) and function code 4 (Read Input Registers) only. It has no write-register, write-coil, reset, movement or charging commands.

Supported register data types: `uint16`, `int16`, `uint32`, `int32`, and `float32`. Scaling, offset, unit and byte order are configurable from the approved register map. It enforces private OT IP addresses, bounded timeouts and validates response transaction IDs, unit IDs, function codes and byte counts. This is a reference adapter, NOT commissioned on real hardware.

Never guess register addresses. Use only the exact model's manufacturer-approved register map.

Example protected settings (replace placeholders only with OEM-approved values):

```json
{
  "host": "10.20.30.40",
  "port": 502,
  "unit_id": 1,
  "transport": "ethernet",
  "timeout_seconds": 2,
  "register_map": {
    "battery.soc": {
      "address": 100,
      "register_type": "holding",
      "data_type": "uint16",
      "byte_order": "AB",
      "scale": 0.1,
      "offset": 0,
      "unit": "%"
    }
  }
}
```

Set `SHUTTLE_ADAPTER_FACTORY=adapters.modbus_tcp:create_adapter`, `SHUTTLE_ADAPTER_ASSET_ID`, `SHUTTLE_ADAPTER_SETTINGS`, `SHUTTLE_ADAPTER_POLL_SECONDS`, `SHUTTLE_GATEWAY_INGEST_TOKEN` and `SHUTTLE_GATEWAY_INGEST_URL`. The protected settings must contain the exact approved tag map.

### Modbus RTU reference adapter over serial

`industrial-gateway/adapters/modbus_rtu.py` is a Linux edge-gateway reference adapter using function codes 3 and 4 only. It validates frame CRC, unit ID, function code and response byte count with bounded serial timeouts. It supports 8 data bits, N/E/O parity, 1/2 stop bits and common baud rates from 1200 to 115200. This is a reference adapter, NOT commissioned on real hardware.

Production paths must use a stable `/dev/serial/by-id/`, `/dev/ttyUSB*` or `/dev/ttyACM*` device. PTYs are test-only. For RS-485 use an isolated, correctly rated USB-RS485 adapter and have the site electrical engineer confirm termination, grounding, biasing and topology. Never guess register addresses.

Set `SHUTTLE_ADAPTER_FACTORY=adapters.modbus_rtu:create_adapter`; use exact OEM-approved serial settings and register map.

### Bluetooth LE GATT explorer — nearby device discovery

The Android/iOS app includes a native BLE central-role reference explorer using the Capacitor 8-compatible `@capacitor-community/bluetooth-le` plugin. The user opens Connections and selects **Scan for BLE devices / ابحث عن أجهزة BLE**. The explorer scans nearby BLE advertisements, lists discovered peripherals by name/address and RSSI, and lets the user select one to connect, discover GATT services/characteristics, read readable characteristics and subscribe to notify/indicate updates. Raw values are displayed as HEX.

**This is BLE peripheral discovery, not automatic identification of a shuttle.** It can list any nearby BLE peripheral. A device name, RSSI or successful GATT connection does not prove that the peripheral is a Cassioli, Craftsman, ACME or shuttle controller. The BLE explorer is a reference adapter, NOT commissioned on real hardware. No installed shuttle is paired or identified by this repository. Vendor UUID mapping and a validated payload decoder are required before a raw value can become trusted telemetry.

The explorer exposes no characteristic-write controls and does not decode unknown payloads into shuttle state or battery measurements. It is not Bluetooth Classic/RFCOMM.

### MQTT reference adapter

`industrial-gateway/adapters/mqtt.py` is a generic reference subscriber for timestamped JSON telemetry. It subscribes only to concrete topics in the exact approved tag map, rejects wildcard topics and requires TLS certificate validation for non-loopback brokers. It has no publish method. This is a reference adapter, NOT commissioned on real hardware.

Set `SHUTTLE_ADAPTER_FACTORY=adapters.mqtt:create_adapter`; configure a real vendor-approved broker, TLS trust, credentials, transport and topic/payload map in protected settings.

### OPC UA reference adapter

`industrial-gateway/adapters/opc_ua.py` is a reference OPC UA client using `Basic256Sha256,SignAndEncrypt`, client certificate/private key, pinned server certificate and exact NodeId allow-list. It performs DataValue reads only; no writes or method calls. This is a reference adapter, NOT commissioned on real hardware.

Set `SHUTTLE_ADAPTER_FACTORY=adapters.opc_ua:create_adapter`; actual client/server certificates, a read-only account and OEM-approved NodeIds are required.

### REST API reference adapter

`industrial-gateway/adapters/rest_api.py` is a reference reader for documented JSON endpoints using GET only. It enforces HTTPS except explicit loopback tests, exact hostname allow-listing, rejects redirects, bounds response size/time and requires timestamped values at approved JSON Pointers. This is a reference adapter, NOT commissioned on real hardware.

Set `SHUTTLE_ADAPTER_FACTORY=adapters.rest_api:create_adapter`; use the manufacturer's approved endpoint, auth method and payload schema.

### WebSocket reference adapter

`industrial-gateway/adapters/websocket_stream.py` is a reference WSS reader for pre-authorized JSON push feeds. It validates TLS/origin, uses approved credentials and reads only documented tags; it never sends app frames or control commands. This is a reference adapter, NOT commissioned on real hardware.

Set `SHUTTLE_ADAPTER_FACTORY=adapters.websocket_stream:create_adapter`. A gateway requiring a subscription frame, vendor binary decoder or custom handshake needs a separate vendor-specific implementation.

## Not implemented as built-in drivers

- Bluetooth Classic / RFCOMM requires a separate native Android implementation, pairing and protocol specification.
- Siemens S7, EtherNet/IP, PROFINET and CANopen require separate drivers for the exact controller family and firmware.
- Native direct USB serial from the Android phone is not implemented. USB serial conversion is handled only by the Linux edge-gateway Modbus RTU reference adapter.
- Industrial proprietary RF requires the exact vendor receiver/gateway, frequency, modulation, pairing, encryption and application protocol. A phone cannot generically decode proprietary RF traffic.
- Vendor SDK/API and proprietary drivers require official documentation, credentials and explicit read-only authorization.

Do not show any connection as LIVE until a driver has passed isolated bench tests and supervised site read-only commissioning. See `HARDWARE_COMMISSIONING_REGISTER.md`, `VENDOR_INTEGRATION_QUESTIONNAIRE.md` and `INDUSTRIAL_SYSTEM_REQUIREMENTS.md`.

## Safety boundary

This is a supervisory monitoring layer, not a safety PLC or motion controller. The initial release is read-only. Never send shuttle movement, lift, fork, charge, reset, acknowledge, enable/disable or safety-bypass commands through this application.
