# Fixtures

This directory contains public-safe fixture data for the no-key offline reproducibility mode (used by the tests and by a keyless reviewer).

`council_fixture.json` is the council fixture replayed by the offline mode (its evidence is simulated). It includes:

- one safe demo question
- four Council agent responses
- peer-review records
- claim text
- fixture evidence
- verification verdicts

`car_wash_fixture.json` is an additional simulated/offline scenario fixture for weighted practical reasoning. It includes:

- one car-wash question
- four role-weighted Council agent responses
- swarm verifier roles
- claim and role weights
- option effects for `drive`, `walk`, and `caveat`
- decision scores and assumptions/caveats

The counterfactual guardrail fixtures check that the system does not overgeneralize the base car-wash recommendation:

- `car_wash_price_check_fixture.json`: checking price should recommend walking.
- `car_already_at_wash_fixture.json`: car already at the wash should recommend walking.
- `car_not_safe_to_drive_fixture.json`: unsafe-to-drive should recommend not driving.
- `coffee_shop_fixture.json`: an unrelated 50-meter destination should recommend walking.

The fixture is not live model output and is not web evidence. It exists so reviewers can reproduce the capstone flow without API keys or paid provider calls.
