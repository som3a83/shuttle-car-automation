import json
import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import websocket

from adapters.websocket_stream import WebSocketReadOnlyAdapter


class WebSocketReadOnlyAdapterTests(unittest.TestCase):
    def setUp(self):
        self.asset = {
            "id": "WS-01", "manufacturer": "Generic OEM", "model": "Push Gateway",
            "firmware": "1.2", "adapter_id": "generic-ws-ro",
            "transports": ["ethernet", "wifi"], "protocols": ["websocket"],
            "allowed_tags": ["battery.soc"]
        }
        self.settings = {
            "url": "wss://gateway.factory.local/telemetry",
            "allowed_hosts": ["gateway.factory.local"],
            "transport": "wifi", "read_timeout_seconds": 2,
            "bearer_token": "secret-from-vault",
            "units": {"battery.soc": "%"}
        }

    def test_receives_read_only_timestamped_telemetry_over_wss(self):
        fake = MagicMock()
        fake.recv.return_value = json.dumps({
            "tag": "battery.soc", "value": 78.2, "sourceTimestamp": datetime.now(timezone.utc).isoformat()
        })
        with patch("adapters.websocket_stream.websocket.create_connection", return_value=fake) as create:
            adapter = WebSocketReadOnlyAdapter(self.asset, self.settings)
            results = adapter.read(["battery.soc"])
        kwargs = create.call_args.kwargs
        self.assertEqual(kwargs["sslopt"]["cert_reqs"], 2)
        self.assertTrue(kwargs["sslopt"]["check_hostname"])
        self.assertEqual(kwargs["header"], ["Authorization: Bearer secret-from-vault"])
        self.assertEqual(results[0].tag, "battery.soc")
        self.assertEqual(results[0].value, 78.2)
        self.assertEqual(results[0].unit, "%")
        self.assertTrue(results[0].source_timestamp.endswith("Z"))
        fake.close.assert_called_once_with()
        fake.send.assert_not_called()

    def test_rejects_public_ws_and_unapproved_transport_protocol(self):
        with self.assertRaises(ValueError):
            WebSocketReadOnlyAdapter(self.asset, {**self.settings, "url": "ws://8.8.8.8/telemetry"})
        with self.assertRaises(ValueError):
            WebSocketReadOnlyAdapter(self.asset, {**self.settings, "transport": "bluetooth-le"})
        with self.assertRaises(ValueError):
            WebSocketReadOnlyAdapter({**self.asset, "protocols": ["mqtt"]}, self.settings)

    def test_rejects_unknown_tags_and_invalid_timestamps(self):
        fake = MagicMock()
        fake.recv.return_value = json.dumps({"tag": "other.tag", "value": 1, "sourceTimestamp": "2026-11-18T00:00:00Z"})
        fake.recv.side_effect = [fake.recv.return_value, websocket.WebSocketTimeoutException()]
        with patch("adapters.websocket_stream.websocket.create_connection", return_value=fake):
            adapter = WebSocketReadOnlyAdapter(self.asset, self.settings)
            self.assertEqual(adapter.read(["battery.soc"]), [])
        with self.assertRaises(ValueError):
            WebSocketReadOnlyAdapter(self.asset, {**self.settings, "units": {"machine.start": ""}})


if __name__ == "__main__":
    unittest.main()
