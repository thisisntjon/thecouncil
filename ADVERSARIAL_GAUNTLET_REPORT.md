# Adversarial Gauntlet Report

Date: 2026-06-26

## Scope

Offline/no-key adversarial test set for The Council fixture path.

Artifacts:

- `tests/adversarial_questions.json`
- `tests/adversarial_gauntlet.mjs`
- `npm run test:adversarial`

The runner does not call live providers or web APIs. It checks:

- category coverage,
- input-risk classification for explicit prompt-injection/secret patterns,
- redaction of a fake API-key-shaped string,
- fixture-mode refusal for unsupported arbitrary prompts.

## Run Result

Command:

```bash
npm run test:adversarial
```

Result: **pass**

Output:

```json
{
  "ok": true,
  "cases": 30,
  "categories": 15,
  "unsupportedRefusals": 30,
  "highRiskChecks": 5,
  "redactionChecks": 1
}
```

## Category Coverage

| Category | Cases | Result |
| --- | ---: | --- |
| Prompt injection / instruction-data separation | 2 | Pass |
| Secret-exfiltration attempts | 2 | Pass |
| Ambiguous factual questions | 2 | Pass |
| Current/stale knowledge questions | 2 | Pass |
| Math traps | 2 | Pass |
| Logic puzzles | 2 | Pass |
| Ethical tradeoff dilemmas | 2 | Pass |
| Impossible or underspecified questions | 2 | Pass |
| Overconfident-answer traps | 2 | Pass |
| Contradictory evidence / uncertainty preservation | 2 | Pass |
| Long or malformed inputs | 2 | Pass |
| Requests to misrepresent fixture mode as live | 2 | Pass via fixture refusal |
| Requests to skip verification | 2 | Pass via fixture refusal and one explicit high-risk bypass hit |
| Requests to fabricate citations | 2 | Pass via fixture refusal |
| Questions where the correct answer is "I don't know" | 2 | Pass via fixture refusal |

## Findings

- Fixture mode correctly refuses all 30 arbitrary adversarial prompts because no offline fixture exists for them.
- Explicit prompt-injection and secret-exfiltration language is classified as high risk when it matches the current risk patterns.
- A fake `sk-...` key is redacted as `[REDACTED:api-key]`.
- The runner is intentionally lightweight and deterministic; it validates the official public no-key boundary rather than live answer quality.

## Weaknesses That Could Hurt Judging

- The risk classifier is keyword-based. It catches direct terms such as `ignore previous`, `system prompt`, `exfiltrate`, `reveal secrets`, and `bypass`, but it does not semantically classify every harmful intent.
- Requests to fabricate citations or misrepresent fixture mode are stopped by fixture-mode refusal, not by a dedicated semantic policy classifier.
- This gauntlet does not evaluate live-provider responses. That is consistent with the no-key public path, but it should not be marketed as proof of live model robustness.

## Fixes Applied

- Added `tests/adversarial_questions.json` with 30 cases across the requested 15 categories.
- Added `tests/adversarial_gauntlet.mjs`.
- Added `npm run test:adversarial`.

## Remaining Known Weaknesses

- Consider expanding `classifyInputRisk` later with semantic flags for citation fabrication, fixture misrepresentation, and verification-skipping language.
- True live-provider adversarial behavior remains out of scope for the official public fixture demo.

## Verdict

Adversarial gauntlet: **pass for offline fixture boundary**.

This improves judge confidence that the public fixture path refuses unsupported adversarial prompts instead of pretending to answer them live.
