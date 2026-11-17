# Security Policy — Shuttle Car Automation

## Supported versions

Security fixes are applied to the latest maintained release line (currently 1.x) and the active development branch. Older builds may contain known defects and should not be used for new deployments.

## Report a vulnerability privately

**Do not report an exploitable vulnerability in a public GitHub issue.**

Use GitHub's private repository security advisory flow:

1. Open the repository's **Security** tab.
2. Select **Advisories** or **Report a vulnerability**.
3. Submit a private report with the affected version/commit, impact, reproducible steps and a safe proof of concept.

Direct link: https://github.com/som3a83/shuttle-car-automation/security/advisories/new

If the private reporting option is unavailable, contact the repository maintainer through the GitHub profile: https://github.com/som3a83. Do not include credentials, personal data, customer records, network diagrams or confidential industrial information in a public issue.

Please allow the maintainer a reasonable opportunity to investigate and prepare a fix before public disclosure. No response-time or coordinated-disclosure deadline is guaranteed by this personal project.

## What to include

- Affected release tag or commit SHA.
- Impact and attack scenario.
- Minimal reproduction steps.
- Relevant logs with tokens, passwords, IPs and personal information removed.
- Any proposed mitigation, if known.

## Scope and industrial safety

This application is currently a local recordkeeping and visualization tool. It has no app-operated backend, account authentication, server-enforced RBAC, cloud synchronization, live PLC integration or machine-control interface. The role selector is a UI preview; it is not a security boundary. Do not treat the application as a safety system.

Never submit a real production secret or actual site access credential as a proof of concept. Use synthetic test values.

## Security controls in this repository

- Pull-request and CI checks before the protected-branch policy is applied.
- Automated dependency update configuration through Dependabot.
- CodeQL static analysis workflow.
- Secret-leak scanning workflow.
- Dependency review workflow for pull requests.
- Release signing keys must be stored as protected GitHub Actions secrets and must never be committed.
- Security settings that are controlled from GitHub repository Settings (branch protection, Dependabot alerts, secret scanning and push protection) are listed in [GITHUB_SECURITY_SETUP.md](GITHUB_SECURITY_SETUP.md).
