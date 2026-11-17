> **CURRENT-STATE NOTICE — 17 November 2026:** The detailed inventory below is a historical snapshot generated before PR #23 was merged. Its statements that PR #23 is open/draft and that the audited `main` SHA is `faff09f63779e70074209dd1d8f808768a2c6021` are no longer current. The current official `main` commit is `f7574cf5db3cfa636d0dae957e1b254cea68b369`; PR #23 was merged at that commit. The current main tree has 118 Git tree entries including directories and is not truncated. The current engineering status and verified CI evidence are maintained in `TECHNICAL_AUDIT.md` and `PROJECT_EXECUTION_STATE.md`. Do not use the historical per-file table below as a current SHA or PR-state inventory.

---

# REPOSITORY UNIFICATION REPORT — IN PROGRESS

Generated from a live GitHub repository snapshot.

## 1. Snapshot and invariants

- Repository: som3a83/shuttle-car-automation
- Official branch: main
- PR development branch: engineering/industrial-ui-security-v1
- PR: #23 — open, draft=true
- Main SHA: faff09f63779e70074209dd1d8f808768a2c6021
- Development SHA at report generation: 4841b2c35ca923ef2ca89b05816aa81867437e76
- PR base SHA: faff09f63779e70074209dd1d8f808768a2c6021
- PR head SHA: 4841b2c35ca923ef2ca89b05816aa81867437e76
- Git tree truncated: false
- Files inventoried: **104**
- Tree directories: **12**
- Total tracked file bytes: **1,986,736**
- File deletions made during this unification pass: **0**
- Changes remain on the development branch; no direct write or merge to main was performed.

## 2. Extension inventory

- .ts: 25
- .md: 19
- .tsx: 16
- .yml: 11
- .mjs: 9
- .py: 5
- .json: 5
- .svg: 3
- .css: 3
- .[no extension]: 2
- .gitignore: 2
- .html: 1
- .example: 1
- .webmanifest: 1
- .zip: 1

## 3. Per-file inventory and disposition

The table gives every tracked file a category and explicit disposition. “Reviewed — targeted audit” means the file was read in context for the current security/recovery/build work; it does not mean every feature inside it has completed exhaustive testing. Other source and documentation files remain retained and require deeper content review.

