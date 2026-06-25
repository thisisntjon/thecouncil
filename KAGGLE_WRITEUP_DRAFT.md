# The Council: Multi-Agent Verification Swarm

The Council turns one AI answer into a transparent deliberation: multiple agents answer independently, critique each other, trigger a hidden verification swarm, and produce an evidence-backed final response with an audit trail.

## Problem

AI assistants often return one polished answer even when the question is ambiguous, high-impact, or evidence-sensitive. That single answer can hide uncertainty, collapse disagreement, and make it hard to know which claims were actually checked.

## Solution

The Council is a multi-agent verification pattern. Four Council agents answer the same question independently. They then peer-review each other for strengths, weaknesses, and revision needs. A hidden Verification Swarm extracts claims, checks them against fixture evidence, assigns confidence, and passes those results into final synthesis.

For this capstone, the default demo is a no-key fixture mode. It simulates the workflow with public-safe local data, so reviewers can reproduce the architecture without paid provider calls, live search, or private credentials.

## Why Multi-Agent Verification Matters

More agents do not automatically mean better answers. The value comes from role separation and traceability. One role generates, another critiques, another extracts claims, another verifies evidence, and the final synthesis preserves uncertainty. This makes overconfidence easier to inspect because the report shows what was supported, what was only partially supported, and what would need more review.

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

## Course Concepts

- Agent / multi-agent system: four Council agents, peer critique, hidden verification swarm, final synthesis
- Security features: no-key fixture mode, `.env` ignored, placeholder examples, redaction helper, input-risk classification, tool allowlist, secret scan
- Deployability: one-command fixture demo, clear setup docs, reproducible validation commands
- Agent skills: `skills/council-verification/SKILL.md`
- MCP: `mcp/server_stub.mjs` exposes read-only fixture tools for the demo
- Evaluation and audit trail: JSON/Markdown exports show claims, verdicts, confidence, and final synthesis

## Security and Privacy

The public demo does not require API keys, private data, live search, or provider calls. Fixture data is simulated and labeled. Live provider mode remains optional, disabled by default, and must use user-provided keys outside the public demo path.

## Limitations

The fixture demo proves the workflow shape, not live model quality. The MCP implementation is a dependency-free stub, not a production MCP SDK server. The existing UI is preserved, but the most reliable review path is the fixture command.

## What I Learned

The main lesson is that agentic reliability comes from process design, not agent count alone. Independent answers help, but the strongest part is the chain of critique, claim-level verification, confidence reporting, and uncertainty preservation.

Approximate word count: 554
