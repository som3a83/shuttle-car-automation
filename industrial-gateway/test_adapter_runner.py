import unittest
from dataclasses import dataclass

from adapter_runner import build_ingest_payload, validate_adapter_identity, validate_ingest_url


class AdapterRunnerTests(unittest.TestCase):
    def setUp(self):
        self.asset = {
            "id": "SC-01", "manufacturer": "Cassioli", "model": "Exact model",
            "firmware": "1.0.0", "adapter_id": "cass-ro-01", "transports": ["wifi"],
            "protocols": ["modbus-tcp"], "allowed_tags": {"battery.soc"}
        }
        self.identity = {
            "adapter_id": "cass-ro-01", "manufacturer": "Cassioli", "model": "Exact model",
            "firmware": "1.0.0", "transport": "wifi", "protocol": "modbus-tcp", "version": "0.1.0"
        }

    def test_adapter_identity_must_match_asset(self):
        result = validate_adapter_identity(self.identity, self.asset)
        self.assertEqual(result["adapterId"], "cass-ro-01")
        with self.assertRaises(ValueError):
            validate_adapter_identity({**self.identity, "firmware": "unknown"}, self.asset)
        with self.assertRaises(ValueError):
            validate_adapter_identity({**self.identity, "transport": "unapproved-radio"}, self.asset)

    def test_reading_is_mapped_without_synthesizing_values(self):
        payload = build_ingest_payload(self.asset, validate_adapter_identity(self.identity, self.asset), {
            "tag": "battery.soc", "value": 0, "unit": "%", "source_timestamp": "2026-11-17T00:00:00Z"
        })
        self.assertEqual(payload["value"], 0)
        self.assertEqual(payload["tag"], "battery.soc")
        self.assertEqual(payload["adapterVersion"], "0.1.0")
        self.assertEqual(payload["transport"], "wifi")
        self.assertEqual(payload["protocol"], "modbus-tcp")

    def test_network_ingest_must_use_https_except_loopback(self):
        self.assertEqual(validate_ingest_url("https://gateway.local/v1/telemetry"), "https://gateway.local/v1/telemetry")
        self.assertEqual(validate_ingest_url("http://127.0.0.1:8765/v1/telemetry"), "http://127.0.0.1:8765/v1/telemetry")
        with self.assertRaises(ValueError):
            validate_ingest_url("http://192.168.1.20:8765/v1/telemetry")
        with self.assertRaises(ValueError):
            validate_ingest_url("https://gateway.local/v1/control")


if __name__ == "__main__":
    unittest.main()
