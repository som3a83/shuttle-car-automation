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

### Generic Modbus RTU over RS-232 / RS-485 / USB serial — read only

`industrial-gateway/adapters/modbus_rtu.py` adds a Linux edge-gateway serial adapter using Modbus RTU function codes 3 and 4 only. It validates frame CRC, unit ID, function code and response byte count, with bounded serial timeouts and an exact approved register map. It supports 8 data bits, N/E/O parity, 1 or 2 stop bits, and common baud rates from 1200 to 115200.

Configure `SHUTTLE_ADAPTER_FACTORY=adapters.modbus_rtu:create_adapter` and store the serial settings in the protected gateway settings file. A production path must be a stable `/dev/serial/by-id/`, `/dev/ttyUSB*` or `/dev/ttyACM*` device. Pseudo-terminals are accepted only by isolated tests. For RS-485, use an isolated, correctly rated USB-RS485 adapter with automatic direction control or a vendor-approved interface; confirm biasing, termination, grounding and cable topology with the site electrical engineer.

Example protected serial settings:

```json
{
  "device": "/dev/serial/by-id/usb-Approved_Isolated_RS485_Adapter",
  "transport": "rs485",
  "baudrate": 9600,
  "parity": "N",
  "stopbits": 1,
  "unit_id": 1,
  "timeout_seconds": 1.5,
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

The selected asset must explicitly allow `rs485` or `usb-serial` as its transport and `modbus-rtu` as its protocol. The map must come from the exact manufacturer's approved documentation. Never guess Modbus addresses.

## Generic Bluetooth LE GATT explorer

The Android/iOS application now includes a native BLE central-role explorer using the Capacitor 8-compatible `@capacitor-community/bluetooth-le` plugin. It can scan nearby BLE advertisements, connect to a selected peripheral, discover exposed GATT services/characteristics, read characteristics that advertise the read property, and subscribe to notify/indicate characteristics. Raw bytes are shown as HEX. The explorer contains no characteristic-write functions and does not decode unknown payloads into shuttle state or battery measurements.

Use this explorer to confirm that a machine or vendor gateway actually exposes BLE and to collect its documented GATT service/characteristic UUIDs. A manufacturer-specific decoder and approved read-only tag mapping are still needed before raw values become trusted LIVE_VENDOR telemetry. Test the installed APK against the actual equipment on a physical Android device.

## Not yet implemented as built-in drivers

- Bluetooth Classic / RFCOMM is not supported by the BLE GATT plugin and needs a separate Android native Classic serial implementation plus device pairing and protocol specification.
- Modbus RTU is now implemented as a generic read-only Linux serial adapter; it still requires a real serial/RS-485 interface and exact OEM-approved register map.
- OPC UA, MQTT, REST, WebSocket, S7, EtherNet/IP, PROFINET and CANopen require separate protocol adapters and tested dependencies.
- USB serial has a Modbus RTU edge-gateway adapter path when used with a compatible serial/RS-485 converter; native direct USB from the Android phone is not implemented.
- Industrial RF requires the exact vendor radio receiver/gateway, frequency, modulation, pairing, encryption and application protocol. A phone cannot generically decode proprietary RF traffic.
- Industrial RF requires the exact vendor radio receiver/gateway, frequency, modulation, pairing, encryption and application protocol. A phone cannot generically decode proprietary RF traffic.
- Vendor SDK/API and proprietary drivers require the vendor's official documentation, credentials and explicit third-party read-only authorization.

Do not show any connection as LIVE until a built adapter has passed an isolated bench test and a supervised site read-only commissioning. See `HARDWARE_COMMISSIONING_REGISTER.md`, `VENDOR_INTEGRATION_QUESTIONNAIRE.md` and `INDUSTRIAL_SYSTEM_REQUIREMENTS.md`.

## Safety boundary

This is a supervisory monitoring layer, not a safety PLC or motion controller. The initial release is read-only. Never send shuttle movement, lift, fork, charge, reset, acknowledge, enable/disable or safety-bypass commands through this application.
