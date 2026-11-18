import os
import pty
import struct
import threading
import unittest

from adapters.modbus_rtu import (
    ModbusRtuReadOnlyAdapter, add_crc, modbus_crc16, valid_crc
)


class ModbusRtuReadOnlyAdapterTests(unittest.TestCase):
    def setUp(self):
        self.master, self.slave = pty.openpty()
        self.device = os.ttyname(self.slave)
        self.asset = {
            "id": "SERIAL-01", "manufacturer": "Any Shuttle OEM", "model": "RTU Model",
            "firmware": "2.0", "adapter_id": "generic-rtu-ro",
            "transports": ["rs485", "usb-serial"], "protocols": ["modbus-rtu"],
            "allowed_tags": ["battery.soc"]
        }

    def tearDown(self):
        for descriptor in (self.master, self.slave):
            try:
                os.close(descriptor)
            except OSError:
                pass

    def _respond(self, value=64):
        request = bytearray()
        while len(request) < 8:
            request.extend(os.read(self.master, 8 - len(request)))
        unit, function, address, count = struct.unpack(">BBHH", request[:6])
        self.assertEqual(unit, 1)
        self.assertEqual(function, 3)
        self.assertEqual(address, 120)
        self.assertEqual(count, 1)
        response = add_crc(bytes((unit, function, 2, (value >> 8) & 0xFF, value & 0xFF)))
        os.write(self.master, response)

    def test_reads_holding_register_via_serial_pty_test_device(self):
        thread = threading.Thread(target=self._respond, daemon=True)
        thread.start()
        adapter = ModbusRtuReadOnlyAdapter(self.asset, {
            "device": self.device, "allow_test_device": True, "transport": "rs485",
            "baudrate": 9600, "parity": "N", "stopbits": 1, "unit_id": 1,
            "register_map": {"battery.soc": {"address": 120, "data_type": "uint16", "unit": "%", "scale": 1}}
        })
        result = adapter.read(["battery.soc"])
        thread.join(timeout=2)
        self.assertEqual(adapter.identity.protocol, "modbus-rtu")
        self.assertEqual(result[0].value, 64)
        self.assertEqual(result[0].quality, "GOOD")

    def test_crc_helpers_match_known_modbus_frame(self):
        frame = add_crc(bytes.fromhex("010300000001"))
        self.assertTrue(valid_crc(frame))
        self.assertEqual(modbus_crc16(bytes.fromhex("010300000001")), int.from_bytes(frame[-2:], "little"))

    def test_rejects_unapproved_serial_path_transport_and_protocol(self):
        with self.assertRaises(ValueError):
            ModbusRtuReadOnlyAdapter(self.asset, {"device": "/etc/passwd", "allow_test_device": True, "register_map": {"battery.soc": {"address": 1}}})
        with self.assertRaises(ValueError):
            ModbusRtuReadOnlyAdapter(self.asset, {
                "device": self.device, "allow_test_device": True, "transport": "wifi",
                "protocols": ["modbus-rtu"], "register_map": {"battery.soc": {"address": 1}}
            })

    def test_requires_exact_approved_tag_map(self):
        with self.assertRaises(ValueError):
            ModbusRtuReadOnlyAdapter(self.asset, {
                "device": self.device, "allow_test_device": True,
                "register_map": {"machine.start": {"address": 1}}
            })


if __name__ == "__main__":
    unittest.main()
