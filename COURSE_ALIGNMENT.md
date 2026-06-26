# Course Alignment

This document summarizes how The Council maps to themes from the Kaggle/Google 5-Day AI Agents livestreams. Raw transcript material is not included here; private supporting notes were used only as a checklist.

## Themes Reviewed

- Agent versus chatbot: a useful agent is a model plus a harness of tools, policies, state, and verification.
- Multi-agent systems: complex goals should be split across specialized roles instead of one monolithic prompt.
- Tool use and MCP: tools should be exposed through constrained, inspectable interfaces.
- Agent skills: reusable procedures help avoid prompt bloat and context degradation.
- Security and guardrails: prompt injection, secret handling, least privilege, and policy checks matter in agentic systems.
- Evaluation and observability: final output is not enough; the trajectory should be reviewable.
- Human review: generated work needs plain-language summaries that reduce approval fatigue.
- Spec-driven development: durable behavior specs are more important than one-off generated code.
- Deployability and reproducibility: reviewers should be able to run a stable demo without credentials.

## How The Council Maps

| Course theme | The Council implementation |
| --- | --- |
| Agentic harness | `lib/fixtureCouncil.mjs` orchestrates roles, verification, synthesis, and report export around the model-like fixture data. |
| Multi-agent specialization | Four Council agents answer independently, peer critique reviews them, and a hidden verification swarm checks claims. |
| Tool boundaries | `lib/security.mjs` classifies input risk, redacts common sensitive patterns, and exposes a small fixture tool allowlist. |
| MCP | `mcp/server_stub.mjs` is a read-only MCP-style stub for fixture tools, intentionally not a production SDK server. |
| Agent skills | `skills/council-verification/SKILL.md` packages the verification workflow as a reusable skill. |
| Spec-driven behavior | `specs/verification.feature` captures the expected public demo behavior in Gherkin-style scenarios. |
| Evaluation | `sample_outputs/latest_fixture_report.json` records a trajectory-style audit trail with claims, verdicts, confidence, and synthesis. |
| Human review | `sample_outputs/latest_fixture_report.md` acts as a plain-language review artifact, similar to a compact "vibe diff." |
| Reproducibility | `npm run demo:fixture` runs offline with public fixture data and no provider keys. |

## Concepts Demonstrated

- Four independent Council agents
- Peer critique
- Hidden Verification Swarm
- Claim-level verification
- Confidence summary
- Unresolved-claim preservation
- JSON/Markdown audit export
- Read-only MCP-style stub
- Agent skill file
- No-key fixture mode
- Secret scan and redaction helper

## Why Fixture Mode Matters

Fixture mode is the official public demo path because it is deterministic, safe, and reproducible. It avoids private data, live search, provider billing, API-key setup, and network instability. This keeps the submission focused on the agentic architecture: the harness, role separation, verification, and audit trail.

## Core Agentic Pattern

The hidden verification swarm is the core pattern. The project does not ask one model to answer and self-grade. It separates the workflow into independent generation, critique, claim extraction, evidence checking, confidence reporting, and final synthesis. That separation makes disagreement and uncertainty inspectable.

## Intentionally Out of Scope

- Live-provider mode as the default demo path
- Publishing raw transcript material
- Presenting course analysis as the submitted project
- Replacing the MCP stub with the full SDK during the submission polish pass
- Adding active red-team or self-healing agents
- Adding dynamic skill routing for a single-skill demo
- Adding RAG or live web retrieval
