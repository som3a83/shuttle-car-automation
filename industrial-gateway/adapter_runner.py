"""Run one trusted vendor read-only adapter and forward samples to the local gateway.

Vendor-specific communication code is intentionally supplied as a separately
reviewed plugin. Never load an untrusted adapter module in an OT environment.
"""
from __future__ import annotations

import importlib
import importlib.util
import json
import os
import sys
import time
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any, Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

import gateway


def mapping(value: Any) -> dict[str, Any]:
    if is_dataclass(value):
        return asdict(value)
    if isinstance(value, Mapping):
        return dict(value)
    if hasattr(value, "__dict__"):
        return dict(vars(value))
    raise ValueError("Adapter identity and readings must be dataclasses or mappings.")


def validate_adapter_identity(identity: Any, asset: dict[str, Any]) -> dict[str, str]:
    raw = mapping(identity)
    normalized = {
        "adapterId": raw.get("adapter_id", raw.get("adapterId")),
        "manufacturer": raw.get("manufacturer"),
        "model": raw.get("model"),
        "firmware": raw.get("firmware"),
        "transport": raw.get("transport"),
        "protocol": raw.get("protocol"),
        "version": raw.get("version", raw.get("adapterVersion")),
    }
    expected = {
        "adapterId": asset["adapter_id"],
        "manufacturer": asset["manufacturer"],
        "model": asset["model"],
        "firmware": asset["firmware"],
    }
    for key, value in expected.items():
        if not isinstance(normalized[key], str) or normalized[key] != value:
            raise ValueError("Vendor adapter identity mismatch: " + key)
    if normalized["transport"] not in asset.get("transports", []):
        raise ValueError("Vendor adapter transport is not approved for this asset.")
    if normalized["protocol"] not in asset.get("protocols", []):
        raise ValueError("Vendor adapter protocol is not approved for this asset.")
    if not isinstance(normalized["version"], str) or not normalized["version"].strip():
        raise ValueError("Vendor adapter version is required.")
    if not isinstance(normalized["transport"], str) or not isinstance(normalized["protocol"], str):
        raise ValueError("Vendor adapter must declare its selected transport and protocol.")
    return {key: str(value) for key, value in normalized.items()}


def build_ingest_payload(asset: dict[str, Any], identity: dict[str, str], reading: Any) -> dict[str, Any]:
    raw = mapping(reading)
    tag = raw.get("tag")
    value = raw.get("value")
    if "source_timestamp" in raw:
        timestamp = raw["source_timestamp"]
    else:
        timestamp = raw.get("sourceTimestamp")
    return {
        "assetId": asset["id"],
        "manufacturer": identity["manufacturer"],
        "model": identity["model"],
        "firmware": identity["firmware"],
        "adapterId": identity["adapterId"],
        "transport": identity["transport"],
        "protocol": identity["protocol"],
        "adapterVersion": identity["version"],
        "tag": tag,
        "value": value,
        "unit": raw.get("unit"),
        "sourceTimestamp": timestamp,
        "quality": raw.get("quality", "GOOD"),
    }


def validate_ingest_url(value: str) -> str:
    parsed = urlparse(value)
    local = parsed.hostname in {"127.0.0.1", "localhost", "::1"}
    if parsed.scheme != "https" and not (parsed.scheme == "http" and local):
        raise ValueError("Ingest URL must use HTTPS; HTTP is allowed only on loopback.")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("Ingest URL must not contain credentials, query strings or fragments.")
    if parsed.path.rstrip("/") != "/v1/telemetry":
        raise ValueError("Ingest URL must end with /v1/telemetry.")
    return value


def post_ingest(url: str, token: str, payload: dict[str, Any]) -> None:
    body = json.dumps(payload, separators=(",", ":"), allow_nan=False).encode("utf-8")
    request = Request(url, data=body, method="POST", headers={
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
        "Accept": "application/json",
    })
    try:
        with urlopen(request, timeout=5) as response:
            if response.status != 202:
                raise RuntimeError("Gateway rejected the sample with HTTP " + str(response.status))
    except HTTPError as exc:
        raise RuntimeError("Gateway rejected the sample with HTTP " + str(exc.code)) from exc
    except URLError as exc:
        raise RuntimeError("Cannot reach the local telemetry gateway: " + str(exc.reason)) from exc


