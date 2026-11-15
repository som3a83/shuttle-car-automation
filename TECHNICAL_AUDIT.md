# Technical Audit — repository-access stage

Date: 2026-11-15  
Repository: `som3a83/shuttle-car-automation`  
Working branch: `development/v4-industrial-upgrade`

## Scope and evidence

Inspected repository metadata, the recursive Git tree at baseline commit `5ad2a89d87947301eb399494236e479369d9d978`, the README, archive metadata, and the limited binary preview returned by the GitHub file viewer.

The tracked repository tree contains exactly `README.md` and `shuttle-control-v4.0.0.zip`. The README is a single heading. The archive is 1,066,026 bytes. The viewer preview begins with ZIP (`PK`) signatures and shows embedded path strings including `shuttle-control-v4.0.0/README.md`, `VERSION`, and a `dist/assets` path. This is only a partial binary preview: it is not a complete central-directory listing, cannot verify every member name, and cannot validate the archive or its contents.

## Extraction attempt and limitation

This session has GitHub read/write API tools only. It has no shell, terminal, local workspace, ZIP utility, or binary-download/extract tool. GitHub's contents response for the ZIP reports `encoding: none` and empty content. The file viewer renders a limited binary preview rather than providing the raw bytes. Therefore **the archive has not been fully listed, validated, extracted, or copied into the repository**. No source was changed or represented as extracted.

## Verified baseline and protection

- Default branch: `main`.
- Baseline commit: `5ad2a89d87947301eb399494236e479369d9d978`.
- Recovery branch: `backup/v4-original-2026-11-15` (baseline snapshot).
- Development branch: `development/v4-industrial-upgrade`.
- Original ZIP remains unchanged; no work was made on `main`.

## Audit classification

| Area | Finding | Classification |
|---|---|---|
| Repository inventory | Two tracked paths verified | IMPLEMENTED & TESTED (inventory only) |
| Archive format | ZIP signature visible in a partial preview only; full integrity not checked | IMPLEMENTED BUT NOT FULLY TESTED |
| ZIP member paths / traversal safety | No complete member listing available | BLOCKED — archive bytes and terminal needed |
| V4 source / actual release version | Name indicates V4.0.0; internal version file cannot be read | BLOCKED — archive extraction needed |
| Frontend / backend / database / APIs | Source tree not present in Git; archive inaccessible as bytes | BLOCKED — source required |
| Authentication / permissions / tenant isolation | Cannot inspect implementation | BLOCKED — source required |
| Fleet, battery, faults, maintenance, operations | Cannot inspect or test | BLOCKED — source required |
| AI integration | Cannot determine whether provider exists | BLOCKED — source/config required |
| PLC / IoT connectivity | Cannot inspect; no hardware protocol documents supplied | BLOCKED — source and vendor/device specifications required |
| Android / Google Play readiness | Cannot inspect native project, SDK config, assets, permissions, or build | BLOCKED — source/build environment required |
| Dependencies / CI / tests | No manifests, workflow files, or test files exposed in Git | BLOCKED — source required |
| Production build / APK / AAB / release ZIP | Not built or asserted | NOT IMPLEMENTED |

## Security and safety

No secrets or customer data were exposed or changed. No production system or physical device was accessed. No PLC commands, external integrations, payments, or publication actions were performed. The archive has not been extracted, so no claims about its safety, contents, or integrity are made.

## Practical unblock: validate and extract locally

On a trusted workstation with Python 3 and authenticated access to this private repository, clone the development branch so the ZIP is downloaded as a normal Git-tracked file:

```bash
git clone --branch development/v4-industrial-upgrade https://github.com/som3a83/shuttle-car-automation.git
cd shuttle-car-automation
```

Before extraction, use Python to list and validate every member path and check archive integrity. This command rejects absolute paths, `..` traversal, and symlinks, and extracts only into a fresh temporary directory:

```bash
python3 - <<'PY'
from pathlib import Path, PurePosixPath
from zipfile import ZipFile
import stat

archive = Path("shuttle-control-v4.0.0.zip")
target = Path("/tmp/shuttle-v4-validated")
if target.exists():
    raise SystemExit(f"Refusing to overwrite existing directory: {target}")
target.mkdir(mode=0o700, parents=True)
with ZipFile(archive) as zf:
    bad = zf.testzip()
    if bad:
        raise SystemExit(f"CRC failure in archive member: {bad}")
    for info in zf.infolist():
        name = info.filename
        path = PurePosixPath(name)
        mode = info.external_attr >> 16
        if path.is_absolute() or ".." in path.parts or not path.parts:
            raise SystemExit(f"Unsafe archive path: {name!r}")
        if "\\" in name or (len(name) > 1 and name[1] == ":"):
            raise SystemExit(f"Non-portable / rooted archive path: {name!r}")
        if stat.S_ISLNK(mode):
            raise SystemExit(f"Symlink member rejected: {name!r}")
        print(name)
    zf.extractall(target)
print(f"Validated extraction completed in {target}")
PY
```

Inspect `/tmp/shuttle-v4-validated` and identify its project root. Then copy only reviewed source, static assets, manifests, tests, and documentation into the cloned checkout. Do **not** copy `node_modules`, caches, temporary directories, secrets, or generated `dist`/build output unless review confirms an artifact is intentionally required. Preserve the ZIP and use a distinct path if existing repository files would collide. Review `git status` and the diff before committing, then push the extracted, reviewed source to `development/v4-industrial-upgrade`.

For this private repository, GitHub authentication must be configured on the workstation (for example via Git Credential Manager or SSH). Do not put a personal access token into shell history or commit credentials. After the source-bearing branch is pushed, the code can be inspected and built with the available GitHub tools/CI; hardware tests still require the relevant device and vendor protocol documentation.