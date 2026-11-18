import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from adapters.opc_ua import OpcUaReadOnlyAdapter


class OpcUaReadOnlyAdapterTests(unittest.TestCase):
    def setUp(self):
        self.asset = {
            "id": "OPCUA-01", "manufacturer": "Any Shuttle OEM", "model": "UA Model",
            "firmware": "3.0", "adapter_id": "generic-opcua-ro",
            "transports": ["ethernet", "wifi"], "protocols": ["opc-ua"],
            "allowed_tags": ["battery.soc"]
        }
        self.settings = {
            "endpoint_url": "opc.tcp://10.20.30.40:4840/shuttle",
            "transport": "ethernet",
            "client_certificate": "/secure/client-cert.pem",
            "client_private_key": "/secure/client-key.pem",
            "server_certificate": "/secure/server-cert.pem",
            "username": "read-only", "password": "secret-from-vault",
            "nodes": {"battery.soc": {"node_id": "ns=4;s=Battery.StateOfCharge", "unit": "%"}}
        }

    def test_reads_only_approved_nodes_using_pinned_sign_and_encrypt(self):
        fake = MagicMock()
        fake.get_node.return_value.read_data_value.return_value = SimpleNamespace(
            Value=SimpleNamespace(Value=79.5),
            SourceTimestamp=datetime(2026, 11, 18, 16, 0, tzinfo=timezone.utc)
        )
        with patch("adapters.opc_ua.Client", return_value=fake):
            adapter = OpcUaReadOnlyAdapter(self.asset, self.settings)
            result = adapter.read(["battery.soc"])
        fake.set_security_string.assert_called_once_with(
            "Basic256Sha256,SignAndEncrypt,/secure/client-cert.pem,/secure/client-key.pem,/secure/server-cert.pem"
        )
        fake.connect.assert_called_once_with()
        fake.set_user.assert_called_once_with("read-only")
        fake.set_password.assert_called_once_with("secret-from-vault")
        fake.get_node.assert_called_once_with("ns=4;s=Battery.StateOfCharge")
        fake.get_node.return_value.read_data_value.assert_called_once_with(raise_on_bad_status=True)
        self.assertEqual(result[0].value, 79.5)
        self.assertEqual(result[0].unit, "%")
        self.assertEqual(result[0].quality, "GOOD")
        self.assertTrue(result[0].source_timestamp.endswith("Z"))
        fake.disconnect.assert_called_once_with()

    def test_rejects_unpinned_or_unapproved_endpoint_and_insecure_configuration(self):
        with self.assertRaises(ValueError):
            OpcUaReadOnlyAdapter(self.asset, {**self.settings, "endpoint_url": "opc.tcp://8.8.8.8:4840"})
        with self.assertRaises(ValueError):
            OpcUaReadOnlyAdapter(self.asset, {**self.settings, "server_certificate": ""})
        with self.assertRaises(ValueError):
            OpcUaReadOnlyAdapter(self.asset, {**self.settings, "transport": "bluetooth-le"})

    def test_requires_exact_approved_node_map(self):
        with self.assertRaises(ValueError):
            OpcUaReadOnlyAdapter(self.asset, {**self.settings, "nodes": {"machine.start": {"node_id": "ns=4;s=Start"}}})

    def test_rejects_node_without_server_source_timestamp(self):
        with patch("adapters.opc_ua.Client") as client_class:
            fake = client_class.return_value
            fake.get_node.return_value.read_data_value.return_value = SimpleNamespace(
                Value=SimpleNamespace(Value=12), SourceTimestamp=None
            )
            adapter = OpcUaReadOnlyAdapter(self.asset, self.settings)
            with self.assertRaises(ValueError):
                adapter.read(["battery.soc"])


if __name__ == "__main__":
    unittest.main()
