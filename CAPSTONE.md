# Capstone

Title: The Council: Multi-Agent Verification Swarm

Track: Freestyle

## Problem Statement

Single AI answers can be fast but opaque. For high-impact research or AI-assisted decisions, users need to see how an answer was formed, where agents disagreed, which claims were checked, and what remains uncertain.

## Core Idea

The Council separates answer generation from verification. Four frontier models (Claude, GPT, Gemini, Grok) answer independently, peer critique exposes weak assumptions, a hidden **cross-vendor verification swarm** re-checks each claim against a *different* model vendor than authored it, and final synthesis produces an answer with confidence and an audit trail. **The project is the live agent;** a deterministic no-key offline mode exists as a reproducibility/CI fallback.

The project intentionally "slices the elephant": generation, critique, verification, and synthesis are separate roles instead of one monolithic prompt. That keeps context smaller, makes each step easier to inspect, and gives the final answer a visible trajectory.

The model is only ~10% of this; the deterministic **harness** — redaction, role orchestration, the tool allowlist, claim verification, and synthesis — is the ~90% that makes the result trustworthy. The JSON export is a **trajectory-style audit trail** (proving success is earned, not a "fragile success trap"), the Markdown export is the **human-readable vibe diff** for sign-off, and preserved confidence + unresolved claims express *effective* trust rather than a binary pass.

## Why Agents Are Needed

Multi-agent is not the default — it adds coordination cost and should only be used when a single agent hits a real boundary. This project hits that boundary: **high-stakes verification** is precisely where the value lives in the disagreement, critique, and claim-checking that a single self-grading prompt collapses. Verification is also not one behavior — generation, critique, claim extraction, evidence checking, and synthesis each need a different role. Splitting those roles is therefore a justified architectural choice, not multi-agent for its own sake, and it makes the process auditable instead of asking one model to answer and then grade itself.

## Demo Path

The demo **is the live agent**: four frontier models stream their answers, the Council convenes for peer evaluation + a consensus score, and a cross-vendor verification swarm re-checks every claim against a different vendor — verdicts, confidence, and an audit trail rendered live in the React UI.

```bash
cp .env.example .env        # add your own provider keys
launch.bat install-ui       # one-time dependency install
launch.bat live             # API + shadow verifier + React UI on http://localhost:5173
```

The live agent is the headline and the centerpiece of the submission video. See `docs/deploy.md` for the reproducible deploy path.

For a reviewer **without keys**, the same pipeline ships as a deterministic offline replay — the path the automated tests run on and a "verify it works without my keys" fallback:

```bash
npm run demo:fixture        # deterministic CLI dashboard; writes JSON + Markdown reports
```

On Windows: `launch.bat fixture`. Offline evidence is **simulated** — it demonstrates the architecture, not live model quality, and must never be presented as live results. It is **reproducible** (re-running reproduces identical verification content; only the run timestamp differs) and does not call live providers, require keys, perform web search, or read private files.

The expected offline behavior is also captured as a durable Gherkin-style spec in `specs/verification.feature`.

A representative question:

> What are the tradeoffs between single-agent and multi-agent verification for AI-assisted decision making?

## Course Concepts

- Agent / multi-agent system: four frontier models answer independently, peer critique, hidden cross-vendor verification swarm, final synthesis
- Security features: `.env` ignored, placeholder `.env.example`, redaction helper, input-risk classification, tool allowlist, secret scan; keyless offline mode also lets reviewers run safely
- Deployability: one-launcher live app, documented reproducible deploy path (`docs/deploy.md`), smoke tests, clear local commands
- Agent skills: `skills/council-verification/SKILL.md`
- MCP: read-only MCP-style fixture stub in `mcp/server_stub.mjs`
- Evaluation: JSON/Markdown audit export with verified claims and confidence summary
- Spec-driven development: `specs/verification.feature` documents the behavioral contract

## Safety and Privacy Design

`.env` files are ignored and only placeholder `.env.example` keys are committed; the `secret:scan` hook enforces this. The engine redacts obvious sensitive input patterns and uses a small read-only tool allowlist. We deliberately do **not** host the live app publicly (it runs on private keys — a no-login endpoint would be an abuse/cost risk); public media uses only the simulated offline reports and public-safe screenshot helper pages.

## Limitations

The offline mode is **simulated** — it proves the architecture and powers CI, not live model quality, and must not be shown as live results. The MCP server is a dependency-free stub and should not be described as a production MCP SDK server. Live provider behavior depends on user keys, provider availability, and costs.

## Future Work

- Replace the MCP stub with an official MCP SDK implementation.
- Add richer fixture sets and evaluator metrics.
- Add deployment packaging after live-mode boundaries are finalized.
- Verifier calibration: tune confidence scoring for reasoning/meta/security questions.
