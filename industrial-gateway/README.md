# Industrial read-only telemetry gateway

A small Python-standard-library edge service for the Shuttle Car Automation application. It provides a secured read API and a secured ingestion boundary for **vendor-approved, read-only adapters**. It contains no PLC driver, no guessed register map and no machine-control endpoints.

## Current commissioning state

The example asset register contains the currently known five fleet identities, but the gateway itself is manufacturer-agnostic: any non-empty manufacturer and exact model/firmware can be registered. Every example asset remains disabled and uncommissioned by default. A live asset must declare approved `transports`, `protocols`, adapter identity and allowed tags. This is intentional.

The gateway cannot produce real telemetry until a qualified integrator obtains the manufacturer's documentation, configures a compatible adapter, fills in the asset register and commissions the read-only path against the physical HMI. This branch includes generic read-only Modbus TCP and Modbus RTU serial adapters; both require the exact OEM-approved register map. It does not include manufacturer-specific register maps or drivers for proprietary interfaces. See `../UNIVERSAL_CONNECTIVITY.md` for the exact status of each connection family.

## Run locally

1. Copy config.example.json to config.json.
2. Use Python 3.11 or later.
3. Generate two different random secrets (at least 32 characters) for SHUTTLE_GATEWAY_READ_TOKEN and SHUTTLE_GATEWAY_INGEST_TOKEN.
4. Set SHUTTLE_GATEWAY_ALLOWED_ORIGINS to the exact approved app origins.
5. Run: python gateway.py

The service binds to 127.0.0.1:8765 by default. Do not expose that listener directly to a plant or public network. For remote access, use the plant-approved OT architecture: firewall allowlists, VPN or managed identity-aware access, and a TLS reverse proxy. Set a non-loopback bind only after OT approval. Never place PLC credentials in the mobile application.

For container deployment, the included Dockerfile listens on the container interface and uses the disabled example asset register. Run it only on a private container network behind an approved TLS reverse proxy; do not publish an unencrypted host port. Mount the commissioned asset JSON as a read-only file and set SHUTTLE_GATEWAY_CONFIG to its container path. Supply the two tokens through the deployment secret manager, not a committed file.

## API contract

- GET /health — minimal unauthenticated process health.
- GET /v1/status — read token required; returns configuration and sample freshness metadata.
- GET /v1/assets — read token required; returns the commissioned asset register.
- GET /v1/telemetry?assetId=SC-01&limit=50 — read token required; returns stored telemetry.
- POST /v1/telemetry — ingest token required; accepts one sample from a trusted vendor adapter.

The ingest body requires assetId, manufacturer, model, firmware, adapterId, adapterVersion, tag, value and timezone-aware sourceTimestamp. The configured asset must be enabled, the identity, selected transport and protocol must match exactly, and tag must be in allowed_tags. The gateway assigns provenance LIVE_VENDOR itself; clients cannot self-assert it. The value must be finite and non-null. Samples include quality, source time and gateway receive time.

The gateway uses SQLite with WAL mode and retains the newest 500,000 samples by default. Set SHUTTLE_GATEWAY_MAX_SAMPLES to change the cap. No control, command, reset, motion, charging or PLC-write route exists.

## Vendor adapter contract and runner

The repository includes `adapter_contract.py`, `adapter_runner.py` and `adapters/modbus_tcp.py`. After an approved adapter module has been implemented for the exact controller and signed off by the OT team, configure these environment values on the gateway host: SHUTTLE_ADAPTER_ASSET_ID, SHUTTLE_ADAPTER_FACTORY (module_name:factory_name), SHUTTLE_ADAPTER_SETTINGS (optional protected JSON path), SHUTTLE_ADAPTER_POLL_SECONDS, SHUTTLE_GATEWAY_INGEST_TOKEN and SHUTTLE_GATEWAY_INGEST_URL. Run `python adapter_runner.py` from this directory. The factory receives the commissioned asset identity, approved transport/protocol lists and approved tag list plus the protected adapter settings. It must return an object with an identity record (adapter_id, manufacturer, model, firmware, transport, protocol, version), a synchronous `read(tags)` method and an optional `close()` method. The runner validates the identity and every sample against the commissioned configuration before sending it to the local gateway. Do not commit vendor modules or adapter settings.

The generic Modbus TCP and RTU adapters use only read function codes 3 and 4. Its protected settings must specify a private OT host, port, unit ID, selected approved transport and an exact manufacturer-approved register_map matching allowed_tags. It supports uint16, int16, uint32, int32 and float32 with explicit scaling and byte order. It performs no writes. The Modbus RTU adapter uses a protected Linux serial device path, validates RTU CRCs and supports explicit baudrate/parity/stopbits. Other transports/protocols need their own native or edge adapters.

A vendor adapter is a separately reviewed, trusted process on the OT gateway. It must:
- Use the exact interface and tag/register map supplied or approved by the manufacturer.
- Use a read-only account/certificate and enforce bounded polling, timeouts and reconnect backoff.
- Publish only approved tags to POST /v1/telemetry with the ingest token.
- Keep PLC/vendor credentials on the gateway, never in the app.
- Preserve source timestamps and quality; never synthesize readings or convert missing values to zero.
- Fail closed on unexpected model, firmware, tag, quality or communications changes.

Do not implement Modbus/OPC UA/MQTT/BLE adapters by guessing addresses, ports, scaling or security settings. Each vendor adapter requires the relevant equipment details and written OT authorization.

## Security notes

- Both tokens are mandatory, different and at least 32 characters.
- Read and ingest credentials are separate.
- CORS is exact-origin allowlisted; wildcard origins are not supported.
- Responses are no-store and include basic hardening headers.
- The listener defaults to loopback. Do not use plain HTTP over Wi-Fi or untrusted networks.
- Use TLS termination, network segmentation and an approved VPN/identity layer for mobile access.
- The mobile UI keeps the read token in component memory only; it is not written to localStorage.
- This service is not a safety system and must not be used to stop, move or protect machinery.

## Test

Run: python -m unittest -v
