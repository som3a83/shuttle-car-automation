export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

interface StorageEnvelope<T> {
  format: 'shuttle-storage-envelope';
  schemaVersion: number;
  revision: number;
  savedAt: string;
  payload: T;
  checksum: string;
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

  async save(payload: T, now = new Date()): Promise<{ revision: number; checksum: string }> {
    const primary = await this.readEnvelope(this.primaryKey);
    const backup = await this.readEnvelope(this.backupKey);
    const valid = [primary, backup]
      .filter((entry): entry is { status: 'valid'; envelope: StorageEnvelope<T> } => entry.status === 'valid');
    if (valid.some(({ envelope }) => envelope.schemaVersion !== this.schemaVersion)) {
      throw new Error('Stored data uses a different schema version. Migrate or export it before saving.');
    }
    const latest = valid.sort((a, b) => b.envelope.revision - a.envelope.revision)[0]?.envelope;
    if (latest) this.storage.setItem(this.backupKey, JSON.stringify(latest));
    const revision = (latest?.revision ?? 0) + 1;
    const unsigned = {
      format: 'shuttle-storage-envelope' as const,
      schemaVersion: this.schemaVersion,
      revision,
      savedAt: now.toISOString(),
      payload
    };
    const envelope: StorageEnvelope<T> = { ...unsigned, checksum: await digest(unsigned, this.cryptoApi) };
    this.storage.setItem(this.primaryKey, JSON.stringify(envelope));
    return { revision, checksum: envelope.checksum };
  }

  async load(): Promise<StorageReadResult<T>> {
    const current = await this.readEnvelope(this.primaryKey);
    if (current.status === 'valid') {
      if (current.envelope.schemaVersion !== this.schemaVersion) {
        return { status: 'corrupt', data: null, revision: 0, reason: `Unsupported schema version ${current.envelope.schemaVersion}.` };
      }
      return { status: 'loaded', data: current.envelope.payload, revision: current.envelope.revision, savedAt: current.envelope.savedAt };
    }
    const backup = await this.readEnvelope(this.backupKey);
    if (backup.status === 'valid' && backup.envelope.schemaVersion === this.schemaVersion) {
      this.storage.setItem(this.primaryKey, JSON.stringify(backup.envelope));
      return { status: 'recovered', data: backup.envelope.payload, revision: backup.envelope.revision, savedAt: backup.envelope.savedAt };
    }
    if (current.status === 'missing' && backup.status === 'missing') return { status: 'missing', data: null, revision: 0 };
    return { status: 'corrupt', data: null, revision: 0, reason: 'Primary and recovery snapshots could not be validated.' };
  }

  private async readEnvelope(key: string): Promise<{ status: 'missing' } | { status: 'invalid' } | { status: 'valid'; envelope: StorageEnvelope<T> }> {
    const raw = this.storage.getItem(key);
    if (!raw) return { status: 'missing' };
    try {
      const parsed = JSON.parse(raw) as Partial<StorageEnvelope<T>>;
      if (parsed.format !== 'shuttle-storage-envelope' ||
        !Number.isInteger(parsed.schemaVersion) || !Number.isInteger(parsed.revision) ||
        (parsed.revision as number) < 1 || typeof parsed.savedAt !== 'string' ||
        typeof parsed.checksum !== 'string' || !('payload' in parsed)) return { status: 'invalid' };
      const { checksum, ...unsigned } = parsed as StorageEnvelope<T>;
      if (await digest(unsigned, this.cryptoApi) !== checksum) return { status: 'invalid' };
      return { status: 'valid', envelope: parsed as StorageEnvelope<T> };
    } catch {
      return { status: 'invalid' };
    }
  }
}