def load_factory(spec: str):
    module_name, separator, factory_name = spec.partition(":")
    if not separator or not module_name or not factory_name:
        raise ValueError("SHUTTLE_ADAPTER_FACTORY must use module_name:factory_name.")
    module_path = Path(module_name)
    if module_path.is_file():
        spec_obj = importlib.util.spec_from_file_location("site_vendor_adapter", module_path)
        if spec_obj is None or spec_obj.loader is None:
            raise ValueError("Cannot load the configured adapter module.")
        module = importlib.util.module_from_spec(spec_obj)
        sys.modules[spec_obj.name] = module
        spec_obj.loader.exec_module(module)
    else:
        module = importlib.import_module(module_name)
    factory = getattr(module, factory_name, None)
    if not callable(factory):
        raise ValueError("Configured adapter factory is not callable.")
    return factory


def load_settings() -> dict[str, Any]:
    path = os.environ.get("SHUTTLE_ADAPTER_SETTINGS", "")
    if not path:
        return {}
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("Adapter settings file must contain a JSON object.")
    return data


def main() -> int:
    asset_id = os.environ.get("SHUTTLE_ADAPTER_ASSET_ID", "")
    factory_spec = os.environ.get("SHUTTLE_ADAPTER_FACTORY", "")
    ingest_token = os.environ.get("SHUTTLE_GATEWAY_INGEST_TOKEN", "")
    ingest_url = validate_ingest_url(os.environ.get(
        "SHUTTLE_GATEWAY_INGEST_URL", "http://127.0.0.1:8765/v1/telemetry"
    ))
    if len(ingest_token) < 32:
        raise SystemExit("SHUTTLE_GATEWAY_INGEST_TOKEN must contain at least 32 characters.")
    if not asset_id:
        raise SystemExit("Set SHUTTLE_ADAPTER_ASSET_ID.")
    config = gateway.load_config()
    asset = config["assets"].get(asset_id)
    if not asset or not gateway.commissioned(asset):
        raise SystemExit("The selected asset is not commissioned in the gateway config.")
    poll_seconds = float(os.environ.get("SHUTTLE_ADAPTER_POLL_SECONDS", "5"))
    if not 1 <= poll_seconds <= 3600:
        raise SystemExit("SHUTTLE_ADAPTER_POLL_SECONDS must be between 1 and 3600.")
    factory = load_factory(factory_spec)
    adapter = factory({
        "id": asset["id"], "manufacturer": asset["manufacturer"], "model": asset["model"],
        "firmware": asset["firmware"], "adapter_id": asset["adapter_id"],
        "transports": list(asset["transports"]), "protocols": list(asset["protocols"]),
        "allowed_tags": sorted(asset["allowed_tags"]),
    }, load_settings())
    identity = validate_adapter_identity(getattr(adapter, "identity", None), asset)
    if not callable(getattr(adapter, "read", None)):
        raise SystemExit("Vendor adapter must implement read(tags).")
    print("Read-only adapter started for " + asset_id + " via " + identity["adapterId"])
    delay = poll_seconds
    try:
        while True:
            started = time.monotonic()
            try:
                readings = adapter.read(sorted(asset["allowed_tags"]))
                accepted = 0
                for reading in readings:
                    payload = build_ingest_payload(asset, identity, reading)
                    gateway.validate_ingest(payload, config)
                    post_ingest(ingest_url, ingest_token, payload)
                    accepted += 1
                print("Accepted " + str(accepted) + " sample(s) for " + asset_id)
                delay = poll_seconds
            except Exception as exc:
                # Do not log payloads, credentials or vendor response bodies.
                print("Adapter poll failed for " + asset_id + ": " + str(exc), file=sys.stderr)
                delay = min(30.0, max(poll_seconds, delay * 2))
            elapsed = time.monotonic() - started
            time.sleep(max(0.0, delay - elapsed))
    except KeyboardInterrupt:
        return 0
    finally:
        close = getattr(adapter, "close", None)
        if callable(close):
            close()


if __name__ == "__main__":
    raise SystemExit(main())
