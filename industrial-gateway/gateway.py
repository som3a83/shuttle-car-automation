#!/usr/bin/env python3
"""Read-only edge gateway for approved shuttle telemetry adapters.

This service never opens PLC sockets and exposes no machine-control routes.
A vendor-approved adapter is responsible for reading documented tags and
publishing them to POST /v1/telemetry.
"""
from __future__ import annotations

import hmac
import json
import math
import os
import re
import sqlite3
import sys
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

VERSION = "1.1.0"
ROOT = Path(__file__).resolve().parent
CONFIG_PATH = Path(os.environ.get("SHUTTLE_GATEWAY_CONFIG", ROOT / "config.json"))
DB_PATH = Path(os.environ.get("SHUTTLE_GATEWAY_DB", ROOT / "telemetry.sqlite3"))
MAX_BODY = 16 * 1024
MAX_QUERY_LIMIT = 250
MAX_SAMPLES = int(os.environ.get("SHUTTLE_GATEWAY_MAX_SAMPLES", "500000"))
ALLOWED_QUALITIES = {"GOOD", "UNCERTAIN", "BAD", "STALE"}
ASSET_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
TAG_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
CONNECTION_ID_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}$")
DB_LOCK = threading.Lock()


class GatewayError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def parse_aware_timestamp(value: Any) -> datetime:
    if not isinstance(value, str) or len(value) > 64:
        raise GatewayError(400, "sourceTimestamp must be an ISO-8601 timestamp with timezone")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise GatewayError(400, "sourceTimestamp is invalid") from exc
    if parsed.tzinfo is None:
        raise GatewayError(400, "sourceTimestamp must include timezone information")
    return parsed.astimezone(timezone.utc)


def load_config() -> dict[str, Any]:
    try:
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise RuntimeError(f"Missing gateway config: {CONFIG_PATH}. Copy config.example.json to config.json.") from exc
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Cannot read gateway config: {exc}") from exc
    if not isinstance(data, dict) or not isinstance(data.get("assets"), list):
        raise RuntimeError("Gateway config must contain an assets array.")
    assets: dict[str, dict[str, Any]] = {}
    for asset in data["assets"]:
        if not isinstance(asset, dict):
            raise RuntimeError("Every asset configuration must be an object.")
        asset_id = asset.get("id")
        if not isinstance(asset_id, str) or not ASSET_ID_RE.fullmatch(asset_id) or asset_id in assets:
            raise RuntimeError(f"Invalid or duplicate asset id: {asset_id!r}")
        manufacturer = asset.get("manufacturer")
        if (not isinstance(manufacturer, str) or not manufacturer.strip() or len(manufacturer.strip()) > 100
                or any(ord(char) < 32 for char in manufacturer)):
            raise RuntimeError(f"Invalid manufacturer for {asset_id}.")
        manufacturer = manufacturer.strip()
        transports = asset.get("transports", [])
        protocols = asset.get("protocols", [])
        for field, values in (("transports", transports), ("protocols", protocols)):
            if (not isinstance(values, list) or len(values) > 12
                    or any(not isinstance(item, str) or not CONNECTION_ID_RE.fullmatch(item) for item in values)
                    or len(set(values)) != len(values)):
                raise RuntimeError(f"Invalid {field} for {asset_id}; use unique lowercase connection identifiers.")
        tags = asset.get("allowed_tags", [])
        if not isinstance(tags, list) or any(not isinstance(tag, str) or not TAG_RE.fullmatch(tag) for tag in tags):
            raise RuntimeError(f"Invalid allowed_tags for {asset_id}.")
        assets[asset_id] = {
            "id": asset_id,
            "manufacturer": manufacturer,
            "model": str(asset.get("model", "")).strip(),
            "firmware": str(asset.get("firmware", "")).strip(),
            "adapter_id": str(asset.get("adapter_id", "")).strip(),
            "transports": list(transports),
            "protocols": list(protocols),
            "allowed_tags": set(tags),
            "enabled": asset.get("enabled") is True,
        }
    return {"assets": assets}


