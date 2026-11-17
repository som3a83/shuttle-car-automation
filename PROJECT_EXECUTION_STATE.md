# Project Execution State — Local Engineering Upgrade

Updated: 17 November 2026
Repository baseline: `som3a83/shuttle-car-automation`
Source archive baseline: `faff09f63779e70074209dd1d8f808768a2c6021`

## Scope and provenance

This local upgrade was applied to the complete source ZIP previously generated from the repository `main` branch. It is not the later in-progress Claude ZIP mentioned in chat, and it has not been pushed to GitHub. The downloaded archive had no `.git` metadata. The changes below are available in the supplied upgrade ZIP only until the maintainer applies them to the intended branch.

## Implemented in this local upgrade

- Added a centralized role/permission matrix covering seven application roles and route permissions.
- Added an authenticated-action gate: a local role preview cannot perform write actions. First launch now starts as an unauthenticated Viewer/guest and routes the user to the local identity center for first-admin bootstrap.
- Added local account creation and sign-in using PBKDF2-SHA-256 with per-account random salt, session-scoped credentials, eight-hour expiry and a short lockout after repeated failed attempts. Session roles are re-derived from the matching local account record rather than trusted from `sessionStorage`. A malformed or duplicated account registry now fails closed and blocks first-admin bootstrap rather than being treated as an empty registry.
- Added a SHA-256 chained audit log. Malformed audit data is reported as unverifiable rather than filtered into an apparently clean empty ledger. Appends stop when the configured 5,000-record cap is reached rather than truncating the chain and breaking verification.
- Added versioned/checksummed operational storage snapshots, previous-snapshot recovery, sequential writes per collection, startup migration from legacy keys and quarantine reporting for damaged envelopes. The old keys remain as a compatibility layer for the existing UI.
- Integrated the versioned storage bootstrap before React mounts and persistence from the main application state effect.
- Added an Arabic/English local identity and security center, sign-in/out and local account visibility controls.
- Added permission checks and audit events to the shift handover and notification-management paths.
- Updated README, SECURITY, PRIVACY and this execution record to describe the actual local-only security boundary.

## Validation performed

- Security and storage unit tests: **25 passed, 0 failed** using Node 22's built-in test runner with experimental TypeScript type stripping.
- Industrial gateway Python tests: **9 passed, 0 failed** using `python3 -m unittest -v` from `industrial-gateway/`.
- Isolated TypeScript strict check for security modules: passed.
- TypeScript/TSX syntax transpilation: 37 source files parsed, zero syntax diagnostics. This is a syntax check, not a full application typecheck.
- ZIP integrity: source archive extracted and its ZIP CRC test passed before modification.

## Not validated / outstanding

- `npm install` could not complete because the package registry was unreachable (`EAI_AGAIN`); offline installation also failed because required packages were not cached.
- Therefore the full Vitest suite, complete React typecheck, Vite production build, Android Gradle build, emulator launch and physical-device test were not run on this locally modified source.
- No APK or AAB was generated from this upgraded source.
- This local upgrade has not been pushed, committed or merged into GitHub.
- The current app remains local browser/WebView storage. The versioned envelope layer is not SQLite, and device-local accounts are not enterprise identity or server-side RBAC.
- No physical shuttle is commissioned or connected. The OT gateway still requires manufacturer-approved read-only adapters, verified models/firmware and approved tag maps.
- 3D representations remain conceptual and are not manufacturer CAD.

## Safety and security boundary

Local password derivation, role checks, checksums and chained audit records improve local integrity and accountability, but a user who controls the device or application files can modify local storage and client code. A network/shared deployment requires trusted server-side identity, authorization, protected APIs and centrally stored audit logs. No PLC writes, motion, charging, reset or machine-control functions were added.

## Recommended integration sequence

1. Review the changed files in this ZIP and compare with the latest Claude output before merging anything.
2. Apply the upgrade to a dedicated branch based on the latest intended GitHub branch, not by overwriting `main` or an unreviewed V6 branch.
3. Install dependencies in a network-enabled environment and run `npm run validate` plus the Android debug build.
4. Resolve full typecheck/build/test results, then manually verify first-admin bootstrap, login/logout, role-specific routes and denied write actions on mobile and desktop.
5. Protect the default branch in GitHub Settings and retain the PR/test evidence.
6. Obtain vendor-approved hardware documentation before any live shuttle integration.
