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
- `council/`: Python implementation and provider abstractions

## Safety Boundary

Fixture mode is the default public capstone path. It uses local fixture data and writes only local reports. Live mode is optional and requires user-provided keys.
