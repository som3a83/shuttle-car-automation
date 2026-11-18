"""Generic read-only WebSocket telemetry adapter for push-stream gateways.

The adapter performs a TLS-validated WebSocket handshake and receives JSON
telemetry frames only. It never sends subscription/control/motion commands.
Use only with vendor endpoints that push an already-authorized read-only feed.
"""
from __future__ import annotations

import base64
import ipaddress
import json
import math
import ssl
import time
from datetime import datetime
from typing import Any, Mapping, Sequence
from urllib.parse import urlparse

import websocket

from adapter_contract import AdapterIdentity, AdapterReading


def _validate_url(value: Any, allowed_hosts: Any, allow_loopback: bool) -> str:
    if not isinstance(value, str) or len(value) > 2048:
        raise ValueError("WebSocket URL is required.")
    parsed = urlparse(value)
    if parsed.scheme not in {"wss", "ws"} or not parsed.hostname:
        raise ValueError("WebSocket URL must use WSS.")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("WebSocket URL must not contain credentials, query strings or fragments.")
    if parsed.scheme != "wss" and not (allow_loopback and parsed.hostname in {"127.0.0.1", "::1", "localhost"}):
        raise ValueError("WebSocket requires WSS; WS is allowed only for explicit loopback tests.")
    try:
        address = ipaddress.ip_address(parsed.hostname)
        if address.is_unspecified or address.is_multicast or address.is_reserved or not address.is_private:
            raise ValueError("WebSocket endpoint must be on a private OT network.")
        if address.is_loopback and not allow_loopback:
            raise ValueError("WebSocket loopback is allowed only in an explicit test environment.")
    except ValueError as exc:
        if "private OT network" in str(exc) or "loopback" in str(exc):
            raise
        hosts = allowed_hosts if isinstance(allowed_hosts, list) else []
        if parsed.hostname not in hosts:
            raise ValueError("WebSocket DNS host must exactly match an entry in allowed_hosts.") from exc
    return value


def _timestamp(value: Any) -> str:
    if not isinstance(value, str) or len(value) > 64:
        raise ValueError("WebSocket payload sourceTimestamp must be an ISO-8601 timestamp.")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("WebSocket payload sourceTimestamp is invalid.") from exc
    if parsed.tzinfo is None:
        raise ValueError("WebSocket payload sourceTimestamp must include timezone information.")
    return parsed.isoformat(timespec="milliseconds").replace("+00:00", "Z")


