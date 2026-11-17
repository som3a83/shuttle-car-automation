# Security Policy — Shuttle Car Automation

## Supported versions

Security fixes are applied to the latest maintained release line and the active development branch. Source archives and debug APKs are development artifacts unless a release tag and release-signing record explicitly state otherwise.

## Report a vulnerability privately

**Do not report an exploitable vulnerability in a public GitHub issue.**

Use GitHub's private repository security advisory flow:

1. Open the repository's **Security** tab.
2. Select **Advisories** or **Report a vulnerability**.
3. Submit the affected version/commit, impact, reproducible steps and a safe proof of concept.

Direct link: https://github.com/som3a83/shuttle-car-automation/security/advisories/new

If private reporting is unavailable, contact the repository maintainer through https://github.com/som3a83. Never attach credentials, personal data, customer records, access tokens, network diagrams or confidential industrial information to a public issue.

## Current security model

The application supports device-local accounts, PBKDF2-SHA-256 password derivation, expiring browser/WebView sessions, a role-permission matrix, application-level mutation checks, a SHA-256 chained audit record and versioned operational storage snapshots with checksums and recovery copies.

These controls improve local-device account separation and data-integrity diagnostics. They are **not** a trusted server security boundary:

- Local account records, audit entries and storage envelopes reside in device/browser storage and can be modified by someone with sufficient access to that device or its application data.
- The audit chain is tamper-evident, not immutable or cryptographically anchored outside the device.
- Checksums detect accidental corruption and unsophisticated edits; they do not provide confidentiality or protect against an attacker who can rewrite the data and recompute hashes.
- Local roles are enforced in application code. They are not server-enforced authorization and do not support centralized revocation or cross-device identity.
- The app has no publisher-operated cloud database or application backend, and no cross-device synchronization.

For multi-user or network deployment, add a trusted identity provider, server-side authorization, protected API, managed device policy and centrally stored audit records before relying on role separation.

## Industrial safety boundary

The application is a local fleet recordkeeping, visualization and monitoring tool. It is not a safety system, emergency stop, machine-protection controller or authorization to release equipment to service. The app and bundled gateway do not issue machine movement, charging, reset, PLC-write or motor-control commands.

The separate Python OT edge gateway accepts authenticated read-only status/telemetry requests and authenticated telemetry ingestion from explicitly configured adapters. The five known asset records are disabled/uncommissioned in the example configuration. No Cassioli, Craftsman or ACME vendor driver or approved register/tag map is included. Live integration requires manufacturer documentation, site authorization, verified hardware details, secure network design and commissioning tests.

## Secure development controls

- Pull-request and CI checks should pass before merge.
- Dependabot, CodeQL, secret scanning and dependency review are configured in repository workflows, subject to their current GitHub availability/settings.
- Release signing keys must be stored as protected GitHub Actions secrets and must never be committed.
- Branch protection, repository secret scanning, push protection and Actions permissions are controlled in GitHub Settings. Follow [GITHUB_SECURITY_SETUP.md](GITHUB_SECURITY_SETUP.md) and verify the actual repository settings; documentation alone does not enable them.

Use synthetic values for tests. Redact all tokens, credentials, IPs, personal information and production configuration from logs and security reports.
