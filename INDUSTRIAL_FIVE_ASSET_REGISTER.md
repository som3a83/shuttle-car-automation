# Commissioning inventory — five shuttle assets

These are application placeholders, not confirmed manufacturer asset IDs. Replace identity fields only from physical nameplates and vendor records.

| Application ID | Manufacturer | Model | Serial | Controller / PLC | Firmware | Approved interface | Commissioning |
|---|---|---|---|---|---|---|---|
| SC-01 | Cassioli | Pending | Pending | Pending | Pending | Pending | NOT_CONFIGURED |
| SC-02 | Cassioli | Pending | Pending | Pending | Pending | Pending | NOT_CONFIGURED |
| SC-03 | Cassioli | Pending | Pending | Pending | Pending | Pending | NOT_CONFIGURED |
| SC-04 | Craftsman | Pending | Pending | Pending | Pending | Pending | NOT_CONFIGURED |
| SC-05 | ACME | Pending | Pending | Pending | Pending | Pending | NOT_CONFIGURED |

## Required per-asset evidence
- Full external nameplate photo: model, serial, manufacturer, electrical ratings.
- Controller/PLC make and model, firmware, HMI model and software version.
- Radio/Wi-Fi/Ethernet module model and vendor-approved communication manual.
- Vendor-issued read-only tag/register map with units, scaling, quality and polling limits.
- Written site OT authorization, gateway placement, firewall allowlist and test window.

## Battery register
For every pack: manufacturer, model, serial, chemistry, nominal voltage, Ah, BMS model/firmware, charger model and approved read-only telemetry method. Do not assume battery packs or interfaces are interchangeable.

## Security handling
Never commit IP addresses, credentials, certificates, QR access tokens, VPN profiles or private network diagrams to this public repository. Keep site-specific commissioning records in an access-controlled location.
