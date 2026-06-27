# Architecture

The Council has two layers:

1. Existing app layer: React/Vite UI, Express API, shadow-council server, and Python Council implementation.
2. Capstone fixture layer: no-key deterministic demo that simulates the full verification pipeline.

## Runtime Flow

```text
User question
  -> Input redaction and risk check
  -> Four independent Council agents
  -> Peer critique stage
  -> Hidden Verification Swarm
  -> Claim verification against fixture evidence
  -> Confidence summary
  -> Final synthesis
  -> JSON/Markdown audit export
```

## Important Files

- `fixtures/council_fixture.json`: public-safe fixture data
- `fixtures/car_wash_fixture.json`: weighted practical-reasoning fixture data
- `lib/security.mjs`: redaction, input-risk classification, tool allowlist
- `lib/fixtureCouncil.mjs`: deterministic offline Council pipeline
- `demo_fixture.mjs`: one-command fixture demo
- `mcp/server_stub.mjs`: read-only MCP-style tool stub
- `skills/council-verification/SKILL.md`: reusable agent skill
- `sample_outputs/`: generated reports

## Existing App Components

- `client/src/App.jsx`: React UI with visible Council and verification swarm surfaces
- `server/index.js`: optional live-provider Express API
- `shadow-council/index.js`: optional shadow verification service

## Model + Harness, Memory, Tools, Reproducibility

The model is ~10% of the system; the ~90% is the deterministic **harness** above (redaction, role orchestration, verification, synthesis). Three properties matter for review:

- **Memory** is explicit and auditable, not hidden: every run carries a run ID and emits a structured audit trail (`load_fixture` -> `redact_input` -> `extract_claims` -> `verify_claims_against_fixture` -> `write_audit_report`) rather than opaque state.
- **Tools** are bounded by a declared allowlist in `lib/security.mjs` (`load_fixture`, `redact_input`, `extract_claims`, `verify_claims_against_fixture`, `write_audit_report`); the agent cannot act outside it.
- **Reproducibility:** the fixture path is deterministic and writes atomically (temp file then rename), so re-running `npm run demo:fixture` reproduces identical verification content (only the run timestamp differs) — safe for grading and regression checks.

## Safety Boundary

Fixture mode is the default public capstone path. It uses local fixture data and writes only local reports. Live mode is optional and requires user-provided keys.

See `docs/mode-matrix.md` for the exact distinction between public fixture UI/CLI mode, optional live provider mode, main Express verification, and the optional Shadow Council server.

## Weighted Scenario

The car-wash fixture demonstrates deterministic weighted reasoning in the offline path. The Council assigns different role weights to intent framing, physical logistics, practical operation, and ambiguity review. The verification stage carries claim weights and option effects into decision scores so the physical requirement that the car must reach the wash outweighs the weaker fact that 50 meters is walkable.
