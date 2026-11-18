# Storage migration and security gate status — 18 November 2026

## Implemented in this development branch

- One selected storage-engine provider is used by operational, local-authentication, audit and customization async APIs.
- The application keeps legacy storage as its default until a Super Admin explicitly starts the migration.
- The migration copies the approved 17-key allow-list into an isolated IndexedDB generation, verifies the staged records and checks the original source fingerprint before atomically switching the active generation.
- The migration does not delete localStorage source values. A successful migration requires an application reload so every lazily loaded module resolves the IndexedDB backend from the persisted preference.
- On IndexedDB startup, all 12 operational collections are checked before the UI mounts. An incomplete active generation pauses startup; the older localStorage recovery screen is not allowed to overwrite IndexedDB with a stale compatibility copy.
- Local sessions remain in sessionStorage and are intentionally excluded from migration. The account registry is re-read from the active storage engine when the session is validated.

## GitHub ruleset still needs repository-owner action

The active main ruleset was last inspected on 18 November 2026 (ID 27423825). It requires pull requests and rejects non-fast-forward changes, but it does not yet require status checks, a second approval, CODEOWNERS approval or resolved review conversations. This branch cannot change those repository-administration settings through the available GitHub connection.

A repository administrator must edit Settings → Rules → main and configure:

1. Require the named PR checks to pass before merge: Shuttle Car Automation CI, CodeQL, Secret Leak Scan, Industrial read-only gateway validation, Parametric CAD validation, and Android Debug APK & Emulator Smoke Test.
2. Require conversation resolution before merge.
3. Require one independent approval only after a second trusted maintainer/reviewer has been added. A PR author cannot approve their own change.
4. Enable CODEOWNERS review when an independently assigned code owner is available.
5. Confirm direct pushes to main are rejected and a deliberately failing test PR cannot merge.

Do not make Dependency Review a required check while GitHub Dependency Graph is unavailable and its workflow step is intentionally non-blocking. Keep the temporary npm audit exception visible until the outstanding upstream picomatch advisory has a published fixed release and the dependency has been updated; then remove continue-on-error and make the audit blocking again.

## Release boundary

An Android debug APK and emulator smoke test are not a signed Google Play release. A signed AAB still requires the publisher upload keystore and the four documented Actions secrets. No hardware telemetry or machine-control route is enabled by this storage change.
