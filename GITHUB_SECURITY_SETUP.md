# GitHub Repository Security Setup

**Repository:** https://github.com/som3a83/shuttle-car-automation  
**Default branch:** `main`  
**Owner:** `som3a83`

This repository is public. The repository API currently reports that `main` is not protected and no repository rulesets are present. The GitHub integration available to this session can manage source files, pull requests and workflow runs, but it does not expose the repository-settings write operation needed to create branch-protection rules or toggle GitHub Advanced Security features. The files and workflows below are committed as code; the settings in sections 1 and 2 require one-time activation in GitHub Settings.

## 1. Protect the main branch

Open **Settings → Branches → Add branch protection rule**.

Set **Branch name pattern** to:

```text
main
```

Enable the following:

- Require a pull request before merging.
- Require status checks to pass before merging.
- Require branches to be up to date before merging.
- Require conversation resolution before merging.
- Do not allow force pushes.
- Do not allow deletions.
- Do not allow bypassing the above settings, after confirming the checks below are stable.

Select these exact status checks after they appear on a pull request:

1. `TypeScript, tests, and production build`
2. `Android Debug APK & Emulator Smoke Test`
3. `CodeQL JavaScript/TypeScript`
4. `Secret Leak Scan`
5. `Dependency Review` (currently runs with a fallback audit until Dependency Graph is enabled)

Do not configure an approval requirement while the repository has only one active maintainer: a pull request author cannot approve their own pull request. Add one independent approval requirement when a second trusted reviewer is available.

Do not protect the active development branch with the same strict rule until a PR and check workflow for that branch is intentionally established. Keep the original V4 backup branch unchanged.

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

**Dependency Review note:** the official review action currently reports that this repository's Dependency Graph is unavailable. Its step is temporarily configured as non-blocking, but its fallback runs a full `npm audit --audit-level=high`; the primary CI also runs this audit as a blocking check. After enabling Dependency Graph in Settings, remove `continue-on-error: true` from the Dependency Review step so delta review becomes a blocking check too.

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

After PR #2 is merged, change the public policy URL to the stable `main` branch URL:

https://github.com/som3a83/shuttle-car-automation/blob/main/PRIVACY_POLICY.md

Use a publicly accessible policy URL in Google Play Console. Never make privacy claims about a future backend, analytics, telemetry or hardware integration until the implementation and policy have both been changed and reviewed.
