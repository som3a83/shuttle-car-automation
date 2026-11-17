import { describe, expect, it } from 'vitest';
import {
  AUDIT_ARCHIVE_PENDING_KEY,
  AUDIT_ARCHIVE_STORAGE_KEY,
  getAuditAnchor,
  readAuditArchives,
  type AuditStorage
} from './auditLog';

function pendingStorage(): { storage: AuditStorage; archiveReads: number } {
  let archiveReads = 0;
  const storage: AuditStorage = {
    getItem(key: string): string | null {
      if (key === AUDIT_ARCHIVE_PENDING_KEY) return JSON.stringify({ pending: true });
      if (key === AUDIT_ARCHIVE_STORAGE_KEY) {
        archiveReads += 1;
        return '[]';
      }
      return null;
    },
    setItem(): void {}
  };
  return { storage, get archiveReads() { return archiveReads; } };
}

describe('audit archive pending marker guard', () => {
  it('AUDIT-PENDING-001 blocks readAuditArchives before archive bytes are read', () => {
    const fixture = pendingStorage();
    expect(() => readAuditArchives(fixture.storage)).toThrow(/archive transaction is pending/i);
    expect(fixture.archiveReads).toBe(0);
  });

  it('AUDIT-PENDING-002 blocks getAuditAnchor before archive bytes are read', async () => {
    const fixture = pendingStorage();
    await expect(getAuditAnchor(fixture.storage)).rejects.toThrow(/archive transaction is pending/i);
    expect(fixture.archiveReads).toBe(0);
  });
});
