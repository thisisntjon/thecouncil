# Judge-Grade Adversarial Audit Report

Date: 2026-06-26

## Scope

Repository: `<repo-root>`

Mission: judge-grade adversarial release audit for The Council before final Kaggle/Google capstone submission.

Safety constraints:

- Work only inside this repository.
- Do not call live model/provider APIs.
- Do not require real API keys.
- Do not print, copy, expose, or save secret values.
- Keep fixture/offline/no-key mode as the official public demo path.
- Do not push.

## Baseline Validation

Status: baseline complete.

| Command | Result | Important output | Blocker? | Fix applied |
| --- | --- | --- | --- | --- |
| `npm run demo:fixture` | Pass via `npm.cmd run demo:fixture` | Fixture/offline/simulated run completed; Run ID `20260626-191505-0001`; 4 agents; 12 verified claims; average confidence `0.87`; JSON/Markdown reports written under `sample_outputs/`. | No | None |
| `npm run ui:fixture` health check | Pass with caveat | Default UI health endpoint at `http://127.0.0.1:4173/api/health` returned HTTP 200 with `mode: fixture/offline` and `liveProvidersRequired: false`. Direct UI server script also started on alternate port 4174 and returned the same health payload. | No | None |
| `npm run verify:capstone` | Pass via `npm.cmd run verify:capstone` | Ran fixture demo, tests, secret scan, and MCP self-test successfully. | No | None |
| `npm test` | Pass via `npm.cmd test` | `ops smoke tests passed`; `claims smoke tests passed`; `Capstone smoke tests passed`. | No | None |
| `npm run lint` | Pass via `npm.cmd run lint` | `eslint .` completed with exit code 0 and no reported warnings/errors. | No | None |
| `npm run secret:scan` | Pass via `npm.cmd run secret:scan` | `Secret scan passed: no risky tracked or unignored filenames found.` | No | None |
| `npm run mcp:self-test` | Pass via `npm.cmd run mcp:self-test` | Returned `ok: true`, 5 tools, and 12 claims. | No | None |
| `node mcp/server_stub.mjs --self-test` | Pass | Returned `ok: true`, tools `list_demo_questions`, `run_fixture_council`, `get_latest_report`, `list_verified_claims`, `get_architecture_summary`, and 12 claims. | No | None |
| `git status --short` | Pass with dirty-worktree caveat | Command completed. Worktree has many modified files, deleted legacy Python/config/script files, and untracked current capstone/audit/workflow files. | No immediate blocker; Phase 3 must classify. | None |

## Initial Notes

- The audit is report/safe-polish work, not a feature-building pass.
- Fixture UI is expected to be a long-running local server; baseline validation should verify startup/health and stop it cleanly.
- The worktree is already dirty from prior capstone work and must not be reverted blindly.
- Plain `npm` in PowerShell first failed due local execution policy blocking `npm.ps1`. The project commands pass through `npm.cmd`, which is the correct Windows command shim for this environment. This is a local shell invocation caveat, not a project blocker.
- Port 4173 was already serving the fixture UI health endpoint during validation. To avoid killing an unrelated process, the audit verified the default health endpoint and separately verified the underlying UI server script on port 4174.

## Pre-Commit Packaging Rehearsal

Status: partial pass. See `PRE_COMMIT_PACKAGING_REHEARSAL.md`.

This is not a fresh-clone test. It is a copied-file rehearsal of the current dirty-worktree submission candidate. True fresh-clone validation is deferred until after a safe commit exists.

Findings:

- Current publishable-file rehearsal copied 109 existing files and skipped 29 deleted tracked paths.
- Initial `npm install` reported one high-severity transitive `form-data` advisory through live-provider SDK dependencies; safe fix applied via npm override, and `npm audit --audit-level=high` now reports 0 vulnerabilities.
- `npm run demo:fixture`, `npm run lint`, `npm run secret:scan`, and `npm run mcp:self-test` pass in the rehearsal copy.
- Initial `npm test` and `npm run verify:capstone` failed in the file-set package because `tests/capstone_smoke.mjs` called `git ls-files` without fallback; safe fix applied, and a refreshed no-`.git` rehearsal copy now passes demo, tests, lint, secret scan, MCP self-test, and adversarial gauntlet.

