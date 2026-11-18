# Phase 2B-4b — Reverse Migration and Admin Storage Management

## Scope

Phase 2B-4b adds an explicit, administrator-triggered reverse migration from the active IndexedDB generation back to the allow-listed legacy localStorage keys introduced in Phase 2B-4a. It does not change shuttle, battery, fault, maintenance, PLC, or vendor telemetry records independently of the typed storage schema.

## User interface and access

- An authenticated Admin or Super Admin can see the Storage Management tab in Security Center.
- Only an authenticated Super Admin with the dedicated `settings.manage` and `storage.rollback` permissions can start forward migration or reverse migration.
- No migration runs at application startup, in React effects, or merely by opening the Storage Management tab. The operator must explicitly click the action.
- Forward migration retains all legacy localStorage keys. It creates a verified backup and asks the operator to confirm it before the manual start.
- Reverse migration also requires a downloadable safety backup and explicit confirmation.

## Reverse-migration sequence

1. **Pre-flight:** confirm IndexedDB is the selected backend, no unfinished migration journal exists, the current generation matches a completed migration snapshot, and the approved 17-key reverse allow-list is complete.
2. **Source validation:** reject an unresolved audit archive marker or malformed existing legacy JSON. Missing IndexedDB keys receive their approved typed defaults.
3. **Read and stage:** read the latest IndexedDB values with revisions; serialize and JSON round-trip each value; store a deterministic staging copy in localStorage without changing canonical legacy keys.
4. **Verify staging:** re-read and verify every staged value and calculate the reverse-migration fingerprint.
5. **Write legacy:** write the staged values to all 17 canonical legacy keys. Re-read each key and verify its raw and parsed value.
6. **Final concurrency check:** ensure the active IndexedDB generation revisions have not changed during reverse migration. If there was a concurrent write, refuse to activate legacy mode so the operator can retry against the latest IndexedDB values.
7. **Commit backend change:** only after all legacy keys verify, persist the next-startup legacy preference and atomically deactivate the IndexedDB generation. Stale IndexedDB tabs are blocked from writing; reload the app to use localStorage.
8. **Retention:** neither canonical legacy keys, reverse-migration staging keys, nor previous IndexedDB generations are automatically deleted. No previous generation cleanup is implemented. Any future cleanup must require at least 90 days and five successful application launches.

## Failure and recovery

- If pre-flight, serialization, staging, a legacy write, a verification check, or the final IndexedDB transaction fails, IndexedDB remains the selected runtime backend (or its preference is restored).
- Some canonical legacy keys may already have been updated if a localStorage write is interrupted mid-sequence. The active IndexedDB generation remains intact and selected; retry re-reads the latest IndexedDB values and overwrites/re-verifies all 17 approved keys.
- A later reverse attempt shares one in-flight promise in the same tab, preventing duplicate StrictMode/double-click operations.
- Staging keys are intentionally retained for recovery/audit. No source or generation deletion is performed automatically.

## Security and operational limits

- This is device-local administration, not server-enforced multi-user authorization. The current local role matrix is not a trusted remote security boundary.
- Downloaded backup files are unencrypted and may contain local account metadata and operational records. Store them securely.
- Rollback only covers the approved 17 storage schema keys. Session storage remains excluded.
- The current storage selection is per device/browser profile. It is not a cloud sync or multi-device migration.

## Validation

Automated tests cover post-migration operational writes, all-key reverse migration, approved defaults for missing records, corrupted legacy JSON rejection, interruption and retry, destination write failure without losing the active IndexedDB copy, previous-generation retention, stale-tab write blocking, single-flight execution, and admin-only access to Storage Management.

Run:

```sh
npm run check
npm test
npm run build
```