| File | Bytes | Blob SHA (short) | Classification | Content review status | Decision |
|---|---:|---|---|---|---|
| .github/CODEOWNERS | 262 | eae045692f | GitHub repository configuration | Inventory only — detailed review pending | Retain; no deletion approved |
| .github/copilot-instructions.md | 2321 | 88c82c2a61 | GitHub repository configuration | Inventory only — detailed review pending | Retain; no deletion approved |
| .github/dependabot.yml | 764 | 0c2d687752 | GitHub repository configuration | Inventory only — detailed review pending | Retain; no deletion approved |
| .github/workflows/android-debug-artifact.yml | 2843 | 4540e94aa0 | CI/CD workflow | Reviewed — targeted audit | Retain; no deletion approved |
| .github/workflows/android-debug.yml | 5373 | b9f9e2fc34 | CI/CD workflow | Reviewed — targeted audit | Retain; no deletion approved |
| .github/workflows/android-package.yml | 2228 | 6bdf095963 | CI/CD workflow | Reviewed — targeted audit | Retain; no deletion approved |
| .github/workflows/android-release.yml | 4563 | cfa0d8baaa | CI/CD workflow | Reviewed — targeted audit | Retain; no deletion approved |
| .github/workflows/ci.yml | 1443 | eb98515142 | CI/CD workflow | Reviewed — targeted audit | Retain; no deletion approved |
| .github/workflows/codeql.yml | 837 | 4beb325d6a | CI/CD workflow | Reviewed — targeted audit | Retain; no deletion approved |
| .github/workflows/dependency-review.yml | 972 | 5f9537a642 | CI/CD workflow | Reviewed — targeted audit | Retain; no deletion approved |
| .github/workflows/industrial-gateway-ci.yml | 1173 | 8013868570 | CI/CD workflow | Reviewed — targeted audit | Retain; no deletion approved |
| .github/workflows/package-source.yml | 1429 | c54033d1fb | CI/CD workflow | Reviewed — targeted audit | Retain; no deletion approved |
| .github/workflows/secret-scan.yml | 587 | 792f945e2f | CI/CD workflow | Reviewed — targeted audit | Retain; no deletion approved |
| .gitignore | 595 | fac8a4c30d | Build/runtime configuration | Inventory only — detailed review pending | Retain; no deletion approved |
| assets/logo.svg | 1305 | f6639831ee | Brand/store/runtime asset | Inventory only — detailed review pending | Retain; no deletion approved |
| assets/play/feature-graphic.svg | 3902 | 6be4e71175 | Brand/store/runtime asset | Inventory only — detailed review pending | Retain; no deletion approved |
| AUTONOMOUS_PROJECT_COMPLETION_REPORT.md | 4752 | a162a38cce | Project documentation/policy | Inventory only — detailed review pending | Retain; no deletion approved |
| capacitor.config.ts | 209 | 40fe96c133 | Build/runtime configuration | Inventory only — detailed review pending | Retain; no deletion approved |
| FINAL_AUDIT_REPORT.md | 7346 | d2fb1db06d | Project documentation/policy | Inventory only — detailed review pending | Retain; no deletion approved |
| GITHUB_SECURITY_SETUP.md | 5157 | 260e5b090f | Project documentation/policy | Inventory only — detailed review pending | Retain; no deletion approved |
| HARDWARE_COMMISSIONING_REGISTER.md | 4626 | 71d56d0adb | Project documentation/policy | Inventory only — detailed review pending | Retain; no deletion approved |
| index.html | 662 | 6e59f0a02c | Build/runtime configuration | Inventory only — detailed review pending | Retain; no deletion approved |
| INDUSTRIAL_FIVE_ASSET_REGISTER.md | 1709 | ae79510017 | Project documentation/policy | Inventory only — detailed review pending | Retain; no deletion approved |
| INDUSTRIAL_SYSTEM_REQUIREMENTS.md | 8796 | eb5261d620 | Project documentation/policy | Inventory only — detailed review pending | Retain; no deletion approved |
| industrial-gateway/.env.example | 541 | 49f5e39057 | Python gateway runtime/configuration | Inventory only — detailed review pending | Retain; no deletion approved |
| industrial-gateway/.gitignore | 143 | 861b9e8f93 | Python gateway runtime/configuration | Inventory only — detailed review pending | Retain; no deletion approved |
| industrial-gateway/adapter_contract.py | 1035 | b2f906f961 | Python gateway runtime/configuration | Inventory only — detailed review pending | Retain; no deletion approved |
| industrial-gateway/adapter_runner.py | 8122 | 26bd8ba8bc | Python gateway runtime/configuration | Inventory only — detailed review pending | Retain; no deletion approved |
| industrial-gateway/config.example.json | 698 | 482173f325 | Python gateway runtime/configuration | Inventory only — detailed review pending | Retain; no deletion approved |
| industrial-gateway/Dockerfile | 568 | 347a068f04 | Python gateway runtime/configuration | Inventory only — detailed review pending | Retain; no deletion approved |
| industrial-gateway/gateway.py | 17713 | 9cfe83c7f3 | Python gateway runtime/configuration | Inventory only — detailed review pending | Retain; no deletion approved |
| industrial-gateway/README.md | 5727 | 8ad5ab41fe | Python gateway runtime/configuration | Inventory only — detailed review pending | Retain; no deletion approved |
| industrial-gateway/test_adapter_runner.py | 1960 | 0c7fdd7c60 | Python gateway tests | Inventory only — detailed review pending | Retain; no deletion approved |
| industrial-gateway/test_gateway.py | 2948 | b2b9e4342f | Python gateway tests | Inventory only — detailed review pending | Retain; no deletion approved |
| INSTALLATION_GUIDE.md | 4514 | 57d6a99f57 | Project documentation/policy | Inventory only — detailed review pending | Retain; no deletion approved |
| package-lock.json | 173993 | 0c526b2c6e | Build/runtime configuration | Reviewed — targeted audit | Retain; no deletion approved |
| package.json | 1424 | 7605e6ed59 | Build/runtime configuration | Reviewed — targeted audit | Retain; no deletion approved |
| PLAY_STORE_RELEASE.md | 4011 | d4bccebac6 | Project documentation/policy | Inventory only — detailed review pending | Retain; no deletion approved |
| PRIVACY_POLICY.md | 9879 | fe365227d5 | Project documentation/policy | Inventory only — detailed review pending | Retain; no deletion approved |
| PROJECT_ARCHITECTURE.md | 2803 | 9dd0502991 | Project documentation/policy | Inventory only — detailed review pending | Retain; no deletion approved |
| PROJECT_EXECUTION_STATE.md | 5146 | b34fd9b1a6 | Project documentation/policy | Inventory only — detailed review pending | Retain; no deletion approved |
| public/manifest.webmanifest | 614 | bef1d639b3 | Brand/store/runtime asset | Inventory only — detailed review pending | Retain; no deletion approved |
| public/shuttle-mark.svg | 1394 | 1f4e79a6e3 | Brand/store/runtime asset | Inventory only — detailed review pending | Retain; no deletion approved |
| README.md | 14161 | a0f8628fdc | Project documentation/policy | Inventory only — detailed review pending | Retain; no deletion approved |
| scripts/android-release-config.check.mjs | 3360 | ff4e5d09b0 | Build/release/test automation script | Inventory only — detailed review pending | Retain; no deletion approved |
| scripts/prepare-android-release.mjs | 4600 | 5059d04d97 | Build/release/test automation script | Inventory only — detailed review pending | Retain; no deletion approved |
| scripts/render-store-assets.mjs | 1679 | 7ae5fe36be | Build/release/test automation script | Inventory only — detailed review pending | Retain; no deletion approved |
| scripts/run-security-tests.mjs | 806 | 905e06c2af | Build/release/test automation script | Inventory only — detailed review pending | Retain; no deletion approved |
| SECURITY.md | 4029 | a500bd2688 | Project documentation/policy | Inventory only — detailed review pending | Retain; no deletion approved |
| shuttle-control-v4.0.0.zip | 1066026 | 025218a574 | Historical source archive (binary; retained; contents not inspected) | Inventory only — detailed review pending | Retain; no deletion approved |
| src/App.test.tsx | 39827 | c2d598bd91 | Application integration/UI tests | Inventory only — detailed review pending | Retain; no deletion approved |
| src/App.tsx | 170835 | fae9878274 | Core application/runtime/types | Reviewed — targeted audit | Retain; no deletion approved |
| src/components/Battery3DViewer.test.tsx | 849 | 400324cd55 | UI component test | Inventory only — detailed review pending | Retain; no deletion approved |
| src/components/Battery3DViewer.tsx | 10727 | ed047061be | UI component/style | Inventory only — detailed review pending | Retain; no deletion approved |
| src/components/CustomizationCenter.test.tsx | 5816 | 6e03214742 | UI component test | Inventory only — detailed review pending | Retain; no deletion approved |
| src/components/CustomizationCenter.tsx | 17397 | 942d126efe | UI component/style | Inventory only — detailed review pending | Retain; no deletion approved |
| src/components/CustomizationLauncher.test.tsx | 885 | 4643ada806 | UI component test | Inventory only — detailed review pending | Retain; no deletion approved |
| src/components/CustomizationLauncher.tsx | 1003 | 056f73bf2a | UI component/style | Inventory only — detailed review pending | Retain; no deletion approved |
| src/components/LiveGatewayPanel.css | 4444 | 7f8de941a7 | UI component/style | Inventory only — detailed review pending | Retain; no deletion approved |
| src/components/LiveGatewayPanel.tsx | 9125 | 1fdb4a67c8 | UI component/style | Inventory only — detailed review pending | Retain; no deletion approved |
| src/components/SecurityCenter.tsx | 15605 | b5fb63975a | UI component/style | Reviewed — targeted audit | Retain; no deletion approved |
| src/components/ShiftOperations.test.tsx | 3061 | 647b289388 | UI component test | Inventory only — detailed review pending | Retain; no deletion approved |
| src/components/ShiftOperations.tsx | 12289 | f8d0209418 | UI component/style | Inventory only — detailed review pending | Retain; no deletion approved |
| src/components/Shuttle3DViewer.test.tsx | 984 | 1ba75df6cd | UI component test | Inventory only — detailed review pending | Retain; no deletion approved |
| src/components/Shuttle3DViewer.tsx | 20427 | f5ff8b928d | UI component/style | Inventory only — detailed review pending | Retain; no deletion approved |
| src/components/StorageRecoveryGate.css | 2687 | ca65207b76 | UI component/style | Reviewed — targeted audit | Retain; no deletion approved |
| src/components/StorageRecoveryGate.tsx | 11014 | 38fe628939 | UI component/style | Reviewed — targeted audit | Retain; no deletion approved |
| src/data/applicationCustomization.ts | 10945 | 00483cb20e | Domain data/service/lifecycle | Inventory only — detailed review pending | Retain; no deletion approved |
| src/data/backupValidation.test.ts | 4881 | bd29a74f32 | Domain/data test | Inventory only — detailed review pending | Retain; no deletion approved |
| src/data/backupValidation.ts | 13883 | b613032689 | Domain data/service/lifecycle | Reviewed — targeted audit | Retain; no deletion approved |
| src/data/batteryLifecycle.test.ts | 4682 | de4444ed05 | Domain/data test | Inventory only — detailed review pending | Retain; no deletion approved |
| src/data/batteryLifecycle.ts | 6284 | 60fcadc99e | Domain data/service/lifecycle | Inventory only — detailed review pending | Retain; no deletion approved |
| src/data/excelExport.test.ts | 3878 | 6e8b62187f | Domain/data test | Inventory only — detailed review pending | Retain; no deletion approved |
| src/data/excelExport.ts | 12118 | d76ded2ad6 | Domain data/service/lifecycle | Inventory only — detailed review pending | Retain; no deletion approved |
| src/data/manufacturerReferences.ts | 7750 | faa1f825fc | Domain data/service/lifecycle | Inventory only — detailed review pending | Retain; no deletion approved |
| src/data/mockData.test.ts | 1631 | 21dbee8fde | Domain/data test | Inventory only — detailed review pending | Retain; no deletion approved |
| src/data/mockData.ts | 6616 | 05f0717b60 | Domain data/service/lifecycle | Inventory only — detailed review pending | Retain; no deletion approved |
| src/data/recordLifecycle.test.ts | 3170 | 76c37ea780 | Domain/data test | Inventory only — detailed review pending | Retain; no deletion approved |
| src/data/recordLifecycle.ts | 2468 | 9e607918f1 | Domain data/service/lifecycle | Inventory only — detailed review pending | Retain; no deletion approved |
| src/index.css | 72062 | 75f11ae1b2 | Global UI design system/styles | Inventory only — detailed review pending | Retain; no deletion approved |
| src/industrial/gatewayClient.test.ts | 1599 | cd5386873b | Industrial gateway client test | Inventory only — detailed review pending | Retain; no deletion approved |
| src/industrial/gatewayClient.ts | 7367 | 8e906adab9 | Industrial gateway client/telemetry | Inventory only — detailed review pending | Retain; no deletion approved |
| src/industrial/telemetry.test.ts | 2109 | b63eb5fba8 | Industrial gateway client test | Inventory only — detailed review pending | Retain; no deletion approved |
| src/industrial/telemetry.ts | 4264 | 80bf8f4d2b | Industrial gateway client/telemetry | Inventory only — detailed review pending | Retain; no deletion approved |
| src/main.tsx | 2295 | b9d6f9028d | Core application/runtime/types | Reviewed — targeted audit | Retain; no deletion approved |
| src/security/auditLog.test.mjs | 2407 | e0e521f8f5 | Security test | Reviewed — targeted audit | Retain; no deletion approved |
| src/security/auditLog.ts | 5142 | b3c8d0a380 | Security/storage/audit/auth implementation | Reviewed — targeted audit | Retain; no deletion approved |
| src/security/localAuth.test.mjs | 4355 | 271ebbb710 | Security test | Reviewed — targeted audit | Retain; no deletion approved |
| src/security/localAuth.ts | 10214 | 40727c9bd3 | Security/storage/audit/auth implementation | Reviewed — targeted audit | Retain; no deletion approved |
| src/security/operationalStorage.test.mjs | 5832 | c650e02012 | Security test | Reviewed — targeted audit | Retain; no deletion approved |
| src/security/operationalStorage.ts | 15896 | e2ac13da5b | Security/storage/audit/auth implementation | Reviewed — targeted audit | Retain; no deletion approved |
| src/security/permissions.test.mjs | 1568 | 5d258757ab | Security test | Reviewed — targeted audit | Retain; no deletion approved |
| src/security/permissions.ts | 4487 | b300dccdc1 | Security/storage/audit/auth implementation | Reviewed — targeted audit | Retain; no deletion approved |
| src/security/storageEngine.test.mjs | 4658 | a120aebe47 | Security test | Reviewed — targeted audit | Retain; no deletion approved |
| src/security/storageEngine.ts | 9437 | 393ce0265c | Security/storage/audit/auth implementation | Reviewed — targeted audit | Retain; no deletion approved |
| src/types.ts | 5702 | ed4eb206c2 | Core application/runtime/types | Inventory only — detailed review pending | Retain; no deletion approved |
| STORE_LISTING.md | 5241 | e84a5ef927 | Project documentation/policy | Inventory only — detailed review pending | Retain; no deletion approved |
| TECHNICAL_AUDIT.md | 6228 | a3db74cbc8 | Project documentation/policy | Inventory only — detailed review pending | Retain; no deletion approved |
| TERMS_OF_USE.md | 2260 | 4a6717c021 | Project documentation/policy | Inventory only — detailed review pending | Retain; no deletion approved |
| tsconfig.json | 598 | fd19b2d653 | Build/runtime configuration | Inventory only — detailed review pending | Retain; no deletion approved |
| tsconfig.node.json | 221 | d6abe448db | Build/runtime configuration | Inventory only — detailed review pending | Retain; no deletion approved |
| VENDOR_INTEGRATION_QUESTIONNAIRE.md | 5404 | f77b046eeb | Project documentation/policy | Inventory only — detailed review pending | Retain; no deletion approved |
| vite.config.ts | 318 | 0a1587844f | Build/runtime configuration | Inventory only — detailed review pending | Retain; no deletion approved |
| vitest.setup.ts | 43 | bb02c60cd0 | Build/runtime configuration | Inventory only — detailed review pending | Retain; no deletion approved |

