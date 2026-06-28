# Submission Summary

Project: The Council: Multi-Agent Verification Swarm

Track: Freestyle

Public GitHub link: `https://github.com/thisisntjon/thecouncil`

Repo access note: Private repo is for staging only; final Kaggle submission should use a public repo or an access method confirmed by Kaggle.

Short pitch: The Council turns one AI answer into a transparent deliberation: multiple agents answer independently, critique each other, trigger a hidden verification swarm, and produce an evidence-backed final response with an audit trail.

## Demo Path

Use fixture/offline mode for the public submission:

```bash
npm run demo:fixture
```

This path is simulated, reproducible, and requires no API keys.

Optional weighted practical-reasoning demo:

```bash
npm run demo:car-wash
```

## What To Emphasize

- Four independent Council agents answer the same question.
- Peer critique records disagreement and revision pressure.
- Hidden Verification Swarm checks 12 fixture claims.
- Confidence summary and unresolved-claim handling are visible.
- JSON/Markdown audit reports are exported under `sample_outputs/`.
- Weighted car-wash scenario shows role/claim weighting and decision scores.
- Counterfactual guardrails prevent overgeneralized driving advice.
- Security boundaries are explicit: no-key fixture mode, `.env` ignored, placeholders only, redaction helper, tool allowlist, secret scan.

## Validation Commands

```bash
npm run demo:fixture
npm run demo:car-wash
npm test
npm run secret:scan
npm run mcp:self-test
```
