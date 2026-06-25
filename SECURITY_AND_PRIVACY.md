# Security and Privacy

## Public-Safe Defaults

- Fixture mode is default.
- No real API keys are required.
- No work, customer, employer, legal, health, or private personal data is included in fixture data.
- `.env` and `.env.*` files are ignored.
- `.env.example` contains placeholders only.
- The public screenshot helper pages use only simulated fixture content.

## Optional Live Mode

Live provider mode is optional. Users must provide their own keys locally. Live mode may cost money and may send prompts to external providers. Do not use live mode for the Kaggle demo unless you explicitly want a live provider walkthrough.

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
