# Capstone

Title: The Council: Multi-Agent Verification Swarm

Track: Freestyle

## Problem Statement

Single AI answers can be fast but opaque. For high-impact research or AI-assisted decisions, users need to see how an answer was formed, where agents disagreed, which claims were checked, and what remains uncertain.

## Core Idea

The Council separates answer generation from verification. Four Council agents answer independently, peer critique exposes weak assumptions, a hidden verification swarm checks claims against fixture evidence, and final synthesis produces an answer with confidence and an audit trail.

The project intentionally "slices the elephant": generation, critique, verification, and synthesis are separate roles instead of one monolithic prompt. That keeps context smaller, makes each step easier to inspect, and gives the final answer a visible trajectory.

The model is only ~10% of this; the deterministic **harness** — redaction, role orchestration, the tool allowlist, claim verification, and synthesis — is the ~90% that makes the result trustworthy. The JSON export is a **trajectory-style audit trail** (proving success is earned, not a "fragile success trap"), the Markdown export is the **human-readable vibe diff** for sign-off, and preserved confidence + unresolved claims express *effective* trust rather than a binary pass.

## Why Agents Are Needed

Multi-agent is not the default — it adds coordination cost and should only be used when a single agent hits a real boundary. This project hits that boundary: **high-stakes verification** is precisely where the value lives in the disagreement, critique, and claim-checking that a single self-grading prompt collapses. Verification is also not one behavior — generation, critique, claim extraction, evidence checking, and synthesis each need a different role. Splitting those roles is therefore a justified architectural choice, not multi-agent for its own sake, and it makes the process auditable instead of asking one model to answer and then grade itself.

## Public Demo Path

The recommended capstone demo is the dependency-free visual fixture UI — the dashboard makes the agents, peer critiques, claim verdicts, confidence, and synthesis immediately legible:

```bash
npm run ui:fixture
```

Then open `http://127.0.0.1:4173` (on Windows: `launch.bat ui`). For a command-line equivalent that writes the same JSON/Markdown reports:

```bash
npm run demo:fixture
```

Both are simulated and public-safe, **reproducible** (re-running reproduces identical verification content; only the run timestamp differs), and do not call live providers, require keys, perform web search, or read private files.

The expected behavior is also captured as a durable Gherkin-style spec in `specs/verification.feature`.

The recommended question is:

> What are the tradeoffs between single-agent and multi-agent verification for AI-assisted decision making?

## Course Concepts

- Agent / multi-agent system: four Council agents, peer critique, hidden verification swarm, final synthesis
- Security features: no-key fixture mode, `.env` ignored, placeholder `.env.example`, redaction helper, input-risk classification, tool allowlist, secret scan
- Deployability: one-command demo, smoke tests, clear local commands
- Agent skills: `skills/council-verification/SKILL.md`
- MCP: read-only MCP-style fixture stub in `mcp/server_stub.mjs`
- Evaluation: JSON/Markdown audit export with verified claims and confidence summary
- Spec-driven development: `specs/verification.feature` documents the behavioral contract

## Safety and Privacy Design

Fixture mode is default and requires no keys. Live mode is optional. `.env` files are ignored. The fixture engine redacts obvious sensitive input patterns and uses a small tool allowlist. The public demo should use only fixture reports and public-safe screenshot helper pages.

## Limitations

Fixture mode demonstrates the architecture, not live model quality. The MCP server is a dependency-free stub and should not be described as a production MCP SDK server. Live provider behavior depends on user keys, provider availability, costs, and a separate review.

## Future Work

- Replace the MCP stub with an official MCP SDK implementation.
- Add richer fixture sets and evaluator metrics.
- Add deployment packaging after live-mode boundaries are finalized.
- Verifier calibration: tune confidence scoring for reasoning/meta/security questions.
