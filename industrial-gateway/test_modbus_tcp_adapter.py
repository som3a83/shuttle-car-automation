import socket
import struct
import threading
import unittest

from adapters.modbus_tcp import ModbusTcpReadOnlyAdapter, _decode_registers


class ModbusTcpReadOnlyAdapterTests(unittest.TestCase):
    def setUp(self):
        self.asset = {
            "id": "TEST-01", "manufacturer": "Any Shuttle OEM", "model": "Model X",
            "firmware": "1.0", "adapter_id": "generic-modbus-ro",
            "transports": ["ethernet", "wifi"], "protocols": ["modbus-tcp"],
            "allowed_tags": ["battery.soc"]
        }

    def _server(self, value=73):
        server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server.bind(("127.0.0.1", 0))
        server.listen(1)
        port = server.getsockname()[1]

        def serve():
            try:
                conn, _ = server.accept()
                with conn:
                    request = b""
                    while len(request) < 12:
                        chunk = conn.recv(12 - len(request))
                        if not chunk:
                            return
                        request += chunk
                    tid, protocol_id, length, unit_id = struct.unpack(">HHHB", request[:7])
                    function, address, quantity = struct.unpack(">BHH", request[7:12])
                    if function not in (3, 4):
                        return
                    data = struct.pack(">H", value) * quantity
                    body = struct.pack(">BB", function, len(data)) + data
                    response = struct.pack(">HHHB", tid, protocol_id, len(body) + 1, unit_id) + body
                    conn.sendall(response)
            finally:
                server.close()

        thread = threading.Thread(target=serve, daemon=True)
        thread.start()
        return port, thread

    def test_reads_a_single_holding_register_over_private_test_loopback(self):
        port, thread = self._server(73)
        adapter = ModbusTcpReadOnlyAdapter(self.asset, {
            "host": "127.0.0.1", "port": port, "allow_loopback": True,
            "transport": "ethernet",
            "register_map": {"battery.soc": {"address": 100, "data_type": "uint16", "unit": "%"}}
        })
        result = adapter.read(["battery.soc"])
        thread.join(timeout=2)
        self.assertEqual(adapter.identity.protocol, "modbus-tcp")
        self.assertEqual(result[0].value, 73)
        self.assertEqual(result[0].quality, "GOOD")
        self.assertTrue(result[0].source_timestamp.endswith("Z"))

    def test_decodes_supported_32_bit_byte_orders(self):
        self.assertEqual(_decode_registers(bytes.fromhex("0000002A"), "uint32", "ABCD"), 42)
        self.assertEqual(_decode_registers(bytes.fromhex("002A0000"), "uint32", "CDAB"), 42)
        self.assertAlmostEqual(_decode_registers(bytes.fromhex("3F800000"), "float32", "ABCD"), 1.0)

    def test_rejects_public_hosts_and_unapproved_transport(self):
        with self.assertRaises(ValueError):
            ModbusTcpReadOnlyAdapter(self.asset, {"host": "8.8.8.8", "register_map": {"battery.soc": {"address": 1}}})
        with self.assertRaises(ValueError):
            ModbusTcpReadOnlyAdapter(self.asset, {
                "host": "127.0.0.1", "allow_loopback": True, "transport": "bluetooth-le",
                "register_map": {"battery.soc": {"address": 1}}
            })

    def test_requires_exact_approved_tag_map(self):
        with self.assertRaises(ValueError):
            ModbusTcpReadOnlyAdapter(self.asset, {
                "host": "127.0.0.1", "allow_loopback": True,
                "register_map": {"plc.start_command": {"address": 1}}
            })


if __name__ == "__main__":
    unittest.main()
