# Final Handover Checklist

This document is a sign-off record, not a substitute for GitHub evidence. Complete it against the exact final `main` commit.

## Source control
- [x] PR #56 merged and verified on `main`.
- [x] PR #57 merged and verified on `main`.
- [x] PR #58 merged and verified on `main`.
- [x] PR #59 merged and verified on `main`.
- [x] PR #60 merged and verified on `main` (final release closure).
- [x] Earlier superseded PR #54 closed as superseded by PR #56.
- [ ] No required implementation commit or release file remains only on an unmerged branch.
- [ ] Final `main` working tree is the only release source.

## CI and artifacts
- [ ] TypeScript, automated tests and production build pass on the final SHA.
- [ ] CodeQL, dependency review and secret scan pass on the final SHA.
- [ ] Industrial gateway validation passes on the final SHA.
- [ ] Android debug APK builds and the emulator installs and launches it.
- [ ] The matching APK and emulator evidence artifacts are available.
- [ ] Shuttle and battery CAD sources render successfully and the matching artifacts are available.
- [ ] Store listing artwork is generated and genuine screenshots are captured from the tested app.

## Product truth and safety
- [ ] Fleet records match confirmed installed models and preserve unknown values as unknown.
- [ ] ACME's reported 0% display remains a manual report; unverified SOC remains null.
- [ ] The diagnostic workbench is described as rule-based, not connected AI.
- [ ] Optional gateway access is described as read-only and not configured by default.
- [ ] No physical machine-control capability or safety certification is claimed.
- [ ] Privacy policy, terms, README, store listing and changelog match actual behavior.

## Publishing
- [ ] Publisher upload-keystore secrets are configured outside source control.
- [ ] Signed AAB/APK signature verification and SHA-256 checks pass.
- [ ] Version code is unique and increasing.
- [ ] Google Play Data safety, content rating, target audience, app access and distribution forms are completed truthfully.
- [ ] Physical-device acceptance is completed before production rollout.

**Important:** A checkbox may be marked complete only after the corresponding evidence is inspected. Pending, skipped or cancelled workflows are not passes. If plant OEM documents or gateway commissioning are unavailable, keep the application in local/offline mode and record that as an external commissioning dependency, not as a completed integration.
