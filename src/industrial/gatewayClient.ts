import { isConnectionIdentifier } from './connectionCatalog';

export type GatewayDisplayState = 'LIVE' | 'STALE' | 'UNVERIFIED' | 'UNAVAILABLE';

export interface GatewayAsset {
  id: string;
  manufacturer: string;
  transports: string[];
  protocols: string[];
  model: string | null;
  firmware: string | null;
  adapterId: string | null;
  enabled: boolean;
  commissioned: boolean;
  missing: string[];
  latestReceivedAt?: string | null;
  sampleCount?: number;
}
export interface GatewayStatus {
  service: string; version: string; readOnly: true; controlRoutes: false;
  assetCount: number; commissionedCount: number; assets: GatewayAsset[];
}
export interface GatewaySample {
  assetId: string; tag: string; value: number | string | boolean | null; unit: string | null;
  sourceTimestamp: string | null; receivedAt: string;
  quality: 'GOOD' | 'UNCERTAIN' | 'BAD' | 'STALE' | 'NOT_CONFIGURED';
  provenance: 'LIVE_VENDOR' | 'MANUAL' | 'SIMULATED' | 'IMPORTED' | 'DERIVED';
  adapterId: string | null; adapterVersion: string | null;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function gatewayUrl(input: string): string {
  let parsed: URL;
  try { parsed = new URL(input.trim()); }
  catch { throw new Error('أدخل عنوان بوابة صحيحًا يبدأ بـ https://'); }
  const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && localHost)) {
    throw new Error('الاتصال عبر الشبكة يتطلب HTTPS؛ HTTP مسموح للاختبار المحلي فقط.');
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('عنوان البوابة لا يقبل بيانات دخول أو استعلامات داخل الرابط.');
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  return parsed.toString().replace(/\/$/, '');
}
async function requestJson(url: string, token: string, path: string): Promise<unknown> {
  const base = gatewayUrl(url);
  if (!token.trim()) throw new Error('أدخل رمز القراءة الخاص بالبوابة.');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(base + path, {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token.trim(), Accept: 'application/json' },
      cache: 'no-store', credentials: 'omit', redirect: 'error', signal: controller.signal
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'Gateway returned HTTP ' + response.status + '.';
      throw new Error(message);
    }
    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('انتهت مهلة الاتصال بالبوابة (8 ثوانٍ).');
    throw error;
  } finally { window.clearTimeout(timeout); }
}
export async function fetchGatewayStatus(url: string, token: string): Promise<GatewayStatus> {
  const data = await requestJson(url, token, '/v1/status');
  if (!isRecord(data) || data.service !== 'shuttle-read-only-gateway' || data.readOnly !== true ||
      data.controlRoutes !== false || !Array.isArray(data.assets) ||
      typeof data.assetCount !== 'number' || typeof data.commissionedCount !== 'number') {
    throw new Error('استجابة البوابة غير مطابقة لعقد القراءة فقط؛ تم رفضها.');
  }
  const assets: GatewayAsset[] = [];
  for (const item of data.assets) {
    if (!isRecord(item) || typeof item.id !== 'string' ||
        typeof item.manufacturer !== 'string' || !item.manufacturer.trim() || item.manufacturer.length > 100 ||
        typeof item.enabled !== 'boolean' || typeof item.commissioned !== 'boolean' ||
        !Array.isArray(item.transports) || item.transports.some((value) => !isConnectionIdentifier(value)) ||
        !Array.isArray(item.protocols) || item.protocols.some((value) => !isConnectionIdentifier(value)) ||
        !Array.isArray(item.missing) || item.missing.some((value) => typeof value !== 'string')) {
      throw new Error('بيانات أحد الأصول في البوابة غير سليمة.');
    }
    assets.push({
      id: item.id, manufacturer: item.manufacturer,
      transports: item.transports as string[], protocols: item.protocols as string[],
      model: typeof item.model === 'string' ? item.model : null,
      firmware: typeof item.firmware === 'string' ? item.firmware : null,
      adapterId: typeof item.adapterId === 'string' ? item.adapterId : null,
      enabled: item.enabled, commissioned: item.commissioned, missing: item.missing as string[],
      latestReceivedAt: typeof item.latestReceivedAt === 'string' ? item.latestReceivedAt : null,
      sampleCount: typeof item.sampleCount === 'number' ? item.sampleCount : 0
    });
  }
  return {
    service: data.service, version: typeof data.version === 'string' ? data.version : 'unknown',
    readOnly: true, controlRoutes: false, assetCount: data.assetCount,
    commissionedCount: data.commissionedCount, assets
  };
}
export async function fetchGatewayTelemetry(url: string, token: string, assetId: string): Promise<GatewaySample[]> {
  const data = await requestJson(url, token, '/v1/telemetry?assetId=' + encodeURIComponent(assetId) + '&limit=20');
  if (!isRecord(data) || data.readOnly !== true || !Array.isArray(data.samples)) {
    throw new Error('Invalid telemetry response for ' + assetId + '.');
  }
  return data.samples.map((item): GatewaySample => {
    if (!isRecord(item) || item.assetId !== assetId || typeof item.tag !== 'string' ||
        !['number', 'string', 'boolean'].includes(typeof item.value) ||
        (typeof item.value === 'number' && !Number.isFinite(item.value)) ||
        !['GOOD', 'UNCERTAIN', 'BAD', 'STALE'].includes(String(item.quality)) ||
        !['LIVE_VENDOR', 'MANUAL', 'SIMULATED', 'IMPORTED', 'DERIVED'].includes(String(item.provenance)) ||
        typeof item.receivedAt !== 'string') {
      throw new Error('Malformed telemetry sample for ' + assetId + '.');
    }
    return {
      assetId: item.assetId, tag: item.tag, value: item.value as number | string | boolean,
      unit: typeof item.unit === 'string' ? item.unit : null,
      sourceTimestamp: typeof item.sourceTimestamp === 'string' ? item.sourceTimestamp : null,
      receivedAt: item.receivedAt, quality: item.quality as GatewaySample['quality'],
      provenance: item.provenance as GatewaySample['provenance'],
      adapterId: typeof item.adapterId === 'string' ? item.adapterId : null,
      adapterVersion: typeof item.adapterVersion === 'string' ? item.adapterVersion : null
    };
  });
}
export function getGatewaySampleState(sample: GatewaySample, now = Date.now(), maxAgeMs = 15_000): GatewayDisplayState {
  if (sample.value === null || sample.quality === 'NOT_CONFIGURED') return 'UNAVAILABLE';
  if (sample.provenance !== 'LIVE_VENDOR' || !sample.adapterId || !sample.adapterVersion) return 'UNVERIFIED';
  if (sample.quality !== 'GOOD' || !sample.sourceTimestamp) return sample.quality === 'STALE' ? 'STALE' : 'UNVERIFIED';
  const source = Date.parse(sample.sourceTimestamp);
  const received = Date.parse(sample.receivedAt);
  if (!Number.isFinite(source) || !Number.isFinite(received) || received > now + 5000 || source > now + 5000) return 'UNVERIFIED';
  if (Math.abs(received - source) > maxAgeMs || now - received > maxAgeMs || now - source > maxAgeMs) return 'STALE';
  return 'LIVE';
}
