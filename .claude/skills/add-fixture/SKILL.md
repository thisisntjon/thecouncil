---
name: add-fixture
description: Scaffold a new deterministic Council fixture scenario — create fixtures/<name>.json, wire it into the demo-question list and launch.bat if needed, and add a tests/capstone_smoke.mjs assertion so it stays reproducible. Use when adding a new offline scenario or guardrail case to The Council.
disable-model-invocation: true
---

# Add a Council fixture scenario

Adds a new offline scenario to The Council. Argument (`$ARGUMENTS`) is a short description of the
scenario and/or its question. Keep everything **deterministic** — no randomness — because the smoke
test asserts exact strings and decision-score orderings.

## Steps

1. **Model an existing fixture first.** Read `fixtures/car_wash_fixture.json` (weighted scenario) or
   `fixtures/coffee_shop_fixture.json` (guardrail) as a template, and skim `lib/fixtureCouncil.mjs`
   (`runFixtureCouncil`, `verifyClaims`, `computeDecisionScores`) to match the expected shape.

2. **Write `fixtures/<name>.json`.** Use a unique `scenarioId`, a unique claim-id prefix (e.g. `cw`,
   `pc`, `cf`), 4 agents with `roleWeight`, claims with verdicts/confidence, and — for decision
   scenarios — the option set so `decisionScores` resolves a clear preferred option. Verify how the
   fixture is selected from a question (the engine maps questions → scenarios) and wire the new
   question in accordingly.

3. **Register the demo question** if the scenario should appear in the picker (the list backing
   `listDemoQuestions()`), so `npm run ui:fixture` and the demo surface it.

4. **Add a smoke-test assertion** in `tests/capstone_smoke.mjs`. For a guardrail, add an entry to the
   `guardrailScenarios` array (`question`, `scenarioId`, `claimPrefix`, `answerPattern`,
   `preferredOption`, `lowerOption`). For a richer scenario, add explicit `assert` calls mirroring the
   car-wash block (claim-id prefix, decision-score ordering, expected synthesis phrases).

5. **Optionally add a `launch.bat` shortcut** and an `npm run demo:<name>` script in `package.json`
   if the scenario deserves a one-command demo.

6. **Verify:** run `npm test`, then `npm run verify:capstone`. Both must pass before you're done.
   Reports land in `sample_outputs/` — confirm the new scenario renders.

## Guardrails

- Deterministic only — the same input must always produce the same report.
- Fixture mode stays offline: no API keys, no network calls.
- Don't break existing assertions; the smoke test pins exact strings and score orderings.