## 4. Branch inventory and disposition

All 30 current branches were enumerated. Diverged branches are not merged wholesale.

| Branch | Current head (short) | Disposition |
|---|---|---|
| backup/v4-original-2026-11-15 | 5ad2a89d87 | Historical backup; behind main, retain. |
| copilot/complete-shuttle-automation-v6 | b1a0a6ab20 | Older V6 line; PR #2 merged, inspect only unique commits. |
| copilot/fix-android-emulator-ci | 9e8cd525d5 | Diverged work; relevant features appear in merged PRs, verify unique diffs. |
| copilot/industrial-customization-center | 8ed929e284 | Customization history overlaps merged PR #21; no wholesale merge. |
| copilot/shuttle-industrial-ui-customization-fix | 6da47a216a | Customization history overlaps merged PR #21; no wholesale merge. |
| dependabot/github_actions/actions/checkout-7 | 6ff588bf7a | Dependency PR candidate; retain until individually validated and dispositioned. |
| dependabot/github_actions/actions/dependency-review-action-5 | 6eaa8f8ca5 | Dependency PR candidate; retain until individually validated and dispositioned. |
| dependabot/github_actions/actions/setup-java-5 | ddb404cd80 | Dependency PR candidate; retain until individually validated and dispositioned. |
| dependabot/github_actions/actions/setup-node-7 | 1d5a429cd2 | Dependency PR candidate; retain until individually validated and dispositioned. |
| dependabot/github_actions/actions/upload-artifact-7 | d26ff4aa0f | Dependency PR candidate; retain until individually validated and dispositioned. |
| dependabot/github_actions/android-actions/setup-android-4 | 4a18d42c12 | Dependency PR candidate; retain until individually validated and dispositioned. |
| dependabot/github_actions/gitleaks/gitleaks-action-3 | e1183d64ce | Dependency PR candidate; retain until individually validated and dispositioned. |
| dependabot/github_actions/softprops/action-gh-release-3 | fee7b7a8df | Dependency PR candidate; retain until individually validated and dispositioned. |
| dependabot/npm_and_yarn/development-dependencies-bfd2ae3dfc | d308a79cc2 | Dependency PR candidate; retain until individually validated and dispositioned. |
| dependabot/npm_and_yarn/jsdom-31.0.1 | 870b6b4b91 | Dependency PR candidate; retain until individually validated and dispositioned. |
| dependabot/npm_and_yarn/production-dependencies-f82e2d3eb6 | 2ee1f49c73 | Dependency PR candidate; retain until individually validated and dispositioned. |
| dependabot/npm_and_yarn/react-19.3.1 | dbc9bbe9ee | Dependency PR candidate; retain until individually validated and dispositioned. |
| dependabot/npm_and_yarn/react-dom-19.3.1 | 001035a7b2 | Dependency PR candidate; retain until individually validated and dispositioned. |
| dependabot/npm_and_yarn/testing-library/jest-dom-7.0.1 | 8893d3cf25 | Dependency PR candidate; retain until individually validated and dispositioned. |
| dependabot/npm_and_yarn/types/react-19.3.0 | a970f45dfd | Dependency PR candidate; retain until individually validated and dispositioned. |
| dependabot/npm_and_yarn/types/react-dom-19.3.0 | ebfd216a27 | Dependency PR candidate; retain until individually validated and dispositioned. |
| dependabot/npm_and_yarn/typescript-7.0.2 | 19e6126a55 | Dependency PR candidate; retain until individually validated and dispositioned. |
| development/industrial-visual-upgrade-2026-11 | faff09f637 | Same tree as main at snapshot; retain pending archive policy. |
| development/shuttle-car-automation-v6 | f65732f74d | Older duplicate V6 line; diverged history, do not bulk merge. |
| development/v4-industrial-upgrade | 31e0a46daa | Historical V4 line; PR #1 merged, retain for history. |
| engineering/industrial-ui-security-v1 | 4841b2c35c | Active PR #23 development branch. |
| feature/shuttle-car-automation-v6-completion | f65732f74d | Older duplicate V6 line; diverged history, do not bulk merge. |
| industrial/commissioning-v1 | ad4da0cb7b | PR #20 merged; preserve history and compare late commits. |
| industrial/live-telemetry-gateway-v1 | c5e2ca65cd | PR #22 merged; preserve source history; no duplicate merge. |
| main | faff09f637 | Official baseline; unchanged. |

