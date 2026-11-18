# Phase 2B-4b — Verified Storage Rollback and Admin UI

## Scope

This stage adds a guarded rollback path for the explicit localStorage-to-IndexedDB migration introduced in Phase 2B-4a. It does not alter shuttle, battery, fault, maintenance, PLC, or vendor telemetry records directly.

## Safety model

1. Each successful generation switch records the imported key revisions alongside the source SHA-256 fingerprint.
2. The Settings page exposes rollback controls to authenticated Super Admin accounts only. The permission matrix includes a dedicated `storage.rollback` permission that is excluded from the Admin role.
3. Before rollback, the panel creates a downloadable, SHA-256-labelled safety backup of the current IndexedDB envelope.
4. Preflight checks the selected active migration snapshot, the current generation pointer, all imported record revisions, and the fingerprint of the preserved allow-listed localStorage source.
5. Any changed/missing/extra IndexedDB record or changed legacy source blocks rollback. The feature does not silently discard post-migration writes.
6. The final deactivation is one IndexedDB transaction. It moves the pointer to a fresh empty rollback generation, preserves the migrated generation and the legacy source, and writes a rollback-history record.
7. A metadata marker rejects writes from already-open IndexedDB tabs after the rollback transaction. A full reload then selects the preserved localStorage backend.
8. A later migration can use the empty rollback generation as its destination baseline; successful activation clears the deactivation marker.

## Important limitations

- This is a device-local recovery mechanism, not a server-enforced administrator boundary. The existing local role/permission system is not a trusted multi-user security boundary.
- The safety export is unencrypted and may contain operational records and local account metadata. Store it securely.
- Rollback is intentionally unavailable once any migrated record has been modified after the snapshot. In that case, export a normal backup and use a reviewed restore/recovery procedure instead.
- The previous IndexedDB generation is retained; this stage does not erase old records or backups.

## Validation

The automated coverage verifies source-fingerprint matching, revision drift rejection, atomic pointer deactivation, preservation of both legacy and migrated data, stale-tab write blocking, Super Admin-only permission, backup confirmation, and rollback UI blocked/success states.

Run:

```sh
npm run check
npm test
npm run build
```
