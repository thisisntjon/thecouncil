# Capstone Conversion Report

Date: 2026-06-25

This report describes the public-safe capstone copy. Local machine paths from the original conversion notes have been intentionally removed.

## Selected Source

Selected source: local source project copy.

Why selected:

- It included the complete app surfaces: React client, Express server, shadow-council server, Python `council/`, and tests.
- It contained the verification swarm and shadow council behavior.
- Other inspected copies were wrappers, older copies, or unrelated workspace copies.

## Destination

Created destination: public-safe capstone repository copy.

## Files and Folders Copied From Source

Copied safe project surfaces:

- `client/`
- `server/`
- `shadow-council/`
- `council/`
- `config/`
- `tests/`
- `scripts/`
- `LICENSE`
- `package.json`
- `package-lock.json`
- `requirements.txt`
- `requirements-dev.txt`

## Files and Folders Intentionally Excluded or Removed

Excluded or removed from the capstone copy:

- `.env`
- `.env.local`
- `node_modules/`
- `client/dist/`
- build artifacts
- `.pytest_cache/`
- `__pycache__/`
- local DB files such as `council_cache.db`
- `archive/`
- generated research data such as `research/*-data/`
- zip/tar archives
- logs
- private/generated run artifacts

## New Capstone Files Created

- `.gitignore`
- `.env.example`
- `README.md`
- `CAPSTONE.md`
- `KAGGLE_WRITEUP_DRAFT.md`
- `VIDEO_SCRIPT.md`
- `ARCHITECTURE.md`
- `COURSE_CONCEPTS.md`
- `SECURITY_AND_PRIVACY.md`
- `DEMO_GUIDE.md`
- `RELEASE_CHECKLIST.md`
- `LICENSE_REVIEW.md`
- `CAPSTONE_CONVERSION_REPORT.md`
- `demo_fixture.mjs`
- `lib/security.mjs`
- `lib/fixtureCouncil.mjs`
- `fixtures/council_fixture.json`
- `fixtures/README.md`
- `sample_outputs/README.md`
- `screenshots/README.md`
- `docs/architecture.mmd`
- `docs/demo-flow.md`
- `mcp/README.md`
- `mcp/server_stub.mjs`
- `skills/council-verification/SKILL.md`
- `scripts/secret_scan.mjs`
- `tests/capstone_smoke.mjs`

## Demo Commands

No-key fixture demo:

```bash
npm run demo:fixture
```

Direct Node equivalent:

```bash
node demo_fixture.mjs
```

MCP stub self-test:

```bash
node mcp/server_stub.mjs --self-test
```

## Test Commands

Smoke tests:

```bash
npm test
```

Secret scan:

```bash
npm run secret:scan
```

Frontend build command is present:

```bash
npm run build:client
```

The build was not run during conversion because dependencies were intentionally not installed and `node_modules/` is excluded from the public-safe copy.

## Validation Results

Passed:

- Fixture demo runs with no API keys.
- Fixture demo writes JSON and Markdown reports.
- Capstone smoke tests pass.
- Secret scan passes by filename/category.
- MCP stub self-test returns the expected tools.
- Static check found no copied `node_modules`, build/cache folders, `.env`, DB, or log files in the capstone copy.

Latest polish pass also removed a private runtime artifact directory and duplicate capstone docs, then reran the secret scan successfully.

## MCP Status

Implemented as a runnable, dependency-free MCP-style stub:

`mcp/server_stub.mjs`

Tools:

- `list_demo_questions`
- `run_fixture_council`
- `get_latest_report`
- `list_verified_claims`
- `get_architecture_summary`

It is intentionally read-only and fixture-only. A production version should use the official MCP SDK transport/framing.

## Course Concepts Demonstrated

- Agent / multi-agent system
- MCP server stub
- Security features
- Deployability
- Agent skills / reusable capabilities
- Evaluation and audit trail

## Remaining Blockers Before Public GitHub/Kaggle Submission

- Add public-safe screenshots or a short GIF under `screenshots/`.
- Decide whether to publish only fixture mode or include optional live-provider instructions.
- If you want the React UI in the video, run a dependency install locally and verify `npm run build:client`.
- Review package lockfiles and existing live provider code before public GitHub release.
- Confirm license comfort before publishing.