## 5. Pull request inventory

- PR #1: closed; development/v4-industrial-upgrade → main; merged 2026-11-15T06:52:12Z — Development/v4 industrial upgrade
- PR #2: closed; copilot/complete-shuttle-automation-v6 → main; merged 2026-11-17T01:56:58Z — V10 shuttle operations, fleet lifecycle & industrial engineering suite
- PR #3: open; dependabot/github_actions/actions/upload-artifact-7 → main; not merged — build(deps): bump actions/upload-artifact from 4 to 7
- PR #4: open; dependabot/github_actions/actions/setup-java-5 → main; not merged — build(deps): bump actions/setup-java from 4 to 5
- PR #5: open; dependabot/github_actions/softprops/action-gh-release-3 → main; not merged — build(deps): bump softprops/action-gh-release from 2 to 3
- PR #6: open; dependabot/github_actions/gitleaks/gitleaks-action-3 → main; not merged — build(deps): bump gitleaks/gitleaks-action from 2 to 3
- PR #7: open; dependabot/github_actions/actions/checkout-7 → main; not merged — Bump actions/checkout from 4 to 7
- PR #8: open; dependabot/github_actions/actions/dependency-review-action-5 → main; not merged — build(deps): bump actions/dependency-review-action from 4 to 5
- PR #9: open; dependabot/github_actions/android-actions/setup-android-4 → main; not merged — build(deps): bump android-actions/setup-android from 3 to 4
- PR #10: open; dependabot/npm_and_yarn/production-dependencies-f82e2d3eb6 → main; not merged — build(deps): bump three from 0.180.0 to 0.187.0 in the production-dependencies group
- PR #11: open; dependabot/github_actions/actions/setup-node-7 → main; not merged — build(deps): bump actions/setup-node from 4 to 7
- PR #12: open; dependabot/npm_and_yarn/development-dependencies-bfd2ae3dfc → main; not merged — build(deps-dev): bump @types/three from 0.180.0 to 0.187.0 in the development-dependencies group
- PR #13: open; dependabot/npm_and_yarn/testing-library/jest-dom-7.0.1 → main; not merged — build(deps-dev): bump @testing-library/jest-dom from 6.10.0 to 7.0.1
- PR #14: open; dependabot/npm_and_yarn/jsdom-31.0.1 → main; not merged — build(deps-dev): bump jsdom from 25.0.1 to 31.0.1
- PR #15: open; dependabot/npm_and_yarn/types/react-19.3.0 → main; not merged — build(deps-dev): bump @types/react from 18.3.31 to 19.3.0
- PR #16: open; dependabot/npm_and_yarn/react-dom-19.3.1 → main; not merged — build(deps): bump react-dom from 18.3.1 to 19.3.1
- PR #17: open; dependabot/npm_and_yarn/types/react-dom-19.3.0 → main; not merged — build(deps-dev): bump @types/react-dom from 18.3.7 to 19.3.0
- PR #18: open; dependabot/npm_and_yarn/typescript-7.0.2 → main; not merged — build(deps-dev): bump typescript from 5.9.3 to 7.0.2
- PR #19: open; dependabot/npm_and_yarn/react-19.3.1 → main; not merged — build(deps): bump react from 18.3.1 to 19.3.1
- PR #20: closed; industrial/commissioning-v1 → main; merged 2026-11-17T02:16:43Z — Industrial commissioning baseline: verified fleet, safety gates and vendor interface requirements
- PR #21: closed; copilot/shuttle-industrial-ui-customization-fix → main; merged 2026-11-17T08:18:10Z — Complete industrial application workflows and local customization
- PR #22: closed; industrial/live-telemetry-gateway-v1 → main; merged 2026-11-17T08:35:46Z — Add read-only industrial telemetry gateway and app client
- PR #23: open (draft); engineering/industrial-ui-security-v1 → main; not merged — Security foundation: local identity, audit integrity and recoverable storage

