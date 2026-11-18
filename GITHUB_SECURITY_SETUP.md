# GitHub Repository Security Setup

**Repository:** https://github.com/som3a83/shuttle-car-automation  
**Default branch:** `main`  
**Owner:** `som3a83`

This repository is public. As checked on 2026-11-18, GitHub reports an active repository ruleset named `main` (ID `27423825`). Its current rules require pull requests and reject non-fast-forward updates. However, the live ruleset does not currently define required status checks, requires zero approvals, does not require a CODEOWNERS review, and does not require review-thread resolution. The default branch therefore has partial protection, not the full protection described below.

The GitHub integration available to this session can manage source files, pull requests and workflow runs. It can read ruleset metadata, but it does not expose a ruleset/branch-protection write action; the branch-protection endpoint also returned an authorization error. The remaining settings must be completed by a repository administrator in GitHub Settings. Do not create a second duplicate ruleset; edit the active `main` ruleset.

## 1. Protect the main branch

Open **Settings → Rules → main** and edit the existing active ruleset.

Keep these existing protections:
- Require a pull request before merging.
- Disallow non-fast-forward updates.
- Keep the bypass list empty.

Add or enable:
- Require status checks to pass before merging.
- Require branches to be up to date before merging.
- Require conversation resolution before merging.
- Block branch deletion.
- Require a CODEOWNERS review when a second independent trusted reviewer is available.

After the relevant workflows have completed successfully on a pull request, configure these checks as required in the ruleset. Confirm the exact check names from the Actions summary for the current pull request before selecting them:

1. `TypeScript, tests, and production build`
2. `CodeQL JavaScript/TypeScript`
3. `Secret Leak Scan`
4. `Python gateway security and validation tests`
5. `Render and validate parametric CAD`
6. `Android Debug APK & Emulator Smoke Test` (for application/runtime changes)
7. `Android Debug APK Packaging` (for release-package changes)

Do not select a check named `test` unless that exact check is currently emitted by a required workflow. The storage regression suite is included in the main TypeScript/test/build job.

Do not make `Dependency Review` a required check until Dependency Graph is enabled and its action is no longer configured with `continue-on-error: true`. The npm audit is also temporarily non-blocking while the current picomatch advisory has no published patched version. Keep both warnings visible; do not silently suppress them.

Do not require a human approval while there is only one active maintainer: the author cannot approve their own pull request. Add one independent approval requirement when a second trusted reviewer is available.

The active ruleset is currently confirmed as active, but the status-check, approval and conversation-resolution gates above are not yet configured. A CODEOWNERS file is present in the proposed branch, but GitHub will not enforce its review requests until the repository administrator enables the corresponding ruleset requirement. The available GitHub integration exposes read-only ruleset inspection and cannot apply these server-side settings.

## 2. Enable GitHub security features

Open **Settings → Code security and analysis** (sometimes shown as **Settings → Security → Advanced Security**).

For this public repository, enable:

- Dependency graph.
- Dependabot alerts.
- Dependabot security updates.
- Secret scanning.
- Push protection for secrets.
- Code scanning / CodeQL (the workflow in this repository supplies advanced setup).

The free public-repository availability of these features is documented by GitHub. If GitHub displays an eligibility or plan message, record the unavailable feature and retain the repository workflows as supplementary controls.

**Dependency Review note:** the official review action currently reports that this repository's Dependency Graph is unavailable. Its step is temporarily configured as non-blocking. The primary CI also runs `npm audit --audit-level=high`, but that step is temporarily non-blocking because the current picomatch advisory has no published patched version. The audit output remains visible. After enabling Dependency Graph, remove `continue-on-error: true` from Dependency Review; after an upstream fix is available and applied, make the npm audit blocking again.

## 3. Actions security

Open **Settings → Actions → General**:

- Set workflow permissions to **Read repository contents and packages** by default.
- Keep **Allow GitHub Actions to create and approve pull requests** disabled unless a specific reviewed workflow needs it.
- Keep Actions restricted to GitHub-owned actions and explicitly approved actions where practical.
- Do not add broad personal access tokens to workflows.
- Keep release signing material in Actions secrets only.

Individual workflows declare the narrow permissions they require. CodeQL requires `security-events: write`; the other build workflows should remain read-only.

## 4. Upload-key secrets for Play releases

Only when building a Google Play AAB, configure:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Use an upload key dedicated to this application. Keep an offline backup. Never commit `.jks`, `.keystore`, `.p12`, passwords, API keys or production credentials.

## 5. Verify the applied protection

After saving the rule, return to **Settings → Branches** and confirm that the `main` rule is listed. The branch list should then show `main` as protected.

Open a test pull request and confirm that the named status checks are required and a direct push to `main` is rejected. Do not test this by pushing real product code directly to `main`.

## 6. Privacy policy publication

The repository contains a bilingual policy at [PRIVACY_POLICY.md](PRIVACY_POLICY.md), and the app includes a privacy notice in System Settings. Because the repository is public, the current raw HTTPS policy URL is:

https://raw.githubusercontent.com/som3a83/shuttle-car-automation/copilot/complete-shuttle-automation-v6/PRIVACY_POLICY.md

The PR has been merged. Use the stable `main` branch URL:

https://github.com/som3a83/shuttle-car-automation/blob/main/PRIVACY_POLICY.md

Use a publicly accessible policy URL in Google Play Console. Never make privacy claims about a future backend, analytics, telemetry or hardware integration until the implementation and policy have both been changed and reviewed.
