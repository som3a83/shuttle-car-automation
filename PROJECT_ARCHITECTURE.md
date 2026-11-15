# Project Architecture — verified status

This document records only architecture that can be verified from the repository snapshot. No application architecture is inferred from the V4 ZIP filename.

## Repository architecture

- `main` is the default branch.
- Baseline commit: `5ad2a89d87947301eb399494236e479369d9d978`.
- `README.md` is a minimal heading.
- `shuttle-control-v4.0.0.zip` is a 1,066,026-byte binary artifact.
- The source archive could not be retrieved or unpacked using the available GitHub interface.

## Application architecture

Unknown. The following cannot be confirmed until source is available:

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

These constraints must be reconciled with the actual code and hardware documentation before implementation.