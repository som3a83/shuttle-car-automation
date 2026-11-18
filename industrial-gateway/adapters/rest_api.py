"""Generic read-only HTTPS/REST telemetry adapter.

Only GET requests are created. Redirects are rejected to prevent credentials
from being forwarded to an unapproved host. TLS verification remains enabled.
"""
from __future__ import annotations

import ipaddress
import json
import math
import ssl
from datetime import datetime
from typing import Any, Mapping, Sequence
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

from adapter_contract import AdapterIdentity, AdapterReading


class _RejectRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None


def _validate_base_url(value: Any, allowed_hosts: Any, allow_loopback: bool) -> str:
    if not isinstance(value, str) or len(value) > 2048:
        raise ValueError("REST base_url is required.")
    parsed = urlparse(value)
    if parsed.scheme not in {"https", "http"} or not parsed.hostname:
        raise ValueError("REST base_url must use HTTPS.")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("REST base_url must not contain credentials, query strings or fragments.")
    if parsed.scheme != "https" and not (allow_loopback and parsed.hostname in {"127.0.0.1", "::1", "localhost"}):
        raise ValueError("REST requires HTTPS; HTTP is allowed only for explicit loopback tests.")
    try:
        address = ipaddress.ip_address(parsed.hostname)
        if address.is_unspecified or address.is_multicast or address.is_reserved or not address.is_private:
            raise ValueError("REST endpoint must be on a private OT network.")
        if address.is_loopback and not allow_loopback:
            raise ValueError("REST loopback is allowed only in an explicit test environment.")
    except ValueError as exc:
        if "private OT network" in str(exc) or "loopback" in str(exc):
            raise
        hosts = allowed_hosts if isinstance(allowed_hosts, list) else []
        if parsed.hostname not in hosts:
            raise ValueError("REST DNS host must exactly match an entry in allowed_hosts.") from exc
    return value.rstrip("/") + "/"


def _timestamp(value: Any) -> str:
    if not isinstance(value, str) or len(value) > 64:
        raise ValueError("REST payload sourceTimestamp must be an ISO-8601 timestamp.")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("REST payload sourceTimestamp is invalid.") from exc
    if parsed.tzinfo is None:
        raise ValueError("REST payload sourceTimestamp must include timezone information.")
    return parsed.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _json_pointer(document: Any, pointer: str) -> Any:
    if pointer == "":
        return document
    if not isinstance(pointer, str) or not pointer.startswith("/"):
        raise ValueError("REST json_pointer must be empty or an RFC 6901 JSON Pointer.")
    current = document
    for raw in pointer[1:].split("/"):
        token = raw.replace("~1", "/").replace("~0", "~")
        if isinstance(current, dict) and token in current:
            current = current[token]
        elif isinstance(current, list) and token.isdigit() and int(token) < len(current):
            current = current[int(token)]
        else:
            raise ValueError("REST json_pointer does not exist in the response.")
    return current


