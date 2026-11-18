# Shuttle Car Automation — Integrated Engineering Work Report
Updated: 2026-11-18

## Integration baseline
- Repository: `som3a83/shuttle-car-automation`
- Base branch: `main` at `5ba2fa25c94571bcf07c1c235a7dff07bd3f8933`
- Anila archive baseline: `faff09f63779e70074209dd1d8f808768a2c6021` (36 commits behind current main when the archive was reviewed).
- Integration branch: `integrated-2b-4a2-industrial-ux-20261118`
- No force-push, history rewrite, or direct write to `main` was performed.

## Integrated changes
1. Ported the seven Phase 2B-4a-2 storage migration orchestration modules and tests from existing PR #46 onto the latest `main`.
2. Replaced permissive storage placeholder interfaces with canonical application types for local accounts, audit records, archived audit records, and customization.
3. Added keyboard rotation/reset controls and accessibility hints to the conceptual shuttle and lithium-battery 3D viewers.
4. Gated shuttle wheel movement on explicit user activation and recorded `Running` status; the label explicitly identifies it as simulated movement, not live machine feedback.
5. Disabled unsolicited motion on initial load and applied the same state gate to the 2D fallback viewer.
6. Corrected the notification-dismissal test to assert that the selected notification disappears without requiring all seeded demo notifications to be cleared.
7. Clarified the CI comment for the unresolved upstream picomatch security advisory.

## Existing CI evidence before this branch
- PR #46 head `8a34dc8d5b672fc3ff9b734e9e770a8376e3a81b` had 255/256 tests passing; its single failure was the notification-dismissal assertion corrected here.
- Its observed workflows passed the TypeScript project check, Android Debug APK workflow, CAD validation, CodeQL, secret scan, dependency review, and Phase 2B-1 storage tests.
- The dependency audit reported six high-severity findings in the Vite/Vitest toolchain through picomatch. This integration does not claim the advisory is fixed; the audit remains visible and non-blocking while no patched upstream version is available.
- The integrated branch still requires fresh CI before merge. No APK/AAB or Play Store submission is claimed by this report.

## Repository protection state observed
- Active ruleset `main` (ID `27423825`) currently requires pull requests and rejects non-fast-forward updates.
- The live ruleset does not yet require status checks, an independent approval, CODEOWNERS approval, or resolved review threads. The updated `GITHUB_SECURITY_SETUP.md` records the missing gates and the exact checks to require.
- The GitHub integration did not expose a ruleset write operation, so those repository settings were not changed by this integration.

## Industrial and deployment boundaries
- The 3D models are conceptual references, not manufacturer-certified CAD.
- No physical shuttle is connected by this integration. Live telemetry or control requires verified vendor documentation, approved read-only adapters, and commissioning.
- Local account/storage protections remain device-local. Multi-device use needs trusted backend identity, server-side authorization, and centralized audit storage.
