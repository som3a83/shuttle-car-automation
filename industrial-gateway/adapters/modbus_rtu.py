"""Generic read-only Modbus RTU adapter for approved serial shuttle interfaces.

Uses function codes 0x03 (holding registers) and 0x04 (input registers) only.
No write coils/registers, reset, movement, charging or machine-control methods exist.
Linux edge gateway implementation; use a properly rated, isolated RS-485/USB adapter.
"""
from __future__ import annotations

import math
import os
import select
import struct
import termios
import time
from datetime import datetime, timezone
from typing import Any, Mapping, Sequence

from adapter_contract import AdapterIdentity, AdapterReading
from adapters.modbus_tcp import _decode_registers

_ALLOWED_TYPES = {"uint16", "int16", "uint32", "int32", "float32"}
_ALLOWED_REGISTER_TYPES = {"holding", "input"}
_ALLOWED_BYTE_ORDERS = {"ABCD", "BADC", "CDAB", "DCBA", "AB", "BA"}
_BAUD_RATES = {
    1200: termios.B1200, 2400: termios.B2400, 4800: termios.B4800,
    9600: termios.B9600, 19200: termios.B19200, 38400: termios.B38400,
    57600: termios.B57600, 115200: termios.B115200,
}
_PARITY = {"N": "none", "E": "even", "O": "odd"}


def modbus_crc16(payload: bytes) -> int:
    crc = 0xFFFF
    for byte in payload:
        crc ^= byte
        for _ in range(8):
            crc = (crc >> 1) ^ (0xA001 if crc & 1 else 0)
    return crc & 0xFFFF


def add_crc(payload: bytes) -> bytes:
    crc = modbus_crc16(payload)
    return payload + bytes((crc & 0xFF, (crc >> 8) & 0xFF))


def valid_crc(frame: bytes) -> bool:
    if len(frame) < 4:
        return False
    expected = modbus_crc16(frame[:-2])
    return frame[-2:] == bytes((expected & 0xFF, (expected >> 8) & 0xFF))


def validate_serial_path(path: Any, allow_test_device: bool = False) -> str:
    if not isinstance(path, str) or not path.startswith("/dev/"):
        raise ValueError("Serial device must be an explicit /dev path.")
    allowed = (
        path.startswith("/dev/serial/by-id/")
        or path.startswith("/dev/ttyUSB")
        or path.startswith("/dev/ttyACM")
        or (allow_test_device and path.startswith("/dev/pts/"))
    )
    if not allowed:
        raise ValueError("Serial path must be a by-id, ttyUSB or ttyACM device (PTY is test-only).")
    try:
        mode = os.stat(path).st_mode
    except OSError as exc:
        raise ValueError("Serial device does not exist or cannot be accessed.") from exc
    if not os.path.exists(path) or not os.path.realpath(path).startswith("/dev/"):
        raise ValueError("Serial device path is invalid.")
    if not (mode & 0o020000):
        # Linux S_IFCHR without importing stat into the device contract.
        import stat
        if not stat.S_ISCHR(mode):
            raise ValueError("Serial path is not a character device.")
    return path


