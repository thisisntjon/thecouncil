# GitHub Release Notes

## The Council: Multi-Agent Verification Swarm

This capstone release packages The Council as a public-safe, no-key, reproducible multi-agent verification demo.

Repository: `https://github.com/thisisntjon/thecouncil`

## Highlights

- Fixture/offline demo with no API keys required.
- Four independent Council agents.
- Peer critique stage.
- Hidden Verification Swarm fixture flow.
- Claim verification with confidence summary.
- JSON and Markdown audit reports under `sample_outputs/`.
- Read-only MCP-style fixture stub with self-test.
- Agent skill at `skills/council-verification/SKILL.md`.
- Public-safe screenshot helper pages under `screenshots/`.

## Validate Locally

```bash
npm run demo:fixture
npm test
npm run secret:scan
npm run mcp:self-test
```

## Notes

Fixture mode is simulated and is the recommended public demo path. Optional live provider mode remains disabled by default and requires user-supplied keys.
