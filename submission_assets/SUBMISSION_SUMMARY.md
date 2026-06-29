# Submission Summary

Project: The Council: Multi-Agent Verification Swarm

Track: Freestyle

Public GitHub link: `https://github.com/thisisntjon/thecouncil`

Repo access note: Private repo is for staging only; final Kaggle submission should use a public repo or an access method confirmed by Kaggle.

Short pitch: The Council turns one AI answer into a transparent deliberation: four frontier models (Claude, GPT, Gemini, Grok) answer independently, critique each other, trigger a hidden cross-vendor verification swarm that re-checks every claim against a *different* vendor, and produce an evidence-backed final response with an audit trail.

## Demo Path

**The project is the live agent.** The headline demo runs the four real models with streaming, peer evaluation, and the cross-vendor verification swarm in the React UI:

```bash
cp .env.example .env        # add your own provider keys
launch.bat install-ui       # one-time dependency install
launch.bat live             # API + shadow verifier + UI on http://localhost:5173
```

The live agent is shown in the submission video; see `docs/deploy.md` for the reproducible deploy path.

For a reviewer **without keys**, a deterministic offline replay runs the same pipeline with no keys or network (this is what CI runs on). Its evidence is **simulated** — never present it as live results:

```bash
npm run demo:fixture
npm run demo:car-wash       # weighted practical-reasoning scenario
```

## What To Emphasize

- Four frontier models answer the same question independently (live: Claude, GPT, Gemini, Grok).
- Peer critique records disagreement and revision pressure.
- A hidden cross-vendor verification swarm re-checks each claim against a different vendor (offline: 12 fixture claims).
- Confidence summary and unresolved-claim handling are visible.
- JSON/Markdown audit reports are exported under `sample_outputs/` (offline mode).
- Weighted car-wash scenario shows role/claim weighting and decision scores.
- Counterfactual guardrails prevent overgeneralized driving advice.
- Security boundaries are explicit: `.env` ignored, placeholders only, redaction helper, tool allowlist, secret scan; the keyless offline mode also lets reviewers run safely.

## Validation Commands

```bash
npm run demo:fixture
npm run demo:car-wash
npm test
npm run secret:scan
npm run mcp:self-test
```
