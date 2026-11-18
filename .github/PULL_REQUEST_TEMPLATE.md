## Scope
<!-- Describe the user-visible and architectural changes. -->

## Validation evidence
- [ ] TypeScript project check passes.
- [ ] Full automated suite passes, including security and storage tests.
- [ ] Production web build passes.
- [ ] Android build and emulator smoke test pass when UI/runtime files change.
- [ ] CAD validation passes when engineering model files change.
- [ ] No secrets, credentials or private operational data are included.

## Data safety and migration
- [ ] Existing local records remain readable or have a verified migration path.
- [ ] Migration is explicit, recoverable and does not delete the source before verification.
- [ ] Backup/restore behavior is covered by tests.
- [ ] Authentication, audit and customization use the same configured storage backend.
- [ ] Failure and recovery paths are covered by tests.

## Industrial safety and engineering provenance
- [ ] No unverified PLC registers, OEM dimensions, live telemetry or machine commands are invented.
- [ ] Conceptual geometry is labelled as reference-only, not OEM CAD.
- [ ] Simulation is clearly distinguished from physical equipment operation.
- [ ] No movement, charging, reset or PLC write path is introduced without an approved safety design.

## Privacy and security
- [ ] Privacy policy and in-app data disclosures match actual behavior.
- [ ] Permission checks are enforced at action handlers, not only by hiding navigation.
- [ ] Audit records preserve provenance and integrity.
- [ ] New dependencies and workflow permissions are justified.
- [ ] Required checks and review protections are configured in the repository ruleset.

## Release boundary
- [ ] Debug APK is not represented as a signed Google Play release.
- [ ] Physical-device testing and vendor commissioning limitations are stated.