import json
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from adapters.mqtt import MqttReadOnlyAdapter


class FakeMqttClient:
    def __init__(self, **kwargs):
        self.kwargs = kwargs
        self.subscriptions = []
        self.tls_configured = False
        self.insecure = None
        self.on_connect = None
        self.on_message = None

    def username_pw_set(self, username, password=None):
        self.credentials = (username, password)

    def tls_set(self, **kwargs):
        self.tls_configured = True
        self.tls_kwargs = kwargs

    def tls_insecure_set(self, value):
        self.insecure = value

    def connect(self, host, port, keepalive):
        self.connection = (host, port, keepalive)

    def subscribe(self, topic, qos=0):
        self.subscriptions.append((topic, qos))

    def loop_start(self):
        self.on_connect(self, None, {}, 0, None)
        stamp = datetime.now(timezone.utc).isoformat()
        for topic in ("plant/shuttle-01/battery/soc", "plant/shuttle-01/state"):
            self.on_message(self, None, SimpleNamespace(
                topic=topic,
                payload=json.dumps({"value": 81 if topic.endswith("soc") else "RUNNING",
                                    "unit": "%" if topic.endswith("soc") else None,
                                    "sourceTimestamp": stamp, "quality": "GOOD"}).encode()
            ))

    def disconnect(self):
        return 0

    def loop_stop(self):
        return None


class MqttReadOnlyAdapterTests(unittest.TestCase):
    def setUp(self):
        self.asset = {
            "id": "MQTT-01", "manufacturer": "Generic OEM", "model": "MQTT Shuttle",
            "firmware": "4.0", "adapter_id": "generic-mqtt-ro",
            "transports": ["ethernet", "wifi"], "protocols": ["mqtt"],
            "allowed_tags": ["battery.soc", "shuttle.state"]
        }
        self.settings = {
            "host": "broker.factory.local", "allowed_hosts": ["broker.factory.local"],
            "port": 8883, "tls": True, "username": "read-only",
            "password": "injected-from-protected-secret-store",
            "transport": "ethernet", "read_timeout_seconds": 1,
            "topics": {
                "battery.soc": "plant/shuttle-01/battery/soc",
                "shuttle.state": "plant/shuttle-01/state"
            }
        }

    def test_subscribes_only_to_approved_topics_and_returns_timestamped_readings(self):
        fake = FakeMqttClient()
        with patch("adapters.mqtt.mqtt.Client", return_value=fake) as client_factory:
            adapter = MqttReadOnlyAdapter(self.asset, self.settings)
            adapter._settings = self.settings
            results = adapter.read(["battery.soc", "shuttle.state"])

        client_factory.assert_called_once()
        self.assertEqual(fake.subscriptions, [
            ("plant/shuttle-01/battery/soc", 1),
            ("plant/shuttle-01/state", 1)
        ])
        self.assertTrue(fake.tls_configured)
        self.assertFalse(fake.insecure)
        self.assertEqual(fake.credentials[0], "read-only")
        self.assertEqual([item.tag for item in results], ["battery.soc", "shuttle.state"])
        self.assertEqual(results[0].value, 81)
        self.assertEqual(results[0].quality, "GOOD")
        self.assertTrue(results[0].source_timestamp.endswith("Z"))

    def test_rejects_unapproved_transport_protocol_and_missing_tls(self):
        with self.assertRaises(ValueError):
            MqttReadOnlyAdapter(self.asset, {**self.settings, "transport": "bluetooth-le"})
        with self.assertRaises(ValueError):
            MqttReadOnlyAdapter({**self.asset, "protocols": ["modbus-tcp"]}, self.settings)
        with self.assertRaises(ValueError):
            MqttReadOnlyAdapter(self.asset, {**self.settings, "tls": False})

    def test_requires_exact_topics_and_rejects_wildcards(self):
        with self.assertRaises(ValueError):
            MqttReadOnlyAdapter(self.asset, {**self.settings, "topics": {"battery.soc": "plant/#"}})
        with self.assertRaises(ValueError):
            MqttReadOnlyAdapter(self.asset, {**self.settings, "topics": {"battery.soc": "plant/battery"}})

    def test_rejects_public_broker_ip(self):
        with self.assertRaises(ValueError):
            MqttReadOnlyAdapter(self.asset, {**self.settings, "host": "1.1.1.1"})


if __name__ == "__main__":
    unittest.main()
