"""Public contract for trusted, vendor-specific read-only adapters.

Implementations must be approved for the exact shuttle hardware and must use
vendor-issued read-only credentials. This interface deliberately exposes no
write, move, reset, charge or control method.
"""
from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Protocol, Sequence


@dataclass(frozen=True)
class AdapterIdentity:
    adapter_id: str
    manufacturer: str
    model: str
    firmware: str
    transport: str
    protocol: str
    version: str


@dataclass(frozen=True)
class AdapterReading:
    tag: str
    value: int | float | str | bool
    unit: str | None
    source_timestamp: str
    quality: str = "GOOD"


class ReadOnlyVendorAdapter(Protocol):
    identity: AdapterIdentity

    def read(self, tags: Sequence[str]) -> Iterable[AdapterReading | Mapping[str, Any]]:
        """Read approved telemetry tags; never write to the machine."""
        ...

    def close(self) -> None:
        """Release the connection without changing machine state."""
        ...
