# Security and Privacy

## Public-Safe Defaults

- The live agent uses your own provider keys via a gitignored `.env`; a deterministic no-key fixture mode reproduces the pipeline offline for keyless reviewers and CI.
- No keys are committed to the repo; `.env.example` has placeholders only.
- No work, customer, employer, legal, health, or private personal data is included in fixture data.
- `.env` and `.env.*` files are ignored.
- `.env.example` contains placeholders only.
- The public screenshot helper pages use only simulated fixture content.

## Live mode (the demo)

The live agent is the headline demo; it calls real providers with your own keys (supplied locally in a gitignored `.env`) and costs money per run. We deliberately do **not** host it on a public no-login endpoint — that would be an uncapped spend surface on our keys — so it is shown in the video and documented in `docs/deploy.md`.

## Prompt-Injection and Unsafe Input Handling

`lib/security.mjs` provides:

- redaction for API-key-shaped strings
- redaction for emails
- redaction for phone numbers
- input-risk classification for prompt-injection phrases
- a small fixture tool allowlist

This is a demo guardrail, not a complete DLP or security product.

## Redaction Behavior

The fixture runner redacts obvious sensitive patterns before placing the question in the report. It does not inspect private files or call external APIs.

## Failure Modes

- Redaction is pattern-based and can miss unusual secrets.
- Fixture evidence is simulated and should not be presented as live web evidence.
- The MCP stub is read-only and demo-oriented.
- Live provider mode must be reviewed separately before public deployment.

## Release Rule

Before publishing, run:

```bash
npm run demo:fixture
npm test
npm run secret:scan
npm run mcp:self-test
```

Also manually review screenshots, sample outputs, and generated reports.
