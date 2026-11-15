# Project Architecture — verified status

This document records only repository details verified so far. No application architecture is inferred from the V4 ZIP filename or partial binary preview.

## Repository architecture

- Default branch: `main`.
- Baseline commit: `5ad2a89d87947301eb399494236e479369d9d978`.
- Recovery branch: `backup/v4-original-2026-11-15`.
- Development branch: `development/v4-industrial-upgrade`.
- `README.md` is a minimal heading.
- `shuttle-control-v4.0.0.zip` is a 1,066,026-byte binary artifact.
- A limited file-viewer preview shows ZIP signatures and some embedded path strings, but does not expose the archive's complete member list or bytes.

## Application architecture

Unknown. The available session tools provide GitHub APIs and file previews, but no terminal, local workspace, raw archive download, or ZIP extraction capability. GitHub's contents response reports `encoding: none` and empty content for this archive. It has not been fully listed, validated, extracted, or checked for unsafe paths. The original archive is preserved unchanged.

The following cannot be confirmed until extracted source is made available in a branch:

- Web framework, routing, state management, and UI component structure.
- Backend runtime, API boundaries, authentication, and authorization.
- Database engine, schema, migrations, backup strategy, or tenant isolation.
- Device communication adapters, telemetry provenance, and safety interlocks.
- AI provider architecture and secret handling.
- Android wrapper/native components, offline behavior, permissions, and release setup.
- CI, automated tests, deployment targets, and production build process.

## Intended architecture constraints for the next implementation stage

These are requirements, not claims about the existing application:

1. Keep device adapters behind a server-side boundary; begin with read-only telemetry and explicitly distinguish real, simulated, manual, historical, and disconnected data.
2. Enforce authentication, authorization, and tenant scoping in the backend for every sensitive operation.
3. Keep provider credentials server-side and optional; core fleet operations must not depend on AI availability.
4. Store operational changes as auditable records; preserve battery, fault, and maintenance history.
5. Never issue movement or other hazardous PLC commands without verified vendor specifications, engineered safety controls, and explicit authorization.
6. Reuse the verified web application in Android where practical; keep signing material outside the repository and under the owner's control.

These constraints must be reconciled with the actual code and hardware documentation before implementation. See `TECHNICAL_AUDIT.md` for a safe local archive validation/extraction procedure.