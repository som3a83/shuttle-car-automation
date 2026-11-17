export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface StorageEnvelope<T> {
  format: 'shuttle-storage-envelope';
  schemaVersion: number;
  revision: number;
  savedAt: string;
  payload: T;
  checksum: string;
}

export type StorageEnvelopeInspection<T> =
  | { status: 'missing'; raw: null }
  | { status: 'invalid'; raw: string; reason: string }
  | { status: 'valid'; raw: string; envelope: StorageEnvelope<T> };

export interface StorageInspection<T> {
  primary: StorageEnvelopeInspection<T>;
  previous: StorageEnvelopeInspection<T>;
}

export type StorageReadResult<T> =
  | { status: 'missing'; data: null; revision: 0 }
  | { status: 'loaded'; data: T; revision: number; savedAt: string }
  | { status: 'recovered'; data: T; revision: number; savedAt: string }
  | { status: 'corrupt'; data: null; revision: 0; reason: string };

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

async function digest(value: unknown, cryptoApi: Crypto): Promise<string> {
  if (!cryptoApi?.subtle) throw new Error('Web Crypto SHA-256 is unavailable.');
  const bytes = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class VersionedStorageEngine<T> {
  private readonly primaryKey: string;
  private readonly backupKey: string;
  private readonly schemaVersion: number;
  private readonly storage: StorageLike;
  private readonly cryptoApi: Crypto;

  constructor(options: {
    key: string;
    schemaVersion: number;
    storage?: StorageLike;
    cryptoApi?: Crypto;
  }) {
    if (!options.key.trim()) throw new Error('Storage key is required.');
    if (!Number.isInteger(options.schemaVersion) || options.schemaVersion < 1) throw new Error('Schema version must be a positive integer.');
    this.primaryKey = options.key;
    this.backupKey = `${options.key}:previous`;
    this.schemaVersion = options.schemaVersion;
    this.storage = options.storage ?? localStorage;
    this.cryptoApi = options.cryptoApi ?? globalThis.crypto;
  }

  async inspect(): Promise<StorageInspection<T>> {
    return {
      primary: await this.readEnvelope(this.primaryKey),
      previous: await this.readEnvelope(this.backupKey)
    };
  }

  async save(payload: T, now = new Date()): Promise<{ revision: number; checksum: string }> {
    const inspection = await this.inspect();
    const { primary, previous } = inspection;

    if (primary.status === 'invalid' || previous.status === 'invalid') {
      throw new Error('Stored data is damaged. Enter Recovery Mode before saving; existing bytes were not changed.');
    }
    if (primary.status === 'valid' && primary.envelope.schemaVersion !== this.schemaVersion) {
      throw new Error('Stored data uses a different schema version. Migrate or export it before saving.');
    }
    if (previous.status === 'valid' && previous.envelope.schemaVersion !== this.schemaVersion) {
      throw new Error('Recovery snapshot uses a different schema version. Migrate or export it before saving.');
    }
    if (primary.status === 'missing' && previous.status === 'valid') {
      throw new Error('The primary snapshot is missing while a previous snapshot exists. Explicit recovery is required before saving.');
    }
    if (primary.status === 'valid' && previous.status === 'valid' &&
        previous.envelope.revision > primary.envelope.revision) {
      throw new Error('The recovery snapshot is newer than the primary snapshot. Explicit recovery is required before saving.');
    }

    const latestRevision = Math.max(
      primary.status === 'valid' ? primary.envelope.revision : 0,
      previous.status === 'valid' ? previous.envelope.revision : 0
    );
    if (primary.status === 'valid') {
      // The current verified primary becomes the previous snapshot before the new primary is written.
      this.storage.setItem(this.backupKey, primary.raw);
    }

    const unsigned = {
      format: 'shuttle-storage-envelope' as const,
      schemaVersion: this.schemaVersion,
      revision: latestRevision + 1,
      savedAt: now.toISOString(),
      payload
    };
    const envelope: StorageEnvelope<T> = { ...unsigned, checksum: await digest(unsigned, this.cryptoApi) };
    const serialized = JSON.stringify(envelope);
    this.storage.setItem(this.primaryKey, serialized);
    return { revision: envelope.revision, checksum: envelope.checksum };
  }

  /**
   * Restores the previous snapshot only when explicitly requested by the
   * Recovery UI after the user has inspected the candidate.
   */
  async restorePrevious(allowReplacingValidPrimary = false): Promise<StorageReadResult<T>> {
    const { primary, previous } = await this.inspect();
    if (primary.status === 'valid' && primary.envelope.schemaVersion === this.schemaVersion && !allowReplacingValidPrimary) {
      throw new Error('The primary snapshot is already valid; explicit Recovery Mode approval is required to replace it.');
    }
    if (previous.status !== 'valid' || previous.envelope.schemaVersion !== this.schemaVersion) {
      throw new Error('No compatible verified previous snapshot is available.');
    }
    this.storage.setItem(this.primaryKey, previous.raw);
    return {
      status: 'recovered',
      data: previous.envelope.payload,
      revision: previous.envelope.revision,
      savedAt: previous.envelope.savedAt
    };
  }

  /**
   * Creates a new verified primary from a user-approved legacy or empty
   * recovery candidate. Existing raw envelopes are deliberately left in place
   * for the caller to quarantine before invoking this method.
   */
  async replaceAfterRecovery(
    payload: T,
    now = new Date(),
    allowReplacingVerifiedPrimary = false
  ): Promise<{ revision: number; checksum: string }> {
    const { primary, previous } = await this.inspect();
    if (primary.status === 'valid' && primary.envelope.schemaVersion === this.schemaVersion && !allowReplacingVerifiedPrimary) {
      throw new Error('A valid primary snapshot now exists; refusing to replace it without an explicit Recovery Mode choice.');
    }
    const latestRevision = Math.max(
      primary.status === 'valid' ? primary.envelope.revision : 0,
      previous.status === 'valid' && previous.envelope.schemaVersion === this.schemaVersion ? previous.envelope.revision : 0
    );
    const unsigned = {
      format: 'shuttle-storage-envelope' as const,
      schemaVersion: this.schemaVersion,
      revision: latestRevision + 1,
      savedAt: now.toISOString(),
      payload
    };
    const envelope: StorageEnvelope<T> = { ...unsigned, checksum: await digest(unsigned, this.cryptoApi) };
    this.storage.setItem(this.primaryKey, JSON.stringify(envelope));
    return { revision: envelope.revision, checksum: envelope.checksum };
  }

  async load(): Promise<StorageReadResult<T>> {
    const { primary, previous } = await this.inspect();
    if (primary.status === 'valid') {
      if (primary.envelope.schemaVersion !== this.schemaVersion) {
        return { status: 'corrupt', data: null, revision: 0, reason: `Unsupported schema version ${primary.envelope.schemaVersion}.` };
      }
      return { status: 'loaded', data: primary.envelope.payload, revision: primary.envelope.revision, savedAt: primary.envelope.savedAt };
    }
    if (previous.status === 'valid' && previous.envelope.schemaVersion === this.schemaVersion) {
      return { status: 'corrupt', data: null, revision: 0, reason: 'A compatible previous snapshot exists. Use Recovery Mode to preview and restore it.' };
    }
    if (primary.status === 'missing' && previous.status === 'missing') return { status: 'missing', data: null, revision: 0 };
    return { status: 'corrupt', data: null, revision: 0, reason: 'Primary and recovery snapshots could not be validated.' };
  }

  private async readEnvelope(key: string): Promise<StorageEnvelopeInspection<T>> {
    const raw = this.storage.getItem(key);
    if (raw === null) return { status: 'missing', raw: null };
    try {
      const parsed = JSON.parse(raw) as Partial<StorageEnvelope<T>>;
      if (parsed.format !== 'shuttle-storage-envelope' ||
        !Number.isInteger(parsed.schemaVersion) || (parsed.schemaVersion as number) < 1 ||
        !Number.isInteger(parsed.revision) || (parsed.revision as number) < 1 ||
        typeof parsed.savedAt !== 'string' || !Number.isFinite(Date.parse(parsed.savedAt)) ||
        typeof parsed.checksum !== 'string' || !/^[a-f0-9]{64}$/i.test(parsed.checksum) ||
        !Object.prototype.hasOwnProperty.call(parsed, 'payload')) {
        return { status: 'invalid', raw, reason: 'Snapshot envelope structure is invalid.' };
      }
      const { checksum, ...unsigned } = parsed as StorageEnvelope<T>;
      if (await digest(unsigned, this.cryptoApi) !== checksum) {
        return { status: 'invalid', raw, reason: 'Snapshot checksum does not match its content.' };
      }
      return { status: 'valid', raw, envelope: parsed as StorageEnvelope<T> };
    } catch (reason) {
      return {
        status: 'invalid',
        raw,
        reason: reason instanceof Error ? reason.message : 'Snapshot could not be parsed or verified.'
      };
    }
  }
}
