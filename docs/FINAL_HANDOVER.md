# Final Handover — Shuttle Car Automation V8

This checklist is evidence-based. Mark an item complete only against the exact final `main` SHA.

## Source and version
- [ ] `main` contains the complete V8.0.0 source.
- [ ] Package version and lockfile both identify 8.0.0.
- [ ] Complete source ZIP, SHA-256 and source commit metadata are published.
- [ ] No required implementation remains only on an unmerged branch.

## Automated verification
- [ ] TypeScript, automated tests and production build pass on final SHA.
- [ ] CodeQL and secret scanning pass on final SHA.
- [ ] Gateway contract/safety tests pass on final SHA.
- [ ] CAD validation passes on final SHA.
- [ ] Responsive screenshots exist for all routes at mobile, tablet and desktop sizes.
- [ ] Android APK builds and emulator install/launch/crash checks pass.
- [ ] APK, checksum and emulator evidence artifacts match final SHA.

## Application behavior
- [ ] Shuttle identities include only the five confirmed manufacturer records.
- [ ] Unverified model names, serials, firmware, status and telemetry remain unknown.
- [ ] ACME reported HMI 0% remains a manual note; unverified SOC remains null.
- [ ] Battery lifecycle and assignment tests pass.
- [ ] Faults cannot be resolved without documented corrective action.
- [ ] Unfinished maintenance orders cannot be archived.
- [ ] Arabic/English navigation, themes and responsive screens are reviewed.
- [ ] Retired AI and reporting screens/permissions are absent.

## Physical connectivity
- [ ] OEM manuals, exact model/serials and approved communication maps are received.
- [ ] Gateway/adapter configuration is approved by plant OT/IT.
- [ ] Read-only telemetry is verified against physical HMI values and timestamps.
- [ ] Physical-device acceptance is signed off by authorized maintenance/OT personnel.

If OEM documentation or plant commissioning is unavailable, mark physical connectivity as **blocked by external commissioning dependency** and keep the app offline/uncommissioned. Do not claim live connectivity.

## Publishing
- [ ] Publisher signing secrets are configured outside source control.
- [ ] Signed AAB/APK signature and SHA-256 checks pass.
- [ ] Google Play declarations, privacy policy, content rating and app access are completed truthfully.
- [ ] Physical Android device test is completed before rollout.
