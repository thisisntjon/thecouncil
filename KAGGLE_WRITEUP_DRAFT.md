# The Council: Multi-Agent Verification Swarm

The Council turns one AI answer into a transparent deliberation: multiple agents answer independently, critique each other, trigger a hidden verification swarm, and produce an evidence-backed final response with an audit trail.

**Track: Freestyle**

## Problem

AI assistants often return one polished answer even when the question is ambiguous, high-impact, or evidence-sensitive. That single answer can hide uncertainty, collapse disagreement, and make it hard to know which claims were actually checked.

## Solution

The Council is a multi-agent verification pattern. Four Council agents answer the same question independently. They then peer-review each other for strengths, weaknesses, and revision needs. A hidden Verification Swarm extracts claims, checks them against evidence, assigns confidence, and passes those results into final synthesis. The project is intentionally more than a chatbot: the model is only ~10% of it, and the other ~90% is the **harness** — redaction, role separation, tool boundaries, claim verification, and audit export. The behavioral contract lives in a durable **spec-driven verification flow** (`specs/verification.feature`), so the spec is the source of truth and the code is disposable.

The Council runs in two modes. **Live mode** is the showpiece in the video: a React + Vite UI (Tailwind + shadcn/ui) streams each agent's answer and chain-of-thought token by token, then renders a **cross-vendor verification swarm** in real time — every claim re-checked by a *different* model vendor than authored it, with confidence and verdicts shown inline. **Fixture mode** is the reproducible, no-key default: it simulates the same workflow with public-safe local data, so reviewers can reproduce the architecture without paid provider calls, live search, or private credentials. Live mode needs your own provider keys; fixture mode is the path judges can run directly.

## Why Multi-Agent Verification Matters

More agents do not automatically mean better answers — multi-agent adds coordination cost, so the right default is to start simple and only split when a single agent hits a real boundary. High-stakes verification *is* that boundary: the value is exactly the disagreement, critique, and claim-checking that a single self-grading prompt collapses. So the workflow "slices the elephant" into generation, critique, claim extraction, evidence checking, and synthesis instead of one monolithic prompt — keeping each context small and avoiding the context rot of asking one model to answer and police itself. This makes overconfidence inspectable: the report shows what was supported, what was only partially supported, and what remains unresolved — *effective* trust, not a binary pass.

## Architecture

The verification flow follows seven stages:

1. Input redaction and risk check
2. Four independent Council answers
3. Peer critique
4. Hidden Verification Swarm claim extraction
5. Evidence verification (cross-vendor in live mode; fixture evidence offline)
6. Confidence summary
7. Final synthesis and audit export

Live mode — the agent itself — is served by an Express API plus a separate shadow-council verifier service behind the React UI. The no-key offline mode adds a deterministic engine in `lib/`, reproducibility commands, smoke tests, a read-only MCP-style stub, submission assets, and a reusable verification skill.

## Demo Walkthrough

The video demonstrates live mode end to end — four models answering, peer evaluation, and the parallel cross-vendor verification swarm reaching a verdict. To reproduce the architecture yourself with no keys:

```bash
npm run demo:fixture
```

The command prints the final synthesis and writes JSON/Markdown reports under `sample_outputs/`. The report includes the four agent answers, peer critiques, 12 verified claims, average confidence, unresolved-claim handling, and an audit trail.

The JSON report is a **trajectory-style audit trail**: it records every critique and intermediate verdict, so a reviewer can confirm the answer was earned rather than a "fragile success trap" (a good-looking output reached by a flawed path). The Markdown report is the **human-readable vibe diff** for human sign-off.

## Memory, Tools, and Reproducibility

Memory is explicit and auditable rather than hidden: each run carries a run ID and emits a structured audit trail (load fixture → redact input → extract claims → verify → write report) instead of opaque hidden state. Tools are bounded by a small, declared allowlist (`load_fixture`, `redact_input`, `extract_claims`, `verify_claims_against_fixture`, `write_audit_report`) — the agent cannot reach beyond them. Outputs are reproducible: the fixture path is deterministic and uses atomic writes, so re-running `npm run demo:fixture` reproduces identical verification content (only the run timestamp differs) — useful for grading and regression checks.

## Course Concepts

- Agent / multi-agent system: four Council agents, peer critique, hidden verification swarm, final synthesis
- Security features: the live agent uses your own keys via a gitignored `.env` (placeholders only, `secret:scan` enforced), input redaction, input-risk classification, a tool allowlist; the no-key fixture mode also lets reviewers run safely
- Deployability: one-command fixture demo, clear setup docs, reproducible validation commands
- Agent skills: `skills/council-verification/SKILL.md` and `.claude/skills/add-fixture/`
- MCP: `mcp/server_stub.mjs` exposes read-only fixture tools for the demo
- Evaluation and audit trail: JSON/Markdown exports show claims, verdicts, confidence, and final synthesis
- Spec-driven behavior: `specs/verification.feature` captures the fixture flow as a durable behavioral contract

## Security and Privacy

The live agent uses your own provider keys, supplied via a gitignored `.env` (only placeholder examples are committed, and `secret:scan` enforces it). We deliberately do not host the live app publicly — a no-login endpoint on private keys would be an abuse/cost risk — so it is shown in the video and documented in `docs/deploy.md`. The no-key offline mode requires no keys, private data, live search, or provider calls; its fixture data is simulated and labeled, never presented as live results.

## Limitations

The fixture demo proves the workflow shape, not live model quality, and its evidence is simulated — never live results. The MCP implementation is a dependency-free stub, not a production MCP SDK server. Live mode requires your own provider keys; the no-key fixture command lets a keyless reviewer reproduce the architecture without them.

## Evaluation Snapshot

To pressure-test the pipeline, I ran ten difficult, diverse questions (factual/staleness, multi-step math, fresh logic, ambiguous intent, ethics, prompt injection, physics misconceptions, a trick question, Fermi estimation, and model self-knowledge) through the full live pipeline with web search off. All ten synthesized a final answer with no crashes, every final answer was correct or well-reasoned by post-run review, and the prompt-injection attempt was resisted. The evaluation also surfaced honest weaknesses: verification confidence under-reports correct reasoning/meta answers, and the models verify with different strictness. Reporting these findings, not just the successes, is the point. No model-generated citations from that run are presented as verified sources. See `submission_assets/EVALUATION_SUMMARY.md`.

## What I Learned

The main lesson is that agentic reliability comes from process design, not agent count alone. Independent answers help, but the strongest part is the chain of critique, claim-level verification, confidence reporting, and uncertainty preservation.
