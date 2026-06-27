# Demo Guide

The recommended public demo is fixture/offline/simulated. It does not require API keys or live provider calls.

**Start here (one command, most reproducible):** the terminal dashboard. It animates the full pipeline — an at-a-glance confidence meter, each agent with its own confidence, peer critiques, color-coded claim verdicts with confidence bars, weighted decision scores, preserved unresolved claims, and the final synthesis.

```bash
npm run demo:fixture
```

Windows: `launch.bat fixture` (the launcher forces UTF-8 so box-drawing/bars render correctly). For a static, screenshot-friendly view, the browser UI below shows the same evaluation in a web page.

## Recommended Demo Question

What are the tradeoffs between single-agent and multi-agent verification for AI-assisted decision making?

## Run The Fixture Demo

```bash
npm run demo:fixture
```

Windows launcher:

```bat
launch.bat
```

The launcher opens a grouped menu: press **Enter** (or **D**) for the demo (default fixture / car-wash / custom question), **U** for the browser UI, and **V** to verify. Developer checks (smoke tests, MCP self-test) live under **A) Advanced**, and the optional key-requiring paths under **L) Live mode**. Everything is offline and key-free unless marked Live.

## Browser Fixture UI

```bat
launch.bat ui
```

This starts a local public-safe UI at `http://127.0.0.1:4173`. It uses the same offline fixture evaluator as `npm run demo:fixture`, shows Council roles, verification claims, decision scores, caveats, and audit export paths, and does not require provider keys.

## Weighted Practical Scenario

```bash
npm run demo:car-wash
```

This runs the public-safe car-wash fixture:

> I want to wash my car. The car wash is 50 meters away. Should I walk or drive?

Expected answer: drive the car for the actual wash, with caveats that walking is reasonable for checking, paying, asking a question, or if the car is already at the wash. The report includes role weights, claim weights, decision scores, and an unresolved safety/legal assumption.

## Counterfactual Guardrails

The smoke tests include offline guardrail scenarios so the system does not answer every nearby destination with the same recommendation:

- Price check at the car wash -> walk.
- Car already at the wash -> walk.
- Car not safe to drive -> do not drive.
- Coffee shop 50 meters away -> walk.

## What To Show

1. Open the browser UI (`npm run ui:fixture`) — the visual dashboard is the strongest first impression.
2. Four Council agents answer independently; peer critiques show scored strengths and weaknesses.
3. The hidden Verification Swarm checks 12 claims with color-coded verdicts and confidence.
4. The final synthesis includes confidence and unresolved-claim handling (effective trust, not a binary pass).
5. The JSON report is a trajectory-style audit trail; the Markdown report is the human-readable vibe diff.
6. Reports are written to `sample_outputs/`; re-running reproduces identical verification content (only the timestamp differs).
7. Optional: run `npm run demo:car-wash` to show weighted applicability beating simple claim count.
8. Optional: the command-line `npm run demo:fixture` produces the same evaluation as text.

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
