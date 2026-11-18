"""Generic secure, read-only OPC UA client adapter for shuttle telemetry.

Requires SignAndEncrypt with certificate-based trust and an exact approved node map.
Only DataValue reads are exposed. There are no write, call-method or control APIs.
"""
from __future__ import annotations

import ipaddress
import math
from datetime import datetime
from typing import Any, Mapping, Sequence
from urllib.parse import urlparse

from asyncua.sync import Client

from adapter_contract import AdapterIdentity, AdapterReading


def _validate_endpoint(value: Any, allowed_hosts: Any) -> str:
    if not isinstance(value, str) or len(value) > 2048:
        raise ValueError("OPC UA endpoint URL is required.")
    parsed = urlparse(value)
    if parsed.scheme != "opc.tcp" or not parsed.hostname or parsed.port is None:
        raise ValueError("OPC UA endpoint must use opc.tcp://host:port.")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("OPC UA endpoint URL must not contain credentials, query strings or fragments.")
    try:
        address = ipaddress.ip_address(parsed.hostname)
        if address.is_unspecified or address.is_multicast or address.is_reserved or not address.is_private:
            raise ValueError("OPC UA endpoint must be on a private OT network.")
    except ValueError as exc:
        if "private OT network" in str(exc):
            raise
        hosts = allowed_hosts if isinstance(allowed_hosts, list) else []
        if parsed.hostname not in hosts:
            raise ValueError("OPC UA DNS host must exactly match an entry in allowed_hosts.") from exc
    if not 1 <= parsed.port <= 65535:
        raise ValueError("OPC UA port is invalid.")
    return value


def _timestamp(value: Any) -> str:
    if not isinstance(value, datetime) or value.tzinfo is None:
        raise ValueError("OPC UA server must provide an aware SourceTimestamp.")
    return value.isoformat(timespec="milliseconds").replace("+00:00", "Z")


class OpcUaReadOnlyAdapter:
    def __init__(self, asset: Mapping[str, Any], settings: Mapping[str, Any]):
        self.transport = settings.get("transport", "ethernet")
        if self.transport not in asset.get("transports", []):
            raise ValueError("Selected transport is not approved for this shuttle.")
        if "opc-ua" not in asset.get("protocols", []):
            raise ValueError("The shuttle is not commissioned for OPC UA.")

        self.endpoint = _validate_endpoint(settings.get("endpoint_url"), settings.get("allowed_hosts"))
        self.timeout = settings.get("timeout_seconds", 4.0)
        if isinstance(self.timeout, bool) or not isinstance(self.timeout, (int, float)) or not 0.5 <= self.timeout <= 15:
            raise ValueError("OPC UA timeout_seconds must be between 0.5 and 15 seconds.")

        self.certificate = settings.get("client_certificate")
        self.private_key = settings.get("client_private_key")
        self.server_certificate = settings.get("server_certificate")
        if not all(isinstance(item, str) and item.strip() for item in (
            self.certificate, self.private_key, self.server_certificate
        )):
            raise ValueError("OPC UA client certificate, private key and pinned server certificate are required.")
        self.username = settings.get("username")
        self.password = settings.get("password")
        if self.username is not None and not isinstance(self.username, str):
            raise ValueError("OPC UA read-only username is invalid.")
        if self.password is not None and not isinstance(self.password, str):
            raise ValueError("OPC UA password is invalid.")

        nodes = settings.get("nodes")
        if not isinstance(nodes, dict) or not nodes:
            raise ValueError("An explicit OPC UA node map is required.")
        if set(nodes) != set(asset.get("allowed_tags", [])):
            raise ValueError("OPC UA node map must exactly match the approved allowed_tags list.")
        self.nodes: dict[str, dict[str, str]] = {}
        for tag, raw in nodes.items():
            if not isinstance(raw, dict):
                raise ValueError("Each OPC UA node map entry must be an object.")
            node_id = raw.get("node_id")
            unit = raw.get("unit")
            if not isinstance(node_id, str) or not node_id.startswith(("ns=", "nsu=", "i=", "s=", "g=", "b=")) or len(node_id) > 512:
                raise ValueError("OPC UA node_id must be an explicit NodeId string.")
            if unit is not None and (not isinstance(unit, str) or len(unit) > 24):
                raise ValueError("OPC UA unit is invalid.")
            self.nodes[tag] = {"node_id": node_id, "unit": unit or ""}

        self.identity = AdapterIdentity(
            adapter_id=str(asset["adapter_id"]),
            manufacturer=str(asset["manufacturer"]),
            model=str(asset["model"]),
            firmware=str(asset["firmware"]),
            transport=str(self.transport),
            protocol="opc-ua",
            version="1.0.0",
        )

    def read(self, tags: Sequence[str]) -> list[AdapterReading]:
        requested = list(tags)
        if not requested or any(tag not in self.nodes for tag in requested):
            raise ValueError("Requested OPC UA tag is not in the approved node map.")
        readings: list[AdapterReading] = []
        with Client(self.endpoint, timeout=float(self.timeout)) as client:
            # Force an authenticated, pinned, signed and encrypted channel.
            security = "Basic256Sha256,SignAndEncrypt," + self.certificate + "," + self.private_key + "," + self.server_certificate
            client.set_security_string(security)
            if self.username:
                client.set_user(self.username)
                if self.password is not None:
                    client.set_password(self.password)
            for tag in requested:
                node = client.get_node(self.nodes[tag]["node_id"])
                data_value = node.read_data_value(raise_on_bad_status=True)
                variant = getattr(data_value, "Value", None)
                value = getattr(variant, "Value", None)
                if isinstance(value, bool):
                    pass
                elif isinstance(value, (int, float)):
                    if not math.isfinite(float(value)):
                        raise ValueError("OPC UA returned a non-finite numeric value.")
                elif isinstance(value, str) and len(value) <= 200:
                    pass
                else:
                    raise ValueError("OPC UA value type is not supported by the telemetry contract.")
                readings.append(AdapterReading(
                    tag=tag,
                    value=value,
                    unit=self.nodes[tag]["unit"] or None,
                    source_timestamp=_timestamp(getattr(data_value, "SourceTimestamp", None)),
                    quality="GOOD",
                ))
        return readings

    def close(self) -> None:
        """OPC UA session is opened and closed for each bounded read batch."""
        return None


def create_adapter(asset: Mapping[str, Any], settings: Mapping[str, Any]) -> OpcUaReadOnlyAdapter:
    return OpcUaReadOnlyAdapter(asset, settings)
