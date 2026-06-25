# Demo Guide

The recommended public demo is fixture/offline/simulated. It does not require API keys or live provider calls.

## Recommended Demo Question

What are the tradeoffs between single-agent and multi-agent verification for AI-assisted decision making?

## Run The Fixture Demo

```bash
npm run demo:fixture
```

## What To Show

1. The command says fixture/offline/simulated.
2. Four Council agents are represented in the report.
3. Peer critiques include strengths and weaknesses.
4. The hidden Verification Swarm checks 12 claims.
5. The final synthesis includes confidence and unresolved-claim handling.
6. Reports are written to `sample_outputs/`.

## Optional Custom Question

```bash
npm run demo:fixture -- "Should a small team use a single powerful AI agent or a council of specialized agents for high-stakes research?"
```

The fixture evidence remains simulated.

## MCP Stub Demo

```bash
npm run mcp:self-test
```

## Smoke Test

```bash
npm test
```

## Public-Safe Visuals

Open these local pages in a browser for screenshots or video b-roll:

- `screenshots/cover.html`
- `screenshots/architecture.html`
- `screenshots/demo-output.html`

Do not use screenshots of private desktops, provider dashboards, `.env` files, account pages, or live run outputs.