## File-by-File Publication Audit

Status: complete. See `FILE_BY_FILE_PUBLICATION_AUDIT.md`.

Findings and actions:

- Audited the current publishable candidate set plus deleted tracked paths.
- Moved process/history reports to `docs/process/`.
- Updated public references in `README.md`, `COURSE_CONCEPTS.md`, and `submission_assets/EVALUATION_SUMMARY.md`.
- Added `.claude/`, `workflow/`, and `importantprompt.txt` to `.gitignore` so local process state is not swept into public release.
- `npm test` still passes after the moves.
- Remaining issue: deleted tracked legacy Python/config/script/test paths still need to be staged as removals during the final commit.

## Content, Evidence, Media, Release, Scope

Status: complete.

Artifacts:

- `ADVERSARIAL_CONTENT_AUDIT.md`
- `EVIDENCE_INTEGRITY_AUDIT.md`
- `MEDIA_READINESS_AUDIT.md`
- `PUBLIC_RELEASE_DECISION_DRAFT.md`
- `SCOPE_FREEZE.md`

Findings and actions:

- No private company/customer/employer/personal-name hits remain in the public candidate set after sanitizing local path references.
- Secret/API/provider term hits are expected placeholder, safety, or config references.
- Evidence wording now says web search was off, model-generated citations are not verified sources, and correctness claims are based on post-run review.
- Media assets exist, are public-safe, and the video script remains under five minutes.
- Public release recommendation: prefer a clean public release repo unless speed requires publishing this repo after cleanup.

## Final Validation

Status: complete.

| Command | Result | Important output | Blocker? |
| --- | --- | --- | --- |
| `npm run demo:fixture` | Pass via `npm.cmd run demo:fixture` | Fixture/offline/simulated; 4 agents; 12 verified claims; average confidence `0.87`. | No |
| `npm run ui:fixture` health check | Pass | `http://127.0.0.1:4173/api/health` returned HTTP 200 with `mode: fixture/offline` and `liveProvidersRequired: false`. | No |
| `npm run verify:capstone` | Pass | Fixture demo, smoke tests, secret scan, and MCP self-test all passed. | No |
| `npm test` | Pass | `ops`, `claims`, and capstone smoke tests passed. | No |
| `npm run lint` | Pass | ESLint completed with exit code 0. | No |
| `npm run secret:scan` | Pass | No risky tracked or unignored filenames found. | No |
| `npm run mcp:self-test` | Pass | Returned `ok: true`, 5 tools, 12 claims. | No |
| `node mcp/server_stub.mjs --self-test` | Pass | Returned `ok: true`, 5 tools, 12 claims. | No |
| `npm run test:adversarial` | Pass | 30 cases, 15 categories, 30 unsupported fixture refusals. | No |
| `npm audit --audit-level=high` | Pass | `found 0 vulnerabilities`. | No |
| `git status --short` | Pass with caveat | Large mixed worktree remains: modified docs/source, staged-to-be removals not yet staged, untracked audit artifacts and new Node fixture files. | Commit gate caveat |

## Commit Gate Decision

Status: **do not commit in this pass**.

Reason: the current worktree contains a large mixed set of prior capstone conversion changes plus this audit pass. Validation is green, but a blind `git add .` would combine many pre-existing edits, deleted legacy paths, new audit artifacts, moved process docs, and optional live-mode changes. That requires human review of the staged summary before committing.

Safe next step: review `git status --short`, decide whether audit reports should be committed or kept process-only, then stage intentionally. True fresh-clone validation should run only after that safe commit exists.
