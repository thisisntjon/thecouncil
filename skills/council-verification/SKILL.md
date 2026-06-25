---
name: council-verification
description: Run a Council-style verification pass with independent answers, peer critique, claim verification, confidence scoring, synthesis, and an audit trail.
---

# Council Verification Skill

Use this skill when an assistant needs a transparent multi-agent verification pass instead of a single unchecked answer.

## Workflow

1. Capture the user question and redact obvious secrets or personal data.
2. Produce independent answers from specialized Council roles.
3. Run peer critique so each role identifies strengths, weaknesses, and revision needs.
4. Extract atomic claims from the answers.
5. Verify each claim against allowed evidence sources.
6. Assign verdicts: `supported`, `partially_supported`, `refuted`, or `unresolved`.
7. Synthesize a final answer that cites supported claims and preserves unresolved claims.
8. Export an audit trail with agents, critiques, claims, evidence, confidence, and limitations.

## Guardrails

- Use fixture/offline mode by default.
- Do not expose API keys, private records, work/customer data, or pasted secrets.
- Label simulated fixture evidence clearly.
- Keep tool use read-only unless the user explicitly asks for a write action.
- Preserve disagreement instead of forcing false consensus.

## Capstone Demo Command

```bash
npm run demo:fixture
```

The fixture demo shows the Council pipeline without paid provider calls.
