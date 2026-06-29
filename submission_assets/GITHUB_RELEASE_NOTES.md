# GitHub Release Notes

## The Council: Multi-Agent Verification Swarm

This capstone release packages The Council as a live multi-agent verification swarm, with a deterministic no-key offline mode for reproducibility and CI.

Repository: `https://github.com/thisisntjon/thecouncil`

## Highlights

- **Live agent (the headline):** four frontier models (Claude, GPT, Gemini, Grok) answer independently and stream to a React UI, the Council convenes for peer evaluation + consensus, and a **cross-vendor verification swarm** re-checks every claim against a *different* vendor. Start with `launch.bat live`.
- Peer critique stage with consensus scoring.
- Final verdict preserves confidence and unresolved claims.
- Deterministic offline mode (`npm run demo:fixture`) reproduces the pipeline with no keys/network — what CI runs on; its evidence is simulated, not live results.
- JSON and Markdown audit reports under `sample_outputs/` (offline mode).
- Read-only MCP-style stub with self-test (a stub, not a production SDK server).
- Agent skill at `skills/council-verification/SKILL.md`.
- Public-safe screenshot helper pages under `screenshots/`.

## Run the live agent

```bash
cp .env.example .env        # add your own provider keys
launch.bat install-ui       # one-time dependency install
launch.bat live             # API + shadow verifier + UI on http://localhost:5173
```

See `docs/deploy.md` for the reproducible deploy path.

## Validate without keys

```bash
npm run demo:fixture
npm test
npm run secret:scan
npm run mcp:self-test
```

## Notes

`.env` is gitignored and only placeholder keys are committed (`secret:scan` enforces this). We do not host the live app publicly — it runs on private keys; the live agent is demonstrated in the submission video, and this repo plus `docs/deploy.md` is the project link.