## 6. Confirmed changes in this unification pass

- Added a startup recovery gate. App state and autosave are not mounted while operational storage inspection requires a recovery decision.
- Reworked the storage engine so ordinary saves reject damaged/incompatible envelopes; inspection does not silently restore a previous copy.
- Added per-collection recovery preview and explicit choices for a verified primary, previous verified snapshot, legacy copy, or explicitly empty register.
- Raw copies are quarantined before a recovery choice replaces an active primary; recovery decisions are journaled.
- Expanded storage tests for corruption, explicit restore, legacy migration, empty-register decisions and fail-closed writes.
- Changed 39 App-level authorization call sites to await an audit-backed permission event before a sensitive mutation is allowed. If audit validation/write fails, the operation is blocked.
- Updated form handlers to retain form/input references across async authorization to avoid React SyntheticEvent currentTarget loss.
- Committed package-lock.json and changed the CI/Android dependency installation to npm ci.
- Removed the temporary lockfile artifact step from CI and removed write permission/self-commit behavior from the standalone APK workflow.
- Updated GitHub Actions versions across workflows: checkout v7, setup-node v7, setup-java v6, upload-artifact v7, dependency-review v5, setup-android v4, gitleaks v3, and softprops release v3.

## 7. Focused audit notes and unresolved risks

