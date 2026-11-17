import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import gateway


class GatewayValidationTests(unittest.TestCase):
    def setUp(self):
        self.config = {
            "assets": {
                "SC-01": {
                    "id": "SC-01", "manufacturer": "Cassioli", "model": "Verified model",
                    "firmware": "1.2.3", "adapter_id": "cassioli-ro-01",
                    "allowed_tags": {"battery.soc", "shuttle.state"}, "enabled": True
                }
            }
        }
        self.sample = {
            "assetId": "SC-01", "manufacturer": "Cassioli", "model": "Verified model",
            "firmware": "1.2.3", "adapterId": "cassioli-ro-01", "adapterVersion": "0.1.0",
            "tag": "battery.soc", "value": 73.5, "unit": "%",
            "sourceTimestamp": "2026-11-17T00:00:00Z", "quality": "GOOD"
        }

    def test_accepts_only_exact_commissioned_read_tag_and_sets_provenance(self):
        result = gateway.validate_ingest(self.sample, self.config)
        self.assertEqual(result["provenance"], "LIVE_VENDOR")
        self.assertEqual(result["value"], 73.5)
        self.assertEqual(result["adapterId"], "cassioli-ro-01")

    def test_uncommissioned_asset_is_rejected(self):
        config = {"assets": {"SC-01": {**self.config["assets"]["SC-01"], "enabled": False}}}
        with self.assertRaises(gateway.GatewayError) as ctx:
            gateway.validate_ingest(self.sample, config)
        self.assertEqual(ctx.exception.status, 409)

    def test_unknown_tag_and_identity_mismatch_are_rejected(self):
        bad_tag = {**self.sample, "tag": "plc.start_command"}
        with self.assertRaises(gateway.GatewayError):
            gateway.validate_ingest(bad_tag, self.config)
        bad_model = {**self.sample, "model": "guessed-model"}
        with self.assertRaises(gateway.GatewayError):
            gateway.validate_ingest(bad_model, self.config)

    def test_null_nan_and_naive_timestamps_are_rejected(self):
        for value in (None, float("nan"), float("inf")):
            with self.subTest(value=value):
                with self.assertRaises(gateway.GatewayError):
                    gateway.validate_ingest({**self.sample, "value": value}, self.config)
        with self.assertRaises(gateway.GatewayError):
            gateway.validate_ingest({**self.sample, "sourceTimestamp": "2026-11-17T00:00:00"}, self.config)

    def test_provenance_cannot_be_overridden_by_sender(self):
        result = gateway.validate_ingest({**self.sample, "provenance": "SIMULATED"}, self.config)
        self.assertEqual(result["provenance"], "LIVE_VENDOR")

    def test_future_timestamp_is_rejected(self):
        future = "2999-01-01T00:00:00Z"
        with self.assertRaises(gateway.GatewayError):
            gateway.validate_ingest({**self.sample, "sourceTimestamp": future}, self.config)


if __name__ == "__main__":
    unittest.main()