def commissioned(asset: dict[str, Any]) -> bool:
    return bool(asset["enabled"] and asset["model"] and asset["firmware"]
                and asset["adapter_id"] and asset["transports"] and asset["protocols"]
                and asset["allowed_tags"])


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH, timeout=10) as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("PRAGMA synchronous=NORMAL")
        db.execute("""
            CREATE TABLE IF NOT EXISTS telemetry (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                asset_id TEXT NOT NULL,
                tag TEXT NOT NULL,
                value_json TEXT NOT NULL,
                unit TEXT,
                source_timestamp TEXT NOT NULL,
                received_at TEXT NOT NULL,
                quality TEXT NOT NULL,
                provenance TEXT NOT NULL,
                adapter_id TEXT NOT NULL,
                adapter_version TEXT NOT NULL,
                transport TEXT NOT NULL DEFAULT 'unknown',
                protocol TEXT NOT NULL DEFAULT 'unknown'
            )
        """)
        columns = {row[1] for row in db.execute("PRAGMA table_info(telemetry)")}
        if "transport" not in columns:
            db.execute("ALTER TABLE telemetry ADD COLUMN transport TEXT NOT NULL DEFAULT 'unknown'")
        if "protocol" not in columns:
            db.execute("ALTER TABLE telemetry ADD COLUMN protocol TEXT NOT NULL DEFAULT 'unknown'")
        db.execute("CREATE INDEX IF NOT EXISTS idx_telemetry_asset_time ON telemetry(asset_id, received_at DESC)")
        db.commit()


