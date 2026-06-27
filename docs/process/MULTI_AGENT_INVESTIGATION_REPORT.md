# Multi-Agent Investigation Report

Date: 2026-06-26

## Executive Summary

The Council is a public-safe capstone demo for a multi-agent verification pattern. It turns a question into a transparent deliberation: independent Council agents answer, peer critiques expose disagreement, a verification stage checks atomic claims against evidence, and a final synthesis exports JSON/Markdown audit reports.

The strongest version of the claim is: this project demonstrates the shape of a trustworthy multi-agent verification workflow in an offline fixture mode. It is not, in the official public path, a live multi-model verification system. The live/provider code exists, but it is optional, key-dependent, and not the reviewer-safe path.

Current end-to-end status: `npm run verify:capstone` passes after updating the secret scan to inspect Git-tracked plus unignored files rather than ignored local secret storage. The later phased work also added a weighted car-wash scenario and counterfactual guardrails.

Overall readiness score after phased follow-up: 84/100.

## What It Does

The project provides a deterministic, no-key demo of The Council:

1. Accepts a user question through `demo_fixture.mjs`.
2. Redacts obvious sensitive values and classifies input risk through `lib/security.mjs`.
3. Loads four simulated Council agents from `fixtures/council_fixture.json`.
4. Emits peer critiques with scores, strengths, and weaknesses.
5. Verifies 12 fixture claims against fixture evidence.
6. Produces a confidence summary and final answer.
7. Writes `sample_outputs/latest_fixture_report.json` and `sample_outputs/latest_fixture_report.md`.
8. Exposes the fixture pipeline through a small MCP-style JSON-RPC stub.
9. Includes a weighted car-wash scenario plus counterfactual guardrails for price checking, car already at wash, unsafe-to-drive, and unrelated short-distance travel.

## Why It Does It

The problem is that single AI answers are fast but opaque. For higher-impact decisions, a user needs to see:

- what different agents said independently
- where they disagreed
- which claims were checked
- how confident the system is
- what remains unresolved
- what audit trail led to the final answer

The project is aligned with agentic design themes: role separation, least privilege, reproducible demo mode, tool boundaries, auditability, and verification-first output.

## How It Does It

The official public path is fixture/offline mode:

```bash
npm run verify:capstone
```

That command runs:

```bash
npm run demo:fixture
npm test
npm run secret:scan
npm run mcp:self-test
```

The implementation is centered on:

- `lib/fixtureCouncil.mjs`: deterministic pipeline and report writer
- `lib/security.mjs`: redaction, risk classification, tool allowlist
- `fixtures/council_fixture.json`: simulated agents, claims, evidence, verdicts
- `fixtures/car_wash_fixture.json`: weighted practical-reasoning fixture
- `fixtures/*_fixture.json`: counterfactual guardrails for walking/driving edge cases
- `mcp/server_stub.mjs`: MCP-style stdio JSON-RPC tool surface
- `tests/capstone_smoke.mjs`: smoke validation for fixture shape and required artifacts
- `scripts/secret_scan.mjs`: Git-aware public-surface filename scan

There are also optional live/provider surfaces:

- `client/`: React/Vite UI
- `server/`: Express API for live model calls and evaluation
- `shadow-council/`: live shadow verification server
- `council/`: Python provider orchestration engine

Those optional surfaces are meaningful, but they are not the reliable public submission path.

## Investigator Findings

Three read-only investigators reviewed distinct slices of the repo.

Product and phase investigator:

- Product clarity: 82/100
- Problem/value fit: 88/100
- Phase completeness: 73/100
- Main concern: all public phases exist, but several are static fixture representations rather than live generation, extraction, investigation, or synthesis.

Implementation investigator:

- Offline fixture report: 76/100
- Fixture data/sample outputs: 78/100
- MCP-style stub: 66/100
- Input redaction/risk classification: 57/100
- Python CouncilEngine: 72/100
- Main concern: the public path is cleanly packaged but simulated; live pieces have limited normal-path test coverage.

Reviewer-readiness investigator:

- Reproducibility: 82/100
- Safety: 75/100 before scan fix
- Submission readiness: 72/100 before scan fix
- Main concern: ignored local secret-storage files caused the old recursive secret scan to fail even though those files are ignored and untracked.

## Feature Scorecard