class WebSocketReadOnlyAdapter:
    def __init__(self, asset: Mapping[str, Any], settings: Mapping[str, Any]):
        self.transport = settings.get("transport", "ethernet")
        if self.transport not in asset.get("transports", []):
            raise ValueError("Selected transport is not approved for this shuttle.")
        if "websocket" not in asset.get("protocols", []):
            raise ValueError("The shuttle is not commissioned for WebSocket.")

        self.url = _validate_url(settings.get("url"), settings.get("allowed_hosts"), settings.get("allow_loopback") is True)
        self.timeout = settings.get("read_timeout_seconds", 5.0)
        self.max_payload_bytes = settings.get("max_payload_bytes", 16384)
        if isinstance(self.timeout, bool) or not isinstance(self.timeout, (int, float)) or not 0.5 <= self.timeout <= 30:
            raise ValueError("WebSocket read_timeout_seconds must be between 0.5 and 30 seconds.")
        if isinstance(self.max_payload_bytes, bool) or not isinstance(self.max_payload_bytes, int) or not 1024 <= self.max_payload_bytes <= 65536:
            raise ValueError("WebSocket max_payload_bytes must be between 1024 and 65536.")

        self.headers: list[str] = []
        token = settings.get("bearer_token")
        username = settings.get("username")
        password = settings.get("password")
        if token is not None:
            if not isinstance(token, str) or not token:
                raise ValueError("WebSocket bearer_token must be a non-empty string.")
            self.headers.append("Authorization: Bearer " + token)
        elif username is not None:
            if not isinstance(username, str) or not isinstance(password, str):
                raise ValueError("WebSocket Basic credentials are invalid.")
            encoded = base64.b64encode((username + ":" + password).encode("utf-8")).decode("ascii")
            self.headers.append("Authorization: Basic " + encoded)

        self.subprotocols = settings.get("subprotocols", [])
        if not isinstance(self.subprotocols, list) or len(self.subprotocols) > 8 or any(not isinstance(item, str) or len(item) > 128 for item in self.subprotocols):
            raise ValueError("WebSocket subprotocol list is invalid.")

        self.allowed_tags = set(asset.get("allowed_tags", []))
        self.units = settings.get("units", {})
        if not isinstance(self.units, dict) or any(tag not in self.allowed_tags for tag in self.units):
            raise ValueError("WebSocket units map contains unapproved tags.")
        if any(not isinstance(unit, str) or len(unit) > 24 for unit in self.units.values()):
            raise ValueError("WebSocket unit value is invalid.")

        self.identity = AdapterIdentity(
            adapter_id=str(asset["adapter_id"]),
            manufacturer=str(asset["manufacturer"]),
            model=str(asset["model"]),
            firmware=str(asset["firmware"]),
            transport=str(self.transport),
            protocol="websocket",
            version="1.0.0",
        )

    def read(self, tags: Sequence[str]) -> list[AdapterReading]:
        requested = list(tags)
        if not requested or any(tag not in self.allowed_tags for tag in requested):
            raise ValueError("Requested WebSocket tag is not in the approved tag map.")
        options: dict[str, Any] = {
            "timeout": float(self.timeout),
            "header": self.headers,
            "subprotocols": self.subprotocols or None,
            "enable_multithread": False,
        }
        if self.url.startswith("wss://"):
            options["sslopt"] = {"cert_reqs": ssl.CERT_REQUIRED, "check_hostname": True}
        connection = websocket.create_connection(self.url, **options)
        deadline = time.monotonic() + float(self.timeout)
        collected: dict[str, AdapterReading] = {}
        try:
            while len(collected) < len(requested):
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    break
                connection.settimeout(remaining)
                try:
                    frame = connection.recv()
                except websocket.WebSocketTimeoutException:
                    break
                if frame in (None, ""):
                    break
                if isinstance(frame, bytes):
                    if len(frame) > self.max_payload_bytes:
                        raise ValueError("WebSocket payload exceeded the configured size limit.")
                    frame = frame.decode("utf-8")
                elif isinstance(frame, str):
                    if len(frame.encode("utf-8")) > self.max_payload_bytes:
                        raise ValueError("WebSocket payload exceeded the configured size limit.")
                else:
                    continue
                try:
                    payload = json.loads(frame)
                except json.JSONDecodeError:
                    raise ValueError("WebSocket frame is not valid JSON.")
                if not isinstance(payload, dict):
                    continue
                tag = payload.get("tag")
                if tag not in requested:
                    continue
                value = payload.get("value")
                if isinstance(value, bool):
                    pass
                elif isinstance(value, (int, float)) and not isinstance(value, bool):
                    if not math.isfinite(float(value)):
                        raise ValueError("WebSocket telemetry value must be finite.")
                elif isinstance(value, str) and len(value) <= 200:
                    pass
                else:
                    raise ValueError("WebSocket telemetry value must be a finite number, boolean or short string.")
                quality = payload.get("quality", "GOOD")
                if quality not in {"GOOD", "UNCERTAIN", "BAD", "STALE"}:
                    raise ValueError("WebSocket telemetry quality is invalid.")
                unit = payload.get("unit", self.units.get(tag))
                if unit is not None and (not isinstance(unit, str) or len(unit) > 24):
                    raise ValueError("WebSocket telemetry unit is invalid.")
                collected[tag] = AdapterReading(tag, value, unit, _timestamp(payload.get("sourceTimestamp")), quality)
            return [collected[tag] for tag in requested if tag in collected]
        finally:
            connection.close()


def create_adapter(asset: Mapping[str, Any], settings: Mapping[str, Any]) -> WebSocketReadOnlyAdapter:
    return WebSocketReadOnlyAdapter(asset, settings)
