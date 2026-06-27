# Pre-Commit Packaging Rehearsal

Date: 2026-06-26

## What This Is

This is **not** a fresh-clone test.

It is a pre-commit packaging rehearsal of the current dirty-worktree submission candidate. The goal is to catch missing files, hidden dependencies, and quickstart mismatches before the final safe commit. True fresh-clone validation must happen later from a real Git clone of a committed branch.

## Method

Source workspace: `<repo-root>`

Rehearsal directory: `<temp-rehearsal-dir>`

File selection:

- Used `git ls-files --cached --others --exclude-standard` in the source workspace.
- Copied existing files into the rehearsal directory.
- Skipped missing/deleted tracked paths.

Copy result:

- Existing files copied: 109
- Missing/deleted tracked paths skipped: 29
- Copy errors: 0

Important limitation: because this is a file-set rehearsal, the copied directory does not include `.git`. That is intentional for this check, but it means this is closer to a zip/source-package perspective than a real Git fresh clone.

## Command Results

| Command | Result | Important output | Finding |
| --- | --- | --- | --- |
| `npm install` | Pass with advisory | Added 126 packages; audited 127 packages; npm reported 1 high-severity vulnerability. | Reproducible install works, but dependency-audit risk needs review before public release. |
| `npm run demo:fixture` | Pass | Fixture/offline/simulated run completed; 4 agents; 12 verified claims; average confidence `0.87`; reports written to `sample_outputs/`. | CLI fixture path packages correctly. |
| `npm run verify:capstone` | Fail in file-set package | Fixture demo passed, `ops` and `claims` smoke tests passed, then `tests/capstone_smoke.mjs` failed on `git ls-files` because the rehearsal directory is not a Git repository. | Hidden Git metadata dependency in test suite. Not a true-clone blocker, but a zip/source-package blocker. |
| `npm test` | Fail in file-set package | Same failure: `fatal: not a git repository` from `git ls-files` in `tests/capstone_smoke.mjs`. | Same hidden Git metadata dependency. |
| `npm run lint` | Pass | `eslint .` completed with exit code 0. | Lint does not require Git metadata. |
| `npm run secret:scan` | Pass with fallback | Git listing unavailable because no `.git`; scanner fell back to filesystem walk and passed. | Secret scanner handles non-Git packages correctly. |
| `npm run mcp:self-test` | Pass | Returned `ok: true`, 5 tools, and 12 claims. | MCP stub packages correctly. |

## Hidden Dependency Findings

1. `tests/capstone_smoke.mjs` assumes it is running inside a Git repository because it calls `git ls-files --cached --others --exclude-standard`.
2. This is acceptable for a true `git clone` judge path, because `.git` exists there.
3. This is not acceptable for a source zip, copied folder, Kaggle artifact bundle, or other package without `.git`.
4. `scripts/secret_scan.mjs` already has the safer pattern: it tries Git listing and falls back to a filesystem walk.

## Dependency Audit Finding

`npm audit --json` reports one high-severity advisory:

- Package: `form-data`
- Installed range: `4.0.0 - 4.0.5`
- Advisory: CRLF injection via unescaped multipart field names/filenames
- Advisory URL: `https://github.com/advisories/GHSA-hmw2-7cc7-3qxx`
- Fix available: yes

`npm why form-data` shows it is transitive through live-provider SDK dependencies:

- `@anthropic-ai/sdk@0.32.1` -> `@types/node-fetch@2.6.13` -> `form-data@4.0.5`
- `openai@4.104.0` -> `@types/node-fetch@2.6.13` -> `form-data@4.0.5`

This does not affect the no-key fixture runtime directly, but it matters for public release hygiene because the root install includes optional live-provider dependencies.

## Docs Mismatch

README quickstart is framed around local Git/npm use and the public fixture commands. It does not claim source-zip support. However, if the public release path includes downloadable source archives or Kaggle-uploaded files, `npm test` currently has a hidden `.git` dependency that should be either documented or fixed.

## Safe-Fix Rerun

After safe fixes:

- `tests/capstone_smoke.mjs` now falls back to a filesystem walk when Git metadata is unavailable.
- `package.json` now overrides `form-data` to a fixed version range.
- `npm install` in a fresh rehearsal copy reports 0 vulnerabilities.
- In the no-`.git` rehearsal copy, `npm run demo:fixture`, `npm test`, `npm run lint`, `npm run secret:scan`, `npm run mcp:self-test`, and `npm run test:adversarial` all pass.

## Verdict

Pre-commit packaging rehearsal: **pass after safe fixes**.

This is still not a true fresh-clone test. It proves the current file-set package can install and run the public offline checks without Git metadata. True fresh-clone validation remains pending until after a final safe commit exists.

## True Fresh-Clone Status

Not yet performed. True fresh-clone validation is deferred until after a final safe commit exists, then it should be run from a real Git clone of that committed branch.