1. Local identity remains device-local, not server identity, shared users, backend authorization, or central revocation.
2. Audit log chaining exists, but the 5,000-record limit currently blocks appends. Durable archive/anchor, search, filter, CSV/JSON export and retention management remain outstanding.
3. Authorization intent is written before an action. Post-action outcome audit calls are still asynchronous in parts of the application; transactional outcome logging remains outstanding.
4. Recovery UI is implemented; quota-failure, restart and repeated-recovery testing remains outstanding.
5. Account management still needs edit, disable/enable, password change/reset, self-promotion prevention and last-Super-Admin protection.
6. Full visual, responsive and per-control UI audit remains pending.
7. Android emulator install/launch and screen-navigation smoke tests are still required. No Play production signing claim is made.
8. shuttle-control-v4.0.0.zip is retained. Its binary contents have not yet been unpacked and compared, so it is not marked unused or obsolete.
9. No file or asset has been deleted based on lack of direct imports; dynamic/runtime use still needs review.
10. All branches were reported as unprotected. Branch-protection write capability has not yet been applied/verified.

## 8. Validation status

Earlier run at commit 608669eba19ada8deade45879fe3a47465c50ac1 passed TypeScript, 92 Vitest tests, 25 Node security tests, release-script checks and Vite production build. The current recovery/auth refactor is under retest; the latest test run at the time of this report had 9 application UI failures caused by async form-event handling, which was then corrected by retaining form references. Do not treat this as a fully passing current build until a fresh run passes.

## 9. Files intentionally not removed

No files were removed. The V4 ZIP archive, documentation, all test files and all historical branches are retained. Deletion remains blocked pending evidence that replacements cover all use cases and that dynamic imports, scripts, workflows and runtime file access have been checked.

## 10. Next audit gates

- Pass current TypeScript, Vitest + Node security tests, release config and production bundle on the same PR head.
- Run Android debug build and emulator install/launch without branch-update cancellation.
- Add recovery UI component tests and Storage API failure/quota/restart tests.
- Complete user/account management safeguards.
- Implement audit archival/retention/export and make post-action result logging reliable.
- Finish reference/dead-code/dynamic asset audit and inspect the V4 ZIP archive.
- Review every Dependabot PR independently; do not bulk merge.
- Verify/apply main branch protection without changing main source.
- Update this report as each file reaches a fully evidenced content-audit decision.