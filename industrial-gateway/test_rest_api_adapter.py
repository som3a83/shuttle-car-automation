import json
import threading
import unittest
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

from adapters.rest_api import RestReadOnlyAdapter


class RestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/redirect":
            self.send_response(302)
            self.send_header("Location", "http://example.com/leak")
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        body = json.dumps({
            "data": {
                "battery": {
                    "soc": {
                        "value": 76.5, "unit": "%", "quality": "GOOD",
                        "sourceTimestamp": datetime.now(timezone.utc).isoformat()
                    }
                }
            }
        }).encode()
        self.wfile.write(body)

    def log_message(self, *args):
        return


class RestReadOnlyAdapterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), RestHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.thread.join(timeout=2)
        cls.server.server_close()

    def setUp(self):
        self.asset = {
            "id": "REST-01", "manufacturer": "Generic OEM", "model": "HTTP Shuttle",
            "firmware": "2.4", "adapter_id": "generic-rest-ro",
            "transports": ["ethernet", "wifi"], "protocols": ["rest-api"],
            "allowed_tags": ["battery.soc"]
        }
        self.settings = {
            "base_url": "http://127.0.0.1:" + str(self.server.server_port) + "/",
            "allow_loopback": True,
            "transport": "ethernet",
            "endpoints": {
                "battery.soc": {
                    "path": "api/telemetry",
                    "json_pointer": "/data/battery/soc",
                    "unit": "%"
                }
            }
        }

    def test_reads_only_approved_get_endpoint_and_extracts_source_timestamp(self):
        adapter = RestReadOnlyAdapter(self.asset, self.settings)
        result = adapter.read(["battery.soc"])
        self.assertEqual(result[0].value, 76.5)
        self.assertEqual(result[0].unit, "%")
        self.assertEqual(result[0].quality, "GOOD")
        self.assertTrue(result[0].source_timestamp.endswith("Z"))

    def test_rejects_public_http_and_unapproved_transport_protocol(self):
        with self.assertRaises(ValueError):
            RestReadOnlyAdapter(self.asset, {**self.settings, "base_url": "http://8.8.8.8:80/"})
        with self.assertRaises(ValueError):
            RestReadOnlyAdapter(self.asset, {**self.settings, "transport": "bluetooth-le"})
        with self.assertRaises(ValueError):
            RestReadOnlyAdapter({**self.asset, "protocols": ["mqtt"]}, self.settings)

    def test_rejects_redirect_to_another_origin(self):
        with self.assertRaises(Exception):
            adapter = RestReadOnlyAdapter(self.asset, {
                **self.settings, "endpoints": {"battery.soc": {"path": "redirect", "json_pointer": "/data/battery/soc"}}
            })
            adapter.read(["battery.soc"])

    def test_requires_exact_endpoint_map_and_safe_paths(self):
        with self.assertRaises(ValueError):
            RestReadOnlyAdapter(self.asset, {**self.settings, "endpoints": {"other": {"path": "api"}}})
        with self.assertRaises(ValueError):
            RestReadOnlyAdapter(self.asset, {**self.settings, "endpoints": {"battery.soc": {"path": "../admin"}}})


if __name__ == "__main__":
    unittest.main()
