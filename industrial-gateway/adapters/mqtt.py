"""Generic read-only MQTT telemetry adapter.

Subscribes only to explicitly approved topics and accepts timestamped JSON
telemetry. No publish, command, movement, reset or charging API is exposed.
"""
from __future__ import annotations

import ipaddress
import json
import ssl
import threading
import time
from datetime import datetime
from typing import Any, Mapping, Sequence
from urllib.parse import urlparse

import paho.mqtt.client as mqtt

from adapter_contract import AdapterIdentity, AdapterReading

_ALLOWED_QUALITIES = {"GOOD", "UNCERTAIN", "BAD", "STALE"}


def _validate_broker(host: Any, allow_loopback: bool, allowed_hosts: Any) -> str:
    if not isinstance(host, str) or not host.strip() or len(host) > 253:
        raise ValueError("MQTT broker host is required.")
    host = host.strip()
    try:
        address = ipaddress.ip_address(host)
        if address.is_unspecified or address.is_multicast or address.is_reserved or not address.is_private:
            raise ValueError("MQTT broker must be on a private OT network.")
        if address.is_loopback and not allow_loopback:
            raise ValueError("Loopback MQTT is permitted only in an explicitly enabled test environment.")
    except ValueError as exc:
        if "private OT network" in str(exc) or "Loopback MQTT" in str(exc):
            raise
        approved = allowed_hosts if isinstance(allowed_hosts, list) else []
        if host not in approved:
            raise ValueError("MQTT DNS host must exactly match an entry in allowed_hosts.") from exc
    return host


def _validate_timestamp(value: Any) -> str:
    if not isinstance(value, str) or len(value) > 64:
        raise ValueError("MQTT payload sourceTimestamp must be an ISO-8601 timestamp.")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("MQTT payload sourceTimestamp is invalid.") from exc
    if parsed.tzinfo is None:
        raise ValueError("MQTT payload sourceTimestamp must include timezone information.")
    return parsed.isoformat(timespec="milliseconds").replace("+00:00", "Z")