| Feature | Score | Assessment |
| --- | ---: | --- |
| Product story and capstone framing | 84 | Clear and well aligned. Still slightly diluted by preserved optional app surfaces. |
| Problem/value fit | 88 | Strong. The auditability problem is real and the Council pattern addresses it directly. |
| Offline fixture runner | 84 | Reliable, fast, no keys, no network. Limited because agents and evidence are static. |
| Phase coverage | 76 | Every advertised public phase has an artifact, but several phases are fixture-authored rather than computed live. |
| Independent agent representation | 72 | Four roles are clear, but answers are loaded from JSON rather than generated independently during the run. |
| Peer critique | 70 | Useful report surface with scores/strengths/weaknesses, but static in fixture mode. |
| Claim verification | 73 | Claims have verdicts, evidence, reasoning, and confidence. Evidence is simulated fixture evidence. |
| Confidence and unresolved-claim handling | 78 | Confidence summary is implemented, and the car-wash/guardrail fixtures now preserve unresolved assumptions such as unsafe/legal driving and accessibility caveats. |
| JSON/Markdown audit export | 87 | Strong, reviewer-friendly, machine-readable and human-readable. Atomic writes are a good touch. |
| Input redaction and risk classification | 62 | Real utility and useful guardrail. Pattern-based and lightly tested. |
| Tool allowlist / safety boundary | 70 | Clear for fixture mode. It is a declared boundary more than a full runtime policy system. |
| Secret scan | 78 | Now checks tracked plus unignored files, which matches public-release risk. Still filename/category only. |
| MCP-style stub | 74 | Direct JSON-RPC round trip works. It is intentionally a small stub, not a production SDK server. |
| Smoke tests / verifier | 88 | `verify:capstone` now passes, and smoke tests cover the weighted car-wash scenario plus counterfactual guardrails. |
| Screenshot and submission assets | 78 | Helpful and public-safe. Final repo/video placeholders still need human completion. |
| Optional live JS app/server | 63 | Ambitious and feature-rich, but not installed, keyless, or verified as part of the public path. |
| Python CouncilEngine | 72 | Real async provider orchestration with stubbed tests. Provider adapters/config/cache need broader coverage. |

## End-To-End Phase Walkthrough

| Phase | Implemented? | Evidence | Score |
| --- | --- | --- | ---: |
| Input capture | Yes | CLI accepts default or custom question | 85 |
| Redaction/risk check | Yes | Regex redaction plus warnings | 62 |
| Independent agents | Fixture-only | Four static agent records | 72 |
| Peer critique | Fixture-only | Static critique records with scores and weaknesses | 70 |
| Claim extraction | Fixture-only | Claims are predefined in fixture JSON | 65 |
| Verification swarm | Fixture-only | Claim verdicts map to fixture evidence | 73 |
| Synthesis | Partly | Final answer is hardcoded around fixture outcome | 68 |
| Audit export | Yes | JSON/Markdown reports | 87 |
| MCP access | Yes | Stdio JSON-RPC stub and self-test | 74 |
| Public validation | Yes | `npm run verify:capstone` passes | 82 |

## Key Gaps

1. The public demo is deterministic and simulated. That is acceptable for reproducibility, but the writeup/video must not imply live verification quality.
2. Arbitrary custom questions still fall back to the default offline fixture unless they match a known scenario exactly.
3. Optional live-mode code is not part of the passing public validation command.
4. Public GitHub link and video/submission placeholders still need to be filled before final submission.

## Action Taken During Investigation

The investigation found that ignored local secret-storage files caused the old secret scan to fail. The scan was updated to inspect Git-tracked plus unignored files via `git ls-files --cached --others --exclude-standard`, which matches its public-release purpose and avoids opening ignored local secret storage.

Validated after the fix:

```bash
npm run secret:scan
npm run verify:capstone
```

Both pass.

## Recommendation

Keep the public submission framed as:

> The Council is a reproducible offline architecture demo of a multi-agent verification workflow.

Avoid claiming:

> The fixture demo performs live autonomous verification.

## Follow-Up Phased Work

After this investigation, the car-wash phased workflow closed all planned phases:

- Phase 1: added the weighted car-wash fixture and fixture-driven synthesis.
- Phase 2: exposed the scenario through CLI/MCP/docs/specs with `npm run demo:car-wash`.
- Phase 3: added counterfactual guardrails so the system does not overgeneralize driving advice.

Validated guardrail outcomes:

- Base car wash: drive beats walk.
- Price check: walk beats drive.
- Car already at wash: walk beats drive.
- Unsafe-to-drive: do not drive beats drive.
- Coffee shop 50 meters away: walk beats drive.

Best next improvement before final submission: capture fresh screenshots or a short video segment showing the weighted car-wash report, including decision scores and caveats.
