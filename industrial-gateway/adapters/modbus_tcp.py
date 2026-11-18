"""Generic, read-only Modbus TCP adapter for approved shuttle telemetry.

Only function codes 0x03 (holding registers) and 0x04 (input registers) are used.
No write coils/registers, reset, motion, charging or control methods exist.
"""
from __future__ import annotations

import ipaddress
import socket
import struct
import time
from datetime import datetime, timezone
from typing import Any, Mapping, Sequence

from adapter_contract import AdapterIdentity, AdapterReading

_ALLOWED_TYPES = {"uint16", "int16", "uint32", "int32", "float32"}
_ALLOWED_REGISTER_TYPES = {"holding", "input"}
_ALLOWED_BYTE_ORDERS = {"ABCD", "BADC", "CDAB", "DCBA", "AB", "BA"}


def _private_host(value: Any, allow_loopback: bool) -> str:
    if not isinstance(value, str):
        raise ValueError("Modbus TCP host must be a literal private IP address.")
    try:
        address = ipaddress.ip_address(value)
    except ValueError as exc:
        raise ValueError("Modbus TCP host must be a literal private IP address; DNS names are not accepted.") from exc
    if address.is_unspecified or address.is_multicast or address.is_reserved or not address.is_private:
        raise ValueError("Modbus TCP may connect only to a private OT network address.")
    if address.is_loopback and not allow_loopback:
        raise ValueError("Loopback is permitted only in an explicitly enabled test environment.")
    return str(address)


def _decode_registers(raw: bytes, data_type: str, byte_order: str) -> int | float:
    if data_type in {"uint16", "int16"}:
        if len(raw) != 2:
            raise ValueError("A 16-bit value must contain exactly one register.")
        value = int.from_bytes(raw if byte_order == "AB" else raw[::-1], "big", signed=data_type == "int16")
        return value

    if len(raw) != 4:
        raise ValueError("A 32-bit value must contain exactly two registers.")
    permutations = {
        "ABCD": raw,
        "BADC": bytes((raw[1], raw[0], raw[3], raw[2])),
        "CDAB": raw[2:4] + raw[0:2],
        "DCBA": raw[::-1],
    }
    packed = permutations[byte_order]
    if data_type == "uint32":
        return struct.unpack(">I", packed)[0]
    if data_type == "int32":
        return struct.unpack(">i", packed)[0]
    return struct.unpack(">f", packed)[0]


class ModbusTcpReadOnlyAdapter:
    def __init__(self, asset: Mapping[str, Any], settings: Mapping[str, Any]):
        transports = asset.get("transports", [])
        protocols = asset.get("protocols", [])
        transport = settings.get("transport", "ethernet")
        if transport not in transports:
            raise ValueError("Selected transport is not approved for this shuttle.")
        if "modbus-tcp" not in protocols:
            raise ValueError("The shuttle is not commissioned for Modbus TCP.")

        self.host = _private_host(settings.get("host"), settings.get("allow_loopback") is True)
        self.port = settings.get("port", 502)
        self.unit_id = settings.get("unit_id", 1)
        self.timeout = settings.get("timeout_seconds", 2.0)
        if isinstance(self.port, bool) or not isinstance(self.port, int) or not 1 <= self.port <= 65535:
            raise ValueError("Modbus TCP port must be an integer from 1 to 65535.")
        if isinstance(self.unit_id, bool) or not isinstance(self.unit_id, int) or not 0 <= self.unit_id <= 247:
            raise ValueError("Modbus unit_id must be between 0 and 247.")
        if isinstance(self.timeout, bool) or not isinstance(self.timeout, (int, float)) or not 0.1 <= self.timeout <= 10:
            raise ValueError("Modbus timeout_seconds must be between 0.1 and 10 seconds.")

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
                raise ValueError("Unsupported Modbus register type or data type.")
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

        self._transaction_id = 0
        self.identity = AdapterIdentity(
            adapter_id=str(asset["adapter_id"]),
            manufacturer=str(asset["manufacturer"]),
            model=str(asset["model"]),
            firmware=str(asset["firmware"]),
            transport=str(transport),
            protocol="modbus-tcp",
            version="1.0.0",
        )

    @staticmethod
    def _receive_exact(connection: socket.socket, length: int) -> bytes:
        chunks = bytearray()
        while len(chunks) < length:
            chunk = connection.recv(length - len(chunks))
            if not chunk:
                raise ConnectionError("Modbus TCP peer closed the connection early.")
            chunks.extend(chunk)
        return bytes(chunks)

    def _read_registers(self, address: int, count: int, function: int) -> bytes:
        self._transaction_id = (self._transaction_id + 1) & 0xFFFF
        transaction_id = self._transaction_id
        pdu = struct.pack(">BHH", function, address, count)
        request = struct.pack(">HHHB", transaction_id, 0, len(pdu) + 1, self.unit_id) + pdu
        with socket.create_connection((self.host, self.port), timeout=float(self.timeout)) as connection:
            connection.settimeout(float(self.timeout))
            connection.sendall(request)
            header = self._receive_exact(connection, 7)
            response_id, protocol_id, length, unit_id = struct.unpack(">HHHB", header)
            if response_id != transaction_id or protocol_id != 0 or unit_id != self.unit_id:
                raise ValueError("Modbus TCP response header does not match the request.")
            if length < 3 or length > 252:
                raise ValueError("Modbus TCP response length is invalid.")
            body = self._receive_exact(connection, length - 1)
        response_function = body[0]
        if response_function == (function | 0x80):
            exception_code = body[1] if len(body) > 1 else -1
            raise RuntimeError("Modbus device returned exception code " + str(exception_code))
        if response_function != function or len(body) < 2:
            raise ValueError("Modbus TCP function code does not match the request.")
        byte_count = body[1]
        register_bytes = body[2:]
        if byte_count != count * 2 or len(register_bytes) != byte_count:
            raise ValueError("Modbus TCP register byte count does not match the approved map.")
        return register_bytes

    def read(self, tags: Sequence[str]) -> list[AdapterReading]:
        readings: list[AdapterReading] = []
        for tag in tags:
            spec = self.register_map.get(tag)
            if spec is None:
                raise ValueError("Requested tag is not in the approved register map: " + str(tag))
            data_type = spec["data_type"]
            count = 2 if data_type.endswith("32") else 1
            function = 3 if spec["register_type"] == "holding" else 4
            raw = self._read_registers(spec["address"], count, function)
            value = _decode_registers(raw, data_type, spec["byte_order"])
            scaled = value * spec["scale"] + spec["offset"]
            if isinstance(scaled, float) and not (float("-inf") < scaled < float("inf")):
                raise ValueError("Scaled Modbus value is not finite.")
            readings.append(AdapterReading(
                tag=tag,
                value=scaled,
                unit=spec["unit"],
                source_timestamp=datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
                quality="GOOD",
            ))
        return readings

    def close(self) -> None:
        """Each request uses a bounded short-lived TCP connection."""
        return None


def create_adapter(asset: Mapping[str, Any], settings: Mapping[str, Any]) -> ModbusTcpReadOnlyAdapter:
    return ModbusTcpReadOnlyAdapter(asset, settings)
