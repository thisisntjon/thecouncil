# Submission Summary

Project: The Council: Multi-Agent Verification Swarm

Track: Freestyle

Public GitHub link: `<ADD FINAL PUBLIC REPO LINK BEFORE SUBMISSION>`

Repo access note: Private repo is for staging only; final Kaggle submission should use a public repo or an access method confirmed by Kaggle.

Short pitch: The Council turns one AI answer into a transparent deliberation: multiple agents answer independently, critique each other, trigger a hidden verification swarm, and produce an evidence-backed final response with an audit trail.

## Demo Path

Use fixture/offline mode for the public submission:

```bash
npm run demo:fixture
```

This path is simulated, reproducible, and requires no API keys.

## What To Emphasize

- Four independent Council agents answer the same question.
- Peer critique records disagreement and revision pressure.
- Hidden Verification Swarm checks 12 fixture claims.
- Confidence summary and unresolved-claim handling are visible.
- JSON/Markdown audit reports are exported under `sample_outputs/`.
- Security boundaries are explicit: no-key fixture mode, `.env` ignored, placeholders only, redaction helper, tool allowlist, secret scan.

## Validation Commands

```bash
npm run demo:fixture
npm test
npm run secret:scan
npm run mcp:self-test
```
