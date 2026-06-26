# The Council: Multi-Agent Verification Swarm

**The Council turns one AI answer into a transparent deliberation: multiple agents answer independently, critique each other, trigger a hidden verification swarm, and produce an evidence-backed final response with an audit trail.**

Track: Freestyle

The public demo path is fixture/offline by default. It is simulated, reproducible, and does not require API keys or live provider calls.

## Quickstart

Install dependencies from the project files, then run the public fixture demo:

```bash
npm install
npm run demo:fixture
```

The demo writes:

- `sample_outputs/latest_fixture_report.json`
- `sample_outputs/latest_fixture_report.md`

## Required Validation Commands

Run these before publishing or submitting:

```bash
npm run demo:fixture
npm test
npm run secret:scan
npm run mcp:self-test
```

Direct MCP self-test equivalent:

```bash
node mcp/server_stub.mjs --self-test
```

## What The Demo Shows

The default question is:

> What are the tradeoffs between single-agent and multi-agent verification for AI-assisted decision making?

Expected result: four simulated Council agents answer independently, peer critique runs, a hidden verification swarm checks 12 fixture claims, and JSON/Markdown audit reports are exported. The final answer preserves confidence and unresolved-claim handling instead of hiding uncertainty.

## Architecture

```text
User Question
  -> Input Redaction / Risk Check
  -> Four Independent Council Agents
  -> Peer Critique
  -> Hidden Verification Swarm
  -> Claim Verification
  -> Confidence Summary
  -> Final Synthesis + Audit Export
```

See `ARCHITECTURE.md` and `docs/architecture.mmd`.

## Course Concepts Demonstrated

- Agent / multi-agent system: four Council agents, peer critique, hidden verification swarm, final synthesis
- Security features: no-key fixture mode, `.env` ignored, placeholders only, redaction helper, input-risk classification, tool allowlist, secret scan
- Deployability: one-command fixture demo, reproducible local commands, smoke tests
- Agent skills: `skills/council-verification/SKILL.md`
- MCP: small read-only MCP-style fixture stub at `mcp/server_stub.mjs`
- Evaluation / audit trail: JSON/Markdown report, verified claims, confidence summary, unresolved claims
- Spec-driven behavior: `specs/verification.feature`
- Operational readiness: `QUALITY_OF_LIFE_BASELINE.md` maps the fixture demo to practical run/debug/safety features

See `COURSE_CONCEPTS.md`.

## Screenshot Assets

Public-safe screenshot helper pages are in `screenshots/`:

- `screenshots/cover.html`
- `screenshots/architecture.html`
- `screenshots/demo-output.html`

Open those local HTML files in a browser and capture screenshots for Kaggle, GitHub, or the video. They contain only public-safe fixture content.

## Optional Live Provider Mode

Live provider mode is optional and disabled by default. To try it locally, copy `.env.example` to `.env`, add your own provider keys, install the client/server packages, and run the existing app servers.

Do not use live mode for the public capstone demo unless you intentionally want a live-provider walkthrough. Do not commit `.env`, credentials, screenshots of private accounts, or live run outputs.

## Repository Structure

```text
client/                         Existing React/Vite UI
server/                         Existing optional live Express API
shadow-council/                 Existing optional shadow verification server
council/                        Existing Python implementation
fixtures/                       Public-safe offline fixture data
lib/                            Fixture engine and security helper
mcp/                            Read-only MCP-style stub
skills/council-verification/    Reusable Council verification skill
sample_outputs/                 Generated fixture reports
screenshots/                    Public-safe screenshot helper pages
submission_assets/              Kaggle/GitHub submission helper docs
docs/                           Architecture and demo-flow docs
tests/                          Existing tests plus capstone smoke test
```

## Known Limitations

- Fixture mode is simulated; it demonstrates architecture, not live model quality.
- The MCP server is a small dependency-free stub, not a production MCP SDK server.
- Live provider mode needs user-supplied keys, provider availability, and separate review before public deployment.
- The existing UI is preserved, but the most reliable capstone review path is the offline fixture command.

## License Status

The copied source included an MIT-style `LICENSE`. See `LICENSE_REVIEW.md` before public release.