class MqttReadOnlyAdapter:
    def __init__(self, asset: Mapping[str, Any], settings: Mapping[str, Any]):
        self.transport = settings.get("transport", "ethernet")
        if self.transport not in asset.get("transports", []):
            raise ValueError("Selected transport is not approved for this shuttle.")
        if "mqtt" not in asset.get("protocols", []):
            raise ValueError("The shuttle is not commissioned for MQTT.")

        self.host = _validate_broker(
            settings.get("host"), settings.get("allow_loopback") is True, settings.get("allowed_hosts")
        )
        self.port = settings.get("port", 8883)
        self.keepalive = settings.get("keepalive_seconds", 30)
        self.timeout = settings.get("read_timeout_seconds", 5.0)
        if isinstance(self.port, bool) or not isinstance(self.port, int) or not 1 <= self.port <= 65535:
            raise ValueError("MQTT port must be an integer from 1 to 65535.")
        if isinstance(self.keepalive, bool) or not isinstance(self.keepalive, int) or not 10 <= self.keepalive <= 300:
            raise ValueError("MQTT keepalive_seconds must be between 10 and 300.")
        if isinstance(self.timeout, bool) or not isinstance(self.timeout, (int, float)) or not 0.5 <= self.timeout <= 30:
            raise ValueError("MQTT read_timeout_seconds must be between 0.5 and 30 seconds.")

        self.allow_loopback = settings.get("allow_loopback") is True
        self.tls_enabled = settings.get("tls") is True
        if not self.tls_enabled and not (self.allow_loopback and self.host in {"127.0.0.1", "::1", "localhost"}):
            raise ValueError("MQTT TLS is required except for explicitly enabled loopback tests.")

        topics = settings.get("topics")
        if not isinstance(topics, dict) or not topics:
            raise ValueError("An explicit MQTT topics map is required.")
        if set(topics) != set(asset.get("allowed_tags", [])):
            raise ValueError("MQTT topics map must exactly match the approved allowed_tags list.")
        self.topics: dict[str, str] = {}
        self.topic_to_tag: dict[str, str] = {}
        for tag, topic in topics.items():
            if not isinstance(topic, str) or not topic.strip() or len(topic) > 512 or "+" in topic or "#" in topic:
                raise ValueError("Each MQTT telemetry topic must be a concrete topic, not a wildcard.")
            topic = topic.strip()
            if topic in self.topic_to_tag:
                raise ValueError("MQTT topics must be unique per approved tag.")
            self.topics[tag] = topic
            self.topic_to_tag[topic] = tag

        self.identity = AdapterIdentity(
            adapter_id=str(asset["adapter_id"]),
            manufacturer=str(asset["manufacturer"]),
            model=str(asset["model"]),
            firmware=str(asset["firmware"]),
            transport=str(self.transport),
            protocol="mqtt",
            version="1.0.0",
        )
        self._lock = threading.Lock()
        self._condition = threading.Condition(self._lock)
        self._readings: dict[str, AdapterReading] = {}
        self._error: str | None = None
        self._client: mqtt.Client | None = None
        self._loop_started = False

    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        if int(reason_code) != 0:
            with self._condition:
                self._error = "MQTT broker rejected the connection with reason code " + str(reason_code)
                self._condition.notify_all()
            return
        for topic in self.topic_to_tag:
            client.subscribe(topic, qos=1)

    def _on_message(self, client, userdata, message):
        tag = self.topic_to_tag.get(message.topic)
        if tag is None:
            return
        try:
            payload = json.loads(message.payload.decode("utf-8"))
            if not isinstance(payload, dict) or "value" not in payload:
                raise ValueError("MQTT telemetry payload must be a JSON object containing value.")
            value = payload["value"]
            if isinstance(value, bool):
                pass
            elif isinstance(value, (int, float)) and not isinstance(value, bool):
                import math
                if not math.isfinite(float(value)):
                    raise ValueError("MQTT telemetry value must be finite.")
            elif isinstance(value, str) and len(value) <= 200:
                pass
            else:
                raise ValueError("MQTT telemetry value must be a finite number, boolean or short string.")
            quality = payload.get("quality", "GOOD")
            if quality not in _ALLOWED_QUALITIES:
                raise ValueError("MQTT telemetry quality is invalid.")
            source_timestamp = _validate_timestamp(payload.get("sourceTimestamp"))
            unit = payload.get("unit")
            if unit is not None and (not isinstance(unit, str) or len(unit) > 24):
                raise ValueError("MQTT telemetry unit is invalid.")
            reading = AdapterReading(tag, value, unit, source_timestamp, quality)
            with self._condition:
                self._readings[tag] = reading
                self._condition.notify_all()
        except Exception as exc:
            with self._condition:
                self._error = "Rejected MQTT telemetry payload for tag " + tag + ": " + str(exc)
                self._condition.notify_all()

    def read(self, tags: Sequence[str]) -> list[AdapterReading]:
        requested = list(tags)
        if not requested or any(tag not in self.topics for tag in requested):
            raise ValueError("Requested MQTT tag is not in the approved topic map.")
        with self._condition:
            self._readings = {}
            self._error = None

        client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id="shuttle-" + self.identity.adapter_id[:40],
            protocol=mqtt.MQTTv311,
            clean_session=True,
        )
        username = self._get_setting("username")
        password = self._get_setting("password")
        if username:
            client.username_pw_set(username, password or None)
        if self.tls_enabled:
            ca_certs = self._get_setting("ca_certs")
            certfile = self._get_setting("certfile")
            keyfile = self._get_setting("keyfile")
            client.tls_set(
                ca_certs=ca_certs or None,
                certfile=certfile or None,
                keyfile=keyfile or None,
                cert_reqs=ssl.CERT_REQUIRED,
                tls_version=ssl.PROTOCOL_TLS_CLIENT,
            )
            client.tls_insecure_set(False)
        client.on_connect = self._on_connect
        client.on_message = self._on_message
        self._client = client
        client.connect(self.host, self.port, self.keepalive)
        client.loop_start()
        self._loop_started = True
        deadline = time.monotonic() + float(self.timeout)
        try:
            with self._condition:
                while len(self._readings) < len(requested) and not self._error:
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        break
                    self._condition.wait(remaining)
                if self._error:
                    raise RuntimeError(self._error)
                return [self._readings[tag] for tag in requested if tag in self._readings]
        finally:
            self.close()

    def _get_setting(self, key: str) -> str | None:
        value = getattr(self, "_settings", {}).get(key) if hasattr(self, "_settings") else None
        return value if isinstance(value, str) and value else None

    def close(self) -> None:
        client = self._client
        self._client = None
        if client is not None:
            try:
                client.disconnect()
            finally:
                if self._loop_started:
                    client.loop_stop()
                self._loop_started = False


def create_adapter(asset: Mapping[str, Any], settings: Mapping[str, Any]) -> MqttReadOnlyAdapter:
    adapter = MqttReadOnlyAdapter(asset, settings)
    adapter._settings = settings
    return adapter
