# Architecture

The Council is a live multi-agent verification agent, with a no-key offline mode for reproducibility:

1. **Live agent (the project):** React/Vite UI → Express API orchestrating four frontier models (Claude, GPT, Gemini, Grok) → the `shadow-council` cross-vendor verifier (each claim re-checked by a *different* vendor).
2. **Offline reproducibility / CI:** a deterministic no-key engine (`lib/fixtureCouncil.mjs`) that replays the same pipeline with no keys or network — it powers `npm test`. Its evidence is simulated, not live results.

## Runtime Flow

```text
User question
  -> Input redaction and risk check
  -> Four independent Council agents
  -> Peer critique stage
  -> Hidden Verification Swarm
  -> Cross-vendor claim verification (fixture evidence in offline mode)
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

The live agent is the demo; it uses your own provider keys via a gitignored `.env`. A deterministic no-key fixture mode reproduces the same pipeline offline (it powers CI and lets a keyless reviewer run it); its data is simulated and written only to local reports — never presented as live results.

See `docs/mode-matrix.md` for the exact distinction between public fixture UI/CLI mode, optional live provider mode, main Express verification, and the optional Shadow Council server.

## Weighted Scenario

The car-wash fixture demonstrates deterministic weighted reasoning in the offline path. The Council assigns different role weights to intent framing, physical logistics, practical operation, and ambiguity review. The verification stage carries claim weights and option effects into decision scores so the physical requirement that the car must reach the wash outweighs the weaker fact that 50 meters is walkable.
