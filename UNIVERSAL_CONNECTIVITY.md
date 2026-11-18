# Universal Shuttle Connectivity

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

## Implemented driver in this branch

### Generic Modbus TCP — read only

`industrial-gateway/adapters/modbus_tcp.py` contains a generic Modbus TCP reader for a shuttle/controller that explicitly supports Modbus TCP. It uses function code 3 (Read Holding Registers) and function code 4 (Read Input Registers) only. It has no write-register, write-coil, reset, movement or charging commands.

Supported register data types: `uint16`, `int16`, `uint32`, `int32`, and `float32`. Scaling, offset, unit and byte order are configurable from the approved register map. The driver enforces private OT IP addresses, bounded timeouts and register counts, and validates response transaction IDs, unit IDs, function codes and byte counts.

This driver still requires the exact model's manufacturer-approved register map. A register address must never be guessed from another machine or from a generic Modbus example.

Example protected settings file (replace every placeholder only with values approved for the exact machine):

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

The configured `register_map` must exactly match `allowed_tags` in the asset configuration. The settings file belongs on the secured gateway host and must not be committed to GitHub.

Configure the gateway environment:
- `SHUTTLE_ADAPTER_ASSET_ID`: commissioned asset ID.
- `SHUTTLE_ADAPTER_FACTORY=adapters.modbus_tcp:create_adapter`.
- `SHUTTLE_ADAPTER_SETTINGS`: protected path to the settings JSON.
- `SHUTTLE_ADAPTER_POLL_SECONDS`: approved polling interval.
- `SHUTTLE_GATEWAY_INGEST_TOKEN` and `SHUTTLE_GATEWAY_INGEST_URL`.

The asset's `transports` list must include the selected transport (for example `ethernet` or `wifi`) and its `protocols` list must include `modbus-tcp`. The adapter declares the selected path for every reading; the gateway rejects readings from undeclared transports or protocols and persists those fields with the sample.

## Not yet implemented as built-in drivers

- Modbus RTU / RS-485 requires a serial-interface adapter and an approved serial device configuration.
- OPC UA, MQTT, REST, WebSocket, S7, EtherNet/IP, PROFINET and CANopen require separate protocol adapters and tested dependencies.
- Bluetooth LE, Bluetooth Classic and USB serial require Android native Capacitor plugins / permissions plus physical-device tests. They are catalogued, not yet active in the APK.
- Industrial RF requires the exact vendor radio receiver/gateway, frequency, modulation, pairing, encryption and application protocol. A phone cannot generically decode proprietary RF traffic.
- Vendor SDK/API and proprietary drivers require the vendor's official documentation, credentials and explicit third-party read-only authorization.

Do not show any connection as LIVE until a built adapter has passed an isolated bench test and a supervised site read-only commissioning. See `HARDWARE_COMMISSIONING_REGISTER.md`, `VENDOR_INTEGRATION_QUESTIONNAIRE.md` and `INDUSTRIAL_SYSTEM_REQUIREMENTS.md`.

## Safety boundary

This is a supervisory monitoring layer, not a safety PLC or motion controller. The initial release is read-only. Never send shuttle movement, lift, fork, charge, reset, acknowledge, enable/disable or safety-bypass commands through this application.
