# Capstone

Title: The Council: Multi-Agent Verification Swarm

Track: Freestyle

## Problem Statement

Single AI answers can be fast but opaque. For high-impact research or AI-assisted decisions, users need to see how an answer was formed, where agents disagreed, which claims were checked, and what remains uncertain.

## Core Idea

The Council separates answer generation from verification. Four Council agents answer independently, peer critique exposes weak assumptions, a hidden verification swarm checks claims against fixture evidence, and final synthesis produces an answer with confidence and an audit trail.

## Why Agents Are Needed

Verification is not one behavior. Generation, critique, claim extraction, evidence checking, and synthesis each require a different role. Splitting those roles makes the process more auditable than asking one model to answer and then self-grade.

## Public Demo Path

The capstone demo uses fixture/offline mode:

```bash
npm run demo:fixture
```

It is simulated and public-safe. It does not call live providers, require keys, perform web search, or read private files.

The recommended question is:

> What are the tradeoffs between single-agent and multi-agent verification for AI-assisted decision making?

## Course Concepts

- Agent / multi-agent system: four Council agents, peer critique, hidden verification swarm, final synthesis
- Security features: no-key fixture mode, `.env` ignored, placeholder `.env.example`, redaction helper, input-risk classification, tool allowlist, secret scan
- Deployability: one-command demo, smoke tests, clear local commands
- Agent skills: `skills/council-verification/SKILL.md`
- MCP: read-only MCP-style fixture stub in `mcp/server_stub.mjs`
- Evaluation: JSON/Markdown audit export with verified claims and confidence summary

## Safety and Privacy Design

Fixture mode is default and requires no keys. Live mode is optional. `.env` files are ignored. The fixture engine redacts obvious sensitive input patterns and uses a small tool allowlist. The public demo should use only fixture reports and public-safe screenshot helper pages.

## Limitations

Fixture mode demonstrates the architecture, not live model quality. The MCP server is a dependency-free stub and should not be described as a production MCP SDK server. Live provider behavior depends on user keys, provider availability, costs, and a separate review.

## Future Work

- Replace the MCP stub with an official MCP SDK implementation.
- Add a one-click fixture UI mode.
- Add richer fixture sets and evaluator metrics.
- Add deployment packaging after live-mode boundaries are finalized.