def validate_ingest(payload: Any, config: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise GatewayError(400, "Body must be a JSON object.")
    asset_id = payload.get("assetId")
    if not isinstance(asset_id, str) or not ASSET_ID_RE.fullmatch(asset_id):
        raise GatewayError(400, "assetId is invalid.")
    asset = config["assets"].get(asset_id)
    if not asset:
        raise GatewayError(403, "assetId is not present in the approved asset register.")
    if not commissioned(asset):
        raise GatewayError(409, f"{asset_id} is not commissioned; exact model, firmware, adapter and tag map are required.")
    if payload.get("manufacturer") != asset["manufacturer"]:
        raise GatewayError(403, "Manufacturer does not match the commissioned asset.")
    if payload.get("adapterId") != asset["adapter_id"]:
        raise GatewayError(403, "Adapter identity does not match the commissioned asset.")
    if payload.get("model") != asset["model"] or payload.get("firmware") != asset["firmware"]:
        raise GatewayError(403, "Model or firmware does not match the commissioned adapter.")
    transport = payload.get("transport")
    protocol = payload.get("protocol")
    if transport not in asset["transports"] or protocol not in asset["protocols"]:
        raise GatewayError(403, "Transport or protocol is not approved for the commissioned asset.")
    tag = payload.get("tag")
    if not isinstance(tag, str) or not TAG_RE.fullmatch(tag) or tag not in asset["allowed_tags"]:
        raise GatewayError(403, "Tag is not included in the approved read-only tag map.")

    value = payload.get("value")
    if isinstance(value, bool):
        pass
    elif isinstance(value, (int, float)) and math.isfinite(float(value)):
        pass
    elif isinstance(value, str) and len(value) <= 200:
        pass
    else:
        raise GatewayError(400, "value must be a finite number, boolean or short string; null is not a reading.")

    unit = payload.get("unit")
    if unit is not None and (not isinstance(unit, str) or len(unit) > 24):
        raise GatewayError(400, "unit must be a string of at most 24 characters.")
    quality = payload.get("quality", "GOOD")
    if not isinstance(quality, str) or quality not in ALLOWED_QUALITIES:
        raise GatewayError(400, "quality must be GOOD, UNCERTAIN, BAD or STALE.")
    source_dt = parse_aware_timestamp(payload.get("sourceTimestamp"))
    now = datetime.now(timezone.utc)
    if source_dt.timestamp() > now.timestamp() + 60:
        raise GatewayError(400, "sourceTimestamp is more than 60 seconds in the future.")

    adapter_version = payload.get("adapterVersion")
    if not isinstance(adapter_version, str) or not adapter_version.strip() or len(adapter_version) > 80:
        raise GatewayError(400, "adapterVersion is required.")
    return {
        "assetId": asset_id,
        "tag": tag,
        "value": value,
        "unit": unit,
        "sourceTimestamp": source_dt.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "receivedAt": utc_now(),
        "quality": quality,
        "provenance": "LIVE_VENDOR",
        "adapterId": asset["adapter_id"],
        "adapterVersion": adapter_version.strip(),
        "transport": transport,
        "protocol": protocol,
    }


class GatewayHandler(BaseHTTPRequestHandler):
    server_version = "ShuttleReadOnlyGateway/" + VERSION
    sys_version = ""

    @property
    def config(self) -> dict[str, Any]:
        return self.server.gateway_config  # type: ignore[attr-defined]

    def log_message(self, fmt: str, *args: Any) -> None:
        # Do not log Authorization headers, payloads or query strings.
        sys.stderr.write("[gateway] " + (fmt % args).split("?", 1)[0] + "\n")

    def _headers(self, status: int, content_type: str = "application/json; charset=utf-8") -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        origin = self.headers.get("Origin", "")
        allowed = self.server.allowed_origins  # type: ignore[attr-defined]
        if origin and origin in allowed:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Max-Age", "300")
        self.end_headers()

    def _json(self, status: int, data: Any) -> None:
        body = json.dumps(data, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")
        self._headers(status)
        self.wfile.write(body)

    def _authorize(self, token_name: str) -> None:
        expected = os.environ.get(token_name, "")
        if len(expected) < 32:
            raise GatewayError(503, f"{token_name} is not configured with at least 32 characters.")
        supplied = self.headers.get("Authorization", "")
        prefix = "Bearer "
        actual = supplied[len(prefix):] if supplied.startswith(prefix) else ""
        if not hmac.compare_digest(actual.encode("utf-8"), expected.encode("utf-8")):
            raise GatewayError(401, "Unauthorized.")

    def do_OPTIONS(self) -> None:
        origin = self.headers.get("Origin", "")
        if origin and origin not in self.server.allowed_origins:  # type: ignore[attr-defined]
            self._json(403, {"error": "Origin is not allowed."})
            return
        self._headers(204, "text/plain; charset=utf-8")

    def do_GET(self) -> None:
        try:
            parsed = urlparse(self.path)
            if parsed.path == "/health":
                self._json(200, {"service": "shuttle-read-only-gateway", "version": VERSION, "readOnly": True})
                return
            self._authorize("SHUTTLE_GATEWAY_READ_TOKEN")
            if parsed.path == "/v1/status":
                self._json(200, self._status())
                return
            if parsed.path == "/v1/assets":
                assets = [self._public_asset(asset) for asset in self.config["assets"].values()]
                self._json(200, {"assets": assets, "readOnly": True})
                return
            if parsed.path == "/v1/telemetry":
                query = parse_qs(parsed.query)
                asset_id = query.get("assetId", [None])[0]
                limit_raw = query.get("limit", ["50"])[0]
                try:
                    limit = max(1, min(MAX_QUERY_LIMIT, int(limit_raw)))
                except (TypeError, ValueError):
                    raise GatewayError(400, "limit must be an integer.")
                if asset_id and asset_id not in self.config["assets"]:
                    raise GatewayError(404, "Unknown assetId.")
                sql = "SELECT asset_id,tag,value_json,unit,source_timestamp,received_at,quality,provenance,adapter_id,adapter_version,transport,protocol FROM telemetry"
                params: list[Any] = []
                if asset_id:
                    sql += " WHERE asset_id=?"
                    params.append(asset_id)
                sql += " ORDER BY received_at DESC LIMIT ?"
                params.append(limit)
                with DB_LOCK, sqlite3.connect(DB_PATH, timeout=10) as db:
                    rows = db.execute(sql, params).fetchall()
                samples = [{
                    "assetId": row[0], "tag": row[1], "value": json.loads(row[2]), "unit": row[3],
                    "sourceTimestamp": row[4], "receivedAt": row[5], "quality": row[6],
                    "provenance": row[7], "adapterId": row[8], "adapterVersion": row[9],
                    "transport": row[10], "protocol": row[11]
                } for row in rows]
                self._json(200, {"samples": samples, "readOnly": True})
                return
            raise GatewayError(404, "Route not found.")
        except GatewayError as exc:
            self._json(exc.status, {"error": exc.message})
        except Exception:
            self._json(500, {"error": "Internal gateway error."})

    def do_POST(self) -> None:
        try:
            parsed = urlparse(self.path)
            if parsed.path != "/v1/telemetry":
                raise GatewayError(404, "Only the read-only telemetry ingest route exists.")
            self._authorize("SHUTTLE_GATEWAY_INGEST_TOKEN")
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY:
                raise GatewayError(413, "Request body must be between 1 byte and 16 KiB.")
            try:
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                raise GatewayError(400, "Body must be valid UTF-8 JSON.")
            sample = validate_ingest(payload, self.config)
            with DB_LOCK, sqlite3.connect(DB_PATH, timeout=10) as db:
                db.execute(
                    """INSERT INTO telemetry(asset_id,tag,value_json,unit,source_timestamp,received_at,quality,provenance,adapter_id,adapter_version,transport,protocol)
                       VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (sample["assetId"], sample["tag"], json.dumps(sample["value"], allow_nan=False),
                     sample["unit"], sample["sourceTimestamp"], sample["receivedAt"], sample["quality"],
                     sample["provenance"], sample["adapterId"], sample["adapterVersion"], sample["transport"], sample["protocol"])
                )
                db.execute(
                    "DELETE FROM telemetry WHERE id NOT IN (SELECT id FROM telemetry ORDER BY id DESC LIMIT ?)",
                    (MAX_SAMPLES,)
                )
                db.commit()
            self._json(202, {"accepted": True, "sample": sample, "readOnly": True})
        except GatewayError as exc:
            self._json(exc.status, {"error": exc.message})
        except (ValueError, OverflowError):
            self._json(400, {"error": "Invalid request."})
        except Exception:
            self._json(500, {"error": "Internal gateway error."})

    def _public_asset(self, asset: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": asset["id"], "manufacturer": asset["manufacturer"],
            "model": asset["model"] or None, "firmware": asset["firmware"] or None,
            "adapterId": asset["adapter_id"] or None, "enabled": asset["enabled"],
            "transports": asset["transports"], "protocols": asset["protocols"],
            "commissioned": commissioned(asset),
            "missing": [name for name, value in (
                ("exact model", asset["model"]), ("firmware", asset["firmware"]),
                ("adapter id", asset["adapter_id"]), ("transport", asset["transports"]),
                ("protocol", asset["protocols"]), ("approved tag map", asset["allowed_tags"]), ("enabled flag", asset["enabled"])
            ) if not value]
        }

    def _status(self) -> dict[str, Any]:
        assets = [self._public_asset(asset) for asset in self.config["assets"].values()]
        with DB_LOCK, sqlite3.connect(DB_PATH, timeout=10) as db:
            latest = db.execute(
                "SELECT asset_id, MAX(received_at), COUNT(*) FROM telemetry GROUP BY asset_id"
            ).fetchall()
        latest_by_asset = {row[0]: {"latestReceivedAt": row[1], "sampleCount": row[2]} for row in latest}
        for asset in assets:
            asset.update(latest_by_asset.get(asset["id"], {"latestReceivedAt": None, "sampleCount": 0}))
        return {
            "service": "shuttle-read-only-gateway", "version": VERSION,
            "readOnly": True, "controlRoutes": False,
            "assetCount": len(assets), "commissionedCount": sum(1 for a in assets if a["commissioned"]),
            "assets": assets
        }


def main() -> None:
    read_token = os.environ.get("SHUTTLE_GATEWAY_READ_TOKEN", "")
    ingest_token = os.environ.get("SHUTTLE_GATEWAY_INGEST_TOKEN", "")
    if len(read_token) < 32 or len(ingest_token) < 32 or hmac.compare_digest(read_token, ingest_token):
        raise SystemExit("Set two different random secrets: SHUTTLE_GATEWAY_READ_TOKEN and SHUTTLE_GATEWAY_INGEST_TOKEN (32+ characters each).")
    config = load_config()
    init_db()
    bind = os.environ.get("SHUTTLE_GATEWAY_BIND", "127.0.0.1")
    port = int(os.environ.get("SHUTTLE_GATEWAY_PORT", "8765"))
    origins = {item.strip() for item in os.environ.get("SHUTTLE_GATEWAY_ALLOWED_ORIGINS", "https://localhost,capacitor://localhost").split(",") if item.strip()}
    server = ThreadingHTTPServer((bind, port), GatewayHandler)
    server.gateway_config = config  # type: ignore[attr-defined]
    server.allowed_origins = origins  # type: ignore[attr-defined]
    print(f"Read-only shuttle gateway {VERSION} listening on {bind}:{port}; commissioned assets: {sum(commissioned(a) for a in config['assets'].values())}/{len(config['assets'])}")
    print("No PLC driver is bundled. Install only vendor-approved read-only adapters.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