class RestReadOnlyAdapter:
    def __init__(self, asset: Mapping[str, Any], settings: Mapping[str, Any]):
        self.transport = settings.get("transport", "ethernet")
        if self.transport not in asset.get("transports", []):
            raise ValueError("Selected transport is not approved for this shuttle.")
        if "rest-api" not in asset.get("protocols", []):
            raise ValueError("The shuttle is not commissioned for REST API.")

        self.base_url = _validate_base_url(
            settings.get("base_url"), settings.get("allowed_hosts"), settings.get("allow_loopback") is True
        )
        self.timeout = settings.get("timeout_seconds", 4.0)
        self.max_response_bytes = settings.get("max_response_bytes", 16384)
        if isinstance(self.timeout, bool) or not isinstance(self.timeout, (int, float)) or not 0.5 <= self.timeout <= 15:
            raise ValueError("REST timeout_seconds must be between 0.5 and 15 seconds.")
        if isinstance(self.max_response_bytes, bool) or not isinstance(self.max_response_bytes, int) or not 1024 <= self.max_response_bytes <= 65536:
            raise ValueError("REST max_response_bytes must be between 1024 and 65536.")

        self.bearer_token = settings.get("bearer_token")
        self.username = settings.get("username")
        self.password = settings.get("password")
        if self.bearer_token is not None and not isinstance(self.bearer_token, str):
            raise ValueError("REST bearer_token must be a string.")
        if self.username is not None and not isinstance(self.username, str):
            raise ValueError("REST username must be a string.")
        if self.password is not None and not isinstance(self.password, str):
            raise ValueError("REST password must be a string.")

        endpoint_map = settings.get("endpoints")
        if not isinstance(endpoint_map, dict) or not endpoint_map:
            raise ValueError("An explicit REST endpoints map is required.")
        if set(endpoint_map) != set(asset.get("allowed_tags", [])):
            raise ValueError("REST endpoints map must exactly match the approved allowed_tags list.")
        self.endpoints: dict[str, dict[str, str]] = {}
        for tag, raw in endpoint_map.items():
            if not isinstance(raw, dict):
                raise ValueError("Each REST endpoints entry must be an object.")
            path = raw.get("path")
            pointer = raw.get("json_pointer", "")
            unit = raw.get("unit", "")
            if not isinstance(path, str) or not path or len(path) > 512 or path.startswith("//"):
                raise ValueError("REST path must be a relative path.")
            if "://" in path or "?" in path or "#" in path or any(part == ".." for part in path.split("/")):
                raise ValueError("REST path contains a forbidden URL component.")
            if not isinstance(pointer, str) or len(pointer) > 512:
                raise ValueError("REST json_pointer is invalid.")
            if unit is not None and (not isinstance(unit, str) or len(unit) > 24):
                raise ValueError("REST unit is invalid.")
            self.endpoints[tag] = {"path": path.lstrip("/"), "json_pointer": pointer, "unit": unit or ""}

        self.identity = AdapterIdentity(
            adapter_id=str(asset["adapter_id"]),
            manufacturer=str(asset["manufacturer"]),
            model=str(asset["model"]),
            firmware=str(asset["firmware"]),
            transport=str(self.transport),
            protocol="rest-api",
            version="1.0.0",
        )
        self._opener = build_opener(_RejectRedirect())

    def _read_endpoint(self, tag: str):
        spec = self.endpoints[tag]
        url = urljoin(self.base_url, spec["path"])
        parsed = urlparse(url)
        base = urlparse(self.base_url)
        if parsed.scheme != base.scheme or parsed.hostname != base.hostname or parsed.port != base.port:
            raise ValueError("REST endpoint path attempted to leave the approved base origin.")
        headers = {"Accept": "application/json", "Cache-Control": "no-store"}
        if self.bearer_token:
            headers["Authorization"] = "Bearer " + self.bearer_token
        elif self.username is not None:
            import base64
            raw = (self.username + ":" + (self.password or "")).encode("utf-8")
            headers["Authorization"] = "Basic " + base64.b64encode(raw).decode("ascii")
        request = Request(url, headers=headers, method="GET")
        try:
            with self._opener.open(request, timeout=float(self.timeout)) as response:
                body = response.read(self.max_response_bytes + 1)
                if len(body) > self.max_response_bytes:
                    raise ValueError("REST response exceeded the configured size limit.")
                content_type = response.headers.get("Content-Type", "")
                if "application/json" not in content_type.lower():
                    raise ValueError("REST endpoint did not return application/json.")
        except HTTPError as exc:
            raise RuntimeError("REST endpoint rejected the read-only GET with HTTP " + str(exc.code)) from exc
        except URLError as exc:
            raise RuntimeError("REST endpoint could not be reached: " + str(exc.reason)) from exc
        try:
            document = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError("REST endpoint returned invalid UTF-8 JSON.") from exc
        sample = _json_pointer(document, spec["json_pointer"])
        if not isinstance(sample, dict) or "value" not in sample:
            raise ValueError("REST JSON pointer must select an object containing value and sourceTimestamp.")
        value = sample["value"]
        if isinstance(value, bool):
            pass
        elif isinstance(value, (int, float)) and not isinstance(value, bool):
            if not math.isfinite(float(value)):
                raise ValueError("REST telemetry value must be finite.")
        elif isinstance(value, str) and len(value) <= 200:
            pass
        else:
            raise ValueError("REST telemetry value must be a finite number, boolean or short string.")
        quality = sample.get("quality", "GOOD")
        if quality not in {"GOOD", "UNCERTAIN", "BAD", "STALE"}:
            raise ValueError("REST telemetry quality is invalid.")
        timestamp = _timestamp(sample.get("sourceTimestamp"))
        unit = sample.get("unit", spec["unit"])
        if unit is not None and (not isinstance(unit, str) or len(unit) > 24):
            raise ValueError("REST telemetry unit is invalid.")
        return value, unit, timestamp, quality

    def read(self, tags: Sequence[str]) -> list[AdapterReading]:
        requested = list(tags)
        if not requested or any(tag not in self.endpoints for tag in requested):
            raise ValueError("Requested REST tag is not in the approved endpoint map.")
        readings = []
        for tag in requested:
            value, unit, timestamp, quality = self._read_endpoint(tag)
            readings.append(AdapterReading(tag, value, unit, timestamp, quality))
        return readings

    def close(self) -> None:
        return None


def create_adapter(asset: Mapping[str, Any], settings: Mapping[str, Any]) -> RestReadOnlyAdapter:
    return RestReadOnlyAdapter(asset, settings)
