# Copilot engineering instructions

## Project and scope
- This repository contains the existing Shuttle Car Automation V6 application. Extend it in place; do not replace the project or modify `main` for feature work.
- Keep changes focused, typed, accessible, and covered by tests. Use the existing `src/types.ts` model and seed data unless a change is required for accuracy.
- Run `npm install`, `npx tsc -b`, `npm test`, and `npm run build` in a Node-capable environment; report actual results only.

## Industrial safety and data provenance
- Every reading/status must retain provenance: `REAL` only when verified from an actual integration, `SIMULATION` for demo data, `OFFLINE` when unavailable, and `UNKNOWN` when unverified. Never infer a live connection from a label or seed value.
- Do not invent PLC addresses/registers, manufacturer APIs, battery specifications, credentials, or telemetry. Device integration must remain read-only pending reviewed vendor documentation and safety approval. The UI must never issue motion/PLC commands.
- Illustrations are representative engineering visuals, not manufacturer CAD or verified dimensional drawings. Clearly label them.
- AI output is advisory only, must disclose uncertainty, and must not authorize maintenance, operation, or safety actions.

## Security and operations
- Client-side role filtering is not authentication or server-enforced RBAC. Do not claim it provides security. Do not collect or store passwords or secrets in the client.
- Do not commit credentials, private keys, or production data. Any future API credentials belong in a trusted server-side secret store.
- Operational changes in this frontend are local demo state unless a verified persistence service is implemented; make that scope clear.

## UI and quality
- Preserve English LTR and Arabic RTL, responsive phone/tablet/desktop behavior, keyboard access, and the Precision Industrial — Mechanical Intelligence graphite/titanium/copper visual identity.
- Forms need labels, validation, useful state changes, and tests. Buttons should perform a meaningful action or be explicitly disabled with an explanation.
- Keep dependencies minimal. CI must install dependencies and run TypeScript, tests, and production build. Never imply CI, Android, or hardware checks passed without evidence.