class ModbusRtuReadOnlyAdapter:
    def __init__(self, asset: Mapping[str, Any], settings: Mapping[str, Any]):
        transports = asset.get("transports", [])
        protocols = asset.get("protocols", [])
        transport = settings.get("transport", "rs485")
        if transport not in {"rs485", "rs232", "usb-serial"} or transport not in transports:
            raise ValueError("Selected serial transport is not approved for this shuttle.")
        if "modbus-rtu" not in protocols:
            raise ValueError("The shuttle is not commissioned for Modbus RTU.")

        self.device = validate_serial_path(settings.get("device"), settings.get("allow_test_device") is True)
        self.baudrate = settings.get("baudrate", 9600)
        self.parity = settings.get("parity", "N")
        self.stopbits = settings.get("stopbits", 1)
        self.unit_id = settings.get("unit_id", 1)
        self.timeout = settings.get("timeout_seconds", 1.5)
        if isinstance(self.baudrate, bool) or self.baudrate not in _BAUD_RATES:
            raise ValueError("Unsupported serial baudrate.")
        if self.parity not in _PARITY:
            raise ValueError("Serial parity must be N, E or O.")
        if isinstance(self.stopbits, bool) or self.stopbits not in (1, 2):
            raise ValueError("Serial stopbits must be 1 or 2.")
        if isinstance(self.unit_id, bool) or not isinstance(self.unit_id, int) or not 1 <= self.unit_id <= 247:
            raise ValueError("Modbus RTU unit_id must be between 1 and 247.")
        if isinstance(self.timeout, bool) or not isinstance(self.timeout, (int, float)) or not 0.1 <= self.timeout <= 10:
            raise ValueError("Modbus RTU timeout_seconds must be between 0.1 and 10 seconds.")

        tag_map = settings.get("register_map")
        if not isinstance(tag_map, dict) or not tag_map:
            raise ValueError("A manufacturer-approved register_map is required.")
        if set(tag_map) != set(asset.get("allowed_tags", [])):
            raise ValueError("register_map must exactly match the approved allowed_tags list.")
        self.register_map: dict[str, dict[str, Any]] = {}
        for tag, raw in tag_map.items():
            if not isinstance(raw, dict):
                raise ValueError("Every register_map entry must be an object.")
            address = raw.get("address")
            data_type = raw.get("data_type", "uint16")
            register_type = raw.get("register_type", "holding")
            byte_order = raw.get("byte_order", "ABCD" if data_type.endswith("32") else "AB")
            scale = raw.get("scale", 1)
            offset = raw.get("offset", 0)
            if isinstance(address, bool) or not isinstance(address, int) or not 0 <= address <= 65535:
                raise ValueError("Register address must be between 0 and 65535.")
            if data_type not in _ALLOWED_TYPES or register_type not in _ALLOWED_REGISTER_TYPES:
                raise ValueError("Unsupported Modbus RTU register or data type.")
            if byte_order not in _ALLOWED_BYTE_ORDERS:
                raise ValueError("Unsupported Modbus byte order.")
            if data_type.endswith("32") and byte_order not in {"ABCD", "BADC", "CDAB", "DCBA"}:
                raise ValueError("32-bit data requires a four-byte order.")
            if data_type.endswith("16") and byte_order not in {"AB", "BA"}:
                raise ValueError("16-bit data requires AB or BA byte order.")
            if isinstance(scale, bool) or not isinstance(scale, (int, float)) or abs(scale) > 1_000_000:
                raise ValueError("Register scale is invalid.")
            if isinstance(offset, bool) or not isinstance(offset, (int, float)) or abs(offset) > 1_000_000:
                raise ValueError("Register offset is invalid.")
            self.register_map[tag] = {
                "address": address, "data_type": data_type, "register_type": register_type,
                "byte_order": byte_order, "scale": scale, "offset": offset,
                "unit": raw.get("unit") if isinstance(raw.get("unit"), str) else None,
            }

        self.identity = AdapterIdentity(
            adapter_id=str(asset["adapter_id"]),
            manufacturer=str(asset["manufacturer"]),
            model=str(asset["model"]),
            firmware=str(asset["firmware"]),
            transport=str(transport),
            protocol="modbus-rtu",
            version="1.0.0",
        )

    def _open_serial(self) -> int:
        fd = os.open(self.device, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
        try:
            attrs = termios.tcgetattr(fd)
            attrs[0] = 0
            attrs[1] = 0
            attrs[2] = termios.CS8 | termios.CREAD | termios.CLOCAL
            if self.parity in {"E", "O"}:
                attrs[2] |= termios.PARENB
                if self.parity == "O":
                    attrs[2] |= termios.PARODD
            if self.stopbits == 2:
                attrs[2] |= termios.CSTOPB
            attrs[3] = 0
            attrs[4] = _BAUD_RATES[self.baudrate]
            attrs[5] = _BAUD_RATES[self.baudrate]
            attrs[6][termios.VMIN] = 0
            attrs[6][termios.VTIME] = 0
            termios.tcsetattr(fd, termios.TCSANOW, attrs)
            termios.tcflush(fd, termios.TCIOFLUSH)
            return fd
        except Exception:
            os.close(fd)
            raise

    def _receive_exact(self, fd: int, length: int) -> bytes:
        received = bytearray()
        deadline = time.monotonic() + float(self.timeout)
        while len(received) < length:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError("Modbus RTU response timed out.")
            ready, _, _ = select.select([fd], [], [], remaining)
            if not ready:
                raise TimeoutError("Modbus RTU response timed out.")
            try:
                chunk = os.read(fd, length - len(received))
            except BlockingIOError:
                continue
            if not chunk:
                continue
            received.extend(chunk)
        return bytes(received)

    def _read_registers(self, fd: int, address: int, count: int, function: int) -> bytes:
        request = add_crc(struct.pack(">BBHH", self.unit_id, function, address, count))
        # Enforce a quiet interval before the next RTU request.
        time.sleep(max(0.0035, 3.5 * 11 / self.baudrate))
        termios.tcflush(fd, termios.TCIFLUSH)
        view = memoryview(request)
        while view:
            written = os.write(fd, view)
            view = view[written:]
        header = self._receive_exact(fd, 3)
        if header[0] != self.unit_id:
            raise ValueError("Modbus RTU response unit ID does not match.")
        if header[1] == (function | 0x80):
            tail = self._receive_exact(fd, 2)
            frame = header + tail
            if not valid_crc(frame):
                raise ValueError("Modbus RTU exception response has an invalid CRC.")
            raise RuntimeError("Modbus RTU device returned exception code " + str(header[2]))
        if header[1] != function:
            raise ValueError("Modbus RTU function code does not match the request.")
        byte_count = header[2]
        if byte_count != count * 2:
            raise ValueError("Modbus RTU byte count does not match the approved register map.")
        tail = self._receive_exact(fd, byte_count + 2)
        frame = header + tail
        if not valid_crc(frame):
            raise ValueError("Modbus RTU response CRC validation failed.")
        return frame[3:-2]

    def read(self, tags: Sequence[str]) -> list[AdapterReading]:
        readings: list[AdapterReading] = []
        fd = self._open_serial()
        try:
            for tag in tags:
                spec = self.register_map.get(tag)
                if spec is None:
                    raise ValueError("Requested tag is not in the approved register map: " + str(tag))
                data_type = spec["data_type"]
                count = 2 if data_type.endswith("32") else 1
                function = 3 if spec["register_type"] == "holding" else 4
                raw = self._read_registers(fd, spec["address"], count, function)
                value = _decode_registers(raw, data_type, spec["byte_order"])
                scaled = value * spec["scale"] + spec["offset"]
                if isinstance(scaled, float) and not math.isfinite(scaled):
                    raise ValueError("Scaled Modbus RTU value is not finite.")
                readings.append(AdapterReading(
                    tag=tag,
                    value=scaled,
                    unit=spec["unit"],
                    source_timestamp=datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
                    quality="GOOD",
                ))
        finally:
            os.close(fd)
        return readings

    def close(self) -> None:
        """Serial descriptor is opened and closed for each bounded read batch."""
        return None


def create_adapter(asset: Mapping[str, Any], settings: Mapping[str, Any]) -> ModbusRtuReadOnlyAdapter:
    return ModbusRtuReadOnlyAdapter(asset, settings)
