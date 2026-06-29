# Demo Guide

**The demo is the live agent.** Below is the walkthrough to show (or record), followed by a no-key
reproducibility path for anyone without provider keys.

## The live walkthrough (what to show)

Start the stack and open the UI:

```bash
launch.bat live      # starts API + shadow verifier + React UI; reuses anything already running
```

Then open `http://localhost:5173` and drive it:

1. **Setup** — pick the question count, confirm the four Council members (Claude, GPT, Gemini, Grok).
2. **Ask** a question (a good one below). **Round 1** — all four models stream their answers live, with
   per-model latency and web search.
3. **Convene the Council** — **Round 2** peer evaluation: each model scores the others, with strengths,
   weaknesses, and a **consensus score**.
4. **Round 3 — the cross-vendor verification swarm** runs in parallel: each claim is re-checked by a
   *different* vendor than authored it, with **Supported / Partial / Refuted** verdicts, confidence bars,
   "verified by {vendor}" tags, and citations.
5. **Verdict** — "The Council has decided," with the audit trail behind it.

The strongest moment: models often **split** on the answer, and the cross-vendor verification resolves it —
that's the whole thesis, live.

## Recommended demo question

```text
I want to wash my car. The car wash is 50 meters away. Should I walk or drive?
```

A logic trap: it *feels* like "short distance → walk," but the goal is to wash the car, which requires the
car at the wash → **drive**. Live, you'll often see two models fall for the trap and the verification swarm
surface the correct answer. (Also good: "What are the tradeoffs between single-agent and multi-agent
verification for AI-assisted decision making?")

## Run without API keys (reproducibility / CI)

So a reviewer without keys can still run the whole pipeline — and so CI can — the same pipeline ships as a
deterministic **offline** replay. It writes JSON/Markdown reports to `sample_outputs/`. Its evidence is
**simulated** (it proves the architecture, not live model quality):

```bash
npm run demo:fixture
npm run demo:car-wash       # the weighted practical-reasoning scenario, offline
```

On Windows: `launch.bat fixture`.

## Offline guardrail tests

The smoke tests include offline guardrail scenarios so the system doesn't answer every nearby destination
the same way:

- Price check at the car wash -> walk.
- Car already at the wash -> walk.
- Car not safe to drive -> do not drive.
- Coffee shop 50 meters away -> walk.

## Validation

```bash
npm run verify:capstone      # demo:fixture + npm test + secret:scan + mcp:self-test
npm test                     # smoke tests (run on the offline engine)
npm run mcp:self-test        # exercises the MCP stub
```

## Public-Safe Visuals

For screenshots / b-roll, open these local pages (public-safe content only):

- `screenshots/cover.html`
- `screenshots/architecture.html`
- `screenshots/demo-output.html`

Do not capture private desktops, provider dashboards, `.env` files, account pages, or real keys.
