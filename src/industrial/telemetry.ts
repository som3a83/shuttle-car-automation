/**
 * Industrial telemetry boundary.
 *
 * This module deliberately contains no socket, PLC, OPC UA, Modbus or vendor SDK client.
 * Vendor adapters must run in the approved OT gateway and implement this read-only contract.
 * Never place PLC credentials or network addresses in the mobile application.
 */

export type TelemetryQuality = 'GOOD' | 'UNCERTAIN' | 'BAD' | 'STALE' | 'NOT_CONFIGURED';
export type TelemetryProvenance = 'LIVE_VENDOR' | 'MANUAL' | 'SIMULATED' | 'IMPORTED' | 'DERIVED';

export interface TelemetrySample<T extends number | string | boolean = number | string | boolean> {
  assetId: string;
  tag: string;
  value: T | null;
  unit: string | null;
  sourceTimestamp: string | null;
  receivedAt: string;
  quality: TelemetryQuality;
  provenance: TelemetryProvenance;
  adapterId: string | null;
  adapterVersion: string | null;
}

export interface ReadOnlyTelemetryAdapter {
  readonly id: string;
  readonly manufacturer: 'Cassioli' | 'Craftsman' | 'ACME';
  readonly model: string;
  readonly firmware: string;
  readonly mode: 'READ_ONLY';
  read(tags: readonly string[], signal?: AbortSignal): Promise<readonly TelemetrySample[]>;
}

export interface TelemetryPolicy {
  maxAgeMs: number;
  allowedClockSkewMs: number;
}

export type DisplayState = 'LIVE' | 'STALE' | 'UNVERIFIED' | 'UNAVAILABLE';

const parseTime = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * A sample is LIVE only when provenance, quality, adapter identity and timestamps
 * all pass validation. Null values are never coerced to zero.
 */
export function getTelemetryDisplayState(
  sample: TelemetrySample,
  now = Date.now(),
  policy: TelemetryPolicy = { maxAgeMs: 15_000, allowedClockSkewMs: 5_000 }
): DisplayState {
  if (sample.value === null || sample.quality === 'NOT_CONFIGURED') return 'UNAVAILABLE';
  if (sample.provenance !== 'LIVE_VENDOR' || !sample.adapterId || !sample.adapterVersion) return 'UNVERIFIED';
  if (sample.quality !== 'GOOD') return sample.quality === 'STALE' ? 'STALE' : 'UNVERIFIED';

  const source = parseTime(sample.sourceTimestamp);
  const received = parseTime(sample.receivedAt);
  if (source === null || received === null) return 'UNVERIFIED';
  if (received > now + policy.allowedClockSkewMs || source > now + policy.allowedClockSkewMs) return 'UNVERIFIED';
  if (Math.abs(received - source) > policy.maxAgeMs) return 'STALE';
  if (now - received > policy.maxAgeMs || now - source > policy.maxAgeMs) return 'STALE';
  return 'LIVE';
}

/** Runtime validation at the gateway/API boundary; rejects malformed or unsafe claims. */
export function validateTelemetrySample(input: unknown): input is TelemetrySample {
  if (!input || typeof input !== 'object') return false;
  const item = input as Record<string, unknown>;
  const validValue = item.value === null || ['number', 'string', 'boolean'].includes(typeof item.value);
  const qualities: TelemetryQuality[] = ['GOOD', 'UNCERTAIN', 'BAD', 'STALE', 'NOT_CONFIGURED'];
  const provenances: TelemetryProvenance[] = ['LIVE_VENDOR', 'MANUAL', 'SIMULATED', 'IMPORTED', 'DERIVED'];
  return typeof item.assetId === 'string' && item.assetId.length > 0
    && typeof item.tag === 'string' && item.tag.length > 0
    && validValue
    && (item.unit === null || typeof item.unit === 'string')
    && (item.sourceTimestamp === null || typeof item.sourceTimestamp === 'string')
    && typeof item.receivedAt === 'string'
    && qualities.includes(item.quality as TelemetryQuality)
    && provenances.includes(item.provenance as TelemetryProvenance)
    && (item.adapterId === null || typeof item.adapterId === 'string')
    && (item.adapterVersion === null || typeof item.adapterVersion === 'string');
}

/** Explicitly prevents future adapters from silently adding write/control operations. */
export function assertReadOnlyAdapter(adapter: ReadOnlyTelemetryAdapter): void {
  if (adapter.mode !== 'READ_ONLY') {
    throw new Error('Industrial monitoring adapters must be READ_ONLY.');
  }
  if (!adapter.id || !adapter.model || !adapter.firmware) {
    throw new Error('Adapter identity, exact model and firmware are required before commissioning.');
  }
}
