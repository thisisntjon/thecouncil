# The Council: Multi-Agent Verification Swarm

The Council turns one AI answer into a transparent deliberation: multiple agents answer independently, critique each other, trigger a hidden verification swarm, and produce an evidence-backed final response with an audit trail.

## Problem

AI assistants often return one polished answer even when the question is ambiguous, high-impact, or evidence-sensitive. That single answer can hide uncertainty, collapse disagreement, and make it hard to know which claims were actually checked.

## Solution

The Council is a multi-agent verification pattern. Four Council agents answer the same question independently. They then peer-review each other for strengths, weaknesses, and revision needs. A hidden Verification Swarm extracts claims, checks them against fixture evidence, assigns confidence, and passes those results into final synthesis. The project is intentionally more than a chatbot: the model is only ~10% of it, and the other ~90% is the **harness** â€” redaction, role separation, tool boundaries, claim verification, and audit export. The behavioral contract lives in a durable **spec-driven verification flow** (`specs/verification.feature`), so the spec is the source of truth and the code is disposable.

For this capstone, the default demo is a no-key fixture mode. It simulates the workflow with public-safe local data, so reviewers can reproduce the architecture without paid provider calls, live search, or private credentials.

## Why Multi-Agent Verification Matters

More agents do not automatically mean better answers â€” multi-agent adds coordination cost, so the right default is to start simple and only split when a single agent hits a real boundary. High-stakes verification *is* that boundary: the value is exactly the disagreement, critique, and claim-checking that a single self-grading prompt collapses. So the workflow "slices the elephant" into generation, critique, claim extraction, evidence checking, and synthesis instead of one monolithic prompt â€” keeping each context small and avoiding the context rot of asking one model to answer and police itself. This makes overconfidence inspectable: the report shows what was supported, what was only partially supported, and what remains unresolved â€” *effective* trust, not a binary pass.

## Architecture

The fixture demo follows this flow:

1. Input redaction and risk check
2. Four independent Council answers
3. Peer critique
4. Hidden Verification Swarm claim extraction
5. Fixture evidence verification
6. Confidence summary
7. Final synthesis and audit export

The copied project also includes an existing React/Vite UI, Express API, shadow-council service, and Python implementation. The capstone polish adds a reliable offline fixture engine in `lib/`, public demo commands, smoke tests, a read-only MCP-style stub, submission assets, and a reusable verification skill.

## Demo Walkthrough

The recommended demo question is:

> What are the tradeoffs between single-agent and multi-agent verification for AI-assisted decision making?

Run:

```bash
npm run demo:fixture
```

The command prints the final synthesis and writes JSON/Markdown reports under `sample_outputs/`. The report includes the four agent answers, peer critiques, 12 verified claims, average confidence, unresolved-claim handling, and an audit trail.

The JSON report is a **trajectory-style audit trail**: it records every critique and intermediate verdict, so a reviewer can confirm the answer was earned rather than a "fragile success trap" (a good-looking output reached by a flawed path). The Markdown report is the **human-readable vibe diff** for human sign-off.

## Memory, Tools, and Reproducibility

Memory is explicit and auditable rather than hidden: each run carries a run ID and emits a structured audit trail (load fixture â†’ redact input â†’ extract claims â†’ verify â†’ write report) instead of opaque hidden state. Tools are bounded by a small, declared allowlist (`load_fixture`, `redact_input`, `extract_claims`, `verify_claims_against_fixture`, `write_audit_report`) â€” the agent cannot reach beyond them. Outputs are reproducible: the fixture path is deterministic and uses atomic writes, so re-running `npm run demo:fixture` reproduces identical verification content (only the run timestamp differs) â€” useful for grading and regression checks.

## Course Concepts

- Agent / multi-agent system: four Council agents, peer critique, hidden verification swarm, final synthesis
- Security features: no-key fixture mode, `.env` ignored, placeholder examples, redaction helper, input-risk classification, tool allowlist, secret scan
- Deployability: one-command fixture demo, clear setup docs, reproducible validation commands
- Agent skills: `skills/council-verification/SKILL.md`
- MCP: `mcp/server_stub.mjs` exposes read-only fixture tools for the demo
- Evaluation and audit trail: JSON/Markdown exports show claims, verdicts, confidence, and final synthesis
- Spec-driven behavior: `specs/verification.feature` captures the fixture flow as a durable behavioral contract

## Security and Privacy

The public demo does not require API keys, private data, live search, or provider calls. Fixture data is simulated and labeled. Live provider mode remains optional, disabled by default, and must use user-provided keys outside the public demo path.

## Limitations

The fixture demo proves the workflow shape, not live model quality. The MCP implementation is a dependency-free stub, not a production MCP SDK server. The existing UI is preserved, but the most reliable review path is the fixture command.

## Evaluation Snapshot

To pressure-test the pipeline, I ran ten difficult, diverse questions (factual/staleness, multi-step math, fresh logic, ambiguous intent, ethics, prompt injection, physics misconceptions, a trick question, Fermi estimation, and model self-knowledge) through the full live pipeline with web search off. All ten synthesized a final answer with no crashes, every final answer was correct or well-reasoned by post-run review, and the prompt-injection attempt was resisted. The evaluation also surfaced honest weaknesses: verification confidence under-reports correct reasoning/meta answers, and the three models verify with different strictness. Reporting these findings, not just the successes, is the point. No model-generated citations from that run are presented as verified sources. See `submission_assets/EVALUATION_SUMMARY.md`.

## What I Learned

The main lesson is that agentic reliability comes from process design, not agent count alone. Independent answers help, but the strongest part is the chain of critique, claim-level verification, confidence reporting, and uncertainty preservation.

Approximate word count: 933
